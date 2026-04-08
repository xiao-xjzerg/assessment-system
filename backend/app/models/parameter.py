"""考核参数模型"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func

from app.database import Base


class DeptTarget(Base):
    """部门人均目标值"""
    __tablename__ = "dept_targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    department = Column(String(50), nullable=False, comment="部门名称")
    group_name = Column(String(50), nullable=True, comment="组/中心名称")
    profit_target = Column(Numeric(14, 2), default=0, comment="人均利润目标值（万元）")
    income_target = Column(Numeric(14, 2), default=0, comment="人均自研收入目标值（万元）")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class SpecialTarget(Base):
    """专项目标值"""
    __tablename__ = "special_targets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    target_name = Column(String(50), nullable=False, comment="目标名称：产品合同目标值/科技创新目标值")
    target_value = Column(Numeric(14, 2), default=0, comment="目标值（万元）")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class ProjectTypeCoeff(Base):
    """项目类型系数表"""
    __tablename__ = "project_type_coefficients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    project_type = Column(String(50), nullable=False, comment="项目类型")
    coefficient = Column(Numeric(6, 4), default=1.0, comment="系数值")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class IndicatorCoeff(Base):
    """员工指标系数表"""
    __tablename__ = "indicator_coefficients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    grade = Column(String(20), nullable=False, comment="职级，如T1/S3/P5")
    coefficient = Column(Numeric(6, 4), default=1.0, comment="指标系数")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
