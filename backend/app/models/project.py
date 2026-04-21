"""项目一览表模型"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func

from app.database import Base


class Project(Base):
    """项目一览表"""
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    cycle_id = Column(Integer, ForeignKey("cycles.id"), nullable=False, comment="所属考核周期")
    project_code = Column(String(50), nullable=False, comment="项目令号")
    project_name = Column(String(200), nullable=False, comment="项目名称")
    project_status = Column(String(20), default="进行中", comment="项目状态")
    project_type = Column(String(20), nullable=False, comment="项目类型：集成/综合/自研/运营")
    impl_method = Column(String(20), nullable=True, comment="实施方式：服务/产品+服务")
    department = Column(String(50), nullable=True, comment="主承部门")
    customer_name = Column(String(200), nullable=True, comment="客户名称")
    start_date = Column(DateTime, nullable=True, comment="项目开始时间")
    end_date = Column(DateTime, nullable=True, comment="项目结束时间")
    contract_amount = Column(Numeric(14, 2), default=0, comment="合同金额（万元）")
    project_profit = Column(Numeric(14, 2), default=0, comment="项目利润（万元）")
    self_dev_income = Column(Numeric(14, 2), default=0, comment="自研收入（万元）")
    product_contract_amount = Column(Numeric(14, 2), default=0, comment="产品合同金额（万元）")
    current_period_profit = Column(Numeric(14, 2), default=0, comment="当期确认项目利润（万元）")
    current_period_self_dev_income = Column(Numeric(14, 2), default=0, comment="当期确认自研收入（万元）")
    presale_progress = Column(Numeric(6, 4), default=0, comment="售前活动进度系数")
    delivery_progress = Column(Numeric(6, 4), default=0, comment="交付活动进度系数")
    used_presale_progress = Column(Numeric(6, 4), default=0, comment="已使用进度系数-售前活动")
    used_delivery_progress = Column(Numeric(6, 4), default=0, comment="已使用进度系数-交付活动")
    pm_id = Column(Integer, ForeignKey("employees.id"), nullable=True, comment="项目经理ID")
    pm_name = Column(String(50), nullable=True, comment="项目经理姓名")
    economic_scale_coeff = Column(Numeric(10, 4), default=0, comment="经济规模系数（自动计算）")
    project_type_coeff = Column(Numeric(6, 4), default=1.0, comment="项目类型系数（自动计算）")
    workload_coeff = Column(Numeric(10, 4), default=0, comment="工作量系数=经济规模系数×项目类型系数")
    signing_probability = Column(Numeric(5, 4), default=1.0, comment="签约概率，未签约项目使用")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
