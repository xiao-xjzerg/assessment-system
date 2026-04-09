"""公共积分申报路由"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, ROLE_EMPLOYEE, ROLE_PM, ROLE_LEADER
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.cycle import Cycle
from app.models.public_score import PublicScore
from app.schemas.public_score import PublicScoreCreate, PublicScoreUpdate, PublicScoreOut
from app.schemas.common import ResponseModel
from app.services.public_score_service import (
    create_public_score,
    update_public_score,
    delete_public_score,
    get_public_scores,
)

router = APIRouter(prefix="/api/public-scores", tags=["公共积分申报"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


# ---- 员工：提交公共积分申报 ----
@router.post("", response_model=ResponseModel)
async def submit_public_score(
    body: PublicScoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """员工提交公共积分申报"""
    cycle = await _get_active_cycle(db)
    try:
        record = await create_public_score(
            db, cycle.id, current_user.id, current_user.name,
            body.model_dump(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    data = PublicScoreOut.model_validate(record).model_dump()
    return ResponseModel(message="申报成功", data=data)


# ---- 查询公共积分申报记录 ----
@router.get("", response_model=ResponseModel)
async def list_public_scores(
    employee_id: Optional[int] = Query(None, description="员工ID（管理员可用）"),
    employee_name: Optional[str] = Query(None, description="员工姓名模糊搜索"),
    activity_type: Optional[str] = Query(None, description="活动类型"),
    status: Optional[str] = Query(None, description="状态"),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """查询公共积分申报记录。普通员工只能看自己的，管理员可看全部"""
    cycle = await _get_active_cycle(db)

    if current_user.role == ROLE_ADMIN:
        items = await get_public_scores(
            db, cycle.id,
            employee_id=employee_id,
            activity_type=activity_type,
            status=status,
            employee_name=employee_name,
        )
    else:
        # 非管理员只能看自己的
        items = await get_public_scores(
            db, cycle.id,
            employee_id=current_user.id,
            activity_type=activity_type,
            status=status,
        )

    data = [PublicScoreOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


# ---- 修改公共积分申报 ----
@router.put("/{record_id}", response_model=ResponseModel)
async def edit_public_score(
    record_id: int,
    body: PublicScoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """修改公共积分申报。员工只能改自己的，管理员可改全部（含直接修改工作量系数和积分）"""
    # 检查记录所有权
    result = await db.execute(select(PublicScore).where(PublicScore.id == record_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")

    is_admin = current_user.role == ROLE_ADMIN
    if not is_admin and record.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权修改此记录")

    try:
        updated = await update_public_score(
            db, record_id,
            body.model_dump(exclude_unset=True),
            is_admin=is_admin,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = PublicScoreOut.model_validate(updated).model_dump()
    msg = "管理员已修改" if is_admin else "修改成功"
    return ResponseModel(message=msg, data=data)


# ---- 删除公共积分申报 ----
@router.delete("/{record_id}", response_model=ResponseModel)
async def remove_public_score(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """删除公共积分申报。员工只能删自己的，管理员可删全部"""
    result = await db.execute(select(PublicScore).where(PublicScore.id == record_id))
    record = result.scalar_one_or_none()
    if record is None:
        raise HTTPException(status_code=404, detail="记录不存在")

    is_admin = current_user.role == ROLE_ADMIN
    if not is_admin and record.employee_id != current_user.id:
        raise HTTPException(status_code=403, detail="无权删除此记录")

    try:
        await delete_public_score(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ResponseModel(message="删除成功")
