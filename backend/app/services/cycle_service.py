"""考核周期业务逻辑"""
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cycle import Cycle
from app.models.employee import Employee
from app.models.parameter import DeptTarget, SpecialTarget, ProjectTypeCoeff, IndicatorCoeff
from app.config import (
    ASSESSMENT_PHASES,
    DEFAULT_PROJECT_TYPE_COEFFICIENTS,
    DEFAULT_INDICATOR_COEFFICIENTS,
    ADMIN_PHONE,
    ROLE_ADMIN,
)


async def get_all_cycles(db: AsyncSession):
    """获取所有考核周期"""
    result = await db.execute(select(Cycle).order_by(Cycle.id.desc()))
    return result.scalars().all()


async def get_active_cycle(db: AsyncSession) -> Cycle | None:
    """获取当前活跃周期"""
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    return result.scalar_one_or_none()


async def create_cycle(db: AsyncSession, name: str) -> Cycle:
    """创建新考核周期，自动设为活跃，继承上一周期员工数据和参数"""
    # 检查名称重复
    existing = await db.execute(select(Cycle).where(Cycle.name == name))
    if existing.scalar_one_or_none():
        raise ValueError(f"考核周期名称 '{name}' 已存在")

    # 获取上一个活跃周期
    prev_cycle = await get_active_cycle(db)

    # 将所有已有周期设为非活跃
    await db.execute(update(Cycle).values(is_active=False))

    # 创建新周期
    cycle = Cycle(name=name, phase=1, is_active=True, is_archived=False)
    db.add(cycle)
    await db.flush()

    # 初始化默认参数
    await _init_default_parameters(db, cycle.id)

    # 如果有上一周期，继承员工数据和参数
    if prev_cycle:
        await _inherit_from_previous(db, prev_cycle.id, cycle.id)

    # 确保新周期内存在系统管理员 admin（兜底保障：任何数据状态下 admin 都在）
    await _ensure_admin_in_cycle(db, cycle.id)

    return cycle


async def switch_active_cycle(db: AsyncSession, cycle_id: int) -> Cycle:
    """切换活跃考核周期"""
    result = await db.execute(select(Cycle).where(Cycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise ValueError("考核周期不存在")
    if cycle.is_archived:
        raise ValueError("已归档的周期不能设为活跃")

    await db.execute(update(Cycle).values(is_active=False))
    cycle.is_active = True
    db.add(cycle)
    await db.flush()
    return cycle


async def archive_cycle(db: AsyncSession, cycle_id: int) -> Cycle:
    """归档考核周期"""
    result = await db.execute(select(Cycle).where(Cycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise ValueError("考核周期不存在")

    cycle.is_archived = True
    cycle.is_active = False
    db.add(cycle)
    await db.flush()
    return cycle


async def update_phase(db: AsyncSession, cycle_id: int, action: str) -> Cycle:
    """切换阶段：next 前进 / prev 回退"""
    result = await db.execute(select(Cycle).where(Cycle.id == cycle_id))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise ValueError("考核周期不存在")
    if cycle.is_archived:
        raise ValueError("已归档的周期不能切换阶段")

    if action == "next":
        if cycle.phase >= 5:
            raise ValueError("已经是最后一个阶段")
        cycle.phase += 1
    elif action == "prev":
        if cycle.phase <= 1:
            raise ValueError("已经是第一个阶段")
        cycle.phase -= 1
    else:
        raise ValueError("action 必须为 next 或 prev")

    db.add(cycle)
    await db.flush()
    return cycle


async def _ensure_admin_in_cycle(db: AsyncSession, cycle_id: int):
    """保证指定周期内存在系统管理员 admin 行。

    若当前周期已有 admin（通常由上一周期继承过来），不动它；
    若没有，从其他任意周期复制一条 admin；
    若整个系统都还没有 admin（极端场景），按默认模板重建。
    """
    from passlib.context import CryptContext

    existing = await db.scalar(
        select(Employee).where(
            Employee.cycle_id == cycle_id, Employee.phone == ADMIN_PHONE
        )
    )
    if existing is not None:
        return

    any_admin = await db.scalar(
        select(Employee).where(Employee.phone == ADMIN_PHONE).limit(1)
    )
    if any_admin is not None:
        db.add(Employee(
            cycle_id=cycle_id,
            name=any_admin.name,
            department=any_admin.department,
            group_name=any_admin.group_name,
            position=any_admin.position,
            grade=any_admin.grade,
            phone=any_admin.phone,
            password_hash=any_admin.password_hash,
            role=any_admin.role,
            assess_type=any_admin.assess_type,
            is_active=True,
        ))
    else:
        pwd = CryptContext(schemes=["bcrypt"]).hash("123456")
        db.add(Employee(
            cycle_id=cycle_id,
            name="系统管理员",
            department="系统",
            group_name=None,
            position="管理员",
            grade=None,
            phone=ADMIN_PHONE,
            password_hash=pwd,
            role=ROLE_ADMIN,
            assess_type=None,
            is_active=True,
        ))
    await db.flush()


async def _init_default_parameters(db: AsyncSession, cycle_id: int):
    """初始化默认的项目类型系数和员工指标系数"""
    for ptype, coeff in DEFAULT_PROJECT_TYPE_COEFFICIENTS.items():
        db.add(ProjectTypeCoeff(cycle_id=cycle_id, project_type=ptype, coefficient=coeff))

    for grade, coeff in DEFAULT_INDICATOR_COEFFICIENTS.items():
        db.add(IndicatorCoeff(cycle_id=cycle_id, grade=grade, coefficient=coeff))

    await db.flush()


async def _inherit_from_previous(db: AsyncSession, prev_cycle_id: int, new_cycle_id: int):
    """从上一周期继承员工数据和参数"""
    # 继承员工信息
    result = await db.execute(
        select(Employee).where(Employee.cycle_id == prev_cycle_id)
    )
    employees = result.scalars().all()
    for emp in employees:
        new_emp = Employee(
            cycle_id=new_cycle_id,
            name=emp.name,
            department=emp.department,
            group_name=emp.group_name,
            position=emp.position,
            grade=emp.grade,
            phone=emp.phone,
            password_hash=emp.password_hash,
            role=emp.role,
            assess_type=emp.assess_type,
            is_active=emp.is_active,
        )
        db.add(new_emp)

    # 继承部门目标值
    result = await db.execute(
        select(DeptTarget).where(DeptTarget.cycle_id == prev_cycle_id)
    )
    for dt in result.scalars().all():
        db.add(DeptTarget(
            cycle_id=new_cycle_id,
            department=dt.department,
            group_name=dt.group_name,
            profit_target=dt.profit_target,
            income_target=dt.income_target,
        ))

    # 继承专项目标值
    result = await db.execute(
        select(SpecialTarget).where(SpecialTarget.cycle_id == prev_cycle_id)
    )
    for st in result.scalars().all():
        db.add(SpecialTarget(
            cycle_id=new_cycle_id,
            target_name=st.target_name,
            target_value=st.target_value,
        ))

    # 项目类型系数和指标系数已由 _init_default_parameters 初始化
    # 如果上一周期有自定义值，覆盖默认值
    result = await db.execute(
        select(ProjectTypeCoeff).where(ProjectTypeCoeff.cycle_id == prev_cycle_id)
    )
    prev_coeffs = {c.project_type: c.coefficient for c in result.scalars().all()}
    if prev_coeffs:
        # 更新已有的
        result = await db.execute(
            select(ProjectTypeCoeff).where(ProjectTypeCoeff.cycle_id == new_cycle_id)
        )
        for c in result.scalars().all():
            if c.project_type in prev_coeffs:
                c.coefficient = prev_coeffs[c.project_type]
                db.add(c)

    result = await db.execute(
        select(IndicatorCoeff).where(IndicatorCoeff.cycle_id == prev_cycle_id)
    )
    prev_ind = {c.grade: c.coefficient for c in result.scalars().all()}
    if prev_ind:
        result = await db.execute(
            select(IndicatorCoeff).where(IndicatorCoeff.cycle_id == new_cycle_id)
        )
        for c in result.scalars().all():
            if c.grade in prev_ind:
                c.coefficient = prev_ind[c.grade]
                db.add(c)

    await db.flush()
