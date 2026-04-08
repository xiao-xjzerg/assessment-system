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


class KeyTaskScoreUpdate(BaseModel):
    employee_id: int
    score: Decimal = Field(..., ge=0, le=10, description="重点任务分数 0~10")


class KeyTaskScoreOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    employee_name: str
    score: Decimal

    model_config = {"from_attributes": True}
