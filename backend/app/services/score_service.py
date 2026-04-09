"""积分计算业务逻辑

积分计算流程：
1. 根据项目参与度 + 项目数据，生成售前/交付积分明细(score_details)
2. 根据公共积分申报(public_scores)，生成公共/转型积分明细(score_details)
3. 公共活动积分上限校验：不超过该员工项目积分的15%
4. 汇总生成积分汇总表(score_summaries)
5. 计算开方归一化得分(normalized_score)
"""
import math
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.score import ScoreDetail, ScoreSummary
from app.models.public_score import PublicScore
from app.models.participation import Participation
from app.models.project import Project
from app.models.employee import Employee
from app.config import (
    BASE_SCORE_PRESALE, BASE_SCORE_DELIVERY,
    BASE_SCORE_PUBLIC, BASE_SCORE_TRANSFORM,
    ASSESS_TYPE_MANAGER, ASSESS_TYPE_BUSINESS, ASSESS_TYPE_RD,
    DEPT_DELIVERY, DEPT_RD,
)


async def calculate_all_scores(db: AsyncSession, cycle_id: int):
    """
    全量计算：清除旧数据 → 生成积分明细 → 汇总 → 归一化。
    """
    # 1. 清除该周期的旧积分数据
    await db.execute(delete(ScoreDetail).where(ScoreDetail.cycle_id == cycle_id))
    await db.execute(delete(ScoreSummary).where(ScoreSummary.cycle_id == cycle_id))
    await db.flush()

    # 2. 生成项目积分明细（售前+交付）
    await _generate_project_score_details(db, cycle_id)

    # 3. 生成公共/转型积分明细
    await _generate_public_score_details(db, cycle_id)

    # 4. 应用公共活动积分上限（15%项目积分）
    await _apply_public_score_cap(db, cycle_id)

    # 5. 生成积分汇总
    await _generate_score_summaries(db, cycle_id)

    # 6. 计算开方归一化得分
    await _calculate_normalized_scores(db, cycle_id)

    await db.flush()


async def _generate_project_score_details(db: AsyncSession, cycle_id: int):
    """
    根据参与度和项目数据，生成售前/交付积分明细。
    每个员工在每个项目上产生两条记录（售前、交付），前提是有参与度。
    score = base_score × progress_coeff × workload_coeff × participation_coeff
    """
    # 获取所有参与度记录
    result = await db.execute(
        select(Participation).where(Participation.cycle_id == cycle_id)
    )
    participations = result.scalars().all()

    # 获取所有项目（缓存）
    proj_result = await db.execute(
        select(Project).where(Project.cycle_id == cycle_id)
    )
    projects = {p.id: p for p in proj_result.scalars().all()}

    for part in participations:
        project = projects.get(part.project_id)
        if project is None:
            continue

        # 售前积分
        presale_progress = Decimal(str(project.presale_progress or 0))
        used_presale = Decimal(str(project.used_presale_progress or 0))
        # 本期售前进度 = presale_progress - used_presale_progress
        current_presale_progress = presale_progress - used_presale
        if current_presale_progress < 0:
            current_presale_progress = Decimal("0")

        workload_coeff = Decimal(str(project.workload_coeff or 0))
        participation_coeff = Decimal(str(part.participation_coeff or 0))

        if current_presale_progress > 0 and workload_coeff > 0 and participation_coeff > 0:
            presale_score = (
                Decimal(str(BASE_SCORE_PRESALE))
                * current_presale_progress
                * workload_coeff
                * participation_coeff
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            detail = ScoreDetail(
                cycle_id=cycle_id,
                employee_id=part.employee_id,
                employee_name=part.employee_name,
                project_id=project.id,
                project_name=project.project_name,
                phase="售前",
                base_score=BASE_SCORE_PRESALE,
                progress_coeff=current_presale_progress,
                workload_coeff=workload_coeff,
                participation_coeff=participation_coeff,
                score=presale_score,
            )
            db.add(detail)

        # 交付积分
        delivery_progress = Decimal(str(project.delivery_progress or 0))
        used_delivery = Decimal(str(project.used_delivery_progress or 0))
        current_delivery_progress = delivery_progress - used_delivery
        if current_delivery_progress < 0:
            current_delivery_progress = Decimal("0")

        if current_delivery_progress > 0 and workload_coeff > 0 and participation_coeff > 0:
            delivery_score = (
                Decimal(str(BASE_SCORE_DELIVERY))
                * current_delivery_progress
                * workload_coeff
                * participation_coeff
            ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

            detail = ScoreDetail(
                cycle_id=cycle_id,
                employee_id=part.employee_id,
                employee_name=part.employee_name,
                project_id=project.id,
                project_name=project.project_name,
                phase="交付",
                base_score=BASE_SCORE_DELIVERY,
                progress_coeff=current_delivery_progress,
                workload_coeff=workload_coeff,
                participation_coeff=participation_coeff,
                score=delivery_score,
            )
            db.add(detail)

    await db.flush()


async def _generate_public_score_details(db: AsyncSession, cycle_id: int):
    """
    根据公共积分申报表，生成公共/转型积分明细。
    base_score=10, progress_coeff=1, participation_coeff=1,
    workload_coeff=活动工作量系数, score=10×工作量系数
    """
    result = await db.execute(
        select(PublicScore).where(PublicScore.cycle_id == cycle_id)
    )
    public_scores = result.scalars().all()

    for ps in public_scores:
        phase = "公共" if ps.activity_type == "公共活动" else "转型"
        base = BASE_SCORE_PUBLIC if phase == "公共" else BASE_SCORE_TRANSFORM

        detail = ScoreDetail(
            cycle_id=cycle_id,
            employee_id=ps.employee_id,
            employee_name=ps.employee_name,
            project_id=None,
            project_name=ps.activity_name,
            phase=phase,
            base_score=base,
            progress_coeff=Decimal("1"),
            workload_coeff=ps.workload_coeff,
            participation_coeff=Decimal("1"),
            score=ps.score,
        )
        db.add(detail)

    await db.flush()


async def _apply_public_score_cap(db: AsyncSession, cycle_id: int):
    """
    公共活动积分上限：不超过该员工项目积分(售前+交付)合计的15%。
    转型活动不设上限。
    """
    # 获取每个员工的项目积分合计
    proj_scores = await db.execute(
        select(
            ScoreDetail.employee_id,
            func.sum(ScoreDetail.score).label("total"),
        ).where(
            ScoreDetail.cycle_id == cycle_id,
            ScoreDetail.phase.in_(["售前", "交付"]),
        ).group_by(ScoreDetail.employee_id)
    )
    proj_totals = {row.employee_id: Decimal(str(row.total)) for row in proj_scores.all()}

    # 获取每个员工的公共积分明细
    public_details_result = await db.execute(
        select(ScoreDetail).where(
            ScoreDetail.cycle_id == cycle_id,
            ScoreDetail.phase == "公共",
        ).order_by(ScoreDetail.employee_id, ScoreDetail.id)
    )
    public_details = public_details_result.scalars().all()

    # 按员工分组
    emp_public: dict[int, list] = {}
    for d in public_details:
        emp_public.setdefault(d.employee_id, []).append(d)

    for emp_id, details in emp_public.items():
        proj_total = proj_totals.get(emp_id, Decimal("0"))
        cap = (proj_total * Decimal("0.15")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # 计算公共积分合计
        public_total = sum(Decimal(str(d.score)) for d in details)

        if public_total > cap and cap > 0:
            # 按比例缩减每条公共积分记录
            ratio = cap / public_total
            for d in details:
                d.score = (Decimal(str(d.score)) * ratio).quantize(
                    Decimal("0.01"), rounding=ROUND_HALF_UP
                )
        elif cap == 0:
            # 没有项目积分，公共积分全部归零
            for d in details:
                d.score = Decimal("0")

    await db.flush()


async def _generate_score_summaries(db: AsyncSession, cycle_id: int):
    """
    根据积分明细生成积分汇总表。
    按员工分组，分别汇总项目积分（售前+交付）、公共积分、转型积分。
    """
    # 获取所有员工信息
    emp_result = await db.execute(
        select(Employee).where(Employee.cycle_id == cycle_id)
    )
    employees = {e.id: e for e in emp_result.scalars().all()}

    # 获取所有积分明细
    details_result = await db.execute(
        select(ScoreDetail).where(ScoreDetail.cycle_id == cycle_id)
    )
    all_details = details_result.scalars().all()

    # 按员工分组汇总
    emp_scores: dict[int, dict] = {}
    for d in all_details:
        if d.employee_id not in emp_scores:
            emp_scores[d.employee_id] = {
                "project": Decimal("0"),
                "public": Decimal("0"),
                "transform": Decimal("0"),
            }
        score_val = Decimal(str(d.score))
        if d.phase in ("售前", "交付"):
            emp_scores[d.employee_id]["project"] += score_val
        elif d.phase == "公共":
            emp_scores[d.employee_id]["public"] += score_val
        elif d.phase == "转型":
            emp_scores[d.employee_id]["transform"] += score_val

    for emp_id, scores in emp_scores.items():
        emp = employees.get(emp_id)
        if emp is None:
            continue

        total = scores["project"] + scores["public"] + scores["transform"]

        summary = ScoreSummary(
            cycle_id=cycle_id,
            employee_id=emp_id,
            employee_name=emp.name,
            department=emp.department or "",
            assess_type=emp.assess_type or "",
            project_score_total=scores["project"].quantize(Decimal("0.01")),
            public_score_total=scores["public"].quantize(Decimal("0.01")),
            transform_score_total=scores["transform"].quantize(Decimal("0.01")),
            total_score=total.quantize(Decimal("0.01")),
            normalized_score=Decimal("0"),  # 稍后计算
        )
        db.add(summary)

    await db.flush()


async def _calculate_normalized_scores(db: AsyncSession, cycle_id: int):
    """
    计算开方归一化得分。
    - 基层管理人员: 得分 = 30 × √(个人积分) / √(全类型最高积分)
    - 业务人员: 得分 = 50 × √(个人积分) / √(同类人员最高积分)（实施交付部内比较）
    - 产品研发人员: 得分 = 50 × √(个人积分) / √(同类人员最高积分)（产品研发部内比较）
    - 公共人员: 不计算积分得分（公共人员用工作目标完成度70分）
    """
    result = await db.execute(
        select(ScoreSummary).where(ScoreSummary.cycle_id == cycle_id)
    )
    summaries = result.scalars().all()

    if not summaries:
        return

    # 找到全类型最高积分（用于基层管理人员）
    all_max = max(float(s.total_score) for s in summaries) if summaries else 0

    # 按部门+考核类型分组，找各组最高积分
    group_max: dict[str, float] = {}
    for s in summaries:
        key = f"{s.department}_{s.assess_type}"
        current = float(s.total_score)
        if key not in group_max or current > group_max[key]:
            group_max[key] = current

    # 实施交付部业务人员最高积分
    delivery_business_max = group_max.get(f"{DEPT_DELIVERY}_{ASSESS_TYPE_BUSINESS}", 0)
    # 产品研发部产品研发人员最高积分
    rd_max = group_max.get(f"{DEPT_RD}_{ASSESS_TYPE_RD}", 0)

    for s in summaries:
        total = float(s.total_score)
        normalized = 0.0

        if s.assess_type == ASSESS_TYPE_MANAGER:
            # 基层管理人员: 30 × √(个人) / √(全类型最高)
            if all_max > 0 and total > 0:
                normalized = 30.0 * math.sqrt(total) / math.sqrt(all_max)

        elif s.assess_type == ASSESS_TYPE_BUSINESS:
            # 业务人员: 50 × √(个人) / √(同部门同类最高)
            dept_max = delivery_business_max
            if dept_max > 0 and total > 0:
                normalized = 50.0 * math.sqrt(total) / math.sqrt(dept_max)

        elif s.assess_type == ASSESS_TYPE_RD:
            # 产品研发人员: 50 × √(个人) / √(同部门同类最高)
            dept_max = rd_max
            if dept_max > 0 and total > 0:
                normalized = 50.0 * math.sqrt(total) / math.sqrt(dept_max)

        # 公共人员不计算积分归一化得分（用工作目标完成度）

        s.normalized_score = Decimal(str(round(normalized, 2)))

    await db.flush()


async def get_score_details(
    db: AsyncSession,
    cycle_id: int,
    employee_id: Optional[int] = None,
    employee_name: Optional[str] = None,
    project_name: Optional[str] = None,
    phase: Optional[str] = None,
    department: Optional[str] = None,
) -> list:
    """查询积分明细"""
    query = select(ScoreDetail).where(ScoreDetail.cycle_id == cycle_id)
    if employee_id is not None:
        query = query.where(ScoreDetail.employee_id == employee_id)
    if employee_name:
        query = query.where(ScoreDetail.employee_name.contains(employee_name))
    if project_name:
        query = query.where(ScoreDetail.project_name.contains(project_name))
    if phase:
        query = query.where(ScoreDetail.phase == phase)
    # 按部门筛选需要关联员工表
    if department:
        query = query.join(Employee, ScoreDetail.employee_id == Employee.id).where(
            Employee.department == department
        )
    query = query.order_by(ScoreDetail.employee_id, ScoreDetail.project_id, ScoreDetail.phase)
    result = await db.execute(query)
    return result.scalars().all()


async def update_score_detail(
    db: AsyncSession,
    detail_id: int,
    data: dict,
    modified_by: str,
) -> ScoreDetail:
    """管理员修改积分明细（可编辑字段后系统自动重算积分和汇总）"""
    result = await db.execute(select(ScoreDetail).where(ScoreDetail.id == detail_id))
    detail = result.scalar_one_or_none()
    if detail is None:
        raise ValueError("积分明细记录不存在")

    if "progress_coeff" in data and data["progress_coeff"] is not None:
        detail.progress_coeff = data["progress_coeff"]
    if "workload_coeff" in data and data["workload_coeff"] is not None:
        detail.workload_coeff = data["workload_coeff"]
    if "work_description" in data and data["work_description"] is not None:
        detail.work_description = data["work_description"]
    if "remark" in data and data["remark"] is not None:
        detail.remark = data["remark"]

    # 重新计算分数
    detail.score = (
        Decimal(str(detail.base_score))
        * Decimal(str(detail.progress_coeff))
        * Decimal(str(detail.workload_coeff))
        * Decimal(str(detail.participation_coeff))
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    detail.modified_by = modified_by
    from datetime import datetime
    detail.modified_at = datetime.now()

    await db.flush()
    await db.refresh(detail)
    return detail


async def get_score_summaries(
    db: AsyncSession,
    cycle_id: int,
    employee_name: Optional[str] = None,
    department: Optional[str] = None,
    assess_type: Optional[str] = None,
) -> list:
    """查询积分汇总"""
    query = select(ScoreSummary).where(ScoreSummary.cycle_id == cycle_id)
    if employee_name:
        query = query.where(ScoreSummary.employee_name.contains(employee_name))
    if department:
        query = query.where(ScoreSummary.department == department)
    if assess_type:
        query = query.where(ScoreSummary.assess_type == assess_type)
    query = query.order_by(ScoreSummary.department, ScoreSummary.assess_type, ScoreSummary.total_score.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def export_score_data(db: AsyncSession, cycle_id: int) -> dict:
    """导出积分统计数据（供Excel导出使用）"""
    details = await get_score_details(db, cycle_id)
    summaries = await get_score_summaries(db, cycle_id)
    return {
        "details": details,
        "summaries": summaries,
    }
