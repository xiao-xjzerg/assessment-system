"""加减分与重点任务业务逻辑"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bonus import BonusRecord, KeyTaskScore
from app.models.employee import Employee
from app.config import ASSESS_TYPE_MANAGER


async def get_bonus_records(
    db: AsyncSession,
    cycle_id: int,
    employee_id: Optional[int] = None,
    department: Optional[str] = None,
    assess_type: Optional[str] = None,
) -> list:
    """查询加减分记录"""
    query = select(BonusRecord).where(BonusRecord.cycle_id == cycle_id)
    if employee_id is not None:
        query = query.where(BonusRecord.employee_id == employee_id)
    if department:
        query = query.where(BonusRecord.department == department)
    if assess_type:
        query = query.where(BonusRecord.assess_type == assess_type)
    query = query.order_by(BonusRecord.employee_id, BonusRecord.id)
    result = await db.execute(query)
    return result.scalars().all()


async def create_bonus_record(
    db: AsyncSession,
    cycle_id: int,
    employee_id: int,
    description: str,
    value: Decimal,
) -> BonusRecord:
    """创建加减分记录"""
    # 查找员工信息
    emp = await db.get(Employee, employee_id)
    if emp is None:
        raise ValueError("员工不存在")

    # 校验：员工加减分总和限制在-10~+10
    existing_sum = await _get_bonus_sum(db, cycle_id, employee_id)
    new_sum = existing_sum + value
    if new_sum > Decimal("10") or new_sum < Decimal("-10"):
        raise ValueError(
            f"该员工加减分总和为{existing_sum}，新增{value}后将为{new_sum}，"
            f"超出-10~+10范围"
        )

    record = BonusRecord(
        cycle_id=cycle_id,
        employee_id=employee_id,
        employee_name=emp.name,
        department=emp.department or "",
        assess_type=emp.assess_type or "",
        description=description,
        value=value,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def delete_bonus_record(db: AsyncSession, record_id: int) -> None:
    """删除加减分记录"""
    record = await db.get(BonusRecord, record_id)
    if record is None:
        raise ValueError("加减分记录不存在")
    await db.delete(record)
    await db.flush()


async def get_bonus_sum(db: AsyncSession, cycle_id: int, employee_id: int) -> Decimal:
    """获取某员工加减分总和"""
    return await _get_bonus_sum(db, cycle_id, employee_id)


async def _get_bonus_sum(db: AsyncSession, cycle_id: int, employee_id: int) -> Decimal:
    """内部获取加减分总和"""
    result = await db.execute(
        select(func.sum(BonusRecord.value)).where(
            BonusRecord.cycle_id == cycle_id,
            BonusRecord.employee_id == employee_id,
        )
    )
    total = result.scalar()
    return Decimal(str(total)) if total is not None else Decimal("0")


# ---- 重点任务申报（多条申请制） ----

MAX_KEY_TASK_TOTAL = Decimal("10")


async def get_key_task_scores(
    db: AsyncSession,
    cycle_id: int,
    employee_id: Optional[int] = None,
) -> list[KeyTaskScore]:
    """查询重点任务申请列表（按 employee_id, id 排序）"""
    query = select(KeyTaskScore).where(KeyTaskScore.cycle_id == cycle_id)
    if employee_id is not None:
        query = query.where(KeyTaskScore.employee_id == employee_id)
    query = query.order_by(KeyTaskScore.employee_id, KeyTaskScore.id)
    result = await db.execute(query)
    return list(result.scalars().all())


async def _employee_key_task_sum(
    db: AsyncSession,
    cycle_id: int,
    employee_id: int,
    exclude_record_id: Optional[int] = None,
) -> Decimal:
    """当前员工已申报的分值合计（可选排除某行，用于 update 校验）"""
    query = select(func.coalesce(func.sum(KeyTaskScore.score), 0)).where(
        KeyTaskScore.cycle_id == cycle_id,
        KeyTaskScore.employee_id == employee_id,
    )
    if exclude_record_id is not None:
        query = query.where(KeyTaskScore.id != exclude_record_id)
    result = await db.execute(query)
    total = result.scalar() or 0
    return Decimal(str(total))


async def create_key_task_score(
    db: AsyncSession,
    cycle_id: int,
    employee_id: int,
    task_name: str,
    completion: str,
    score: Decimal,
) -> KeyTaskScore:
    """新增一条重点任务申请"""
    emp = await db.get(Employee, employee_id)
    if emp is None:
        raise ValueError("员工不存在")
    if emp.assess_type != ASSESS_TYPE_MANAGER:
        raise ValueError("重点任务申报仅适用于基层管理人员")

    if score < Decimal("1") or score > Decimal("10"):
        raise ValueError("申请分值范围为 1~10")

    existing_sum = await _employee_key_task_sum(db, cycle_id, employee_id)
    new_total = existing_sum + score
    if new_total > MAX_KEY_TASK_TOTAL:
        raise ValueError(
            f"该员工已申报合计 {existing_sum}，新增 {score} 后将达 {new_total}，"
            f"超出合计上限 {MAX_KEY_TASK_TOTAL}"
        )

    record = KeyTaskScore(
        cycle_id=cycle_id,
        employee_id=employee_id,
        employee_name=emp.name,
        task_name=task_name,
        completion=completion,
        score=score,
    )
    db.add(record)
    await db.flush()
    await db.refresh(record)
    return record


async def update_key_task_score(
    db: AsyncSession,
    record_id: int,
    task_name: str,
    completion: str,
    score: Decimal,
) -> KeyTaskScore:
    """编辑一条重点任务申请"""
    record = await db.get(KeyTaskScore, record_id)
    if record is None:
        raise ValueError("重点任务申请不存在")

    if score < Decimal("1") or score > Decimal("10"):
        raise ValueError("申请分值范围为 1~10")

    existing_sum = await _employee_key_task_sum(
        db, record.cycle_id, record.employee_id, exclude_record_id=record.id
    )
    new_total = existing_sum + score
    if new_total > MAX_KEY_TASK_TOTAL:
        raise ValueError(
            f"该员工其他申请合计 {existing_sum}，本条改为 {score} 后将达 {new_total}，"
            f"超出合计上限 {MAX_KEY_TASK_TOTAL}"
        )

    record.task_name = task_name
    record.completion = completion
    record.score = score
    await db.flush()
    await db.refresh(record)
    return record


async def delete_key_task_score(db: AsyncSession, record_id: int) -> KeyTaskScore:
    """删除一条重点任务申请，返回被删记录（便于权限层事前检查 employee_id）"""
    record = await db.get(KeyTaskScore, record_id)
    if record is None:
        raise ValueError("重点任务申请不存在")
    await db.delete(record)
    await db.flush()
    return record
