"""应用配置项"""
import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent

# 数据库配置
DATABASE_DIR = BASE_DIR / "data"
DATABASE_DIR.mkdir(parents=True, exist_ok=True)
DATABASE_URL = f"sqlite+aiosqlite:///{DATABASE_DIR / 'app.db'}"

# JWT 配置
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "assessment-system-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_ACCESS_TOKEN_EXPIRE_HOURS = 8

# 密码配置
DEFAULT_PASSWORD_SUFFIX_LENGTH = 6  # 取手机号后6位作为初始密码

# 系统内置管理员账号（受保护，任何导入/删除/修改均不得影响）
ADMIN_PHONE = "13800000001"

# 分页默认值
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

# 考核阶段定义
ASSESSMENT_PHASES = {
    1: "数据导入",
    2: "填报申报",
    3: "在线评分",
    4: "结果查看",
    5: "确认结束",
}

# 角色定义
ROLE_ADMIN = "管理员"
ROLE_PM = "项目经理"  # 派生角色：根据项目一览表中的 pm_id 动态判定，不出现在员工表
ROLE_EMPLOYEE = "普通员工"
ROLE_LEADER = "领导"
ALL_ROLES = [ROLE_ADMIN, ROLE_PM, ROLE_EMPLOYEE, ROLE_LEADER]
# 员工信息表中允许出现的角色（项目经理由项目一览表派生，不再进员工表）
EMPLOYEE_ROLES = [ROLE_ADMIN, ROLE_EMPLOYEE, ROLE_LEADER]

# 考核类型定义
ASSESS_TYPE_MANAGER = "基层管理人员"
ASSESS_TYPE_PUBLIC = "公共人员"
ASSESS_TYPE_BUSINESS = "业务人员"
ASSESS_TYPE_RD = "产品研发人员"
ALL_ASSESS_TYPES = [ASSESS_TYPE_MANAGER, ASSESS_TYPE_PUBLIC, ASSESS_TYPE_BUSINESS, ASSESS_TYPE_RD]

# 部门定义
DEPT_DELIVERY = "实施交付部"
DEPT_RD = "产品研发部"
ALL_DEPARTMENTS = [DEPT_DELIVERY, DEPT_RD]

# 项目类型
PROJECT_TYPES = ["集成", "综合", "自研", "运营"]

# 实施方式
IMPL_METHODS = ["服务", "产品+服务"]

# 项目类型系数默认值（权威数据源：数据库 project_type_coefficients 表；此处仅为新周期的初始种子）
DEFAULT_PROJECT_TYPE_COEFFICIENTS = {
    "运营/运维": 0.7,
    "集成": 1.0,
    "基金课题/咨询": 1.5,
    "自研/AI": 2.0,
}

# 员工指标系数默认值
DEFAULT_INDICATOR_COEFFICIENTS = {
    "T1": 0.8, "S1": 0.8, "P1": 0.8,
    "T2": 0.9, "S2": 0.9, "P2": 0.9,
    "T3": 1.0, "S3": 1.0, "P3": 1.0,
    "T4": 1.05, "S4": 1.05, "P4": 1.05,
    "T5": 1.1, "S5": 1.1, "P5": 1.1,
    "T6": 1.2, "S6": 1.2, "P6": 1.2,
    "T7": 1.3, "S7": 1.3, "P7": 1.3,
    "T8": 1.4, "S8": 1.4, "P8": 1.4,
    "T9": 1.5, "S9": 1.5, "P9": 1.5,
}

# 积分基础分值
BASE_SCORE_PRESALE = 50
BASE_SCORE_DELIVERY = 100
BASE_SCORE_PUBLIC = 10
BASE_SCORE_TRANSFORM = 10

# 评定等级
RATING_LEVELS = ["优秀", "合格", "基本合格", "不合格"]

# 360评价维度满分
EVAL_DIMENSIONS = {
    "业务人员": {"工作任务完成度": 60, "工作态度": 40},
    "产品研发人员": {"工作任务完成度": 60, "工作态度": 40},
    "基层管理人员": {"能力": 40, "管理": 40, "态度": 20},
    "公共人员": {"工作能力": 60, "工作态度": 40},
}
