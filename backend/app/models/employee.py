"""员工模型"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func

from app.database import Base


class Employee(Base):
    """员工信息表"""
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    name = Column(String(50), nullable=False, comment="姓名")
    department = Column(String(50), nullable=False, comment="部门：实施交付部/产品研发部")
    group_name = Column(String(50), nullable=True, comment="组/中心名称")
    position = Column(String(50), nullable=True, comment="岗位")
    grade = Column(String(20), nullable=True, comment="岗级，如T1/S3/P5")
    phone = Column(String(20), nullable=False, comment="联系方式（手机号），也是登录账号")
    password_hash = Column(String(256), nullable=False, comment="密码哈希")
    role = Column(String(20), nullable=False, comment="角色：管理员/项目经理/普通员工/领导")
    assess_type = Column(String(20), nullable=True, comment="考核类型：基层管理人员/公共人员/业务人员/产品研发人员（领导可为空）")
    is_active = Column(Boolean, default=True, comment="账号是否启用")
    status = Column(String(20), default="正常", comment="状态")
    rating = Column(String(20), nullable=True, comment="评定等级：优秀/合格/基本合格/不合格")
    leader_comment = Column(String(1000), nullable=True, comment="领导评语")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
