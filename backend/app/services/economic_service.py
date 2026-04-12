"""经济指标计算业务逻辑

经济指标计算规则（PRD M7）：
1. 项目利润区块（实施交付部交付经理/运营经理）：
   得分 = 满分 × 完成值 / (所在部门人均目标值 × 指标系数)
   满分：业务人员20分，基层管理人员30分
   得分上限为满分值

2. 自研收入区块（产品研发部全员）：
   产品化收入特殊规则：
   ①合同明确约定产品内容(impl_method='产品+服务')：核算收入 = 产品部分收入 × 参与系数 × 1.2
   ②未约定但实际使用产品的：核算收入 = 项目自研收入的15% × 参与系数
   各组得分计算差异：
   前端组/后端组：得分 = 20 × 完成值 / (部门人均目标值 × 指标系数)
   产品组：得分 = 15 × 自研完成值/(目标值×指标系数) + 5 × 产品合同完成值/产品合同目标值
   算法组：得分 = 15 × 自研完成值/(目标值×指标系数) + 5 × 科技创新完成值/科技创新目标值
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
D_015 = D("0.15")
D_1_2 = D("1.2")


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

    for part in emp_participations:
        project = projects.get(part.project_id)
        if project is None:
            continue

        profit = D(str(project.project_profit or 0))
        part_coeff = D(str(part.participation_coeff or 0))
        completed_value = (profit * part_coeff).quantize(D("0.01"), rounding=ROUND_HALF_UP)

        # 得分 = 满分 × 完成值 / (目标值 × 指标系数)
        denominator = target * grade_coeff
        if denominator > 0:
            score = (full_mark * completed_value / denominator).quantize(
                D("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            score = ZERO

        # 上限
        if score > full_mark:
            score = full_mark
        if score < ZERO:
            score = ZERO

        results.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "department": emp.department,
            "group_name": emp.group_name or "",
            "grade": emp.grade or "",
            "assess_type": emp.assess_type,
            "project_id": project.id,
            "project_name": project.project_name,
            "indicator_type": "利润",
            "raw_value": float(profit),
            "participation_coeff": float(part_coeff),
            "completed_value": float(completed_value),
            "target_value": float(target),
            "indicator_coeff": float(grade_coeff),
            "full_mark": float(full_mark),
            "score": float(score),
        })

    return results


def _calc_income_scores(
    emp, emp_participations, projects, dept_targets,
    special_targets, grade_coeff
) -> list[dict]:
    """计算产品研发部员工的自研收入得分"""
    results = []
    full_mark = D("20")  # 产品研发人员经济指标满分20分

    # 获取自研收入目标值
    income_target = _get_dept_income_target(dept_targets, emp.department, emp.group_name)
    # 专项目标值
    product_contract_target = special_targets.get("产品合同目标值", ZERO)
    tech_innovation_target = special_targets.get("科技创新目标值", ZERO)

    group = emp.group_name or ""

    for part in emp_participations:
        project = projects.get(part.project_id)
        if project is None:
            continue

        part_coeff = D(str(part.participation_coeff or 0))

        # 自研收入计算（含产品化收入特殊规则）
        self_dev_income = D(str(project.self_dev_income or 0))

        # 产品化收入特殊规则
        if project.impl_method == "产品+服务":
            # ①合同明确约定产品内容：核算收入 = 产品部分收入 × 参与系数 × 1.2
            product_income = D(str(project.product_contract_amount or 0))
            completed_value = (product_income * part_coeff * D_1_2).quantize(
                D("0.01"), rounding=ROUND_HALF_UP
            )
        else:
            # ②未约定但实际使用产品的（或普通项目）：核算收入 = 自研收入 × 参与系数
            # 对于有产品使用的：核算收入 = 项目自研收入的15% × 参与系数
            if self_dev_income > 0 and D(str(project.product_contract_amount or 0)) > 0:
                completed_value = (self_dev_income * D_015 * part_coeff).quantize(
                    D("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                completed_value = (self_dev_income * part_coeff).quantize(
                    D("0.01"), rounding=ROUND_HALF_UP
                )

        # 根据组别计算得分
        denominator = income_target * grade_coeff

        if group == "产品组":
            # 产品组：15 × 自研完成值/(目标值×指标系数) + 5 × 产品合同完成值/产品合同目标值
            if denominator > 0:
                income_part = D("15") * completed_value / denominator
            else:
                income_part = ZERO

            product_amount = D(str(project.product_contract_amount or 0))
            product_completed = (product_amount * part_coeff).quantize(D("0.01"), rounding=ROUND_HALF_UP)
            if product_contract_target > 0:
                product_part = D("5") * product_completed / product_contract_target
            else:
                product_part = ZERO

            score = (income_part + product_part).quantize(D("0.01"), rounding=ROUND_HALF_UP)

            # 额外记录产品合同明细
            if product_amount > 0:
                results.append({
                    "employee_id": emp.id,
                    "employee_name": emp.name,
                    "department": emp.department,
                    "group_name": group,
                    "grade": emp.grade or "",
                    "assess_type": emp.assess_type,
                    "project_id": project.id,
                    "project_name": project.project_name,
                    "indicator_type": "产品合同",
                    "raw_value": float(product_amount),
                    "participation_coeff": float(part_coeff),
                    "completed_value": float(product_completed),
                    "target_value": float(product_contract_target),
                    "indicator_coeff": float(grade_coeff),
                    "full_mark": 5.0,
                    "score": float(product_part.quantize(D("0.01"), rounding=ROUND_HALF_UP)),
                })

        elif group == "算法组":
            # 算法组：15 × 自研完成值/(目标值×指标系数) + 5 × 科技创新完成值/科技创新目标值
            if denominator > 0:
                income_part = D("15") * completed_value / denominator
            else:
                income_part = ZERO

            # 科技创新使用自研收入作为创新值近似
            tech_completed = completed_value
            if tech_innovation_target > 0:
                tech_part = D("5") * tech_completed / tech_innovation_target
            else:
                tech_part = ZERO

            score = (income_part + tech_part).quantize(D("0.01"), rounding=ROUND_HALF_UP)

        else:
            # 前端组/后端组：20 × 自研完成值/(目标值×指标系数)
            if denominator > 0:
                score = (full_mark * completed_value / denominator).quantize(
                    D("0.01"), rounding=ROUND_HALF_UP
                )
            else:
                score = ZERO

        # 上限
        if score > full_mark:
            score = full_mark
        if score < ZERO:
            score = ZERO

        results.append({
            "employee_id": emp.id,
            "employee_name": emp.name,
            "department": emp.department,
            "group_name": group,
            "grade": emp.grade or "",
            "assess_type": emp.assess_type,
            "project_id": project.id,
            "project_name": project.project_name,
            "indicator_type": "自研收入",
            "raw_value": float(self_dev_income),
            "participation_coeff": float(part_coeff),
            "completed_value": float(completed_value),
            "target_value": float(income_target),
            "indicator_coeff": float(grade_coeff),
            "full_mark": float(full_mark),
            "score": float(score),
        })

    return results


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
