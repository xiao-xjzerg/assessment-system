"""经济指标计算业务逻辑

经济指标以「项目一览表」的 `当期确认项目利润` / `当期确认自研收入` 为准：
员工单项目完成值 = 当期确认值 × 参与系数
员工完成值 = 该员工在所有参与项目上完成值的累加

1. 项目利润区块（实施交付部）：
   得分 = 满分 × 完成值 / (所在部门人均目标值 × 指标系数)
   满分：业务人员 20 分，基层管理人员 30 分
   得分上限为满分值

2. 自研收入区块（产品研发部）：
   前端组 / 后端组：20 × 自研完成值 / (人均目标值 × 指标系数)
   产品组：15 × 自研完成值 / (人均目标值 × 指标系数) + 5 × 产品合同完成值 / 产品合同目标值
     其中 当期产品金额 = 当期确认自研收入 × (产品合同金额 / 自研收入)
          产品合同完成值 = 当期产品金额 × 参与系数
          （self_dev_income = 0 时当期产品金额视为 0）
   算法组：15 × 自研完成值 / (人均目标值 × 指标系数) + 5 × 科技创新完成值 / 科技创新目标值
     （科技创新完成值当前以自研完成值近似）

注：一览表中 `产品合同金额` 列由外部按 `合同产品部分×1.2` 或 `项目自研收入×15%` 口径预先生成，
本系统不再做此类变换，统一直接读取字段值按上述公式核算。
"""
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.models.employee import Employee
from app.models.participation import Participation
from app.models.parameter import DeptTarget, SpecialTarget, IndicatorCoeff
from app.config import (
    DEPT_DELIVERY, DEPT_RD,
    ASSESS_TYPE_MANAGER, ASSESS_TYPE_BUSINESS, ASSESS_TYPE_RD, ASSESS_TYPE_PUBLIC,
)

D = Decimal
ZERO = D("0")


async def calculate_economic_indicators(db: AsyncSession, cycle_id: int) -> list[dict]:
    """
    计算所有员工的经济指标得分，返回明细列表。
    每条记录包含：employee_id, employee_name, department, group_name, grade, assess_type,
                  project_id, project_name, indicator_type(利润/自研/产品合同),
                  raw_value, participation_coeff, completed_value, target_value,
                  indicator_coeff, full_mark, score
    """
    # 加载数据
    employees = await _load_employees(db, cycle_id)
    projects = await _load_projects(db, cycle_id)
    participations = await _load_participations(db, cycle_id)
    dept_targets = await _load_dept_targets(db, cycle_id)
    special_targets = await _load_special_targets(db, cycle_id)
    indicator_coeffs = await _load_indicator_coeffs(db, cycle_id)

    results = []

    for emp in employees.values():
        # 领导不参与考核
        if emp.role == "领导":
            continue
        # 公共人员没有经济指标
        if emp.assess_type == ASSESS_TYPE_PUBLIC:
            continue

        emp_participations = participations.get(emp.id, [])
        if not emp_participations:
            continue

        grade_coeff = _get_indicator_coeff(indicator_coeffs, emp.grade)

        if emp.department == DEPT_DELIVERY:
            # 实施交付部 → 项目利润区块
            profit_results = _calc_profit_scores(
                emp, emp_participations, projects, dept_targets, grade_coeff
            )
            results.extend(profit_results)

        elif emp.department == DEPT_RD:
            # 产品研发部 → 自研收入区块
            income_results = _calc_income_scores(
                emp, emp_participations, projects, dept_targets,
                special_targets, grade_coeff
            )
            results.extend(income_results)

    return results


def _calc_profit_scores(
    emp, emp_participations, projects, dept_targets, grade_coeff
) -> list[dict]:
    """计算实施交付部员工的项目利润得分"""
    results = []
    # 满分：业务人员20分，基层管理人员30分
    if emp.assess_type == ASSESS_TYPE_MANAGER:
        full_mark = D("30")
    else:
        full_mark = D("20")

    # 获取所在部门/组的人均利润目标值
    target = _get_dept_profit_target(dept_targets, emp.department, emp.group_name)

    # 累加员工在所有项目上的完成值
    denominator = target * grade_coeff
    total_completed = ZERO
    project_rows = []

    for part in emp_participations:
        project = projects.get(part.project_id)
        if project is None:
            continue

        current_profit = D(str(project.current_period_profit or 0))
        part_coeff = D(str(part.participation_coeff or 0))
        completed_value = (current_profit * part_coeff).quantize(D("0.01"), rounding=ROUND_HALF_UP)
        total_completed += completed_value

        project_rows.append({
            "project_id": project.id,
            "project_name": project.project_name,
            "raw_value": float(current_profit),
            "participation_coeff": float(part_coeff),
            "completed_value": float(completed_value),
        })

    # 按总完成值计算员工总得分
    if denominator > 0:
        total_score = (full_mark * total_completed / denominator).quantize(
            D("0.01"), rounding=ROUND_HALF_UP
        )
    else:
        total_score = ZERO
    if total_score > full_mark:
        total_score = full_mark
    if total_score < ZERO:
        total_score = ZERO

    _append_proportional_rows(
        results, emp, emp.group_name or "", "利润", project_rows,
        total_completed, total_score,
        float(target), float(grade_coeff), float(full_mark),
    )

    return results


def _calc_income_scores(
    emp, emp_participations, projects, dept_targets,
    special_targets, grade_coeff
) -> list[dict]:
    """计算产品研发部员工的自研收入得分（以"当期确认自研收入"为口径累加核算）"""
    results = []
    full_mark = D("20")  # 产品研发人员经济指标满分 20

    income_target = _get_dept_income_target(dept_targets, emp.department, emp.group_name)
    product_contract_target = special_targets.get("产品合同目标值", ZERO)
    tech_innovation_target = special_targets.get("科技创新目标值", ZERO)

    group = emp.group_name or ""
    denominator = income_target * grade_coeff

    # 归集员工在所有项目上的自研完成值 / 产品合同完成值
    income_rows = []
    product_rows = []
    total_income_completed = ZERO
    total_product_completed = ZERO

    for part in emp_participations:
        project = projects.get(part.project_id)
        if project is None:
            continue

        part_coeff = D(str(part.participation_coeff or 0))
        current_income = D(str(project.current_period_self_dev_income or 0))
        income_completed = (current_income * part_coeff).quantize(
            D("0.01"), rounding=ROUND_HALF_UP
        )
        total_income_completed += income_completed

        income_rows.append({
            "project_id": project.id,
            "project_name": project.project_name,
            "raw_value": float(current_income),
            "participation_coeff": float(part_coeff),
            "completed_value": float(income_completed),
        })

        if group == "产品组":
            # 当期产品金额 = 当期确认自研收入 × (产品合同金额 / 自研收入)
            self_dev_total = D(str(project.self_dev_income or 0))
            product_amount = D(str(project.product_contract_amount or 0))
            if self_dev_total > 0:
                current_product = current_income * product_amount / self_dev_total
            else:
                current_product = ZERO
            product_completed = (current_product * part_coeff).quantize(
                D("0.01"), rounding=ROUND_HALF_UP
            )
            total_product_completed += product_completed
            if product_completed != 0:
                product_rows.append({
                    "project_id": project.id,
                    "project_name": project.project_name,
                    "raw_value": float(current_product.quantize(D("0.01"), rounding=ROUND_HALF_UP)),
                    "participation_coeff": float(part_coeff),
                    "completed_value": float(product_completed),
                })

    if group == "产品组":
        if denominator > 0:
            income_part = D("15") * total_income_completed / denominator
        else:
            income_part = ZERO
        if income_part > D("15"):
            income_part = D("15")
        if income_part < ZERO:
            income_part = ZERO

        if product_contract_target > 0:
            product_part = D("5") * total_product_completed / product_contract_target
        else:
            product_part = ZERO
        if product_part > D("5"):
            product_part = D("5")
        if product_part < ZERO:
            product_part = ZERO

        income_part = income_part.quantize(D("0.01"), rounding=ROUND_HALF_UP)
        product_part = product_part.quantize(D("0.01"), rounding=ROUND_HALF_UP)

        _append_proportional_rows(
            results, emp, group, "自研收入", income_rows,
            total_income_completed, income_part,
            float(income_target), float(grade_coeff), 15.0,
        )
        _append_proportional_rows(
            results, emp, group, "产品合同", product_rows,
            total_product_completed, product_part,
            float(product_contract_target), float(grade_coeff), 5.0,
        )

    elif group == "算法组":
        if denominator > 0:
            income_part = D("15") * total_income_completed / denominator
        else:
            income_part = ZERO
        if income_part > D("15"):
            income_part = D("15")
        if income_part < ZERO:
            income_part = ZERO

        # 科技创新完成值以自研完成值近似
        if tech_innovation_target > 0:
            tech_part = D("5") * total_income_completed / tech_innovation_target
        else:
            tech_part = ZERO
        if tech_part > D("5"):
            tech_part = D("5")
        if tech_part < ZERO:
            tech_part = ZERO

        combined_part = (income_part + tech_part).quantize(D("0.01"), rounding=ROUND_HALF_UP)
        if combined_part > full_mark:
            combined_part = full_mark

        _append_proportional_rows(
            results, emp, group, "自研收入", income_rows,
            total_income_completed, combined_part,
            float(income_target), float(grade_coeff), float(full_mark),
        )

    else:
        if denominator > 0:
            total_score = (full_mark * total_income_completed / denominator).quantize(
                D("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            total_score = ZERO
        if total_score > full_mark:
            total_score = full_mark
        if total_score < ZERO:
            total_score = ZERO

        _append_proportional_rows(
            results, emp, group, "自研收入", income_rows,
            total_income_completed, total_score,
            float(income_target), float(grade_coeff), float(full_mark),
        )

    return results


def _append_proportional_rows(
    results, emp, group, indicator_type, project_rows,
    total_completed, total_score,
    target_value, indicator_coeff, full_mark,
):
    """将员工总得分按各项目完成值占比分摊到明细行，方便页面展示与求和。
    最后一行兜底，保证分摊后各行之和等于总得分。"""
    total_completed_d = D(str(total_completed))
    total_score_d = D(str(total_score))
    remaining = total_score_d
    for i, row in enumerate(project_rows):
        completed = D(str(row["completed_value"]))
        if i == len(project_rows) - 1:
            share = remaining
        elif total_completed_d > 0:
            share = (total_score_d * completed / total_completed_d).quantize(
                D("0.01"), rounding=ROUND_HALF_UP
            )
            remaining -= share
        else:
            share = ZERO
        results.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "department": emp.department,
            "group_name": group,
            "grade": emp.grade or "",
            "assess_type": emp.assess_type,
            "project_id": row["project_id"],
            "project_name": row["project_name"],
            "indicator_type": indicator_type,
            "raw_value": row["raw_value"],
            "participation_coeff": row["participation_coeff"],
            "completed_value": row["completed_value"],
            "target_value": target_value,
            "indicator_coeff": indicator_coeff,
            "full_mark": full_mark,
            "score": float(share),
        })


def _get_indicator_coeff(indicator_coeffs: dict[str, D], grade: Optional[str]) -> D:
    """获取员工指标系数"""
    if grade and grade in indicator_coeffs:
        return indicator_coeffs[grade]
    return D("1.0")


def _get_dept_profit_target(dept_targets: dict, department: str, group_name: Optional[str]) -> D:
    """获取部门人均利润目标值"""
    key = f"{department}_{group_name or ''}"
    if key in dept_targets:
        return dept_targets[key].get("profit", ZERO)
    # 尝试只用部门
    dept_key = f"{department}_"
    if dept_key in dept_targets:
        return dept_targets[dept_key].get("profit", ZERO)
    return ZERO


def _get_dept_income_target(dept_targets: dict, department: str, group_name: Optional[str]) -> D:
    """获取部门人均自研收入目标值"""
    key = f"{department}_{group_name or ''}"
    if key in dept_targets:
        return dept_targets[key].get("income", ZERO)
    dept_key = f"{department}_"
    if dept_key in dept_targets:
        return dept_targets[dept_key].get("income", ZERO)
    return ZERO


async def get_employee_economic_score(details: list[dict], employee_id: int) -> D:
    """汇总某员工的经济指标总得分（去除产品合同明细的重复计分）"""
    total = ZERO
    for d in details:
        if d["employee_id"] == employee_id and d["indicator_type"] != "产品合同":
            total += D(str(d["score"]))
    return total.quantize(D("0.01"), rounding=ROUND_HALF_UP)


# ---- 数据加载辅助函数 ----

async def _load_employees(db: AsyncSession, cycle_id: int) -> dict[int, Employee]:
    result = await db.execute(
        select(Employee).where(Employee.cycle_id == cycle_id, Employee.is_active == True)
    )
    return {e.id: e for e in result.scalars().all()}


async def _load_projects(db: AsyncSession, cycle_id: int) -> dict[int, Project]:
    result = await db.execute(
        select(Project).where(Project.cycle_id == cycle_id)
    )
    return {p.id: p for p in result.scalars().all()}


async def _load_participations(db: AsyncSession, cycle_id: int) -> dict[int, list]:
    result = await db.execute(
        select(Participation).where(Participation.cycle_id == cycle_id)
    )
    parts: dict[int, list] = {}
    for p in result.scalars().all():
        parts.setdefault(p.employee_id, []).append(p)
    return parts


async def _load_dept_targets(db: AsyncSession, cycle_id: int) -> dict:
    result = await db.execute(
        select(DeptTarget).where(DeptTarget.cycle_id == cycle_id)
    )
    targets = {}
    for t in result.scalars().all():
        key = f"{t.department}_{t.group_name or ''}"
        targets[key] = {
            "profit": D(str(t.profit_target or 0)),
            "income": D(str(t.income_target or 0)),
        }
    return targets


async def _load_special_targets(db: AsyncSession, cycle_id: int) -> dict[str, D]:
    result = await db.execute(
        select(SpecialTarget).where(SpecialTarget.cycle_id == cycle_id)
    )
    return {t.target_name: D(str(t.target_value or 0)) for t in result.scalars().all()}


async def _load_indicator_coeffs(db: AsyncSession, cycle_id: int) -> dict[str, D]:
    result = await db.execute(
        select(IndicatorCoeff).where(IndicatorCoeff.cycle_id == cycle_id)
    )
    return {c.grade: D(str(c.coefficient or 1)) for c in result.scalars().all()}
