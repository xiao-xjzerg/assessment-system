"""项目业务逻辑"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import PROJECT_TYPES, IMPL_METHODS, DEFAULT_PROJECT_TYPE_COEFFICIENTS
from app.models.project import Project
from app.models.employee import Employee


def calc_economic_scale_coeff(profit: Decimal, signing_probability: Decimal = Decimal("1")) -> Decimal:
    """计算经济规模系数
    先按利润分段计算，再乘以签约概率（未签约项目）
    利润(万元): <50→0.5, 50~100→1, 100~300→1.5, 300~500→2, 500~1000→3, >=1000→4
    """
    p = float(profit)
    if p < 50:
        coeff = Decimal("0.5")
    elif p < 100:
        coeff = Decimal("1")
    elif p < 300:
        coeff = Decimal("1.5")
    elif p < 500:
        coeff = Decimal("2")
    elif p < 1000:
        coeff = Decimal("3")
    else:
        coeff = Decimal("4")
    return coeff * signing_probability


def calc_project_type_coeff(project_type: str) -> Decimal:
    """根据项目类型获取默认系数"""
    return Decimal(str(DEFAULT_PROJECT_TYPE_COEFFICIENTS.get(project_type, 1.0)))


def calc_project_coefficients(project: Project) -> None:
    """自动计算项目的经济规模系数、项目类型系数和工作量系数"""
    project.economic_scale_coeff = calc_economic_scale_coeff(
        Decimal(str(project.project_profit or 0)),
        Decimal(str(project.signing_probability or 1)),
    )
    project.project_type_coeff = calc_project_type_coeff(project.project_type)
    project.workload_coeff = project.economic_scale_coeff * project.project_type_coeff


def validate_project_row(row: dict, row_num: int) -> list[str]:
    """校验单行项目数据"""
    errors = []
    required = ["project_code", "project_name", "project_type"]
    for field in required:
        if not row.get(field):
            errors.append(f"第{row_num}行：{field}不能为空")

    pt = row.get("project_type", "")
    if pt and pt not in PROJECT_TYPES:
        errors.append(f"第{row_num}行：项目类型无效，应为 {'/'.join(PROJECT_TYPES)} 之一")

    impl = row.get("impl_method", "")
    if impl and impl not in IMPL_METHODS:
        errors.append(f"第{row_num}行：实施方式无效，应为 {'/'.join(IMPL_METHODS)} 之一")

    # 数值字段校验
    numeric_fields = [
        "contract_amount", "project_profit", "self_dev_income",
        "product_contract_amount",
    ]
    for nf in numeric_fields:
        val = row.get(nf)
        if val is not None and val != "":
            try:
                float(val)
            except (ValueError, TypeError):
                errors.append(f"第{row_num}行：{nf}必须为数值")

    return errors


async def import_projects(
    db: AsyncSession, cycle_id: int, rows: list[dict]
) -> dict:
    """批量导入项目数据"""
    all_errors = []
    valid_rows = []

    codes_in_file = []
    for i, row in enumerate(rows, start=2):
        errs = validate_project_row(row, i)
        if errs:
            all_errors.extend(errs)
        else:
            code = row["project_code"]
            if code in codes_in_file:
                all_errors.append(f"第{i}行：项目令号 {code} 在文件中重复")
            else:
                codes_in_file.append(code)
                valid_rows.append(row)

    if all_errors:
        return {"success_count": 0, "errors": all_errors}

    # 检查数据库中重复的项目令号
    result = await db.execute(
        select(Project.project_code).where(
            Project.cycle_id == cycle_id,
            Project.project_code.in_(codes_in_file),
        )
    )
    existing_codes = {row[0] for row in result.all()}
    if existing_codes:
        all_errors.append(f"以下项目令号已存在：{', '.join(existing_codes)}")
        return {"success_count": 0, "errors": all_errors}

    # 查找项目经理：按姓名匹配当前周期已导入的员工。
    # 项目经理不再依赖员工表的 role 字段；仅按姓名唯一匹配。
    # 若姓名不存在或存在同名（无法唯一确定），pm_id 置空，
    # 由前端在"项目管理"页以红色提示"缺少员工信息"。
    for row in valid_rows:
        pm_id = None
        pm_name_val = row.get("pm_name")
        if pm_name_val:
            pm_result = await db.execute(
                select(Employee.id).where(
                    Employee.cycle_id == cycle_id,
                    Employee.name == pm_name_val,
                )
            )
            matched_ids = [r[0] for r in pm_result.all()]
            if len(matched_ids) == 1:
                pm_id = matched_ids[0]

        proj = Project(
            cycle_id=cycle_id,
            project_code=row["project_code"],
            project_name=row["project_name"],
            project_type=row["project_type"],
            project_status=row.get("project_status", "进行中"),
            impl_method=row.get("impl_method"),
            department=row.get("department"),
            customer_name=row.get("customer_name"),
            contract_amount=Decimal(str(row.get("contract_amount") or 0)),
            project_profit=Decimal(str(row.get("project_profit") or 0)),
            self_dev_income=Decimal(str(row.get("self_dev_income") or 0)),
            product_contract_amount=Decimal(str(row.get("product_contract_amount") or 0)),
            presale_progress=Decimal(str(row.get("presale_progress") or 0)),
            delivery_progress=Decimal(str(row.get("delivery_progress") or 0)),
            pm_id=pm_id,
            pm_name=pm_name_val,
            signing_probability=Decimal(str(row.get("signing_probability") or 1)),
        )
        calc_project_coefficients(proj)
        db.add(proj)

    await db.flush()
    return {"success_count": len(valid_rows), "errors": []}


async def reimport_projects(
    db: AsyncSession, cycle_id: int, rows: list[dict]
) -> dict:
    """全量更新导入"""
    from sqlalchemy import delete
    await db.execute(delete(Project).where(Project.cycle_id == cycle_id))
    await db.flush()
    return await import_projects(db, cycle_id, rows)


async def get_projects(
    db: AsyncSession,
    cycle_id: int,
    page: int = 1,
    page_size: int = 20,
    search: Optional[str] = None,
    project_type: Optional[str] = None,
    department: Optional[str] = None,
    project_status: Optional[str] = None,
) -> tuple[list[Project], int]:
    """分页查询项目列表"""
    query = select(Project).where(Project.cycle_id == cycle_id)

    if search:
        query = query.where(
            or_(
                Project.project_name.contains(search),
                Project.project_code.contains(search),
            )
        )
    if project_type:
        query = query.where(Project.project_type == project_type)
    if department:
        query = query.where(Project.department == department)
    if project_status:
        query = query.where(Project.project_status == project_status)

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Project.id).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())
    return items, total
