"""360评价业务逻辑：互评关系匹配、在线评分、评分汇总、工作目标完成度"""
import random
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, delete, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import (
    ASSESS_TYPE_MANAGER, ASSESS_TYPE_PUBLIC,
    ASSESS_TYPE_BUSINESS, ASSESS_TYPE_RD,
    EVAL_DIMENSIONS, ROLE_LEADER,
)
from app.models.employee import Employee
from app.models.project import Project
from app.models.participation import Participation
from app.models.evaluation import EvalRelation, EvalScore, EvalSummary, WorkGoalScore


# ============================================================
# 一、互评关系自动匹配算法
# ============================================================

async def generate_eval_relations(db: AsyncSession, cycle_id: int) -> dict:
    """
    自动生成互评关系。

    规则（2026-04-21 调整）：
      - 业务/产研：4 同事（优先级：同项目项目经理 > 同项目其他成员 > 同组 > 同部门不同组）
                  + 上级领导（同组/中心的基层管理人员，多人） + 部门领导（同部门，多人）
      - 基层管理：部门员工（同组/中心全员，排除其他基层管理） + 全系统其他基层管理互评（全选）
                  + 部门领导（同部门，多人）
      - 公共人员：部门员工 6 人（同组 3 + 同部门不同组 3，不足互补；无组时全部同部门补）
                  + 部门领导（同部门，多人）

    "上级领导 / 部门领导 / 基层管理互评" 多人时各自独立作为评价人记录，
    在 calculate_eval_summaries 中按类型求平均。

    返回 {"created": int, "skipped_no_superior": [...], "skipped_no_dept_leader": [...]}。
    """
    # 清除旧数据：评分记录先删（避免外键残留），再删互评关系
    await db.execute(delete(EvalScore).where(EvalScore.cycle_id == cycle_id))
    await db.execute(delete(EvalRelation).where(EvalRelation.cycle_id == cycle_id))
    await db.flush()

    # 加载本周期所有活跃员工
    result = await db.execute(
        select(Employee).where(
            Employee.cycle_id == cycle_id,
            Employee.is_active == True,
        )
    )
    employees = result.scalars().all()

    # 索引
    emp_map = {e.id: e for e in employees}
    group_map: dict[tuple[str, str], list] = {}      # (dept, group_key) -> [emp]
    dept_employees: dict[str, list] = {}             # dept -> [emp]
    dept_leaders: dict[str, list] = {}               # dept -> [role=领导 emp]
    group_managers: dict[tuple[str, str], list] = {} # (dept, group_key) -> [基层管理 emp]
    all_managers: list = []                          # 全系统基层管理

    for e in employees:
        gk = e.group_name or ""
        group_map.setdefault((e.department, gk), []).append(e)
        dept_employees.setdefault(e.department, []).append(e)
        if e.role == ROLE_LEADER:
            dept_leaders.setdefault(e.department, []).append(e)
        if e.assess_type == ASSESS_TYPE_MANAGER:
            group_managers.setdefault((e.department, gk), []).append(e)
            all_managers.append(e)

    # 项目：pm_id 用于"同项目项目经理"优先级
    proj_result = await db.execute(
        select(Project).where(Project.cycle_id == cycle_id)
    )
    projects = proj_result.scalars().all()
    project_pms: dict[int, int] = {p.id: p.pm_id for p in projects if p.pm_id}

    # 参与度：emp_id -> projects / project_id -> members
    part_result = await db.execute(
        select(Participation).where(Participation.cycle_id == cycle_id)
    )
    participations = part_result.scalars().all()
    emp_projects: dict[int, set] = {}
    project_members: dict[int, set] = {}
    for p in participations:
        emp_projects.setdefault(p.employee_id, set()).add(p.project_id)
        project_members.setdefault(p.project_id, set()).add(p.employee_id)

    # ---- 跨类型去重用的 ID 集合 ----
    # 所有 role=领导 的 ID（部门领导池来源，不应再进同事池）
    all_leader_ids: set = {
        l.id for lst in dept_leaders.values() for l in lst
    }
    # 所有基层管理人员 ID（上级领导/基层管理互评池来源，不应进业务/产研的同事池）
    all_manager_ids: set = {m.id for m in all_managers}
    # 业务/产研的同事池排除：领导 + 基层管理
    business_peer_exclude = all_leader_ids | all_manager_ids
    # 公共人员的同事池排除：领导
    public_peer_exclude = all_leader_ids

    created = 0
    skipped_no_superior: list = []
    skipped_no_dept_leader: list = []

    def _add_relation(evaluatee, evaluator, evaluator_type, order=0):
        nonlocal created
        db.add(EvalRelation(
            cycle_id=cycle_id,
            evaluatee_id=evaluatee.id,
            evaluatee_name=evaluatee.name,
            evaluatee_assess_type=evaluatee.assess_type,
            evaluator_id=evaluator.id,
            evaluator_name=evaluator.name,
            evaluator_type=evaluator_type,
            evaluator_order=order,
        ))
        created += 1

    for emp in employees:
        assess_type = emp.assess_type
        gk = emp.group_name or ""

        # ---- 同部门领导（三类考核共用） ----
        dleaders = [l for l in dept_leaders.get(emp.department, []) if l.id != emp.id]

        if assess_type in (ASSESS_TYPE_BUSINESS, ASSESS_TYPE_RD):
            # 4 名同事（同事池排除所有领导 + 基层管理人员，避免与"部门领导"/"上级领导"重复）
            colleagues = _pick_business_colleagues(
                emp, emp_map, emp_projects, project_members, project_pms,
                group_map, dept_employees,
                excluded_ids=business_peer_exclude, count=4,
            )
            for order, col in enumerate(colleagues, 1):
                _add_relation(emp, col, "同事", order)

            # 上级领导：同组/中心基层管理；fallback 部门内其他组基层管理
            superiors = [m for m in group_managers.get((emp.department, gk), []) if m.id != emp.id]
            if not superiors:
                superiors = [
                    m for m in all_managers
                    if m.department == emp.department and m.id != emp.id
                ]
            if superiors:
                for s in superiors:
                    _add_relation(emp, s, "上级领导", 0)
            else:
                skipped_no_superior.append(emp.name)

            # 部门领导：同部门 role=领导 全选
            if dleaders:
                for l in dleaders:
                    _add_relation(emp, l, "部门领导", 0)
            else:
                skipped_no_dept_leader.append(emp.name)

        elif assess_type == ASSESS_TYPE_MANAGER:
            # 部门员工：本人所在组/中心全员（排除本人、其他基层管理人员、部门领导）
            group_subs = [
                m for m in group_map.get((emp.department, gk), [])
                if m.id != emp.id
                and m.assess_type != ASSESS_TYPE_MANAGER
                and m.id not in all_leader_ids
            ]
            for order, sub in enumerate(group_subs, 1):
                _add_relation(emp, sub, "部门员工", order)

            # 基层管理互评：全系统其他基层管理人员（全选）
            for m in all_managers:
                if m.id == emp.id:
                    continue
                _add_relation(emp, m, "基层管理互评", 0)

            # 部门领导
            if dleaders:
                for l in dleaders:
                    _add_relation(emp, l, "部门领导", 0)
            else:
                skipped_no_dept_leader.append(emp.name)

        elif assess_type == ASSESS_TYPE_PUBLIC:
            # 部门员工：6 人，同组 3 + 同部门不同组 3，不足互补（排除部门领导）
            peers = _pick_public_peers(
                emp, group_map, dept_employees,
                excluded_ids=public_peer_exclude, target=6, half=3,
            )
            for order, sub in enumerate(peers, 1):
                _add_relation(emp, sub, "部门员工", order)

            # 部门领导
            if dleaders:
                for l in dleaders:
                    _add_relation(emp, l, "部门领导", 0)
            else:
                skipped_no_dept_leader.append(emp.name)

        # 领导 / 管理员等无考核类型的员工不参与互评生成

    await db.flush()
    return {
        "created": created,
        "skipped_no_superior": skipped_no_superior,
        "skipped_no_dept_leader": skipped_no_dept_leader,
    }


def _pick_business_colleagues(
    emp, emp_map, emp_projects, project_members, project_pms,
    group_map, dept_employees, excluded_ids: set | None = None, count: int = 4,
) -> list:
    """
    为业务人员/产品研发人员挑选同事评价人（最多count人）。
    优先级：
      1. 同项目项目经理（我所参与项目的 PM，不含自己）
      2. 同项目其他成员（跨部门允许）
      3. 同部门 + 同组
      4. 同部门 + 不同组
    excluded_ids: 不应进入同事池的员工 ID（通常是全部 role=领导 和 assess_type=基层管理人员，
                  他们分别走"部门领导" / "上级领导"通道，避免同一人同时作为同事评价出现）。
    """
    chosen_ids: set = set()
    chosen: list = []
    excluded = excluded_ids or set()

    def _add(candidate):
        if not candidate:
            return
        if (candidate.id != emp.id
                and candidate.id not in chosen_ids
                and candidate.id not in excluded):
            chosen_ids.add(candidate.id)
            chosen.append(candidate)

    my_projects = list(emp_projects.get(emp.id, set()))

    # 优先级1：同项目 PM（本人若为 PM 自然被过滤）
    pm_candidates = []
    for pid in my_projects:
        pm_id = project_pms.get(pid)
        pm = emp_map.get(pm_id) if pm_id else None
        if pm:
            pm_candidates.append(pm)
    random.shuffle(pm_candidates)
    for c in pm_candidates:
        if len(chosen) >= count:
            break
        _add(c)

    # 优先级2：同项目其他成员（跨部门允许）
    if len(chosen) < count:
        project_colleagues: list = []
        for pid in my_projects:
            for mid in project_members.get(pid, set()):
                c = emp_map.get(mid)
                if c and c.id != emp.id and c.id not in chosen_ids:
                    project_colleagues.append(c)
        random.shuffle(project_colleagues)
        for c in project_colleagues:
            if len(chosen) >= count:
                break
            _add(c)

    # 优先级3：同部门同组
    if len(chosen) < count:
        gk = emp.group_name or ""
        group_members = group_map.get((emp.department, gk), [])
        candidates = [m for m in group_members if m.id != emp.id and m.id not in chosen_ids]
        random.shuffle(candidates)
        for c in candidates:
            if len(chosen) >= count:
                break
            _add(c)

    # 优先级4：同部门不同组
    if len(chosen) < count:
        gk = emp.group_name or ""
        dept_pool = dept_employees.get(emp.department, [])
        candidates = [
            m for m in dept_pool
            if m.id != emp.id and m.id not in chosen_ids
            and (m.group_name or "") != gk
        ]
        random.shuffle(candidates)
        for c in candidates:
            if len(chosen) >= count:
                break
            _add(c)

    return chosen[:count]


def _pick_public_peers(
    emp, group_map, dept_employees,
    excluded_ids: set | None = None, target: int = 6, half: int = 3,
) -> list:
    """
    为公共人员挑选部门员工评价人。
    规则：同组 half 人 + 同部门不同组 half 人，任一侧不足时由另一侧补足；
         若员工没有组/中心，则全部从同部门员工中随机抽取。
    excluded_ids: 不应进入同事池的员工 ID（通常是全部 role=领导，他们走"部门领导"通道）。
    """
    gk = emp.group_name or ""
    excluded = excluded_ids or set()

    def _not_excluded(m):
        return m.id != emp.id and m.id not in excluded

    if not gk:
        # 无组/中心：直接在同部门内随机抽
        pool = [m for m in dept_employees.get(emp.department, []) if _not_excluded(m)]
        random.shuffle(pool)
        return pool[:target]

    # 同组候选（排除本人、部门领导）
    same_group = [m for m in group_map.get((emp.department, gk), []) if _not_excluded(m)]
    # 同部门不同组候选
    diff_group = [
        m for m in dept_employees.get(emp.department, [])
        if _not_excluded(m) and (m.group_name or "") != gk
    ]
    random.shuffle(same_group)
    random.shuffle(diff_group)

    sg_pick = same_group[:half]
    dg_pick = diff_group[:half]

    # 任一侧不足，从另一侧补到 target
    if len(sg_pick) < half:
        need = half - len(sg_pick)
        extra = diff_group[len(dg_pick):len(dg_pick) + need]
        dg_pick = dg_pick + extra
    if len(dg_pick) < half:
        need = half - len(dg_pick)
        extra = same_group[len(sg_pick):len(sg_pick) + need]
        sg_pick = sg_pick + extra

    result = sg_pick + dg_pick
    # 整体不足 target：同部门剩余再补
    if len(result) < target:
        chosen_ids = {m.id for m in result}
        fillers = [
            m for m in dept_employees.get(emp.department, [])
            if _not_excluded(m) and m.id not in chosen_ids
        ]
        random.shuffle(fillers)
        result.extend(fillers[:target - len(result)])
    return result[:target]


# ============================================================
# 二、互评关系查询与管理
# ============================================================

async def get_eval_relations(
    db: AsyncSession,
    cycle_id: int,
    evaluatee_id: Optional[int] = None,
    evaluatee_name: Optional[str] = None,
    evaluator_type: Optional[str] = None,
    department: Optional[str] = None,
) -> list:
    """查询互评关系列表"""
    query = select(EvalRelation).where(EvalRelation.cycle_id == cycle_id)
    if evaluatee_id:
        query = query.where(EvalRelation.evaluatee_id == evaluatee_id)
    if evaluatee_name:
        query = query.where(EvalRelation.evaluatee_name.contains(evaluatee_name))
    if evaluator_type:
        query = query.where(EvalRelation.evaluator_type == evaluator_type)
    # 部门筛选需联表
    if department:
        query = query.join(
            Employee, EvalRelation.evaluatee_id == Employee.id
        ).where(Employee.department == department)
    query = query.order_by(EvalRelation.evaluatee_id, EvalRelation.evaluator_type, EvalRelation.evaluator_order)
    result = await db.execute(query)
    return result.scalars().all()


async def update_eval_relation(
    db: AsyncSession,
    relation_id: int,
    new_evaluator_id: int,
    new_evaluator_name: str,
) -> EvalRelation:
    """管理员修改互评关系中的评价人"""
    result = await db.execute(
        select(EvalRelation).where(EvalRelation.id == relation_id)
    )
    relation = result.scalar_one_or_none()
    if relation is None:
        raise ValueError("互评关系不存在")

    # 校验新评价人存在
    emp_result = await db.execute(
        select(Employee).where(Employee.id == new_evaluator_id)
    )
    emp = emp_result.scalar_one_or_none()
    if emp is None:
        raise ValueError("评价人不存在")

    relation.evaluator_id = new_evaluator_id
    relation.evaluator_name = new_evaluator_name
    # 如果之前已完成评分，修改评价人后重置
    if relation.is_completed:
        relation.is_completed = False
        # 删除旧评分记录
        await db.execute(
            delete(EvalScore).where(EvalScore.relation_id == relation_id)
        )
    await db.flush()
    return relation


async def get_my_eval_tasks(
    db: AsyncSession,
    cycle_id: int,
    evaluator_id: int,
) -> list:
    """获取当前用户需要完成的评价任务"""
    result = await db.execute(
        select(EvalRelation).where(
            EvalRelation.cycle_id == cycle_id,
            EvalRelation.evaluator_id == evaluator_id,
        ).order_by(EvalRelation.is_completed, EvalRelation.evaluatee_name)
    )
    return result.scalars().all()


# ============================================================
# 三、在线评分
# ============================================================

async def submit_eval_scores(
    db: AsyncSession,
    relation_id: int,
    scores: list,
    evaluator_id: int,
) -> list:
    """
    提交评分。
    scores: [{"dimension": str, "max_score": Decimal, "score": Decimal}, ...]
    """
    # 校验互评关系
    result = await db.execute(
        select(EvalRelation).where(EvalRelation.id == relation_id)
    )
    relation = result.scalar_one_or_none()
    if relation is None:
        raise ValueError("互评关系不存在")
    if relation.evaluator_id != evaluator_id:
        raise ValueError("无权为此关系评分")
    if relation.is_completed:
        raise ValueError("该评分已提交，不可重复提交")

    # 校验评分维度与分值
    expected_dims = EVAL_DIMENSIONS.get(relation.evaluatee_assess_type, {})
    for s in scores:
        dim = s["dimension"]
        if dim not in expected_dims:
            raise ValueError(f"无效的评分维度: {dim}")
        max_s = Decimal(str(expected_dims[dim]))
        if s["max_score"] != max_s:
            raise ValueError(f"维度 {dim} 满分应为 {max_s}")
        if s["score"] < 0 or s["score"] > max_s:
            raise ValueError(f"维度 {dim} 评分应在 0~{max_s} 之间")

    # 检查是否提交了所有维度
    submitted_dims = {s["dimension"] for s in scores}
    missing = set(expected_dims.keys()) - submitted_dims
    if missing:
        raise ValueError(f"缺少评分维度: {', '.join(missing)}")

    # 删除该关系已有评分（防止部分写入）
    await db.execute(
        delete(EvalScore).where(EvalScore.relation_id == relation_id)
    )

    records = []
    for s in scores:
        record = EvalScore(
            cycle_id=relation.cycle_id,
            relation_id=relation_id,
            evaluatee_id=relation.evaluatee_id,
            evaluator_id=evaluator_id,
            dimension=s["dimension"],
            max_score=s["max_score"],
            score=s["score"],
        )
        db.add(record)
        records.append(record)

    # 标记关系为已完成
    relation.is_completed = True
    await db.flush()
    return records


async def get_eval_scores_by_relation(
    db: AsyncSession,
    relation_id: int,
) -> list:
    """查询某个互评关系的评分详情"""
    result = await db.execute(
        select(EvalScore).where(EvalScore.relation_id == relation_id)
        .order_by(EvalScore.id)
    )
    return result.scalars().all()


async def admin_reset_eval_score(
    db: AsyncSession,
    relation_id: int,
) -> EvalRelation:
    """管理员重置某个互评关系的评分，允许重新评分"""
    result = await db.execute(
        select(EvalRelation).where(EvalRelation.id == relation_id)
    )
    relation = result.scalar_one_or_none()
    if relation is None:
        raise ValueError("互评关系不存在")

    await db.execute(
        delete(EvalScore).where(EvalScore.relation_id == relation_id)
    )
    relation.is_completed = False
    await db.flush()
    return relation


# ============================================================
# 四、评分汇总计算
# ============================================================

async def calculate_eval_summaries(db: AsyncSession, cycle_id: int) -> int:
    """
    汇总计算所有人的360评价得分。

    加权规则：
      业务人员:     同事均分×40% + 上级领导均分×30% + 部门领导均分×30%
      产品研发人员: 同事均分×30% + 上级领导均分×40% + 部门领导均分×30%
      基层管理人员: 部门员工均分×30% + 基层管理互评均分×30% + 部门领导均分×40%
      公共人员:     部门员工均分×50% + 部门领导均分×50%
    最终得分 = 加权总分 / 100 × 30

    说明：所有"均分"均对互评关系中相应 evaluator_type 的评价人取平均，
    包括未完成评分者按 0 参与平均（与旧口径一致）。
    """
    # 清除旧汇总
    await db.execute(delete(EvalSummary).where(EvalSummary.cycle_id == cycle_id))

    # 获取所有互评关系
    rel_result = await db.execute(
        select(EvalRelation).where(EvalRelation.cycle_id == cycle_id)
    )
    all_relations = rel_result.scalars().all()

    evaluatee_relations: dict[int, list] = {}
    for r in all_relations:
        evaluatee_relations.setdefault(r.evaluatee_id, []).append(r)

    # 评分记录：relation_id -> 该评价人对被评人的总分
    score_result = await db.execute(
        select(EvalScore).where(EvalScore.cycle_id == cycle_id)
    )
    all_scores = score_result.scalars().all()
    relation_total: dict[int, Decimal] = {}
    for s in all_scores:
        relation_total[s.relation_id] = relation_total.get(
            s.relation_id, Decimal("0")
        ) + (s.score or Decimal("0"))

    # 员工信息
    emp_result = await db.execute(
        select(Employee).where(Employee.cycle_id == cycle_id)
    )
    emp_map = {e.id: e for e in emp_result.scalars().all()}

    def _avg(lst):
        if not lst:
            return Decimal("0")
        return sum(lst) / len(lst)

    # 业务/产研 的同事标签为"同事"，基层管理/公共 的同事标签为"部门员工"
    peer_types = {"同事", "部门员工"}

    count = 0
    for evaluatee_id, relations in evaluatee_relations.items():
        emp = emp_map.get(evaluatee_id)
        if not emp:
            continue

        assess_type = emp.assess_type

        # 按评价人类型分组
        type_scores: dict[str, list] = {}
        peer_scores: list = []
        for r in relations:
            total = relation_total.get(r.id, Decimal("0"))
            type_scores.setdefault(r.evaluator_type, []).append(total)
            if r.evaluator_type in peer_types:
                peer_scores.append(total)

        colleague_avg = _avg(peer_scores)
        colleague_count = len(peer_scores)
        superior_score = _avg(type_scores.get("上级领导", []))
        dept_leader_score = _avg(type_scores.get("部门领导", []))
        manager_mutual_score = _avg(type_scores.get("基层管理互评", []))

        if assess_type == ASSESS_TYPE_BUSINESS:
            weighted = (
                colleague_avg * Decimal("0.4")
                + superior_score * Decimal("0.3")
                + dept_leader_score * Decimal("0.3")
            )
        elif assess_type == ASSESS_TYPE_RD:
            weighted = (
                colleague_avg * Decimal("0.3")
                + superior_score * Decimal("0.4")
                + dept_leader_score * Decimal("0.3")
            )
        elif assess_type == ASSESS_TYPE_MANAGER:
            weighted = (
                colleague_avg * Decimal("0.3")
                + manager_mutual_score * Decimal("0.3")
                + dept_leader_score * Decimal("0.4")
            )
        elif assess_type == ASSESS_TYPE_PUBLIC:
            weighted = (
                colleague_avg * Decimal("0.5")
                + dept_leader_score * Decimal("0.5")
            )
        else:
            weighted = Decimal("0")

        weighted = weighted.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        final = (weighted / Decimal("100") * Decimal("30")).quantize(
            Decimal("0.01"), rounding=ROUND_HALF_UP
        )

        summary = EvalSummary(
            cycle_id=cycle_id,
            employee_id=evaluatee_id,
            employee_name=emp.name,
            department=emp.department,
            position=emp.position,
            assess_type=assess_type,
            colleague_avg_score=colleague_avg.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            colleague_count=colleague_count,
            superior_score=superior_score.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            dept_leader_score=dept_leader_score.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            manager_mutual_score=manager_mutual_score.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            weighted_total=weighted,
            final_score=final,
        )
        db.add(summary)
        count += 1

    await db.flush()
    return count


async def get_eval_summaries(
    db: AsyncSession,
    cycle_id: int,
    employee_name: Optional[str] = None,
    department: Optional[str] = None,
    assess_type: Optional[str] = None,
) -> list:
    """查询评分汇总"""
    query = select(EvalSummary).where(EvalSummary.cycle_id == cycle_id)
    if employee_name:
        query = query.where(EvalSummary.employee_name.contains(employee_name))
    if department:
        query = query.where(EvalSummary.department == department)
    if assess_type:
        query = query.where(EvalSummary.assess_type == assess_type)
    query = query.order_by(EvalSummary.department, EvalSummary.employee_name)
    result = await db.execute(query)
    return result.scalars().all()


# ============================================================
# 五、工作目标完成度评分（领导 → 公共人员）
# ============================================================

async def get_public_employees_for_leader(
    db: AsyncSession,
    cycle_id: int,
    leader_id: int,
    all_departments: bool = False,
) -> list:
    """获取打分对象列表。

    - 领导：同部门公共人员
    - 管理员（all_departments=True）：所有部门公共人员
    """
    query = select(Employee).where(
        Employee.cycle_id == cycle_id,
        Employee.assess_type == ASSESS_TYPE_PUBLIC,
        Employee.is_active == True,
        Employee.id != leader_id,
    )

    if not all_departments:
        leader_result = await db.execute(
            select(Employee).where(Employee.id == leader_id)
        )
        leader = leader_result.scalar_one_or_none()
        if leader is None:
            raise ValueError("领导不存在")
        query = query.where(Employee.department == leader.department)

    query = query.order_by(Employee.department, Employee.name)
    result = await db.execute(query)
    return result.scalars().all()


async def save_work_goal_score(
    db: AsyncSession,
    cycle_id: int,
    leader_id: int,
    employee_id: int,
    score: Decimal,
    comment: Optional[str] = None,
) -> WorkGoalScore:
    """保存/更新工作目标完成度评分"""
    # 校验被评人是公共人员
    emp_result = await db.execute(
        select(Employee).where(Employee.id == employee_id)
    )
    emp = emp_result.scalar_one_or_none()
    if emp is None:
        raise ValueError("员工不存在")
    if emp.assess_type != ASSESS_TYPE_PUBLIC:
        raise ValueError("该员工不是公共人员，不需要工作目标完成度评分")

    # 校验分数范围
    if score < 0 or score > 70:
        raise ValueError("工作目标完成度得分应在 0~70 之间")

    # 查找已有记录
    result = await db.execute(
        select(WorkGoalScore).where(
            WorkGoalScore.cycle_id == cycle_id,
            WorkGoalScore.employee_id == employee_id,
            WorkGoalScore.leader_id == leader_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.score = score
        existing.comment = comment
        await db.flush()
        return existing
    else:
        record = WorkGoalScore(
            cycle_id=cycle_id,
            employee_id=employee_id,
            leader_id=leader_id,
            score=score,
            comment=comment,
        )
        db.add(record)
        await db.flush()
        return record


async def get_work_goal_scores(
    db: AsyncSession,
    cycle_id: int,
    employee_id: Optional[int] = None,
    leader_id: Optional[int] = None,
) -> list:
    """查询工作目标完成度评分"""
    query = select(WorkGoalScore).where(WorkGoalScore.cycle_id == cycle_id)
    if employee_id:
        query = query.where(WorkGoalScore.employee_id == employee_id)
    if leader_id:
        query = query.where(WorkGoalScore.leader_id == leader_id)
    query = query.order_by(WorkGoalScore.employee_id)
    result = await db.execute(query)
    return result.scalars().all()


# ============================================================
# 六、导出互评关系与评分汇总
# ============================================================

async def export_eval_relations_data(db: AsyncSession, cycle_id: int) -> list:
    """导出互评关系数据（用于Excel导出）"""
    return await get_eval_relations(db, cycle_id)


async def export_eval_summaries_data(db: AsyncSession, cycle_id: int) -> list:
    """导出评分汇总数据（用于Excel导出）"""
    return await get_eval_summaries(db, cycle_id)


async def get_eval_progress(db: AsyncSession, cycle_id: int) -> dict:
    """获取评价进度统计"""
    # 总关系数
    total_result = await db.execute(
        select(func.count(EvalRelation.id)).where(
            EvalRelation.cycle_id == cycle_id
        )
    )
    total = total_result.scalar() or 0

    # 已完成数
    completed_result = await db.execute(
        select(func.count(EvalRelation.id)).where(
            EvalRelation.cycle_id == cycle_id,
            EvalRelation.is_completed == True,
        )
    )
    completed = completed_result.scalar() or 0

    return {
        "total": total,
        "completed": completed,
        "pending": total - completed,
        "progress": round(completed / total * 100, 1) if total > 0 else 0,
    }
