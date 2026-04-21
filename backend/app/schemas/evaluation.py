"""360评价相关 schema"""
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field


class EvalRelationOut(BaseModel):
    id: int
    cycle_id: int
    evaluatee_id: int
    evaluatee_name: str
    evaluatee_assess_type: str
    evaluator_id: int
    evaluator_name: str
    evaluator_type: str
    evaluator_order: int
    is_completed: bool

    model_config = {"from_attributes": True}


class EvalRelationUpdate(BaseModel):
    evaluator_id: int
    evaluator_name: str


class EvalScoreItem(BaseModel):
    dimension: str
    max_score: Decimal
    score: Decimal = Field(..., ge=0)


class EvalScoreSubmit(BaseModel):
    relation_id: int
    scores: List[EvalScoreItem]


class EvalScoreOut(BaseModel):
    id: int
    cycle_id: int
    relation_id: int
    evaluatee_id: int
    evaluator_id: int
    dimension: str
    max_score: Decimal
    score: Decimal

    model_config = {"from_attributes": True}


class EvalSummaryOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    employee_name: str
    department: str
    position: Optional[str] = None
    assess_type: str
    colleague1_score: Decimal
    colleague2_score: Decimal
    colleague3_score: Decimal
    colleague4_score: Decimal
    superior_score: Decimal
    dept_leader_score: Decimal
    weighted_total: Decimal
    final_score: Decimal

    model_config = {"from_attributes": True}


class WorkGoalScoreCreate(BaseModel):
    employee_id: int
    score: Decimal = Field(..., ge=0, le=70)
    comment: Optional[str] = None


class WorkGoalScoreOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    leader_id: int
    leader_name: Optional[str] = None
    score: Decimal
    comment: Optional[str] = None

    model_config = {"from_attributes": True}


class EvalProgressOut(BaseModel):
    total: int
    completed: int
    pending: int
    progress: float
