"""加减分和重点任务相关 schema"""
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel, Field


class BonusRecordCreate(BaseModel):
    employee_id: int
    description: str = Field(..., description="加减分项说明")
    value: Decimal = Field(..., ge=-10, le=10, description="加减分值")


class BonusRecordOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    employee_name: str
    department: str
    assess_type: str
    description: str
    value: Decimal

    model_config = {"from_attributes": True}


class KeyTaskScoreCreate(BaseModel):
    employee_id: int
    task_name: str = Field(..., min_length=1, max_length=200, description="重点任务名称")
    completion: str = Field(..., min_length=1, max_length=1000, description="完成情况（含团队成员）")
    score: Decimal = Field(..., ge=1, le=10, description="申请分值 1~10")


class KeyTaskScoreUpdate(BaseModel):
    task_name: str = Field(..., min_length=1, max_length=200, description="重点任务名称")
    completion: str = Field(..., min_length=1, max_length=1000, description="完成情况（含团队成员）")
    score: Decimal = Field(..., ge=1, le=10, description="申请分值 1~10")


class KeyTaskScoreOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    employee_name: str
    task_name: str
    completion: str
    score: Decimal

    model_config = {"from_attributes": True}
