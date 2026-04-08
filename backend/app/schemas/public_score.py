"""公共积分申报相关 schema"""
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field


class PublicScoreCreate(BaseModel):
    activity_name: str = Field(..., description="活动名称")
    activity_type: str = Field(..., description="活动类型：公共活动/转型活动")
    man_months: Decimal = Field(..., ge=0, description="投入人力（人月）")
    complexity: str = Field(..., description="复杂度：较简单/中等/极大")
    remark: Optional[str] = None


class PublicScoreUpdate(BaseModel):
    activity_name: Optional[str] = None
    activity_type: Optional[str] = None
    man_months: Optional[Decimal] = None
    complexity: Optional[str] = None
    workload_coeff: Optional[Decimal] = None  # 管理员可直接修改
    score: Optional[Decimal] = None  # 管理员可直接修改
    remark: Optional[str] = None


class PublicScoreOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    employee_name: str
    activity_name: str
    activity_type: str
    man_months: Decimal
    complexity: str
    scale_value: Decimal
    complexity_value: Decimal
    workload_coeff: Decimal
    score: Decimal
    status: Optional[str] = None
    remark: Optional[str] = None

    model_config = {"from_attributes": True}
