"""公共积分申报模型"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func

from app.database import Base


class PublicScore(Base):
    """公共积分申报"""
    __tablename__ = "public_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="申报员工ID")
    employee_name = Column(String(50), nullable=False, comment="申报员工姓名")
    activity_name = Column(String(200), nullable=False, comment="活动名称")
    activity_type = Column(String(20), nullable=False, comment="活动类型：公共活动/转型活动")
    man_months = Column(Numeric(8, 2), default=0, comment="投入人力（人月）")
    complexity = Column(String(20), nullable=False, comment="复杂度：较简单/中等/极大")
    scale_value = Column(Numeric(6, 4), default=0, comment="活动规模值（自动计算）")
    complexity_value = Column(Numeric(6, 4), default=0, comment="活动复杂性值（自动计算）")
    workload_coeff = Column(Numeric(8, 4), default=0, comment="工作量系数=规模值×复杂性值")
    score = Column(Numeric(8, 2), default=0, comment="积分=基础分值10×工作量系数")
    status = Column(String(20), default="已申报", comment="状态：已申报/管理员已修改")
    remark = Column(String(500), nullable=True, comment="备注")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
