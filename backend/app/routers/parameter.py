"""考核参数设置路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN
from app.database import get_db
from app.dependencies import require_roles
from app.models.employee import Employee
from app.models.cycle import Cycle
from app.schemas.parameter import (
    DeptTargetSave, DeptTargetOut,
    SpecialTargetSave, SpecialTargetOut,
    ProjectTypeCoeffSave, ProjectTypeCoeffOut,
    IndicatorCoeffSave, IndicatorCoeffOut,
    SigningProbabilitySave,
)
from app.schemas.project import ProjectOut
from app.schemas.common import ResponseModel
from app.services.parameter_service import (
    get_dept_targets, save_dept_targets,
    get_special_targets, save_special_targets,
    get_project_type_coeffs, save_project_type_coeffs, reset_project_type_coeffs,
    get_indicator_coeffs, save_indicator_coeffs, reset_indicator_coeffs,
    get_unsigned_projects, save_signing_probabilities,
)

router = APIRouter(prefix="/api/parameters", tags=["考核参数设置"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


# ==================== 部门人均目标值 ====================

@router.get("/dept-targets", response_model=ResponseModel)
async def list_dept_targets(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """获取部门人均目标值"""
    cycle = await _get_active_cycle(db)
    items = await get_dept_targets(db, cycle.id)
    data = [DeptTargetOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.post("/dept-targets", response_model=ResponseModel)
async def save_dept_targets_api(
    body: DeptTargetSave,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """批量保存部门人均目标值"""
    cycle = await _get_active_cycle(db)
    items = await save_dept_targets(db, cycle.id, body.items)
    data = [DeptTargetOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(message="部门目标值保存成功", data=data)


# ==================== 专项目标值 ====================

@router.get("/special-targets", response_model=ResponseModel)
async def list_special_targets(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """获取专项目标值"""
    cycle = await _get_active_cycle(db)
    items = await get_special_targets(db, cycle.id)
    data = [SpecialTargetOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.post("/special-targets", response_model=ResponseModel)
async def save_special_targets_api(
    body: SpecialTargetSave,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """保存专项目标值"""
    cycle = await _get_active_cycle(db)
    items = await save_special_targets(
        db, cycle.id, body.product_contract_target, body.tech_innovation_target
    )
    data = [SpecialTargetOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(message="专项目标值保存成功", data=data)


# ==================== 项目类型系数 ====================

@router.get("/project-type-coeffs", response_model=ResponseModel)
async def list_project_type_coeffs(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """获取项目类型系数表"""
    cycle = await _get_active_cycle(db)
    items = await get_project_type_coeffs(db, cycle.id)
    data = [ProjectTypeCoeffOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.post("/project-type-coeffs", response_model=ResponseModel)
async def save_project_type_coeffs_api(
    body: ProjectTypeCoeffSave,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """批量保存项目类型系数"""
    cycle = await _get_active_cycle(db)
    items = await save_project_type_coeffs(db, cycle.id, body.items)
    data = [ProjectTypeCoeffOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(message="项目类型系数保存成功", data=data)


@router.post("/project-type-coeffs/reset", response_model=ResponseModel)
async def reset_project_type_coeffs_api(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """重置项目类型系数为默认值"""
    cycle = await _get_active_cycle(db)
    items = await reset_project_type_coeffs(db, cycle.id)
    data = [ProjectTypeCoeffOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(message="已重置为默认值", data=data)


# ==================== 员工指标系数 ====================

@router.get("/indicator-coeffs", response_model=ResponseModel)
async def list_indicator_coeffs(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """获取员工指标系数表"""
    cycle = await _get_active_cycle(db)
    items = await get_indicator_coeffs(db, cycle.id)
    data = [IndicatorCoeffOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.post("/indicator-coeffs", response_model=ResponseModel)
async def save_indicator_coeffs_api(
    body: IndicatorCoeffSave,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """批量保存员工指标系数"""
    cycle = await _get_active_cycle(db)
    items = await save_indicator_coeffs(db, cycle.id, body.items)
    data = [IndicatorCoeffOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(message="员工指标系数保存成功", data=data)


@router.post("/indicator-coeffs/reset", response_model=ResponseModel)
async def reset_indicator_coeffs_api(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """重置员工指标系数为默认值"""
    cycle = await _get_active_cycle(db)
    items = await reset_indicator_coeffs(db, cycle.id)
    data = [IndicatorCoeffOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(message="已重置为默认值", data=data)


# ==================== 签约概率 ====================

@router.get("/signing-probabilities", response_model=ResponseModel)
async def list_signing_probabilities(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """获取未签约项目列表（含签约概率）"""
    cycle = await _get_active_cycle(db)
    projects = await get_unsigned_projects(db, cycle.id)
    data = [ProjectOut.model_validate(p).model_dump() for p in projects]
    return ResponseModel(data=data)


@router.post("/signing-probabilities", response_model=ResponseModel)
async def save_signing_probabilities_api(
    body: SigningProbabilitySave,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """批量保存签约概率"""
    cycle = await _get_active_cycle(db)
    count = await save_signing_probabilities(db, cycle.id, body.items)
    return ResponseModel(message=f"成功更新 {count} 个项目的签约概率")
