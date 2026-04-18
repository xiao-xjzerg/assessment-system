"""积分统计路由"""
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, ROLE_EMPLOYEE, ROLE_PM, ROLE_LEADER
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.cycle import Cycle
from app.schemas.score import ScoreDetailOut, ScoreDetailUpdate, ScoreSummaryOut
from app.schemas.common import ResponseModel
from app.services.score_service import (
    calculate_all_scores,
    get_score_details,
    update_score_detail,
    get_score_summaries,
    export_score_data,
)

router = APIRouter(prefix="/api/scores", tags=["积分统计"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


# ---- 触发积分计算 ----
@router.post("/calculate", response_model=ResponseModel)
async def trigger_calculation(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员触发全量积分计算（刷新计算）"""
    cycle = await _get_active_cycle(db)
    await calculate_all_scores(db, cycle.id)
    return ResponseModel(message="积分计算完成")


# ---- 积分明细查询 ----
@router.get("/details", response_model=ResponseModel)
async def list_details(
    employee_id: Optional[int] = Query(None),
    employee_name: Optional[str] = Query(None),
    project_name: Optional[str] = Query(None),
    phase: Optional[str] = Query(None, description="售前/交付/公共/转型"),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """查询积分明细。管理员/领导可查全部，其他角色只能查自己"""
    cycle = await _get_active_cycle(db)

    if current_user.role in (ROLE_ADMIN, ROLE_LEADER):
        items = await get_score_details(
            db, cycle.id,
            employee_id=employee_id,
            employee_name=employee_name,
            project_name=project_name,
            phase=phase,
            department=department,
        )
    elif current_user.is_pm:
        # 项目经理可以看自己负责项目的积分明细
        items = await get_score_details(
            db, cycle.id,
            employee_id=employee_id or current_user.id,
            employee_name=employee_name,
            project_name=project_name,
            phase=phase,
        )
    else:
        # 普通员工只能看自己的
        items = await get_score_details(
            db, cycle.id,
            employee_id=current_user.id,
            phase=phase,
        )

    data = [ScoreDetailOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


# ---- 管理员编辑积分明细 ----
@router.put("/details/{detail_id}", response_model=ResponseModel)
async def edit_detail(
    detail_id: int,
    body: ScoreDetailUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员编辑积分明细（修改后系统自动重算积分和汇总，记录修改人和修改时间）"""
    try:
        detail = await update_score_detail(
            db, detail_id,
            body.model_dump(exclude_unset=True),
            modified_by=current_user.name,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    data = ScoreDetailOut.model_validate(detail).model_dump()
    return ResponseModel(message="修改成功", data=data)


# ---- 积分汇总查询 ----
@router.get("/summary", response_model=ResponseModel)
async def list_summary(
    employee_name: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    assess_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """查询积分汇总。管理员/领导可查全部，其他角色只能查自己"""
    cycle = await _get_active_cycle(db)

    if current_user.role in (ROLE_ADMIN, ROLE_LEADER):
        items = await get_score_summaries(
            db, cycle.id,
            employee_name=employee_name,
            department=department,
            assess_type=assess_type,
        )
    else:
        items = await get_score_summaries(
            db, cycle.id,
            employee_name=current_user.name,
        )

    data = [ScoreSummaryOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


# ---- 导出积分统计报表 Excel ----
@router.get("/export", response_model=None)
async def export_excel(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """导出积分统计报表为 Excel 文件"""
    cycle = await _get_active_cycle(db)
    data = await export_score_data(db, cycle.id)

    from openpyxl import Workbook
    wb = Workbook()

    # Sheet1: 积分汇总
    ws_summary = wb.active
    ws_summary.title = "积分汇总"
    summary_headers = [
        "员工姓名", "部门", "考核类型",
        "项目积分合计", "公共积分合计", "转型积分合计",
        "总积分", "开方归一化得分",
    ]
    ws_summary.append(summary_headers)
    for s in data["summaries"]:
        ws_summary.append([
            s.employee_name, s.department, s.assess_type,
            float(s.project_score_total), float(s.public_score_total),
            float(s.transform_score_total), float(s.total_score),
            float(s.normalized_score),
        ])

    # Sheet2: 积分明细
    ws_detail = wb.create_sheet("积分明细")
    detail_headers = [
        "员工姓名", "项目名称", "阶段", "基础分值",
        "进度系数", "工作量系数", "参与系数", "分数",
        "修改人", "备注",
    ]
    ws_detail.append(detail_headers)
    for d in data["details"]:
        ws_detail.append([
            d.employee_name, d.project_name or "", d.phase,
            float(d.base_score), float(d.progress_coeff),
            float(d.workload_coeff), float(d.participation_coeff),
            float(d.score),
            d.modified_by or "", d.remark or "",
        ])

    # 设置列宽
    for ws in [ws_summary, ws_detail]:
        for col_idx, col in enumerate(ws.columns, 1):
            max_len = max(len(str(cell.value or "")) for cell in col)
            ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26 else "A"].width = max(max_len * 2 + 2, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=score_report_{cycle.name}.xlsx"},
    )
