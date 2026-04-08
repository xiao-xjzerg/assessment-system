"""考核周期相关 schema"""
from typing import Optional
from pydantic import BaseModel, Field


class CycleCreate(BaseModel):
    name: str = Field(..., description="周期名称，如2026年Q1")


class CycleOut(BaseModel):
    id: int
    name: str
    phase: int
    is_active: bool
    is_archived: bool

    model_config = {"from_attributes": True}


class PhaseUpdate(BaseModel):
    action: str = Field(..., description="操作：next/prev")
