"""考核参数业务逻辑"""
from decimal import Decimal
from typing import List

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.parameter import DeptTarget, SpecialTarget, ProjectTypeCoeff, IndicatorCoeff
from app.models.project import Project
from app.config import DEFAULT_PROJECT_TYPE_COEFFICIENTS, DEFAULT_INDICATOR_COEFFICIENTS


# ==================== 部门人均目标值 ====================

async def get_dept_targets(db: AsyncSession, cycle_id: int) -> list:
    result = await db.execute(
        select(DeptTarget).where(DeptTarget.cycle_id == cycle_id)
        .order_by(DeptTarget.department, DeptTarget.group_name)
    )
    return result.scalars().all()


async def save_dept_targets(db: AsyncSession, cycle_id: int, items: list) -> list:
    """批量保存部门目标值（全量替换）"""
    await db.execute(delete(DeptTarget).where(DeptTarget.cycle_id == cycle_id))
    records = []
    for item in items:
        record = DeptTarget(
            cycle_id=cycle_id,
            department=item.department,
            group_name=item.group_name,
            profit_target=item.profit_target,
            income_target=item.income_target,
        )
        db.add(record)
        records.append(record)
    await db.flush()
    return records


# ==================== 专项目标值 ====================

async def get_special_targets(db: AsyncSession, cycle_id: int) -> list:
    result = await db.execute(
        select(SpecialTarget).where(SpecialTarget.cycle_id == cycle_id)
    )
    return result.scalars().all()


async def save_special_targets(
    db: AsyncSession,
    cycle_id: int,
    product_contract_target: Decimal,
    tech_innovation_target: Decimal,
) -> list:
    """保存专项目标值（全量替换）"""
    await db.execute(delete(SpecialTarget).where(SpecialTarget.cycle_id == cycle_id))

    records = []
    for name, value in [
        ("产品合同目标值", product_contract_target),
        ("科技创新目标值", tech_innovation_target),
    ]:
        record = SpecialTarget(cycle_id=cycle_id, target_name=name, target_value=value)
        db.add(record)
        records.append(record)
    await db.flush()
    return records


# ==================== 项目类型系数 ====================

async def get_project_type_coeffs(db: AsyncSession, cycle_id: int) -> list:
    result = await db.execute(
        select(ProjectTypeCoeff).where(ProjectTypeCoeff.cycle_id == cycle_id)
        .order_by(ProjectTypeCoeff.id)
    )
    return result.scalars().all()


async def save_project_type_coeffs(db: AsyncSession, cycle_id: int, items: list) -> list:
    """批量保存项目类型系数（全量替换）"""
    await db.execute(delete(ProjectTypeCoeff).where(ProjectTypeCoeff.cycle_id == cycle_id))
    records = []
    for item in items:
        record = ProjectTypeCoeff(
            cycle_id=cycle_id,
            project_type=item.project_type,
            coefficient=item.coefficient,
        )
        db.add(record)
        records.append(record)
    await db.flush()
    return records


async def reset_project_type_coeffs(db: AsyncSession, cycle_id: int) -> list:
    """重置项目类型系数为默认值"""
    await db.execute(delete(ProjectTypeCoeff).where(ProjectTypeCoeff.cycle_id == cycle_id))
    records = []
    for ptype, coeff in DEFAULT_PROJECT_TYPE_COEFFICIENTS.items():
        record = ProjectTypeCoeff(cycle_id=cycle_id, project_type=ptype, coefficient=coeff)
        db.add(record)
        records.append(record)
    await db.flush()
    return records


# ==================== 员工指标系数 ====================

async def get_indicator_coeffs(db: AsyncSession, cycle_id: int) -> list:
    result = await db.execute(
        select(IndicatorCoeff).where(IndicatorCoeff.cycle_id == cycle_id)
        .order_by(IndicatorCoeff.id)
    )
    return result.scalars().all()


async def save_indicator_coeffs(db: AsyncSession, cycle_id: int, items: list) -> list:
    """批量保存员工指标系数（全量替换）"""
    await db.execute(delete(IndicatorCoeff).where(IndicatorCoeff.cycle_id == cycle_id))
    records = []
    for item in items:
        record = IndicatorCoeff(
            cycle_id=cycle_id,
            grade=item.grade,
            coefficient=item.coefficient,
        )
        db.add(record)
        records.append(record)
    await db.flush()
    return records


async def reset_indicator_coeffs(db: AsyncSession, cycle_id: int) -> list:
    """重置员工指标系数为默认值"""
    await db.execute(delete(IndicatorCoeff).where(IndicatorCoeff.cycle_id == cycle_id))
    records = []
    for grade, coeff in DEFAULT_INDICATOR_COEFFICIENTS.items():
        record = IndicatorCoeff(cycle_id=cycle_id, grade=grade, coefficient=coeff)
        db.add(record)
        records.append(record)
    await db.flush()
    return records


# ==================== 签约概率 ====================

async def get_unsigned_projects(db: AsyncSession, cycle_id: int) -> list:
    """获取未签约项目列表（用于设置签约概率）"""
    result = await db.execute(
        select(Project).where(
            Project.cycle_id == cycle_id,
            Project.project_status != "已签约",
        ).order_by(Project.id)
    )
    return result.scalars().all()


async def save_signing_probabilities(db: AsyncSession, cycle_id: int, items: list) -> int:
    """批量保存签约概率"""
    count = 0
    for item in items:
        result = await db.execute(
            select(Project).where(
                Project.id == item.project_id,
                Project.cycle_id == cycle_id,
            )
        )
        project = result.scalar_one_or_none()
        if project:
            from app.services.project_service import (
                calc_project_coefficients, normalize_signing_probability,
            )
            project.signing_probability = normalize_signing_probability(item.signing_probability)
            # 重新计算经济规模系数（签约概率影响）
            await calc_project_coefficients(db, project)
            db.add(project)
            count += 1
    await db.flush()
    return count
