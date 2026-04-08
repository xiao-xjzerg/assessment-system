"""加减分和重点任务模型"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func

from app.database import Base


class BonusRecord(Base):
    """加减分记录"""
    __tablename__ = "bonus_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="员工ID")
    employee_name = Column(String(50), nullable=False, comment="员工姓名")
    department = Column(String(50), nullable=False, comment="部门")
    assess_type = Column(String(20), nullable=False, comment="考核类型")
    description = Column(String(500), nullable=False, comment="加减分项说明")
    value = Column(Numeric(5, 2), default=0, comment="加减分值 -10~+10")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class KeyTaskScore(Base):
    """重点任务分数（仅基层管理人员）"""
    __tablename__ = "key_task_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="员工ID")
    employee_name = Column(String(50), nullable=False, comment="员工姓名")
    score = Column(Numeric(5, 2), default=0, comment="重点任务分数 0~10")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
