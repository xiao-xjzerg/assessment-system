"""考核周期管理路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, ASSESSMENT_PHASES
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.schemas.cycle import CycleCreate, CycleOut, PhaseUpdate
from app.schemas.common import ResponseModel
from app.services.cycle_service import (
    get_all_cycles,
    get_active_cycle,
    create_cycle,
    switch_active_cycle,
    archive_cycle,
    update_phase,
)

router = APIRouter(prefix="/api/cycles", tags=["考核周期管理"])


@router.get("", response_model=ResponseModel)
async def list_cycles(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """获取所有考核周期"""
    cycles = await get_all_cycles(db)
    data = [CycleOut.model_validate(c).model_dump() for c in cycles]
    return ResponseModel(data=data)


@router.get("/active", response_model=ResponseModel)
async def get_active(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """获取当前活跃考核周期"""
    cycle = await get_active_cycle(db)
    if cycle is None:
        return ResponseModel(code=404, message="没有活跃的考核周期", data=None)
    data = CycleOut.model_validate(cycle).model_dump()
    data["phase_name"] = ASSESSMENT_PHASES.get(cycle.phase, "")
    return ResponseModel(data=data)


@router.post("", response_model=ResponseModel)
async def create(
    body: CycleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """创建新考核周期"""
    try:
        cycle = await create_cycle(db, body.name)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(message="考核周期创建成功", data=CycleOut.model_validate(cycle).model_dump())


@router.post("/{cycle_id}/activate", response_model=ResponseModel)
async def activate(
    cycle_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """切换活跃考核周期"""
    try:
        cycle = await switch_active_cycle(db, cycle_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(message="已切换活跃周期", data=CycleOut.model_validate(cycle).model_dump())


@router.post("/{cycle_id}/archive", response_model=ResponseModel)
async def do_archive(
    cycle_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """归档考核周期"""
    try:
        cycle = await archive_cycle(db, cycle_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResponseModel(message="周期已归档", data=CycleOut.model_validate(cycle).model_dump())


@router.post("/{cycle_id}/phase", response_model=ResponseModel)
async def change_phase(
    cycle_id: int,
    body: PhaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """切换考核阶段（next/prev）"""
    try:
        cycle = await update_phase(db, cycle_id, body.action)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    data = CycleOut.model_validate(cycle).model_dump()
    data["phase_name"] = ASSESSMENT_PHASES.get(cycle.phase, "")
    return ResponseModel(
        message=f"已切换到阶段{cycle.phase}-{ASSESSMENT_PHASES.get(cycle.phase, '')}",
        data=data,
    )
