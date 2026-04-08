"""项目参与度相关 schema"""
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field


class ParticipationItem(BaseModel):
    employee_id: int
    employee_name: str
    department: str
    participation_coeff: Decimal = Field(..., ge=0, le=1, description="参与度系数 0~1")


class ParticipationSave(BaseModel):
    project_id: int
    items: List[ParticipationItem]


class ParticipationOut(BaseModel):
    id: int
    cycle_id: int
    project_id: int
    employee_id: int
    employee_name: str
    department: str
    participation_coeff: Decimal
    status: Optional[str] = None

    model_config = {"from_attributes": True}
