"""公共依赖（获取当前用户、权限校验）"""
from functools import wraps
from typing import List

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import JWT_SECRET_KEY, JWT_ALGORITHM, ROLE_PM
from app.database import get_db
from app.models.cycle import Cycle
from app.models.employee import Employee
from app.models.project import Project

security = HTTPBearer()


async def is_project_manager(db: AsyncSession, user_id: int) -> bool:
    """判断用户在当前活跃周期内是否为某个项目的项目经理。

    项目经理角色不再写入 employees.role，而是根据项目一览表的 pm_id 动态派生。
    """
    cycle_id = await db.scalar(select(Cycle.id).where(Cycle.is_active == True))
    if cycle_id is None:
        return False
    exists_id = await db.scalar(
        select(Project.id).where(
            Project.cycle_id == cycle_id,
            Project.pm_id == user_id,
        ).limit(1)
    )
    return exists_id is not None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Employee:
    """从 JWT Token 中获取当前登录用户"""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        sub = payload.get("sub")
        if sub is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭据",
            )
        # JWT 规范中 sub 必须是字符串，登录时已转 str，这里转回 int。
        try:
            user_id = int(sub)
        except (TypeError, ValueError):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="无效的认证凭据",
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的认证凭据",
        )

    result = await db.execute(select(Employee).where(Employee.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )
    # 动态派生"项目经理"权限：员工表中不再保存该角色，仅基于当前周期项目一览表判定
    user.is_pm = await is_project_manager(db, user.id)
    return user


def require_roles(allowed_roles: List[str]):
    """角色权限校验依赖。

    允许以下任一匹配即通过：
    - 用户的 role 字段在 allowed_roles 中；
    - 允许角色包含"项目经理"且用户在当前周期被派生为 PM（user.is_pm=True）。
    """
    async def role_checker(current_user: Employee = Depends(get_current_user)):
        if current_user.role in allowed_roles:
            return current_user
        if ROLE_PM in allowed_roles and getattr(current_user, "is_pm", False):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"权限不足，需要角色：{', '.join(allowed_roles)}",
        )
    return role_checker
