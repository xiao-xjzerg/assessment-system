"""认证相关 schema"""
from typing import Optional

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    phone: str = Field(..., description="手机号")
    password: str = Field(..., description="密码")


class LoginResponse(BaseModel):
    token: str
    user_id: int
    name: str
    role: str
    assess_type: Optional[str] = None  # 领导不参与考核，可为空
    department: str
    is_pm: bool = False  # 是否在当前周期担任项目经理（派生角色）


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., description="旧密码")
    new_password: str = Field(..., description="新密码")
