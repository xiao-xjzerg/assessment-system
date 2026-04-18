"""加减分与重点任务业务逻辑"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, delete, func
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


# ---- 重点任务分数 ----

async def get_key_task_scores(
    db: AsyncSession,
    cycle_id: int,
    employee_id: Optional[int] = None,
) -> list:
    """查询重点任务分数（仅基层管理人员）"""
    query = select(KeyTaskScore).where(KeyTaskScore.cycle_id == cycle_id)
    if employee_id is not None:
        query = query.where(KeyTaskScore.employee_id == employee_id)
    query = query.order_by(KeyTaskScore.employee_id)
    result = await db.execute(query)
    return result.scalars().all()


async def save_key_task_score(
    db: AsyncSession,
    cycle_id: int,
    employee_id: int,
    score: Decimal,
) -> KeyTaskScore:
    """保存重点任务分数（upsert）"""
    # 校验员工存在且为基层管理人员
    emp = await db.get(Employee, employee_id)
    if emp is None:
        raise ValueError("员工不存在")
    if emp.assess_type != ASSESS_TYPE_MANAGER:
        raise ValueError("重点任务分数仅适用于基层管理人员")

    # 校验分数范围
    if score < Decimal("0") or score > Decimal("10"):
        raise ValueError("重点任务分数范围为0~10")

    # 查找是否已有记录
    result = await db.execute(
        select(KeyTaskScore).where(
            KeyTaskScore.cycle_id == cycle_id,
            KeyTaskScore.employee_id == employee_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        existing.score = score
        await db.flush()
        await db.refresh(existing)
        return existing
    else:
        record = KeyTaskScore(
            cycle_id=cycle_id,
            employee_id=employee_id,
            employee_name=emp.name,
            score=score,
        )
        db.add(record)
        await db.flush()
        await db.refresh(record)
        return record


async def batch_save_key_task_scores(
    db: AsyncSession,
    cycle_id: int,
    items: list[dict],
) -> list[KeyTaskScore]:
    """批量保存重点任务分数"""
    results = []
    for item in items:
        record = await save_key_task_score(
            db, cycle_id,
            employee_id=item["employee_id"],
            score=Decimal(str(item["score"])),
        )
        results.append(record)
    return results
