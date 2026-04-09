"""公共积分申报业务逻辑"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.public_score import PublicScore
from app.models.employee import Employee


def calc_scale_value(man_months: Decimal) -> Decimal:
    """
    计算活动规模值。
    规则：
    - <3人月: 0.5
    - 3~10人月: 线性插值 0.5~1.0
    - >10人月: 线性插值 1.0~1.5，上限1.5
    """
    mm = float(man_months)
    if mm < 3:
        return Decimal("0.5")
    elif mm <= 10:
        # 线性插值 0.5 ~ 1.0
        val = 0.5 + (mm - 3) / (10 - 3) * 0.5
        return Decimal(str(round(val, 4)))
    else:
        # >10 线性插值 1.0 ~ 1.5, 上限 1.5
        val = 1.0 + (mm - 10) / 10 * 0.5
        if val > 1.5:
            val = 1.5
        return Decimal(str(round(val, 4)))


def calc_complexity_value(complexity: str) -> Decimal:
    """
    计算活动复杂性值。
    规则：较简单=0.6，中等=1.0，极大=1.8
    """
    mapping = {
        "较简单": Decimal("0.6"),
        "中等": Decimal("1.0"),
        "极大": Decimal("1.8"),
    }
    return mapping.get(complexity, Decimal("1.0"))


def calc_public_score_fields(man_months: Decimal, complexity: str):
    """计算公共积分申报的自动计算字段"""
    scale_value = calc_scale_value(man_months)
    complexity_value = calc_complexity_value(complexity)
    workload_coeff = (scale_value * complexity_value).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
    score = (Decimal("10") * workload_coeff).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return scale_value, complexity_value, workload_coeff, score


async def create_public_score(
    db: AsyncSession,
    cycle_id: int,
    employee_id: int,
    employee_name: str,
    data: dict,
) -> PublicScore:
    """员工创建公共积分申报"""
    # 校验活动类型
    if data["activity_type"] not in ("公共活动", "转型活动"):
        raise ValueError("活动类型必须为'公共活动'或'转型活动'")
    if data["complexity"] not in ("较简单", "中等", "极大"):
        raise ValueError("复杂度必须为'较简单'、'中等'或'极大'")

    scale_value, complexity_value, workload_coeff, score = calc_public_score_fields(
        data["man_months"], data["complexity"]
    )

    record = PublicScore(
        cycle_id=cycle_id,
        employee_id=employee_id,
        employee_name=employee_name,
        activity_name=data["activity_name"],
        activity_type=data["activity_type"],
        man_months=data["man_months"],
        complexity=data["complexity"],
        scale_value=scale_value,
        complexity_value=complexity_value,
        workload_coeff=workload_coeff,
        score=score,
        status="已申报",
        remark=data.get("remark"),
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def update_public_score(
    db: AsyncSession,
    record_id: int,
    data: dict,
    is_admin: bool = False,
) -> PublicScore:
    """更新公共积分申报"""
    result = await db.execute(select(PublicScore).where(PublicScore.id == record_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise ValueError("公共积分申报记录不存在")

    if "activity_name" in data and data["activity_name"] is not None:
        record.activity_name = data["activity_name"]
    if "activity_type" in data and data["activity_type"] is not None:
        if data["activity_type"] not in ("公共活动", "转型活动"):
            raise ValueError("活动类型必须为'公共活动'或'转型活动'")
        record.activity_type = data["activity_type"]
    if "complexity" in data and data["complexity"] is not None:
        if data["complexity"] not in ("较简单", "中等", "极大"):
            raise ValueError("复杂度必须为'较简单'、'中等'或'极大'")
        record.complexity = data["complexity"]
    if "man_months" in data and data["man_months"] is not None:
        record.man_months = data["man_months"]
    if "remark" in data and data.get("remark") is not None:
        record.remark = data["remark"]

    # 管理员可直接修改工作量系数和积分
    if is_admin:
        if "workload_coeff" in data and data["workload_coeff"] is not None:
            record.workload_coeff = data["workload_coeff"]
            record.score = (Decimal("10") * data["workload_coeff"]).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )
        if "score" in data and data["score"] is not None:
            record.score = data["score"]
        record.status = "管理员已修改"
    else:
        # 员工修改时重新计算
        scale_value, complexity_value, workload_coeff, score = calc_public_score_fields(
            record.man_months, record.complexity
        )
        record.scale_value = scale_value
        record.complexity_value = complexity_value
        record.workload_coeff = workload_coeff
        record.score = score

    await db.flush()
    await db.refresh(record)
    return record


async def delete_public_score(db: AsyncSession, record_id: int):
    """删除公共积分申报记录"""
    result = await db.execute(select(PublicScore).where(PublicScore.id == record_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise ValueError("公共积分申报记录不存在")
    await db.delete(record)
    await db.flush()
    return record


async def get_public_scores(
    db: AsyncSession,
    cycle_id: int,
    employee_id: Optional[int] = None,
    activity_type: Optional[str] = None,
    status: Optional[str] = None,
    employee_name: Optional[str] = None,
) -> list:
    """查询公共积分申报记录"""
    query = select(PublicScore).where(PublicScore.cycle_id == cycle_id)
    if employee_id is not None:
        query = query.where(PublicScore.employee_id == employee_id)
    if activity_type is not None:
        query = query.where(PublicScore.activity_type == activity_type)
    if status is not None:
        query = query.where(PublicScore.status == status)
    if employee_name is not None:
        query = query.where(PublicScore.employee_name.contains(employee_name))
    query = query.order_by(PublicScore.employee_id, PublicScore.id)
    result = await db.execute(query)
    return result.scalars().all()


async def get_employee_project_score_total(
    db: AsyncSession, cycle_id: int, employee_id: int
) -> Decimal:
    """获取员工的项目积分合计（用于公共活动积分上限校验）"""
    from app.models.score import ScoreDetail
    result = await db.execute(
        select(func.coalesce(func.sum(ScoreDetail.score), 0)).where(
            ScoreDetail.cycle_id == cycle_id,
            ScoreDetail.employee_id == employee_id,
            ScoreDetail.phase.in_(["售前", "交付"]),
        )
    )
    return Decimal(str(result.scalar()))
