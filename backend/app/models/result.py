"""最终考核成绩模型"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Boolean, func

from app.database import Base


class FinalResult(Base):
    """最终考核成绩"""
    __tablename__ = "final_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="员工ID")
    employee_name = Column(String(50), nullable=False, comment="员工姓名")
    department = Column(String(50), nullable=False, comment="部门")
    group_name = Column(String(50), nullable=True, comment="组/中心")
    position = Column(String(50), nullable=True, comment="岗位")
    grade = Column(String(20), nullable=True, comment="岗级")
    assess_type = Column(String(20), nullable=False, comment="考核类型")

    # 各维度得分
    work_score = Column(Numeric(8, 2), default=0, comment="工作积分得分")
    work_score_max = Column(Numeric(5, 2), default=0, comment="工作积分满分（30或50）")
    economic_score = Column(Numeric(8, 2), default=0, comment="经济指标得分")
    economic_score_max = Column(Numeric(5, 2), default=0, comment="经济指标满分（20或30）")
    key_task_score = Column(Numeric(5, 2), default=0, comment="重点任务得分（/10，仅基层管理人员）")
    work_goal_score = Column(Numeric(8, 2), default=0, comment="工作目标完成度得分（/70，仅公共人员）")
    eval_score = Column(Numeric(8, 2), default=0, comment="综合评价得分（/30）")
    bonus_score = Column(Numeric(5, 2), default=0, comment="加减分（±10）")

    # 汇总
    total_score = Column(Numeric(8, 2), default=0, comment="总分")
    ranking = Column(Integer, default=0, comment="排名（同部门同类型内）")
    rating = Column(String(20), nullable=True, comment="评定等级")
    leader_comment = Column(String(1000), nullable=True, comment="领导评语")

    # 跨周期标记
    no_excellent_flag = Column(Boolean, default=False, comment="不可评优标记（同年2次基本合格）")

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
