"""项目参与度模型"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func

from app.database import Base


class Participation(Base):
    """项目参与度"""
    __tablename__ = "participations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, comment="项目ID")
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=False, comment="员工ID")
    employee_name = Column(String(50), nullable=False, comment="员工姓名")
    department = Column(String(50), nullable=False, comment="员工所属部门")
    participation_coeff = Column(Numeric(5, 4), default=0, comment="参与度系数 0~1")
    status = Column(String(20), default="未填", comment="状态：未填/已提交/已修改")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
