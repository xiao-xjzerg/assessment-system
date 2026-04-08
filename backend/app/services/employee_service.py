"""员工业务逻辑"""
import re
from typing import Optional

from passlib.context import CryptContext
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import (
    ALL_ROLES, ALL_ASSESS_TYPES, ALL_DEPARTMENTS,
    DEFAULT_PASSWORD_SUFFIX_LENGTH,
)
from app.models.employee import Employee

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

PHONE_PATTERN = re.compile(r"^1\d{10}$")


def generate_default_password(phone: str) -> str:
    """生成初始密码：手机号后6位"""
    return phone[-DEFAULT_PASSWORD_SUFFIX_LENGTH:]


def validate_employee_row(row: dict, row_num: int) -> list[str]:
    """校验单行员工数据，返回错误列表"""
    errors = []
    required = ["name", "department", "phone", "role", "assess_type"]
    for field in required:
        if not row.get(field):
            errors.append(f"第{row_num}行：{field}不能为空")

    phone = row.get("phone", "")
    if phone and not PHONE_PATTERN.match(str(phone)):
        errors.append(f"第{row_num}行：手机号格式不正确（需11位数字）")

    role = row.get("role", "")
    if role and role not in ALL_ROLES:
        errors.append(f"第{row_num}行：角色值无效，应为 {'/'.join(ALL_ROLES)} 之一")

    assess_type = row.get("assess_type", "")
    if assess_type and assess_type not in ALL_ASSESS_TYPES:
        errors.append(f"第{row_num}行：考核类型无效，应为 {'/'.join(ALL_ASSESS_TYPES)} 之一")

    dept = row.get("department", "")
    if dept and dept not in ALL_DEPARTMENTS:
        errors.append(f"第{row_num}行：部门无效，应为 {'/'.join(ALL_DEPARTMENTS)} 之一")

    return errors


async def check_phone_duplicates(
    db: AsyncSession, phones: list[str], cycle_id: int
) -> list[str]:
    """检查手机号在当前周期是否重复"""
    result = await db.execute(
        select(Employee.phone).where(
            Employee.cycle_id == cycle_id,
            Employee.phone.in_(phones),
        )
    )
    existing = {row[0] for row in result.all()}
    return list(existing)


async def import_employees(
    db: AsyncSession, cycle_id: int, rows: list[dict]
) -> dict:
    """批量导入员工数据，返回 {success_count, errors}"""
    all_errors = []
    valid_rows = []

    # 先校验全部行
    phones_in_file = []
    for i, row in enumerate(rows, start=2):  # Excel 第2行开始是数据
        errs = validate_employee_row(row, i)
        if errs:
            all_errors.extend(errs)
        else:
            phone = str(row["phone"])
            if phone in phones_in_file:
                all_errors.append(f"第{i}行：手机号 {phone} 在文件中重复")
            else:
                phones_in_file.append(phone)
                valid_rows.append(row)

    if all_errors:
        return {"success_count": 0, "errors": all_errors}

    # 检查数据库中的重复手机号
    existing_phones = await check_phone_duplicates(db, phones_in_file, cycle_id)
    if existing_phones:
        all_errors.append(f"以下手机号已存在：{', '.join(existing_phones)}")
        return {"success_count": 0, "errors": all_errors}

    # 插入数据
    for row in valid_rows:
        phone = str(row["phone"])
        password = generate_default_password(phone)
        emp = Employee(
            cycle_id=cycle_id,
            name=row["name"],
            department=row["department"],
            group_name=row.get("group_name"),
            position=row.get("position"),
            grade=row.get("grade"),
            phone=phone,
            password_hash=pwd_context.hash(password),
            role=row["role"],
            assess_type=row["assess_type"],
            assess_type_secondary=row.get("assess_type_secondary"),
        )
        db.add(emp)

    await db.flush()
    return {"success_count": len(valid_rows), "errors": []}


async def reimport_employees(
    db: AsyncSession, cycle_id: int, rows: list[dict]
) -> dict:
    """全量更新导入（先删除当前周期所有员工再导入）"""
    from sqlalchemy import delete
    await db.execute(delete(Employee).where(Employee.cycle_id == cycle_id))
    await db.flush()
    return await import_employees(db, cycle_id, rows)


async def get_employees(
    db: AsyncSession,
    cycle_id: int,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    department: Optional[str] = None,
    group_name: Optional[str] = None,
    role: Optional[str] = None,
    assess_type: Optional[str] = None,
) -> tuple[list[Employee], int]:
    """分页查询员工列表"""
    query = select(Employee).where(Employee.cycle_id == cycle_id)

    if search:
        query = query.where(
            or_(
                Employee.name.contains(search),
                Employee.phone.contains(search),
            )
        )
    if department:
        query = query.where(Employee.department == department)
    if group_name:
        query = query.where(Employee.group_name == group_name)
    if role:
        query = query.where(Employee.role == role)
    if assess_type:
        query = query.where(Employee.assess_type == assess_type)

    # 总数
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # 分页
    query = query.order_by(Employee.id).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total


async def reset_password(db: AsyncSession, employee_id: int) -> str:
    """重置密码为初始密码，返回新密码"""
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if emp is None:
        raise ValueError("员工不存在")
    password = generate_default_password(emp.phone)
    emp.password_hash = pwd_context.hash(password)
    db.add(emp)
    await db.flush()
    return password
