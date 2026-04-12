"""最终考核成绩计算业务逻辑

总分计算公式（PRD 7.1）：
- 基层管理人员（满分110）：工作积分(0~30) + 经济指标(0~30) + 重点任务(0~10) + 综合评价(0~30) + 加减分(±10)
- 公共人员（满分110）：工作目标完成度(0~70) + 综合评价(0~30) + 加减分(±10)
- 业务人员（满分110）：工作积分(0~50) + 经济指标(0~20) + 综合评价(0~30) + 加减分(±10)
- 产品研发人员（满分110）：工作积分(0~50) + 经济指标(0~20) + 综合评价(0~30) + 加减分(±10)

排名规则：同部门、同考核类型内按总分降序，同分时按工作积分降序、经济指标降序
混合角色：最终总分 = 身份A总分 × 50% + 身份B总分 × 50%
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.result import FinalResult
from app.models.score import ScoreSummary
from app.models.evaluation import EvalSummary, WorkGoalScore
from app.models.bonus import BonusRecord, KeyTaskScore
from app.models.employee import Employee
from app.services.economic_service import calculate_economic_indicators, get_employee_economic_score
from app.config import (
    ASSESS_TYPE_MANAGER, ASSESS_TYPE_PUBLIC, ASSESS_TYPE_BUSINESS, ASSESS_TYPE_RD,
)

D = Decimal
ZERO = D("0")


async def calculate_final_results(db: AsyncSession, cycle_id: int) -> list[FinalResult]:
    """
    计算所有员工的最终考核成绩。
    流程：清旧数据 → 收集各维度得分 → 计算总分 → 混合角色合并 → 排名
    """
    # 1. 清除旧数据
    await db.execute(delete(FinalResult).where(FinalResult.cycle_id == cycle_id))
    await db.flush()

    # 2. 加载所有需要的数据
    employees = await _load_employees(db, cycle_id)
    score_summaries = await _load_score_summaries(db, cycle_id)
    eval_summaries = await _load_eval_summaries(db, cycle_id)
    work_goal_scores = await _load_work_goal_scores(db, cycle_id)
    bonus_sums = await _load_bonus_sums(db, cycle_id)
    key_task_scores = await _load_key_task_scores(db, cycle_id)
    economic_details = await calculate_economic_indicators(db, cycle_id)

    # 按员工汇总经济指标得分
    economic_scores: dict[int, D] = {}
    for d in economic_details:
        eid = d["employee_id"]
        if d["indicator_type"] != "产品合同":
            economic_scores[eid] = economic_scores.get(eid, ZERO) + D(str(d["score"]))

    # 3. 为每个员工计算最终成绩
    results: list[FinalResult] = []
    for emp in employees.values():
        if emp.role == "领导":
            continue

        result = _build_final_result(
            emp, cycle_id,
            score_summaries, eval_summaries, work_goal_scores,
            bonus_sums, key_task_scores, economic_scores,
            emp.assess_type,
        )

        # 混合角色处理
        if emp.assess_type_secondary:
            result.is_mixed_role = True
            result.secondary_assess_type = emp.assess_type_secondary

            # 计算第二身份得分
            secondary_scores = _calc_dimension_scores(
                emp, cycle_id,
                score_summaries, eval_summaries, work_goal_scores,
                bonus_sums, key_task_scores, economic_scores,
                emp.assess_type_secondary,
            )
            result.secondary_work_score = secondary_scores["work_score"]
            result.secondary_economic_score = secondary_scores["economic_score"]
            result.secondary_key_task_score = secondary_scores["key_task_score"]
            result.secondary_eval_score = secondary_scores["eval_score"]
            result.secondary_bonus_score = secondary_scores["bonus_score"]
            result.secondary_total_score = secondary_scores["total_score"]

            # 混合角色最终总分 = 身份A × 50% + 身份B × 50%
            result.total_score = (
                (result.total_score + result.secondary_total_score) * D("0.5")
            ).quantize(D("0.01"), rounding=ROUND_HALF_UP)

        db.add(result)
        results.append(result)

    await db.flush()

    # 4. 计算排名
    await _calculate_rankings(results)
    await db.flush()

    return results


def _build_final_result(
    emp, cycle_id,
    score_summaries, eval_summaries, work_goal_scores,
    bonus_sums, key_task_scores, economic_scores,
    assess_type,
) -> FinalResult:
    """构建单个员工的最终成绩记录"""
    scores = _calc_dimension_scores(
        emp, cycle_id,
        score_summaries, eval_summaries, work_goal_scores,
        bonus_sums, key_task_scores, economic_scores,
        assess_type,
    )

    # 满分设定
    if assess_type == ASSESS_TYPE_MANAGER:
        work_max = D("30")
        econ_max = D("30")
    elif assess_type == ASSESS_TYPE_PUBLIC:
        work_max = D("0")  # 公共人员不用工作积分
        econ_max = D("0")
    else:
        work_max = D("50")
        econ_max = D("20")

    return FinalResult(
        cycle_id=cycle_id,
        employee_id=emp.id,
        employee_name=emp.name,
        department=emp.department or "",
        group_name=emp.group_name or "",
        grade=emp.grade or "",
        assess_type=assess_type,
        is_mixed_role=False,
        work_score=scores["work_score"],
        work_score_max=work_max,
        economic_score=scores["economic_score"],
        economic_score_max=econ_max,
        key_task_score=scores["key_task_score"],
        work_goal_score=scores["work_goal_score"],
        eval_score=scores["eval_score"],
        bonus_score=scores["bonus_score"],
        total_score=scores["total_score"],
    )


def _calc_dimension_scores(
    emp, cycle_id,
    score_summaries, eval_summaries, work_goal_scores,
    bonus_sums, key_task_scores, economic_scores,
    assess_type,
) -> dict:
    """计算某个考核身份下各维度得分"""
    work_score = ZERO
    economic_score = ZERO
    key_task_score = ZERO
    work_goal_score = ZERO
    eval_score = ZERO
    bonus_score = ZERO

    # 工作积分得分（来自 score_summaries.normalized_score）
    ss = score_summaries.get(emp.id)
    if ss and assess_type != ASSESS_TYPE_PUBLIC:
        work_score = D(str(ss.normalized_score or 0))

    # 经济指标得分
    if assess_type != ASSESS_TYPE_PUBLIC:
        econ = economic_scores.get(emp.id, ZERO)
        # 上限
        if assess_type == ASSESS_TYPE_MANAGER:
            economic_score = min(econ, D("30"))
        else:
            economic_score = min(econ, D("20"))

    # 重点任务得分（仅基层管理人员）
    if assess_type == ASSESS_TYPE_MANAGER:
        kt = key_task_scores.get(emp.id)
        if kt:
            key_task_score = D(str(kt.score or 0))

    # 工作目标完成度得分（仅公共人员，满分70）
    if assess_type == ASSESS_TYPE_PUBLIC:
        wg = work_goal_scores.get(emp.id)
        if wg:
            work_goal_score = D(str(wg.score or 0))

    # 综合评价得分（来自 eval_summaries.final_score，满分30）
    es = eval_summaries.get(emp.id)
    if es:
        eval_score = D(str(es.final_score or 0))

    # 加减分
    bs = bonus_sums.get(emp.id, ZERO)
    bonus_score = max(min(bs, D("10")), D("-10"))

    # 计算总分
    if assess_type == ASSESS_TYPE_MANAGER:
        total = work_score + economic_score + key_task_score + eval_score + bonus_score
    elif assess_type == ASSESS_TYPE_PUBLIC:
        total = work_goal_score + eval_score + bonus_score
    else:
        total = work_score + economic_score + eval_score + bonus_score

    return {
        "work_score": work_score.quantize(D("0.01"), rounding=ROUND_HALF_UP),
        "economic_score": economic_score.quantize(D("0.01"), rounding=ROUND_HALF_UP),
        "key_task_score": key_task_score.quantize(D("0.01"), rounding=ROUND_HALF_UP),
        "work_goal_score": work_goal_score.quantize(D("0.01"), rounding=ROUND_HALF_UP),
        "eval_score": eval_score.quantize(D("0.01"), rounding=ROUND_HALF_UP),
        "bonus_score": bonus_score.quantize(D("0.01"), rounding=ROUND_HALF_UP),
        "total_score": total.quantize(D("0.01"), rounding=ROUND_HALF_UP),
    }


async def _calculate_rankings(results: list[FinalResult]):
    """
    排名规则：同部门、同考核类型内按总分降序。
    同分时按工作积分降序、经济指标降序。
    混合角色按主要身份(assess_type)归入对应排名。
    """
    # 按部门+考核类型分组
    groups: dict[str, list[FinalResult]] = {}
    for r in results:
        key = f"{r.department}_{r.assess_type}"
        groups.setdefault(key, []).append(r)

    for key, group in groups.items():
        # 排序
        group.sort(key=lambda r: (
            float(r.total_score),
            float(r.work_score),
            float(r.economic_score),
        ), reverse=True)

        # 赋排名
        for i, r in enumerate(group, 1):
            r.ranking = i


async def get_final_results(
    db: AsyncSession,
    cycle_id: int,
    department: Optional[str] = None,
    assess_type: Optional[str] = None,
    employee_name: Optional[str] = None,
) -> list:
    """查询最终考核成绩"""
    query = select(FinalResult).where(FinalResult.cycle_id == cycle_id)
    if department:
        query = query.where(FinalResult.department == department)
    if assess_type:
        query = query.where(FinalResult.assess_type == assess_type)
    if employee_name:
        query = query.where(FinalResult.employee_name.contains(employee_name))
    query = query.order_by(
        FinalResult.department,
        FinalResult.assess_type,
        FinalResult.ranking,
    )
    result = await db.execute(query)
    return result.scalars().all()


async def update_rating(db: AsyncSession, result_id: int, rating: str) -> FinalResult:
    """更新评定等级"""
    record = await db.get(FinalResult, result_id)
    if record is None:
        raise ValueError("成绩记录不存在")
    record.rating = rating
    await db.flush()
    await db.refresh(record)
    return record


async def update_leader_comment(
    db: AsyncSession, result_id: int, leader_comment: str
) -> FinalResult:
    """更新领导评语"""
    record = await db.get(FinalResult, result_id)
    if record is None:
        raise ValueError("成绩记录不存在")
    record.leader_comment = leader_comment
    await db.flush()
    await db.refresh(record)
    return record


# ---- 数据加载辅助函数 ----

async def _load_employees(db: AsyncSession, cycle_id: int) -> dict[int, Employee]:
    result = await db.execute(
        select(Employee).where(Employee.cycle_id == cycle_id, Employee.is_active == True)
    )
    return {e.id: e for e in result.scalars().all()}


async def _load_score_summaries(db: AsyncSession, cycle_id: int) -> dict[int, ScoreSummary]:
    result = await db.execute(
        select(ScoreSummary).where(ScoreSummary.cycle_id == cycle_id)
    )
    return {s.employee_id: s for s in result.scalars().all()}


async def _load_eval_summaries(db: AsyncSession, cycle_id: int) -> dict[int, EvalSummary]:
    result = await db.execute(
        select(EvalSummary).where(EvalSummary.cycle_id == cycle_id)
    )
    return {s.employee_id: s for s in result.scalars().all()}


async def _load_work_goal_scores(db: AsyncSession, cycle_id: int) -> dict[int, WorkGoalScore]:
    result = await db.execute(
        select(WorkGoalScore).where(WorkGoalScore.cycle_id == cycle_id)
    )
    return {s.employee_id: s for s in result.scalars().all()}


async def _load_bonus_sums(db: AsyncSession, cycle_id: int) -> dict[int, D]:
    result = await db.execute(
        select(
            BonusRecord.employee_id,
            func.sum(BonusRecord.value).label("total"),
        ).where(BonusRecord.cycle_id == cycle_id).group_by(BonusRecord.employee_id)
    )
    return {
        row.employee_id: D(str(row.total))
        for row in result.all()
    }


async def _load_key_task_scores(db: AsyncSession, cycle_id: int) -> dict[int, KeyTaskScore]:
    result = await db.execute(
        select(KeyTaskScore).where(KeyTaskScore.cycle_id == cycle_id)
    )
    return {k.employee_id: k for k in result.scalars().all()}
