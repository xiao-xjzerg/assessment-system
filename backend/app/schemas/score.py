"""积分统计相关 schema"""
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel


class ScoreDetailOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    employee_name: str
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    phase: str
    base_score: Decimal
    progress_coeff: Decimal
    workload_coeff: Decimal
    participation_coeff: Decimal
    participant_name: Optional[str] = None
    participant_role: Optional[str] = None
    work_description: Optional[str] = None
    score: Decimal
    modified_by: Optional[str] = None
    remark: Optional[str] = None

    model_config = {"from_attributes": True}


class ScoreDetailUpdate(BaseModel):
    progress_coeff: Optional[Decimal] = None
    workload_coeff: Optional[Decimal] = None
    work_description: Optional[str] = None
    remark: Optional[str] = None


class ScoreSummaryOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    employee_name: str
    department: str
    assess_type: str
    project_score_total: Decimal
    public_score_total: Decimal
    transform_score_total: Decimal
    total_score: Decimal
    normalized_score: Decimal
    normalize_full_mark: Optional[Decimal] = None
    normalize_base_max: Optional[Decimal] = None

    model_config = {"from_attributes": True}
