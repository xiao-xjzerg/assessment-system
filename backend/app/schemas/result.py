"""最终考核成绩相关 schema"""
from typing import Optional
from decimal import Decimal
from pydantic import BaseModel


class FinalResultOut(BaseModel):
    id: int
    cycle_id: int
    employee_id: int
    employee_name: str
    department: str
    group_name: Optional[str] = None
    grade: Optional[str] = None
    assess_type: str
    is_mixed_role: bool
    work_score: Decimal
    work_score_max: Decimal
    economic_score: Decimal
    economic_score_max: Decimal
    key_task_score: Decimal
    work_goal_score: Decimal
    eval_score: Decimal
    bonus_score: Decimal
    total_score: Decimal
    ranking: int
    rating: Optional[str] = None
    leader_comment: Optional[str] = None
    secondary_assess_type: Optional[str] = None
    secondary_work_score: Decimal = Decimal("0")
    secondary_economic_score: Decimal = Decimal("0")
    secondary_key_task_score: Decimal = Decimal("0")
    secondary_eval_score: Decimal = Decimal("0")
    secondary_bonus_score: Decimal = Decimal("0")
    secondary_total_score: Decimal = Decimal("0")
    no_excellent_flag: bool = False

    model_config = {"from_attributes": True}


class RatingUpdate(BaseModel):
    rating: str


class LeaderCommentUpdate(BaseModel):
    leader_comment: str
