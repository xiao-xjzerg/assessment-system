"""经济指标核算路由（M7）"""
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, ROLE_LEADER, ROLE_PM
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.cycle import Cycle
from app.schemas.common import ResponseModel
from app.services.economic_service import calculate_economic_indicators

router = APIRouter(prefix="/api/economic", tags=["经济指标核算"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


@router.post("/calculate", response_model=ResponseModel)
async def trigger_calculation(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员触发经济指标全量计算（刷新计算）"""
    cycle = await _get_active_cycle(db)
    details = await calculate_economic_indicators(db, cycle.id)
    return ResponseModel(message="经济指标计算完成", data=details)


@router.get("/details", response_model=ResponseModel)
async def list_details(
    employee_name: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    group_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """查询经济指标核算明细。管理员/领导可查全部，其他角色只查自己"""
    cycle = await _get_active_cycle(db)
    all_details = await calculate_economic_indicators(db, cycle.id)

    # 权限过滤
    if current_user.role == ROLE_ADMIN or current_user.role == ROLE_LEADER:
        filtered = all_details
    elif current_user.is_pm:
        filtered = [d for d in all_details if d["employee_id"] == current_user.id]
    else:
        filtered = [d for d in all_details if d["employee_id"] == current_user.id]

    # 筛选
    if employee_name:
        filtered = [d for d in filtered if employee_name in d["employee_name"]]
    if department:
        filtered = [d for d in filtered if d["department"] == department]
    if group_name:
        filtered = [d for d in filtered if d["group_name"] == group_name]

    return ResponseModel(data=filtered)


@router.get("/summary", response_model=ResponseModel)
async def list_summary(
    department: Optional[str] = Query(None),
    group_name: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """查询经济指标得分汇总（按员工聚合）"""
    cycle = await _get_active_cycle(db)
    all_details = await calculate_economic_indicators(db, cycle.id)

    # 权限过滤
    if current_user.role not in (ROLE_ADMIN, ROLE_LEADER):
        all_details = [d for d in all_details if d["employee_id"] == current_user.id]

    # 按员工汇总（排除产品合同类型的重复计分）
    # breakdown 字段返回参与总分计算的各条明细，供前端 Tooltip 展示完整公式
    emp_summary: dict[int, dict] = {}
    for d in all_details:
        eid = d["employee_id"]
        if eid not in emp_summary:
            emp_summary[eid] = {
                "employee_id": eid,
                "employee_name": d["employee_name"],
                "department": d["department"],
                "group_name": d["group_name"],
                "grade": d["grade"],
                "assess_type": d["assess_type"],
                "total_score": 0.0,
                "breakdown": [],
            }
        if d["indicator_type"] != "产品合同":
            emp_summary[eid]["total_score"] += d["score"]
            emp_summary[eid]["breakdown"].append({
                "project_name": d["project_name"],
                "indicator_type": d["indicator_type"],
                "raw_value": d["raw_value"],
                "participation_coeff": d["participation_coeff"],
                "completed_value": d["completed_value"],
                "target_value": d["target_value"],
                "indicator_coeff": d["indicator_coeff"],
                "full_mark": d["full_mark"],
                "score": d["score"],
            })

    summaries = list(emp_summary.values())
    for s in summaries:
        s["total_score"] = round(s["total_score"], 2)

    # 筛选
    if department:
        summaries = [s for s in summaries if s["department"] == department]
    if group_name:
        summaries = [s for s in summaries if s["group_name"] == group_name]

    summaries.sort(key=lambda x: x["total_score"], reverse=True)
    return ResponseModel(data=summaries)


@router.get("/export", response_model=None)
async def export_excel(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """导出经济指标核算表为 Excel 文件"""
    cycle = await _get_active_cycle(db)
    all_details = await calculate_economic_indicators(db, cycle.id)

    from openpyxl import Workbook
    wb = Workbook()

    # Sheet1: 经济指标明细
    ws = wb.active
    ws.title = "经济指标核算表"
    headers = [
        "员工姓名", "部门", "组/中心", "岗级", "考核类型",
        "项目名称", "指标类型", "原始值（万元）",
        "参与系数", "完成值（万元）", "目标值（万元）",
        "指标系数", "满分", "得分",
    ]
    ws.append(headers)
    for d in all_details:
        ws.append([
            d["employee_name"], d["department"], d["group_name"],
            d["grade"], d["assess_type"],
            d["project_name"], d["indicator_type"],
            d["raw_value"], d["participation_coeff"],
            d["completed_value"], d["target_value"],
            d["indicator_coeff"], d["full_mark"], d["score"],
        ])

    for col_cells in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col_cells)
        col_letter = col_cells[0].column_letter
        ws.column_dimensions[col_letter].width = max(max_len * 2 + 2, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=economic_report_{cycle.name}.xlsx"},
    )
