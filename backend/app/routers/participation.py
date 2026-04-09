"""项目参与度填报路由"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, ROLE_PM
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.cycle import Cycle
from app.models.project import Project
from app.schemas.participation import ParticipationSave, ParticipationOut
from app.schemas.common import ResponseModel
from app.services.participation_service import (
    get_participations_by_project,
    get_participations_by_cycle,
    get_pm_projects,
    save_participations,
    delete_participation,
    get_project_participation_summary,
)

router = APIRouter(prefix="/api/participations", tags=["项目参与度"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


# ---- 项目经理：获取自己负责的项目列表 ----
@router.get("/my-projects", response_model=ResponseModel)
async def list_my_projects(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_PM, ROLE_ADMIN])),
):
    """获取当前项目经理负责的项目列表"""
    cycle = await _get_active_cycle(db)
    if current_user.role == ROLE_ADMIN:
        # 管理员看所有项目
        result = await db.execute(
            select(Project).where(Project.cycle_id == cycle.id).order_by(Project.id)
        )
        projects = result.scalars().all()
    else:
        projects = await get_pm_projects(db, cycle.id, current_user.id)

    from app.schemas.project import ProjectOut
    data = [ProjectOut.model_validate(p).model_dump() for p in projects]
    return ResponseModel(data=data)


# ---- 获取某项目的参与度记录 ----
@router.get("/project/{project_id}", response_model=ResponseModel)
async def list_by_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_PM, ROLE_ADMIN])),
):
    """获取某项目的参与度记录"""
    cycle = await _get_active_cycle(db)

    # 项目经理只能查看自己负责的项目
    if current_user.role == ROLE_PM:
        proj_result = await db.execute(
            select(Project).where(Project.id == project_id)
        )
        proj = proj_result.scalar_one_or_none()
        if proj is None or proj.pm_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权查看此项目的参与度")

    items = await get_participations_by_project(db, project_id)
    data = [ParticipationOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


# ---- 管理员：查看所有项目参与度 ----
@router.get("", response_model=ResponseModel)
async def list_all(
    project_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员查看所有参与度记录"""
    cycle = await _get_active_cycle(db)
    items = await get_participations_by_cycle(db, cycle.id, project_id, department, status)
    data = [ParticipationOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


# ---- 保存/提交参与度 ----
@router.post("", response_model=ResponseModel)
async def save(
    body: ParticipationSave,
    submit: bool = Query(False, description="是否提交（true=提交，false=仅保存）"),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_PM, ROLE_ADMIN])),
):
    """保存或提交项目参与度"""
    cycle = await _get_active_cycle(db)

    # 项目经理只能填自己负责的项目
    if current_user.role == ROLE_PM:
        proj_result = await db.execute(
            select(Project).where(Project.id == body.project_id)
        )
        proj = proj_result.scalar_one_or_none()
        if proj is None or proj.pm_id != current_user.id:
            raise HTTPException(status_code=403, detail="无权填写此项目的参与度")

    try:
        records = await save_participations(
            db, cycle.id, body.project_id, body.items, submit=submit
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = [ParticipationOut.model_validate(r).model_dump() for r in records]
    msg = "参与度已提交" if submit else "参与度已保存"
    return ResponseModel(message=msg, data=data)


# ---- 删除单条参与度记录 ----
@router.delete("/{participation_id}", response_model=ResponseModel)
async def remove(
    participation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_PM, ROLE_ADMIN])),
):
    """删除单条参与度记录"""
    try:
        await delete_participation(db, participation_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ResponseModel(message="删除成功")


# ---- 参与度填报概览 ----
@router.get("/summary", response_model=ResponseModel)
async def participation_summary(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """获取参与度填报概览"""
    cycle = await _get_active_cycle(db)
    summary = await get_project_participation_summary(db, cycle.id)
    return ResponseModel(data=summary)
