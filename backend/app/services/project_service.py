"""项目业务逻辑"""
from decimal import Decimal
from typing import Optional

from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import DEFAULT_PROJECT_TYPE_COEFFICIENTS
from app.models.project import Project
from app.models.employee import Employee
from app.models.parameter import ProjectTypeCoeff


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


async def get_project_type_coeff_map(db: AsyncSession, cycle_id: int) -> dict[str, Decimal]:
    """读取当前周期的项目类型系数表，返回 {project_type: coefficient}"""
    result = await db.execute(
        select(ProjectTypeCoeff).where(ProjectTypeCoeff.cycle_id == cycle_id)
    )
    return {c.project_type: Decimal(str(c.coefficient)) for c in result.scalars().all()}


async def calc_project_type_coeff(
    db: AsyncSession, cycle_id: int, project_type: str
) -> Decimal:
    """从当前周期的系数表取项目类型系数；未匹配则按 1.0 兜底"""
    coeff_map = await get_project_type_coeff_map(db, cycle_id)
    return coeff_map.get(project_type, Decimal("1.0"))


async def calc_project_coefficients(
    db: AsyncSession, project: Project, coeff_map: Optional[dict[str, Decimal]] = None
) -> None:
    """自动计算项目的经济规模系数、项目类型系数和工作量系数。

    coeff_map 为可选的预加载映射（批量调用时传入，避免 N+1 查询）。
    """
    project.economic_scale_coeff = calc_economic_scale_coeff(
        Decimal(str(project.project_profit or 0)),
        Decimal(str(project.signing_probability or 1)),
    )
    if coeff_map is None:
        coeff_map = await get_project_type_coeff_map(db, project.cycle_id)
    project.project_type_coeff = coeff_map.get(project.project_type, Decimal("1.0"))
    project.workload_coeff = project.economic_scale_coeff * project.project_type_coeff


def normalize_signing_probability(val) -> Decimal:
    """签约概率单位兼容：若录入值 >1 视为百分比，自动 /100。空值/异常时返回 1。"""
    if val is None or val == "":
        return Decimal("1")
    try:
        d = Decimal(str(val))
    except Exception:
        return Decimal("1")
    if d > 1:
        d = d / Decimal("100")
    if d < 0:
        d = Decimal("0")
    if d > 1:
        d = Decimal("1")
    return d


def validate_project_row(row: dict, row_num: int) -> list[str]:
    """校验单行项目数据。

    项目类型与实施方式不再做枚举硬校验：
    - 项目类型：允许任意字符串入库；若不在当前周期系数表中，导入后给出警告
    - 实施方式：仅做存储/展示用，不参与计算
    """
    errors = []
    required = ["project_code", "project_name", "project_type"]
    for field in required:
        if not row.get(field):
            errors.append(f"第{row_num}行：{field}不能为空")

    # 数值字段校验
    numeric_fields = [
        "contract_amount", "project_profit", "self_dev_income",
        "product_contract_amount",
        "current_period_profit", "current_period_self_dev_income",
        "signing_probability", "presale_progress", "delivery_progress",
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
        return {"success_count": 0, "errors": all_errors, "warnings": []}

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
        return {"success_count": 0, "errors": all_errors, "warnings": []}

    # 预加载当前周期的项目类型系数映射，避免 N+1 查询并用于收集警告
    coeff_map = await get_project_type_coeff_map(db, cycle_id)
    unknown_types: dict[str, int] = {}

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

        project_type = row["project_type"]
        if project_type not in coeff_map:
            unknown_types[project_type] = unknown_types.get(project_type, 0) + 1

        proj = Project(
            cycle_id=cycle_id,
            project_code=row["project_code"],
            project_name=row["project_name"],
            project_type=project_type,
            project_status=row.get("project_status", "进行中"),
            impl_method=row.get("impl_method"),
            department=row.get("department"),
            customer_name=row.get("customer_name"),
            contract_amount=Decimal(str(row.get("contract_amount") or 0)),
            project_profit=Decimal(str(row.get("project_profit") or 0)),
            self_dev_income=Decimal(str(row.get("self_dev_income") or 0)),
            product_contract_amount=Decimal(str(row.get("product_contract_amount") or 0)),
            current_period_profit=Decimal(str(row.get("current_period_profit") or 0)),
            current_period_self_dev_income=Decimal(str(row.get("current_period_self_dev_income") or 0)),
            presale_progress=Decimal(str(row.get("presale_progress") or 0)),
            delivery_progress=Decimal(str(row.get("delivery_progress") or 0)),
            pm_id=pm_id,
            pm_name=pm_name_val,
            signing_probability=normalize_signing_probability(row.get("signing_probability")),
        )
        await calc_project_coefficients(db, proj, coeff_map=coeff_map)
        db.add(proj)

    await db.flush()

    warnings = []
    if unknown_types:
        parts = [f"{t}（{n}条）" for t, n in unknown_types.items()]
        warnings.append(
            "以下项目类型未在当前周期的「项目类型系数表」中配置，已按系数 1.0 计算，"
            f"请前往「考核参数」页补充系数或在「项目管理」中修改项目类型：{', '.join(parts)}"
        )

    return {"success_count": len(valid_rows), "errors": [], "warnings": warnings}


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
