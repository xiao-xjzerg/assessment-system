"""360评价模型（互评关系、评分记录）"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Boolean, func

from app.database import Base


class EvalRelation(Base):
    """互评关系表"""
    __tablename__ = "eval_relations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    evaluatee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="被评人ID")
    evaluatee_name = Column(String(50), nullable=False, comment="被评人姓名")
    evaluatee_assess_type = Column(String(20), nullable=False, comment="被评人考核类型")
    evaluator_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="评价人ID")
    evaluator_name = Column(String(50), nullable=False, comment="评价人姓名")
    evaluator_type = Column(String(20), nullable=False,
                            comment="评价人类型：同事/上级领导/部门领导/基层管理互评/部门员工")
    evaluator_order = Column(Integer, default=0, comment="评价人序号（同事1~4）")
    is_completed = Column(Boolean, default=False, comment="是否已完成评分")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class EvalScore(Base):
    """评分记录表"""
    __tablename__ = "eval_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    relation_id = Column(Integer, ForeignKey("eval_relations.id"), nullable=False, comment="互评关系ID")
    evaluatee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="被评人ID")
    evaluator_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="评价人ID")
    dimension = Column(String(50), nullable=False, comment="评分维度")
    max_score = Column(Numeric(6, 2), nullable=False, comment="该维度满分")
    score = Column(Numeric(6, 2), default=0, comment="评分")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class EvalSummary(Base):
    """评分汇总表"""
    __tablename__ = "eval_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="被评人ID")
    employee_name = Column(String(50), nullable=False, comment="被评人姓名")
    department = Column(String(50), nullable=False, comment="部门")
    position = Column(String(50), nullable=True, comment="岗位")
    assess_type = Column(String(20), nullable=False, comment="考核类型")
    colleague1_score = Column(Numeric(6, 2), default=0, comment="同事1评分")
    colleague2_score = Column(Numeric(6, 2), default=0, comment="同事2评分")
    colleague3_score = Column(Numeric(6, 2), default=0, comment="同事3评分")
    colleague4_score = Column(Numeric(6, 2), default=0, comment="同事4评分")
    superior_score = Column(Numeric(6, 2), default=0, comment="上级领导评分")
    dept_leader_score = Column(Numeric(6, 2), default=0, comment="部门领导评分")
    weighted_total = Column(Numeric(6, 2), default=0, comment="加权汇总得分")
    final_score = Column(Numeric(6, 2), default=0, comment="最终得分（折算到30分）")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class WorkGoalScore(Base):
    """公共人员工作目标完成度评分（领导打分，满分70分）"""
    __tablename__ = "work_goal_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="被评公共人员ID")
    leader_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="评分领导ID")
    score = Column(Numeric(6, 2), default=0, comment="工作目标完成度得分（满分70）")
    comment = Column(String(1000), nullable=True, comment="文字评语")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
