"""项目参与度业务逻辑"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, delete, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.participation import Participation
from app.models.project import Project
from app.models.employee import Employee


async def get_participations_by_project(db: AsyncSession, project_id: int) -> list:
    """获取某项目的所有参与度记录"""
    result = await db.execute(
        select(Participation).where(Participation.project_id == project_id)
        .order_by(Participation.department, Participation.id)
    )
    return result.scalars().all()


async def get_participations_by_cycle(
    db: AsyncSession,
    cycle_id: int,
    project_id: Optional[int] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
) -> list:
    """获取周期内所有参与度记录（管理员视角）"""
    query = select(Participation).where(Participation.cycle_id == cycle_id)
    if project_id:
        query = query.where(Participation.project_id == project_id)
    if department:
        query = query.where(Participation.department == department)
    if status:
        query = query.where(Participation.status == status)
    query = query.order_by(Participation.project_id, Participation.department, Participation.id)
    result = await db.execute(query)
    return result.scalars().all()


async def get_pm_projects(db: AsyncSession, cycle_id: int, pm_id: int) -> list:
    """获取项目经理负责的项目列表"""
    result = await db.execute(
        select(Project).where(
            Project.cycle_id == cycle_id,
            Project.pm_id == pm_id,
        ).order_by(Project.id)
    )
    return result.scalars().all()


def validate_participation_sum(items: list) -> list[str]:
    """
    校验参与度系数：同一项目内，实施交付部合计为1，产品研发部合计为1。
    如某部门无人参与则合计为0（允许）。
    允许±0.01浮点误差。
    """
    dept_sums: dict[str, Decimal] = {}
    for item in items:
        dept = item.department
        dept_sums[dept] = dept_sums.get(dept, Decimal("0")) + item.participation_coeff

    errors = []
    for dept, total in dept_sums.items():
        if total == Decimal("0"):
            continue  # 该部门无人参与
        if abs(total - Decimal("1")) > Decimal("0.01"):
            errors.append(f"{dept}参与度系数合计为{total}，应为1")
    return errors


async def save_participations(
    db: AsyncSession,
    cycle_id: int,
    project_id: int,
    items: list,
    submit: bool = False,
) -> list:
    """保存项目参与度（全量替换该项目的参与度记录）"""
    # 校验项目是否存在
    proj_result = await db.execute(select(Project).where(Project.id == project_id))
    project = proj_result.scalar_one_or_none()
    if project is None:
        raise ValueError("项目不存在")

    # 校验参与度合计
    errors = validate_participation_sum(items)
    if errors:
        raise ValueError("；".join(errors))

    # 校验员工是否存在
    for item in items:
        emp_result = await db.execute(
            select(Employee).where(Employee.id == item.employee_id)
        )
        emp = emp_result.scalar_one_or_none()
        if emp is None:
            raise ValueError(f"员工ID {item.employee_id} 不存在")

    # 删除该项目已有记录
    await db.execute(
        delete(Participation).where(
            Participation.project_id == project_id,
            Participation.cycle_id == cycle_id,
        )
    )

    status = "已提交" if submit else "已保存"
    records = []
    for item in items:
        record = Participation(
            cycle_id=cycle_id,
            project_id=project_id,
            employee_id=item.employee_id,
            employee_name=item.employee_name,
            department=item.department,
            participation_coeff=item.participation_coeff,
            status=status,
        )
        db.add(record)
        records.append(record)
    await db.flush()
    return records


async def delete_participation(db: AsyncSession, participation_id: int):
    """删除单条参与度记录"""
    result = await db.execute(
        select(Participation).where(Participation.id == participation_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        raise ValueError("参与度记录不存在")
    await db.delete(record)
    await db.flush()


async def get_project_participation_summary(db: AsyncSession, cycle_id: int) -> list:
    """获取所有项目的参与度填报概览（用于管理员工作台统计）"""
    # 所有项目
    projects_result = await db.execute(
        select(Project).where(Project.cycle_id == cycle_id)
    )
    all_projects = projects_result.scalars().all()

    # 已填报的项目（有参与度记录的项目ID）
    filled_result = await db.execute(
        select(Participation.project_id).where(
            Participation.cycle_id == cycle_id
        ).distinct()
    )
    filled_project_ids = set(r[0] for r in filled_result.all())

    summary = []
    for p in all_projects:
        summary.append({
            "project_id": p.id,
            "project_name": p.project_name,
            "project_code": p.project_code,
            "department": p.department,
            "pm_name": p.pm_name,
            "filled": p.id in filled_project_ids,
        })
    return summary
