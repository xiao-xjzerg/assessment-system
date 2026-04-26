"""加减分与重点任务路由（M9）"""
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, ROLE_LEADER, ROLE_EMPLOYEE, ASSESS_TYPE_MANAGER
from app.database import get_db
from app.dependencies import require_roles
from app.models.employee import Employee
from app.models.cycle import Cycle
from app.models.bonus import KeyTaskScore
from app.schemas.bonus import (
    BonusRecordCreate,
    BonusRecordOut,
    KeyTaskScoreCreate,
    KeyTaskScoreUpdate,
    KeyTaskScoreOut,
)
from app.schemas.common import ResponseModel
from app.services.bonus_service import (
    get_bonus_records,
    create_bonus_record,
    delete_bonus_record,
    get_key_task_scores,
    create_key_task_score,
    update_key_task_score,
    delete_key_task_score,
)


def _check_key_task_access(current_user: Employee, target_employee_id: Optional[int] = None) -> None:
    """重点任务分数访问权限：

    - 管理员 / 领导：可操作全部基层管理人员
    - 普通员工 & assess_type=基层管理人员：仅可操作自己
    - 其他：403
    """
    if current_user.role in (ROLE_ADMIN, ROLE_LEADER):
        return
    if current_user.role == ROLE_EMPLOYEE and current_user.assess_type == ASSESS_TYPE_MANAGER:
        if target_employee_id is not None and target_employee_id != current_user.id:
            raise HTTPException(status_code=403, detail="仅可编辑本人的重点任务分数")
        return
    raise HTTPException(status_code=403, detail="权限不足")

router = APIRouter(prefix="/api/bonus", tags=["加减分与重点任务"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


# ---- 加减分记录 CRUD ----

@router.get("/records", response_model=ResponseModel)
async def list_bonus_records(
    employee_id: Optional[int] = Query(None),
    department: Optional[str] = Query(None),
    assess_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """查询加减分记录列表"""
    cycle = await _get_active_cycle(db)
    items = await get_bonus_records(
        db, cycle.id,
        employee_id=employee_id,
        department=department,
        assess_type=assess_type,
    )
    data = [BonusRecordOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.post("/records", response_model=ResponseModel)
async def add_bonus_record(
    body: BonusRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """新增加减分记录"""
    cycle = await _get_active_cycle(db)
    try:
        record = await create_bonus_record(
            db, cycle.id,
            employee_id=body.employee_id,
            description=body.description,
            value=body.value,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = BonusRecordOut.model_validate(record).model_dump()
    return ResponseModel(message="添加成功", data=data)


@router.delete("/records/{record_id}", response_model=ResponseModel)
async def remove_bonus_record(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """删除加减分记录"""
    try:
        await delete_bonus_record(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return ResponseModel(message="删除成功")


# ---- 重点任务申报（多条申请制） ----

@router.get("/key-tasks", response_model=ResponseModel)
async def list_key_task_scores(
    employee_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN, ROLE_LEADER, ROLE_EMPLOYEE])),
):
    """查询重点任务申请列表

    - 管理员 / 领导：返回全部（可通过 employee_id 过滤）
    - 基层管理人员：仅返回本人申请（忽略入参 employee_id）
    """
    _check_key_task_access(current_user)
    cycle = await _get_active_cycle(db)

    if current_user.role == ROLE_EMPLOYEE:
        items = await get_key_task_scores(db, cycle.id, employee_id=current_user.id)
    else:
        items = await get_key_task_scores(db, cycle.id, employee_id=employee_id)

    data = [KeyTaskScoreOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.post("/key-tasks", response_model=ResponseModel)
async def add_key_task(
    body: KeyTaskScoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN, ROLE_LEADER, ROLE_EMPLOYEE])),
):
    """新增一条重点任务申请"""
    _check_key_task_access(current_user, body.employee_id)
    cycle = await _get_active_cycle(db)
    try:
        record = await create_key_task_score(
            db, cycle.id,
            employee_id=body.employee_id,
            task_name=body.task_name,
            completion=body.completion,
            score=body.score,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = KeyTaskScoreOut.model_validate(record).model_dump()
    return ResponseModel(message="添加成功", data=data)


@router.put("/key-tasks/{record_id}", response_model=ResponseModel)
async def modify_key_task(
    record_id: int,
    body: KeyTaskScoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN, ROLE_LEADER, ROLE_EMPLOYEE])),
):
    """编辑一条重点任务申请"""
    target = await db.get(KeyTaskScore, record_id)
    if target is None:
        raise HTTPException(status_code=404, detail="重点任务申请不存在")
    _check_key_task_access(current_user, target.employee_id)

    try:
        record = await update_key_task_score(
            db, record_id,
            task_name=body.task_name,
            completion=body.completion,
            score=body.score,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = KeyTaskScoreOut.model_validate(record).model_dump()
    return ResponseModel(message="保存成功", data=data)


@router.delete("/key-tasks/{record_id}", response_model=ResponseModel)
async def remove_key_task(
    record_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN, ROLE_LEADER, ROLE_EMPLOYEE])),
):
    """删除一条重点任务申请"""
    target = await db.get(KeyTaskScore, record_id)
    if target is None:
        raise HTTPException(status_code=404, detail="重点任务申请不存在")
    _check_key_task_access(current_user, target.employee_id)

    try:
        await delete_key_task_score(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return ResponseModel(message="删除成功")


# ---- 导出 ----

@router.get("/export", response_model=None)
async def export_excel(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """导出加减分数据为 Excel 文件"""
    cycle = await _get_active_cycle(db)
    records = await get_bonus_records(db, cycle.id)
    key_tasks = await get_key_task_scores(db, cycle.id)

    from openpyxl import Workbook
    wb = Workbook()

    # Sheet1: 加减分记录
    ws = wb.active
    ws.title = "加减分记录"
    headers = ["员工姓名", "部门", "考核类型", "加减分项说明", "加减分值"]
    ws.append(headers)
    for r in records:
        ws.append([
            r.employee_name, r.department, r.assess_type,
            r.description, float(r.value),
        ])

    # Sheet2: 重点任务申请明细（多条/员工）
    ws2 = wb.create_sheet("重点任务申请")
    ws2.append(["员工姓名", "重点任务名称", "完成情况", "申请分值"])
    for k in key_tasks:
        ws2.append([
            k.employee_name,
            k.task_name or "",
            k.completion or "",
            float(k.score),
        ])

    for ws_item in [ws, ws2]:
        for col_cells in ws_item.columns:
            max_len = max(len(str(cell.value or "")) for cell in col_cells)
            col_letter = col_cells[0].column_letter
            ws_item.column_dimensions[col_letter].width = max(max_len * 2 + 2, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=bonus_report_{cycle.name}.xlsx"},
    )
