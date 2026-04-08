"""员工相关 schema"""
from typing import Optional
from pydantic import BaseModel, Field


class EmployeeCreate(BaseModel):
    name: str = Field(..., description="姓名")
    department: str = Field(..., description="部门")
    group_name: Optional[str] = Field(None, description="组/中心")
    position: Optional[str] = Field(None, description="岗位")
    grade: Optional[str] = Field(None, description="岗级")
    phone: str = Field(..., description="联系方式（手机号）")
    role: str = Field(..., description="角色")
    assess_type: str = Field(..., description="考核类型")
    assess_type_secondary: Optional[str] = Field(None, description="第二考核类型")


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    group_name: Optional[str] = None
    position: Optional[str] = None
    grade: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    assess_type: Optional[str] = None
    assess_type_secondary: Optional[str] = None
    is_active: Optional[bool] = None
    rating: Optional[str] = None
    leader_comment: Optional[str] = None


class EmployeeOut(BaseModel):
    id: int
    cycle_id: int
    name: str
    department: str
    group_name: Optional[str] = None
    position: Optional[str] = None
    grade: Optional[str] = None
    phone: str
    role: str
    assess_type: str
    assess_type_secondary: Optional[str] = None
    is_active: bool
    status: Optional[str] = None
    rating: Optional[str] = None
    leader_comment: Optional[str] = None

    model_config = {"from_attributes": True}
