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
    """重点任务申报（仅基层管理人员，每员工可多条）

    同一员工在同一周期可提交多条申请，每条申请独立记录任务名称、完成情况和申请分值；
    员工总分 = 该员工所有申请 score 之和（业务上单员工合计已被强制约束在 0~10）。
    """
    __tablename__ = "key_task_scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="员工ID")
    employee_name = Column(String(50), nullable=False, comment="员工姓名")
    task_name = Column(String(200), nullable=False, default="", comment="重点任务名称")
    completion = Column(String(1000), nullable=False, default="", comment="完成情况（含团队成员）")
    score = Column(Numeric(5, 2), default=0, comment="申请分值 1~10")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
