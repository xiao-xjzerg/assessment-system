"""考核周期和阶段模型"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, func

from app.database import Base


class Cycle(Base):
    """考核周期"""
    __tablename__ = "cycles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), nullable=False, unique=True, comment="周期名称，如2026年Q1")
    phase = Column(Integer, default=1, comment="当前阶段 1-5")
    is_active = Column(Boolean, default=True, comment="是否为当前活跃周期")
    is_archived = Column(Boolean, default=False, comment="是否已归档")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
