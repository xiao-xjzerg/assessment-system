"""项目管理路由"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.project import Project
from app.models.cycle import Cycle
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut
from app.schemas.common import ResponseModel, PaginatedData
from app.services.project_service import (
    get_projects, import_projects, reimport_projects, calc_project_coefficients,
    normalize_signing_probability,
)
from app.services.excel_service import parse_project_excel, generate_project_template

import io
from decimal import Decimal

router = APIRouter(prefix="/api/projects", tags=["项目管理"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


def _project_out(proj: Project) -> ProjectOut:
    """序列化项目，附带 pm_missing 标记（pm_name 有值但 pm_id 为空）"""
    out = ProjectOut.model_validate(proj)
    out.pm_missing = bool(proj.pm_name) and proj.pm_id is None
    return out


# ---- 模板下载 ----
@router.get("/template")
async def download_template():
    """下载项目导入 Excel 模板"""
    data = generate_project_template()
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=project_template.xlsx"},
    )


# ---- Excel 导入 ----
@router.post("/import", response_model=ResponseModel)
async def import_excel(
    file: UploadFile = File(...),
    reimport: bool = Query(False, description="是否全量更新导入"),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """导入项目一览表 Excel"""
    cycle = await _get_active_cycle(db)

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="请上传 Excel 文件（.xlsx）")

    content = await file.read()
    rows = parse_project_excel(io.BytesIO(content))
    if not rows:
        raise HTTPException(status_code=400, detail="Excel 文件中没有数据")

    if reimport:
        result = await reimport_projects(db, cycle.id, rows)
    else:
        result = await import_projects(db, cycle.id, rows)

    if result["errors"]:
        return ResponseModel(code=400, message="导入失败", data=result)
    msg = f"成功导入 {result['success_count']} 个项目"
    if result.get("warnings"):
        msg += "；存在警告，请查看详情"
    return ResponseModel(message=msg, data=result)


# ---- 列表查询 ----
@router.get("", response_model=ResponseModel)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    search: Optional[str] = Query(None, description="项目名称/令号搜索"),
    project_type: Optional[str] = None,
    department: Optional[str] = None,
    project_status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """分页查询项目列表"""
    cycle = await _get_active_cycle(db)
    items, total = await get_projects(
        db, cycle.id, page, page_size, search, project_type, department, project_status
    )
    data = PaginatedData[ProjectOut](
        items=[_project_out(p) for p in items],
        total=total,
        page=page,
        page_size=page_size,
    )
    return ResponseModel(data=data.model_dump())


# ---- 获取单个项目 ----
@router.get("/{project_id}", response_model=ResponseModel)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """获取单个项目信息"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    proj = result.scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    return ResponseModel(data=_project_out(proj).model_dump())


# ---- 手动新增 ----
@router.post("", response_model=ResponseModel)
async def create_project(
    body: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """手动新增项目"""
    cycle = await _get_active_cycle(db)

    # 检查项目令号重复
    existing = await db.execute(
        select(Project).where(
            Project.cycle_id == cycle.id, Project.project_code == body.project_code
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该项目令号已存在")

    # 查找项目经理：按姓名唯一匹配；若查不到或同名冲突则 pm_id 留空，由前端标红提示
    pm_id = None
    if body.pm_name:
        pm_result = await db.execute(
            select(Employee.id).where(
                Employee.cycle_id == cycle.id,
                Employee.name == body.pm_name,
            )
        )
        matched_ids = [r[0] for r in pm_result.all()]
        if len(matched_ids) == 1:
            pm_id = matched_ids[0]

    proj = Project(
        cycle_id=cycle.id,
        project_code=body.project_code,
        project_name=body.project_name,
        project_type=body.project_type,
        project_status=body.project_status or "进行中",
        impl_method=body.impl_method,
        department=body.department,
        customer_name=body.customer_name,
        start_date=body.start_date,
        end_date=body.end_date,
        contract_amount=body.contract_amount,
        project_profit=body.project_profit,
        self_dev_income=body.self_dev_income,
        product_contract_amount=body.product_contract_amount,
        current_period_profit=body.current_period_profit,
        current_period_self_dev_income=body.current_period_self_dev_income,
        presale_progress=body.presale_progress,
        delivery_progress=body.delivery_progress,
        pm_id=pm_id,
        pm_name=body.pm_name,
        signing_probability=Decimal("1"),
    )
    await calc_project_coefficients(db, proj)
    db.add(proj)
    await db.flush()
    return ResponseModel(data=_project_out(proj).model_dump())


# ---- 编辑 ----
@router.put("/{project_id}", response_model=ResponseModel)
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """编辑项目信息"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    proj = result.scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    update_data = body.model_dump(exclude_unset=True)
    # 签约概率兼容：>1 视为百分比自动 /100
    if "signing_probability" in update_data and update_data["signing_probability"] is not None:
        update_data["signing_probability"] = normalize_signing_probability(
            update_data["signing_probability"]
        )
    for field, value in update_data.items():
        setattr(proj, field, value)

    # pm_name 变化时重新按姓名唯一匹配 pm_id
    if "pm_name" in update_data:
        proj.pm_id = None
        if proj.pm_name:
            pm_result = await db.execute(
                select(Employee.id).where(
                    Employee.cycle_id == proj.cycle_id,
                    Employee.name == proj.pm_name,
                )
            )
            matched_ids = [r[0] for r in pm_result.all()]
            if len(matched_ids) == 1:
                proj.pm_id = matched_ids[0]

    # 重新计算系数（如果相关字段有变化）
    recalc_fields = {"project_profit", "project_type", "signing_probability", "contract_amount"}
    if recalc_fields & set(update_data.keys()):
        await calc_project_coefficients(db, proj)

    db.add(proj)
    await db.flush()
    return ResponseModel(data=_project_out(proj).model_dump())


# ---- 删除 ----
@router.delete("/{project_id}", response_model=ResponseModel)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """删除项目"""
    result = await db.execute(select(Project).where(Project.id == project_id))
    proj = result.scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=404, detail="项目不存在")
    await db.delete(proj)
    await db.flush()
    return ResponseModel(message="删除成功")
