"""认证路由：登录、修改密码"""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_ACCESS_TOKEN_EXPIRE_HOURS
from app.database import get_db
from app.dependencies import get_current_user
from app.models.cycle import Cycle
from app.models.employee import Employee
from app.schemas.auth import LoginRequest, LoginResponse, ChangePasswordRequest
from app.schemas.common import ResponseModel

router = APIRouter(prefix="/api/auth", tags=["认证"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_ACCESS_TOKEN_EXPIRE_HOURS)
    # JWT 规范要求 sub 必须是字符串（python-jose 解码时会校验），
    # 因此这里转 str；get_current_user 解码后再转回 int。
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


@router.post("/login", response_model=ResponseModel)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """手机号+密码登录，返回 JWT Token

    同一手机号可能在多个考核周期都存在记录（每个周期都会继承一份员工档案）。
    登录策略：优先取活跃周期的账号；若无活跃周期，按 id 倒序取最新的。
    """
    active_cycle_id = await db.scalar(
        select(Cycle.id).where(Cycle.is_active == True)
    )
    stmt = select(Employee).where(Employee.phone == req.phone)
    if active_cycle_id is not None:
        stmt = stmt.where(Employee.cycle_id == active_cycle_id)
    stmt = stmt.order_by(Employee.id.desc()).limit(1)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None or not pwd_context.verify(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="手机号或密码错误",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )

    token = create_access_token(user.id)
    data = LoginResponse(
        token=token,
        user_id=user.id,
        name=user.name,
        role=user.role,
        assess_type=user.assess_type,
        department=user.department,
    )
    return ResponseModel(data=data.model_dump())


@router.post("/change-password", response_model=ResponseModel)
async def change_password(
    req: ChangePasswordRequest,
    current_user: Employee = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """修改密码"""
    if not pwd_context.verify(req.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="旧密码不正确",
        )
    current_user.password_hash = pwd_context.hash(req.new_password)
    db.add(current_user)
    await db.flush()
    return ResponseModel(message="密码修改成功")
