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
from app.models.participation import Participation
from app.models.evaluation import EvalRelation, EvalScore, EvalSummary, WorkGoalScore


# ============================================================
# 一、互评关系自动匹配算法
# ============================================================

async def generate_eval_relations(db: AsyncSession, cycle_id: int) -> dict:
    """
    自动生成互评关系。
    返回 {"created": int, "skipped_no_leader": [...]} 统计信息。
    """
    # 清除旧数据
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

    # 按部门、组、考核类型建索引
    emp_map = {e.id: e for e in employees}
    dept_group_map: dict[str, dict[str, list]] = {}  # dept -> group -> [emp]
    dept_employees: dict[str, list] = {}  # dept -> [emp]
    dept_leaders: dict[str, list] = {}  # dept -> [leader_emp]
    managers_by_dept: dict[str, list] = {}  # dept -> [manager_emp]

    for e in employees:
        dept_employees.setdefault(e.department, []).append(e)
        dept_group_map.setdefault(e.department, {}).setdefault(e.group_name or "", []).append(e)
        if e.role == ROLE_LEADER:
            dept_leaders.setdefault(e.department, []).append(e)
        if e.assess_type == ASSESS_TYPE_MANAGER:
            managers_by_dept.setdefault(e.department, []).append(e)

    # 加载项目参与关系（用于同事匹配优先级1）
    part_result = await db.execute(
        select(Participation).where(Participation.cycle_id == cycle_id)
    )
    participations = part_result.scalars().all()
    # emp_id -> set of project_ids
    emp_projects: dict[int, set] = {}
    # project_id -> set of emp_ids
    project_members: dict[int, set] = {}
    for p in participations:
        emp_projects.setdefault(p.employee_id, set()).add(p.project_id)
        project_members.setdefault(p.project_id, set()).add(p.employee_id)

    created = 0
    skipped_no_leader = []

    for emp in employees:
        assess_type = emp.assess_type

        if assess_type in (ASSESS_TYPE_BUSINESS, ASSESS_TYPE_RD):
            # ---- 业务人员 / 产品研发人员 ----
            # 4个同事评价人
            colleagues = _pick_colleagues(
                emp, employees, emp_map, emp_projects, project_members,
                dept_group_map, dept_employees, count=4,
            )
            for order, col in enumerate(colleagues, 1):
                db.add(EvalRelation(
                    cycle_id=cycle_id,
                    evaluatee_id=emp.id,
                    evaluatee_name=emp.name,
                    evaluatee_assess_type=assess_type,
                    evaluator_id=col.id,
                    evaluator_name=col.name,
                    evaluator_type="同事",
                    evaluator_order=order,
                ))
                created += 1

            # 上级领导（部门内领导角色）
            leaders = dept_leaders.get(emp.department, [])
            leaders = [l for l in leaders if l.id != emp.id]
            if leaders:
                db.add(EvalRelation(
                    cycle_id=cycle_id,
                    evaluatee_id=emp.id,
                    evaluatee_name=emp.name,
                    evaluatee_assess_type=assess_type,
                    evaluator_id=leaders[0].id,
                    evaluator_name=leaders[0].name,
                    evaluator_type="上级领导",
                    evaluator_order=0,
                ))
                created += 1
            else:
                skipped_no_leader.append(emp.name)

            # 部门领导（取部门内第一个领导，如与上级领导相同则取第二个）
            dept_leader = _pick_dept_leader(emp, leaders)
            if dept_leader:
                db.add(EvalRelation(
                    cycle_id=cycle_id,
                    evaluatee_id=emp.id,
                    evaluatee_name=emp.name,
                    evaluatee_assess_type=assess_type,
                    evaluator_id=dept_leader.id,
                    evaluator_name=dept_leader.name,
                    evaluator_type="部门领导",
                    evaluator_order=0,
                ))
                created += 1

        elif assess_type == ASSESS_TYPE_MANAGER:
            # ---- 基层管理人员 ----
            # 部门员工评分：从本部门下属中选4人
            subordinates = [
                e for e in dept_employees.get(emp.department, [])
                if e.id != emp.id and e.assess_type != ASSESS_TYPE_MANAGER
            ]
            chosen_subs = _sample_up_to(subordinates, 4)
            for order, sub in enumerate(chosen_subs, 1):
                db.add(EvalRelation(
                    cycle_id=cycle_id,
                    evaluatee_id=emp.id,
                    evaluatee_name=emp.name,
                    evaluatee_assess_type=assess_type,
                    evaluator_id=sub.id,
                    evaluator_name=sub.name,
                    evaluator_type="部门员工",
                    evaluator_order=order,
                ))
                created += 1

            # 基层管理互评：其他基层管理人员
            other_managers = [
                m for m in managers_by_dept.get(emp.department, [])
                if m.id != emp.id
            ]
            for m in other_managers:
                db.add(EvalRelation(
                    cycle_id=cycle_id,
                    evaluatee_id=emp.id,
                    evaluatee_name=emp.name,
                    evaluatee_assess_type=assess_type,
                    evaluator_id=m.id,
                    evaluator_name=m.name,
                    evaluator_type="基层管理互评",
                    evaluator_order=0,
                ))
                created += 1

            # 部门领导
            leaders = dept_leaders.get(emp.department, [])
            leaders = [l for l in leaders if l.id != emp.id]
            if leaders:
                db.add(EvalRelation(
                    cycle_id=cycle_id,
                    evaluatee_id=emp.id,
                    evaluatee_name=emp.name,
                    evaluatee_assess_type=assess_type,
                    evaluator_id=leaders[0].id,
                    evaluator_name=leaders[0].name,
                    evaluator_type="部门领导",
                    evaluator_order=0,
                ))
                created += 1
            else:
                skipped_no_leader.append(emp.name)

        elif assess_type == ASSESS_TYPE_PUBLIC:
            # ---- 公共人员 ----
            # 部门员工评分：从本部门选4人
            dept_emps = [
                e for e in dept_employees.get(emp.department, [])
                if e.id != emp.id
            ]
            chosen_emps = _sample_up_to(dept_emps, 4)
            for order, sub in enumerate(chosen_emps, 1):
                db.add(EvalRelation(
                    cycle_id=cycle_id,
                    evaluatee_id=emp.id,
                    evaluatee_name=emp.name,
                    evaluatee_assess_type=assess_type,
                    evaluator_id=sub.id,
                    evaluator_name=sub.name,
                    evaluator_type="部门员工",
                    evaluator_order=order,
                ))
                created += 1

            # 部门领导
            leaders = dept_leaders.get(emp.department, [])
            leaders = [l for l in leaders if l.id != emp.id]
            if leaders:
                db.add(EvalRelation(
                    cycle_id=cycle_id,
                    evaluatee_id=emp.id,
                    evaluatee_name=emp.name,
                    evaluatee_assess_type=assess_type,
                    evaluator_id=leaders[0].id,
                    evaluator_name=leaders[0].name,
                    evaluator_type="部门领导",
                    evaluator_order=0,
                ))
                created += 1
            else:
                skipped_no_leader.append(emp.name)

    await db.flush()
    return {"created": created, "skipped_no_leader": skipped_no_leader}


def _pick_colleagues(
    emp, all_employees, emp_map, emp_projects, project_members,
    dept_group_map, dept_employees, count: int = 4,
) -> list:
    """
    为业务人员/产品研发人员挑选同事评价人（最多count人）。
    优先级：1.同部门同项目 2.同组 3.同部门不同组
    """
    chosen_ids: set = set()
    chosen: list = []

    def _add(candidate):
        if candidate.id not in chosen_ids and candidate.id != emp.id:
            chosen_ids.add(candidate.id)
            chosen.append(candidate)

    # 优先级1：同部门、同项目参与者
    my_projects = emp_projects.get(emp.id, set())
    project_colleagues = []
    for pid in my_projects:
        for mid in project_members.get(pid, set()):
            c = emp_map.get(mid)
            if c and c.id != emp.id and c.department == emp.department and c.id not in chosen_ids:
                project_colleagues.append(c)
    # 从不同项目各取一人
    seen_projects = set()
    for pid in my_projects:
        if len(chosen) >= count:
            break
        members = [
            emp_map[mid] for mid in project_members.get(pid, set())
            if mid in emp_map and mid != emp.id
            and emp_map[mid].department == emp.department
            and mid not in chosen_ids
        ]
        if members:
            _add(random.choice(members))
            seen_projects.add(pid)
    # 如果不够，从剩余项目同事中补
    remaining = [c for c in project_colleagues if c.id not in chosen_ids]
    random.shuffle(remaining)
    for c in remaining:
        if len(chosen) >= count:
            break
        _add(c)

    # 优先级2：同组员工
    if len(chosen) < count:
        group = emp.group_name or ""
        group_members = dept_group_map.get(emp.department, {}).get(group, [])
        candidates = [m for m in group_members if m.id != emp.id and m.id not in chosen_ids]
        random.shuffle(candidates)
        for c in candidates:
            if len(chosen) >= count:
                break
            _add(c)

    # 优先级3：同部门不同组
    if len(chosen) < count:
        all_dept = dept_employees.get(emp.department, [])
        candidates = [
            m for m in all_dept
            if m.id != emp.id and m.id not in chosen_ids
        ]
        random.shuffle(candidates)
        for c in candidates:
            if len(chosen) >= count:
                break
            _add(c)

    return chosen[:count]


def _pick_dept_leader(emp, leaders: list):
    """从领导列表中选一个作为部门领导评价人"""
    for l in leaders:
        if l.id != emp.id:
            return l
    return None


def _sample_up_to(pool: list, n: int) -> list:
    """从pool中随机抽取最多n个"""
    if len(pool) <= n:
        return list(pool)
    return random.sample(pool, n)


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
      业务人员: 同事均分×40% + 上级领导×30% + 部门领导×30%
      产品研发人员: 同事均分×30% + 上级领导×40% + 部门领导×30%
      基层管理人员: 部门员工均分×30% + 基层管理互评均分×30% + 部门领导×40%
      公共人员: 部门员工均分×50% + 部门领导×50%
    最终得分 = 加权总分 / 100 × 30
    """
    # 清除旧汇总
    await db.execute(delete(EvalSummary).where(EvalSummary.cycle_id == cycle_id))

    # 获取所有被评人（通过互评关系去重）
    rel_result = await db.execute(
        select(EvalRelation).where(EvalRelation.cycle_id == cycle_id)
    )
    all_relations = rel_result.scalars().all()

    # 按被评人分组
    evaluatee_relations: dict[int, list] = {}
    for r in all_relations:
        evaluatee_relations.setdefault(r.evaluatee_id, []).append(r)

    # 获取评分数据
    score_result = await db.execute(
        select(EvalScore).where(EvalScore.cycle_id == cycle_id)
    )
    all_scores = score_result.scalars().all()
    # relation_id -> total_score（该评价人对被评人的总分）
    relation_total: dict[int, Decimal] = {}
    for s in all_scores:
        relation_total[s.relation_id] = relation_total.get(
            s.relation_id, Decimal("0")
        ) + (s.score or Decimal("0"))

    # 获取员工信息
    emp_result = await db.execute(
        select(Employee).where(Employee.cycle_id == cycle_id)
    )
    emp_map = {e.id: e for e in emp_result.scalars().all()}

    count = 0
    for evaluatee_id, relations in evaluatee_relations.items():
        emp = emp_map.get(evaluatee_id)
        if not emp:
            continue

        assess_type = emp.assess_type

        # 按评价人类型分组
        type_scores: dict[str, list] = {}
        colleague_scores_by_order: dict[int, Decimal] = {}

        for r in relations:
            total = relation_total.get(r.id, Decimal("0"))
            type_scores.setdefault(r.evaluator_type, []).append(total)
            if r.evaluator_type == "同事" and r.evaluator_order > 0:
                colleague_scores_by_order[r.evaluator_order] = total
            elif r.evaluator_type == "部门员工" and r.evaluator_order > 0:
                colleague_scores_by_order[r.evaluator_order] = total

        # 计算各评价人类型的分数
        def _avg(lst):
            if not lst:
                return Decimal("0")
            return sum(lst) / len(lst)

        # 填充 colleague1~4 scores
        c1 = colleague_scores_by_order.get(1, Decimal("0"))
        c2 = colleague_scores_by_order.get(2, Decimal("0"))
        c3 = colleague_scores_by_order.get(3, Decimal("0"))
        c4 = colleague_scores_by_order.get(4, Decimal("0"))

        superior_score = Decimal("0")
        dept_leader_score = Decimal("0")

        if "上级领导" in type_scores:
            superior_score = _avg(type_scores["上级领导"])
        if "部门领导" in type_scores:
            dept_leader_score = _avg(type_scores["部门领导"])

        # 计算加权总分
        if assess_type == ASSESS_TYPE_BUSINESS:
            colleague_avg = _avg(type_scores.get("同事", []))
            weighted = (
                colleague_avg * Decimal("0.4")
                + superior_score * Decimal("0.3")
                + dept_leader_score * Decimal("0.3")
            )
        elif assess_type == ASSESS_TYPE_RD:
            colleague_avg = _avg(type_scores.get("同事", []))
            weighted = (
                colleague_avg * Decimal("0.3")
                + superior_score * Decimal("0.4")
                + dept_leader_score * Decimal("0.3")
            )
        elif assess_type == ASSESS_TYPE_MANAGER:
            emp_avg = _avg(type_scores.get("部门员工", []))
            mgr_avg = _avg(type_scores.get("基层管理互评", []))
            weighted = (
                emp_avg * Decimal("0.3")
                + mgr_avg * Decimal("0.3")
                + dept_leader_score * Decimal("0.4")
            )
            # 对基层管理人员，colleague1~4存部门员工评分
        elif assess_type == ASSESS_TYPE_PUBLIC:
            emp_avg = _avg(type_scores.get("部门员工", []))
            weighted = (
                emp_avg * Decimal("0.5")
                + dept_leader_score * Decimal("0.5")
            )
        else:
            weighted = Decimal("0")

        # 四舍五入到2位
        weighted = weighted.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        # 最终得分 = 加权总分 / 100 × 30
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
            colleague1_score=c1,
            colleague2_score=c2,
            colleague3_score=c3,
            colleague4_score=c4,
            superior_score=superior_score,
            dept_leader_score=dept_leader_score,
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
