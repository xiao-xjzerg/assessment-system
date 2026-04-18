"""员工管理路由"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.cycle import Cycle
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeOut
from app.schemas.common import ResponseModel, PaginatedData
from app.services.employee_service import (
    get_employees, import_employees, reimport_employees, reset_password,
)
from app.services.excel_service import parse_employee_excel, generate_employee_template

import io

router = APIRouter(prefix="/api/employees", tags=["员工管理"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


# ---- 模板下载 ----
@router.get("/template")
async def download_template():
    """下载员工导入 Excel 模板"""
    data = generate_employee_template()
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=employee_template.xlsx"},
    )


# ---- Excel 导入 ----
@router.post("/import", response_model=ResponseModel)
async def import_excel(
    file: UploadFile = File(...),
    reimport: bool = Query(False, description="是否全量更新导入"),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """导入员工信息 Excel"""
    cycle = await _get_active_cycle(db)

    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="请上传 Excel 文件（.xlsx）")

    content = await file.read()
    rows = parse_employee_excel(io.BytesIO(content))
    if not rows:
        raise HTTPException(status_code=400, detail="Excel 文件中没有数据")

    if reimport:
        result = await reimport_employees(db, cycle.id, rows)
    else:
        result = await import_employees(db, cycle.id, rows)

    if result["errors"]:
        return ResponseModel(code=400, message="导入失败", data=result)
    return ResponseModel(message=f"成功导入 {result['success_count']} 名员工", data=result)


# ---- 列表查询 ----
@router.get("", response_model=ResponseModel)
async def list_employees(
    page: int = Query(1, ge=1),
    page_size: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    search: Optional[str] = Query(None, description="姓名/手机号搜索"),
    department: Optional[str] = None,
    group_name: Optional[str] = None,
    role: Optional[str] = None,
    assess_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """分页查询员工列表"""
    cycle = await _get_active_cycle(db)
    items, total, duplicate_names = await get_employees(
        db, cycle.id, page, page_size, search, department, group_name, role, assess_type
    )
    out_items = []
    for e in items:
        model = EmployeeOut.model_validate(e)
        model.is_duplicate_name = e.name in duplicate_names
        out_items.append(model)
    data = PaginatedData[EmployeeOut](
        items=out_items,
        total=total,
        page=page,
        page_size=page_size,
    )
    return ResponseModel(data=data.model_dump())


# ---- 获取单个员工 ----
@router.get("/{employee_id}", response_model=ResponseModel)
async def get_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """获取单个员工信息"""
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail="员工不存在")
    return ResponseModel(data=EmployeeOut.model_validate(emp).model_dump())


# ---- 手动新增 ----
@router.post("", response_model=ResponseModel)
async def create_employee(
    body: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """手动新增单个员工"""
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    cycle = await _get_active_cycle(db)

    # 检查手机号重复
    existing = await db.execute(
        select(Employee).where(
            Employee.cycle_id == cycle.id, Employee.phone == body.phone
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="该手机号已存在")

    password = body.phone[-6:]
    emp = Employee(
        cycle_id=cycle.id,
        name=body.name,
        department=body.department,
        group_name=body.group_name,
        position=body.position,
        grade=body.grade,
        phone=body.phone,
        password_hash=pwd_context.hash(password),
        role=body.role,
        assess_type=body.assess_type,
    )
    db.add(emp)
    await db.flush()
    return ResponseModel(
        message=f"员工创建成功，初始密码为 {password}",
        data=EmployeeOut.model_validate(emp).model_dump(),
    )


# ---- 编辑 ----
@router.put("/{employee_id}", response_model=ResponseModel)
async def update_employee(
    employee_id: int,
    body: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """编辑员工信息"""
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail="员工不存在")

    update_data = body.model_dump(exclude_unset=True)

    # 若修改手机号，检查重复
    if "phone" in update_data:
        existing = await db.execute(
            select(Employee).where(
                Employee.cycle_id == emp.cycle_id,
                Employee.phone == update_data["phone"],
                Employee.id != employee_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="该手机号已存在")

    for field, value in update_data.items():
        setattr(emp, field, value)
    db.add(emp)
    await db.flush()
    return ResponseModel(data=EmployeeOut.model_validate(emp).model_dump())


# ---- 删除 ----
@router.delete("/{employee_id}", response_model=ResponseModel)
async def delete_employee(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """删除员工"""
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    emp = result.scalar_one_or_none()
    if emp is None:
        raise HTTPException(status_code=404, detail="员工不存在")
    await db.delete(emp)
    await db.flush()
    return ResponseModel(message="删除成功")


# ---- 重置密码 ----
@router.post("/{employee_id}/reset-password", response_model=ResponseModel)
async def reset_employee_password(
    employee_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """重置员工密码为初始密码"""
    try:
        new_pwd = await reset_password(db, employee_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return ResponseModel(message=f"密码已重置为 {new_pwd}")
