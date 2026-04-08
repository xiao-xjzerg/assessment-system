"""考核参数相关 schema"""
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field


class DeptTargetItem(BaseModel):
    department: str
    group_name: Optional[str] = None
    profit_target: Decimal = Decimal("0")
    income_target: Decimal = Decimal("0")


class DeptTargetSave(BaseModel):
    items: List[DeptTargetItem]


class DeptTargetOut(BaseModel):
    id: int
    cycle_id: int
    department: str
    group_name: Optional[str] = None
    profit_target: Decimal
    income_target: Decimal

    model_config = {"from_attributes": True}


class SpecialTargetSave(BaseModel):
    product_contract_target: Decimal = Field(default=Decimal("0"), description="产品合同目标值")
    tech_innovation_target: Decimal = Field(default=Decimal("0"), description="科技创新目标值")


class SpecialTargetOut(BaseModel):
    id: int
    cycle_id: int
    target_name: str
    target_value: Decimal

    model_config = {"from_attributes": True}


class ProjectTypeCoeffItem(BaseModel):
    project_type: str
    coefficient: Decimal


class ProjectTypeCoeffSave(BaseModel):
    items: List[ProjectTypeCoeffItem]


class ProjectTypeCoeffOut(BaseModel):
    id: int
    cycle_id: int
    project_type: str
    coefficient: Decimal

    model_config = {"from_attributes": True}


class IndicatorCoeffItem(BaseModel):
    grade: str
    coefficient: Decimal


class IndicatorCoeffSave(BaseModel):
    items: List[IndicatorCoeffItem]


class IndicatorCoeffOut(BaseModel):
    id: int
    cycle_id: int
    grade: str
    coefficient: Decimal

    model_config = {"from_attributes": True}


class SigningProbabilityItem(BaseModel):
    project_id: int
    signing_probability: Decimal = Field(..., ge=Decimal("0.5"), le=Decimal("1.0"))


class SigningProbabilitySave(BaseModel):
    items: List[SigningProbabilityItem]
