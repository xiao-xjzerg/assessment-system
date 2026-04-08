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
from app.models.employee import Employee
from app.schemas.auth import LoginRequest, LoginResponse, ChangePasswordRequest
from app.schemas.common import ResponseModel

router = APIRouter(prefix="/api/auth", tags=["认证"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


@router.post("/login", response_model=ResponseModel)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """手机号+密码登录，返回 JWT Token"""
    result = await db.execute(
        select(Employee).where(Employee.phone == req.phone)
    )
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
