"""项目相关 schema"""
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    project_code: str = Field(..., description="项目令号")
    project_name: str = Field(..., description="项目名称")
    project_type: str = Field(..., description="项目类型")
    impl_method: Optional[str] = Field(None, description="实施方式")
    department: Optional[str] = Field(None, description="主承部门")
    customer_name: Optional[str] = Field(None, description="客户名称")
    start_date: Optional[datetime] = Field(None, description="项目开始时间")
    end_date: Optional[datetime] = Field(None, description="项目结束时间")
    contract_amount: Decimal = Field(default=Decimal("0"), description="合同金额（万元）")
    project_profit: Decimal = Field(default=Decimal("0"), description="项目利润（万元）")
    self_dev_income: Decimal = Field(default=Decimal("0"), description="自研收入（万元）")
    product_contract_amount: Decimal = Field(default=Decimal("0"), description="产品合同金额（万元）")
    presale_progress: Decimal = Field(default=Decimal("0"), description="售前活动进度系数")
    delivery_progress: Decimal = Field(default=Decimal("0"), description="交付活动进度系数")
    pm_name: Optional[str] = Field(None, description="项目经理姓名")
    project_status: Optional[str] = Field("进行中", description="项目状态")


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    project_type: Optional[str] = None
    impl_method: Optional[str] = None
    department: Optional[str] = None
    customer_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    contract_amount: Optional[Decimal] = None
    project_profit: Optional[Decimal] = None
    self_dev_income: Optional[Decimal] = None
    product_contract_amount: Optional[Decimal] = None
    presale_progress: Optional[Decimal] = None
    delivery_progress: Optional[Decimal] = None
    pm_name: Optional[str] = None
    project_status: Optional[str] = None
    workload_coeff: Optional[Decimal] = None  # 管理员可手动覆盖


class ProjectOut(BaseModel):
    id: int
    cycle_id: int
    project_code: str
    project_name: str
    project_status: Optional[str] = None
    project_type: str
    impl_method: Optional[str] = None
    department: Optional[str] = None
    customer_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    contract_amount: Decimal = Decimal("0")
    project_profit: Decimal = Decimal("0")
    self_dev_income: Decimal = Decimal("0")
    product_contract_amount: Decimal = Decimal("0")
    presale_progress: Decimal = Decimal("0")
    delivery_progress: Decimal = Decimal("0")
    used_presale_progress: Decimal = Decimal("0")
    used_delivery_progress: Decimal = Decimal("0")
    pm_id: Optional[int] = None
    pm_name: Optional[str] = None
    economic_scale_coeff: Decimal = Decimal("0")
    project_type_coeff: Decimal = Decimal("1")
    workload_coeff: Decimal = Decimal("0")
    signing_probability: Decimal = Decimal("1")
    pm_missing: bool = False  # 项目经理姓名存在但未能匹配到员工档案（缺失或同名冲突）

    model_config = {"from_attributes": True}
