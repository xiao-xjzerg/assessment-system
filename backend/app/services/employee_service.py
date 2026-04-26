"""员工业务逻辑"""
import re
from typing import Optional

from passlib.context import CryptContext
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import (
    EMPLOYEE_ROLES, ALL_ASSESS_TYPES, ALL_DEPARTMENTS,
    ROLE_EMPLOYEE, ROLE_LEADER, DEFAULT_PASSWORD_SUFFIX_LENGTH,
    ADMIN_PHONE,
)
from app.models.employee import Employee

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

PHONE_PATTERN = re.compile(r"^1\d{10}$")


def generate_default_password(phone: str) -> str:
    """生成初始密码：手机号后6位"""
    return phone[-DEFAULT_PASSWORD_SUFFIX_LENGTH:]


def validate_employee_row(row: dict, row_num: int) -> list[str]:
    """校验单行员工数据，返回错误列表。
    注：角色若为空由调用方先补默认值"普通员工"再进入校验。
    """
    errors = []
    # 领导不参与考核，允许 assess_type 为空
    role = row.get("role", "") or ROLE_EMPLOYEE
    required = ["name", "department", "phone"]
    if role != ROLE_LEADER:
        required.append("assess_type")
    for field in required:
        if not row.get(field):
            errors.append(f"第{row_num}行：{field}不能为空")

    phone = row.get("phone", "")
    if phone and not PHONE_PATTERN.match(str(phone)):
        errors.append(f"第{row_num}行：手机号格式不正确（需11位数字）")
    if phone and str(phone) == ADMIN_PHONE:
        errors.append(f"第{row_num}行：手机号 {ADMIN_PHONE} 为系统保留账号，不可在导入文件中使用")

    role = row.get("role", "")
    if role and role not in EMPLOYEE_ROLES:
        errors.append(
            f"第{row_num}行：角色值无效，应为 {'/'.join(EMPLOYEE_ROLES)} 之一"
        )

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
        # 角色字段为空时默认为"普通员工"
        if not row.get("role"):
            row["role"] = ROLE_EMPLOYEE
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
            assess_type=row.get("assess_type") or None,
        )
        db.add(emp)

    await db.flush()
    return {"success_count": len(valid_rows), "errors": []}


async def reimport_employees(
    db: AsyncSession, cycle_id: int, rows: list[dict]
) -> dict:
    """全量更新导入（先删除当前周期所有员工再导入，但保留系统管理员 admin 行）"""
    from sqlalchemy import delete
    await db.execute(
        delete(Employee).where(
            Employee.cycle_id == cycle_id,
            Employee.phone != ADMIN_PHONE,
        )
    )
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
) -> tuple[list[Employee], int, set[str]]:
    """分页查询员工列表。

    返回 (items, total, duplicate_names)，duplicate_names 为当前周期内姓名重复的集合。
    """
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

    dup_result = await db.execute(
        select(Employee.name)
        .where(Employee.cycle_id == cycle_id)
        .group_by(Employee.name)
        .having(func.count(Employee.id) > 1)
    )
    duplicate_names = {row[0] for row in dup_result.all()}

    return items, total, duplicate_names


async def reset_password(db: AsyncSession, employee_id: int) -> str:
    """重置密码为初始密码，返回新密码"""
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if emp is None:
        raise ValueError("员工不存在")
    if emp.phone == ADMIN_PHONE:
        raise ValueError("系统管理员账号受保护，不可通过此接口重置密码，请使用『修改密码』功能")
    password = generate_default_password(emp.phone)
    emp.password_hash = pwd_context.hash(password)
    db.add(emp)
    await db.flush()
    return password
