"""积分统计模型"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func

from app.database import Base


class ScoreDetail(Base):
    """积分明细表 - 每个员工在每个项目上的积分"""
    __tablename__ = "score_details"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="员工ID")
    employee_name = Column(String(50), nullable=False, comment="员工姓名")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, comment="项目ID（公共积分为null）")
    project_name = Column(String(200), nullable=True, comment="项目名称")
    phase = Column(String(20), nullable=False, comment="项目阶段：售前/交付/公共/转型")
    base_score = Column(Numeric(8, 2), default=0, comment="基础分值：售前50/交付100/公共10/转型10")
    progress_coeff = Column(Numeric(6, 4), default=0, comment="进度系数")
    workload_coeff = Column(Numeric(10, 4), default=0, comment="工作量系数")
    participation_coeff = Column(Numeric(5, 4), default=0, comment="参与系数")
    participant_name = Column(String(50), nullable=True, comment="参与人")
    participant_role = Column(String(20), nullable=True, comment="参与人角色")
    work_description = Column(String(500), nullable=True, comment="完成的工作")
    score = Column(Numeric(10, 2), default=0, comment="分数合计=基础分值×进度系数×工作量系数×参与系数")
    modified_by = Column(String(50), nullable=True, comment="修改人")
    modified_at = Column(DateTime, nullable=True, comment="修改时间")
    remark = Column(String(500), nullable=True, comment="备注")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ScoreSummary(Base):
    """积分汇总表 - 每个员工的积分汇总"""
    __tablename__ = "score_summaries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="员工ID")
    employee_name = Column(String(50), nullable=False, comment="员工姓名")
    department = Column(String(50), nullable=False, comment="部门")
    assess_type = Column(String(20), nullable=False, comment="考核类型")
    project_score_total = Column(Numeric(10, 2), default=0, comment="项目积分合计")
    public_score_total = Column(Numeric(10, 2), default=0, comment="公共积分合计")
    transform_score_total = Column(Numeric(10, 2), default=0, comment="转型积分合计")
    total_score = Column(Numeric(10, 2), default=0, comment="总积分")
    normalized_score = Column(Numeric(8, 2), default=0, comment="开方归一化得分")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
