"""导出所有模型（Alembic 需要）"""
from app.database import Base

from app.models.cycle import Cycle
from app.models.employee import Employee
from app.models.project import Project
from app.models.participation import Participation
from app.models.public_score import PublicScore
from app.models.score import ScoreDetail, ScoreSummary
from app.models.evaluation import EvalRelation, EvalScore, EvalSummary, WorkGoalScore
from app.models.bonus import BonusRecord, KeyTaskScore
from app.models.result import FinalResult
from app.models.parameter import DeptTarget, SpecialTarget, ProjectTypeCoeff, IndicatorCoeff

__all__ = [
    "Base",
    "Cycle",
    "Employee",
    "Project",
    "Participation",
    "PublicScore",
    "ScoreDetail",
    "ScoreSummary",
    "EvalRelation",
    "EvalScore",
    "EvalSummary",
    "WorkGoalScore",
    "BonusRecord",
    "KeyTaskScore",
    "FinalResult",
    "DeptTarget",
    "SpecialTarget",
    "ProjectTypeCoeff",
    "IndicatorCoeff",
]
