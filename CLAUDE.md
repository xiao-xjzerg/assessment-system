# 员工季度考核管理系统

## 技术栈

| 层级 | 技术选型 | 版本 |
|------|----------|------|
| 前端框架 | React | 18 |
| 前端UI库 | Ant Design + Ant Design Pro Components | 5.x |
| 前端路由 | React Router | v6 |
| 前端状态管理 | Zustand | latest |
| 前端HTTP | Axios | latest |
| 后端框架 | Python FastAPI | 0.115.0 |
| ORM | SQLAlchemy | 2.0.35 (异步引擎 aiosqlite) |
| 数据库 | SQLite | 开发阶段，后续可切换 PostgreSQL |
| 数据库迁移 | Alembic | 1.14.1 |
| 认证 | JWT (python-jose + passlib) | — |
| Excel处理 | openpyxl(导入) + xlsxwriter(导出) | — |

## 项目结构

```
assessment-system/
├── CLAUDE.md
├── backend/
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/                    # 数据库迁移脚本
│   │   ├── env.py
│   │   └── versions/
│   │       └── 318867b8eecd_initial_migration.py
│   ├── data/
│   │   └── app.db                  # SQLite 数据库文件
│   └── app/
│       ├── __init__.py
│       ├── main.py                 # FastAPI 入口
│       ├── config.py               # 配置项
│       ├── database.py             # 数据库连接和会话管理
│       ├── dependencies.py         # 公共依赖（JWT校验、角色权限）
│       ├── models/                 # SQLAlchemy 模型（18张表）
│       │   ├── __init__.py
│       │   ├── cycle.py            # 考核周期
│       │   ├── employee.py         # 员工信息
│       │   ├── project.py          # 项目一览表
│       │   ├── participation.py    # 项目参与度
│       │   ├── public_score.py     # 公共积分申报
│       │   ├── score.py            # 积分明细+汇总
│       │   ├── evaluation.py       # 360评价（互评关系、评分、汇总、工作目标完成度）
│       │   ├── bonus.py            # 加减分+重点任务
│       │   ├── result.py           # 最终考核成绩
│       │   └── parameter.py        # 考核参数（目标值、系数表）
│       ├── schemas/                # Pydantic 请求/响应模型
│       │   ├── common.py
│       │   ├── auth.py
│       │   ├── employee.py
│       │   ├── project.py
│       │   ├── cycle.py
│       │   ├── participation.py
│       │   ├── public_score.py
│       │   ├── parameter.py
│       │   ├── score.py
│       │   ├── evaluation.py
│       │   ├── bonus.py
│       │   └── result.py
│       ├── routers/                # API 路由
│       │   ├── __init__.py
│       │   ├── auth.py             # 认证：登录、修改密码
│       │   ├── employee.py         # 员工 CRUD、导入、模板下载
│       │   ├── project.py          # 项目 CRUD、导入、模板下载
│       │   ├── cycle.py            # 考核周期 CRUD、阶段切换
│       │   ├── parameter.py        # 考核参数设置（5组参数）
│       │   ├── participation.py    # 项目参与度填报与管理
│       │   ├── public_score.py     # 公共积分申报（员工申报/管理员审核修改）
│       │   ├── score.py            # 积分统计（明细/汇总/计算/导出Excel）
│       │   ├── evaluation.py       # 360评价（互评关系/评分/汇总/工作目标完成度）
│       │   ├── economic.py         # 经济指标核算（计算/查询/导出Excel）
│       │   ├── bonus.py            # 加减分CRUD、重点任务分数录入/导出
│       │   └── result.py           # 最终成绩（计算/排名/评级/评语/导出Excel/全量导出）
│       └── services/               # 业务逻辑层
│           ├── __init__.py
│           ├── employee_service.py # 员工导入、校验、查询
│           ├── project_service.py  # 项目导入、校验、系数计算
│           ├── excel_service.py    # Excel 解析与模板生成
│           ├── cycle_service.py    # 考核周期管理、继承、阶段切换
│           ├── parameter_service.py # 考核参数CRUD、重置默认值
│           ├── participation_service.py # 参与度填报、校验、统计
│           ├── public_score_service.py  # 公共积分申报、计算规模值/复杂性值
│           ├── score_service.py    # 积分全量计算、明细/汇总生成、开方归一化
│           ├── evaluation_service.py # 360评价：互评匹配、评分、汇总、工作目标完成度
│           ├── economic_service.py # 经济指标计算（利润/自研收入/产品合同）
│           ├── bonus_service.py   # 加减分CRUD、重点任务分数管理
│           └── result_service.py  # 最终成绩计算、排名、混合角色合并
├── frontend/                       # 前端项目（待开发）
│   └── src/
│       ├── layouts/
│       ├── pages/
│       ├── components/
│       ├── services/
│       ├── stores/
│       └── utils/
└── templates/                      # Excel 导入模板（待开发）
```

## 已完成模块

### 阶段一：项目脚手架与数据库模型 ✅

- **目录结构**：完整创建，前后端分离
- **数据库模型**：18张表全部定义完成
- **Alembic迁移**：初始迁移已生成并执行
- **FastAPI入口**：服务可启动，/docs 可访问
- **Pydantic Schema**：所有模块的请求/响应模型已定义
- **公共依赖**：JWT认证中间件、角色权限校验已实现

### 阶段二：认证与数据导入 ✅

- **登录 API**：手机号+密码登录，返回 JWT Token（POST /api/auth/login）
- **修改密码 API**：验证旧密码后修改（POST /api/auth/change-password）
- **员工管理**：完整 CRUD（GET/POST/PUT/DELETE /api/employees）
- **员工导入**：Excel 批量导入，支持全量更新（POST /api/employees/import）
- **员工模板下载**：下载标准 Excel 模板（GET /api/employees/template）
- **重置密码**：管理员可重置员工密码为初始密码（POST /api/employees/{id}/reset-password）
- **项目管理**：完整 CRUD（GET/POST/PUT/DELETE /api/projects）
- **项目导入**：Excel 批量导入，支持全量更新（POST /api/projects/import）
- **项目模板下载**：下载标准 Excel 模板（GET /api/projects/template）
- **自动计算**：导入/创建/编辑项目时自动计算经济规模系数、项目类型系数、工作量系数

### 阶段三：考核参数与项目参与度 ✅

- **考核周期管理**：创建（自动继承上一周期员工和参数）、切换活跃周期、归档
- **阶段状态管理**：前进/回退阶段（1-5），含边界校验和阶段名称返回
- **部门人均目标值**：批量保存/查询（部门+组/中心粒度）
- **专项目标值**：产品合同目标值、科技创新目标值的保存/查询
- **项目类型系数表**：查询/保存/重置为默认值（运营0.7、集成1.0、自研2.0等）
- **员工指标系数表**：查询/保存/重置为默认值（T1=0.8 ~ T9=1.5等27个职级）
- **签约概率设置**：获取未签约项目、批量更新概率并自动重算经济规模系数
- **项目参与度填报**：项目经理填报（权限限制为自己的项目）、管理员查看/修改全部
- **参与度校验**：同一项目内同部门人员参与系数合计为1（±0.01浮点误差）
- **填报概览统计**：项目级汇总显示已填/未填状态

## 数据模型

### cycles（考核周期）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| name | String(50) | 周期名称，如"2026年Q1" |
| phase | Integer | 当前阶段 1-5 |
| is_active | Boolean | 是否为当前活跃周期 |
| is_archived | Boolean | 是否已归档 |

### employees（员工信息）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| name | String(50) | 姓名 |
| department | String(50) | 部门：实施交付部/产品研发部 |
| group_name | String(50) | 组/中心名称 |
| position | String(50) | 岗位 |
| grade | String(20) | 岗级，如T1/S3/P5 |
| phone | String(20) | 手机号（登录账号） |
| password_hash | String(256) | 密码哈希 |
| role | String(20) | 角色：管理员/项目经理/普通员工/领导 |
| assess_type | String(20) | 考核类型：基层管理人员/公共人员/业务人员/产品研发人员 |
| assess_type_secondary | String(20) | 第二考核类型（混合角色） |
| is_active | Boolean | 账号是否启用 |
| rating | String(20) | 评定等级 |
| leader_comment | String(1000) | 领导评语 |

### projects（项目一览表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| project_code | String(50) | 项目令号 |
| project_name | String(200) | 项目名称 |
| project_status | String(20) | 项目状态 |
| project_type | String(20) | 项目类型：集成/综合/自研/运营 |
| impl_method | String(20) | 实施方式：服务/产品+服务 |
| department | String(50) | 主承部门 |
| customer_name | String(200) | 客户名称 |
| start_date | DateTime | 项目开始时间 |
| end_date | DateTime | 项目结束时间 |
| contract_amount | Numeric(14,2) | 合同金额（万元） |
| project_profit | Numeric(14,2) | 项目利润（万元） |
| self_dev_income | Numeric(14,2) | 自研收入（万元） |
| product_contract_amount | Numeric(14,2) | 产品合同金额（万元） |
| presale_progress | Numeric(6,4) | 售前活动进度系数 |
| delivery_progress | Numeric(6,4) | 交付活动进度系数 |
| used_presale_progress | Numeric(6,4) | 已使用进度系数-售前活动 |
| used_delivery_progress | Numeric(6,4) | 已使用进度系数-交付活动 |
| pm_id | FK→employees | 项目经理ID |
| pm_name | String(50) | 项目经理姓名 |
| economic_scale_coeff | Numeric(10,4) | 经济规模系数（自动计算） |
| project_type_coeff | Numeric(6,4) | 项目类型系数（自动计算） |
| workload_coeff | Numeric(10,4) | 工作量系数=经济规模×项目类型系数 |
| signing_probability | Numeric(5,4) | 签约概率 |

### participations（项目参与度）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| project_id | FK→projects | 项目ID |
| employee_id | FK→employees | 员工ID |
| employee_name | String(50) | 员工姓名 |
| department | String(50) | 员工所属部门 |
| participation_coeff | Numeric(5,4) | 参与度系数 0~1 |
| status | String(20) | 状态 |

### public_scores（公共积分申报）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| employee_id | FK→employees | 申报员工ID |
| activity_name | String(200) | 活动名称 |
| activity_type | String(20) | 活动类型：公共活动/转型活动 |
| man_months | Numeric(8,2) | 投入人力（人月） |
| complexity | String(20) | 复杂度：较简单/中等/极大 |
| scale_value | Numeric(6,4) | 活动规模值 |
| complexity_value | Numeric(6,4) | 活动复杂性值 |
| workload_coeff | Numeric(8,4) | 工作量系数 |
| score | Numeric(8,2) | 积分 |
| status | String(20) | 状态 |

### score_details（积分明细）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| employee_id | FK→employees | 员工ID |
| employee_name | String(50) | 员工姓名 |
| project_id | FK→projects | 项目ID（公共积分为null） |
| project_name | String(200) | 项目名称 |
| phase | String(20) | 项目阶段：售前/交付/公共/转型 |
| base_score | Numeric(8,2) | 基础分值：售前50/交付100/公共10/转型10 |
| progress_coeff | Numeric(6,4) | 进度系数 |
| workload_coeff | Numeric(10,4) | 工作量系数 |
| participation_coeff | Numeric(5,4) | 参与系数 |
| participant_name | String(50) | 参与人 |
| participant_role | String(20) | 参与人角色 |
| work_description | String(500) | 完成的工作 |
| score | Numeric(10,2) | 分数=基础×进度×工作量×参与 |
| modified_by | String(50) | 修改人 |
| modified_at | DateTime | 修改时间 |
| remark | String(500) | 备注 |

### score_summaries（积分汇总）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| employee_id | FK→employees | 员工ID |
| employee_name | String(50) | 员工姓名 |
| department | String(50) | 部门 |
| assess_type | String(20) | 考核类型 |
| project_score_total | Numeric(10,2) | 项目积分合计 |
| public_score_total | Numeric(10,2) | 公共积分合计 |
| transform_score_total | Numeric(10,2) | 转型积分合计 |
| total_score | Numeric(10,2) | 总积分 |
| normalized_score | Numeric(8,2) | 开方归一化得分 |

### eval_relations（互评关系）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| evaluatee_id | FK→employees | 被评人ID |
| evaluatee_name | String(50) | 被评人姓名 |
| evaluatee_assess_type | String(20) | 被评人考核类型 |
| evaluator_id | FK→employees | 评价人ID |
| evaluator_name | String(50) | 评价人姓名 |
| evaluator_type | String(20) | 评价人类型：同事/上级领导/部门领导/基层管理互评/部门员工 |
| evaluator_order | Integer | 评价人序号（同事1~4） |
| is_completed | Boolean | 是否已完成评分 |

### eval_scores（评分记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| relation_id | FK→eval_relations | 互评关系ID |
| evaluatee_id | FK→employees | 被评人ID |
| evaluator_id | FK→employees | 评价人ID |
| dimension | String(50) | 评分维度 |
| max_score | Numeric(6,2) | 该维度满分 |
| score | Numeric(6,2) | 评分 |

### eval_summaries（评分汇总）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| employee_id | FK→employees | 被评人ID |
| employee_name | String(50) | 被评人姓名 |
| department | String(50) | 部门 |
| position | String(50) | 岗位 |
| assess_type | String(20) | 考核类型 |
| colleague1_score | Numeric(6,2) | 同事1评分 |
| colleague2_score | Numeric(6,2) | 同事2评分 |
| colleague3_score | Numeric(6,2) | 同事3评分 |
| colleague4_score | Numeric(6,2) | 同事4评分 |
| superior_score | Numeric(6,2) | 上级领导评分 |
| dept_leader_score | Numeric(6,2) | 部门领导评分 |
| weighted_total | Numeric(6,2) | 加权汇总得分 |
| final_score | Numeric(6,2) | 最终得分（折算到30分） |

### work_goal_scores（工作目标完成度评分）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| employee_id | FK→employees | 被评公共人员ID |
| leader_id | FK→employees | 评分领导ID |
| score | Numeric(6,2) | 工作目标完成度得分（满分70） |
| comment | String(1000) | 文字评语 |

### bonus_records（加减分记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| employee_id | FK→employees | 员工ID |
| employee_name | String(50) | 员工姓名 |
| department | String(50) | 部门 |
| assess_type | String(20) | 考核类型 |
| description | String(500) | 加减分项说明 |
| value | Numeric(5,2) | 加减分值 -10~+10 |

### key_task_scores（重点任务分数）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| employee_id | FK→employees | 员工ID |
| employee_name | String(50) | 员工姓名 |
| score | Numeric(5,2) | 重点任务分数 0~10 |

### final_results（最终考核成绩）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id | FK→cycles | 所属考核周期 |
| employee_id | FK→employees | 员工ID |
| employee_name | String(50) | 员工姓名 |
| department | String(50) | 部门 |
| group_name | String(50) | 组/中心 |
| grade | String(20) | 岗级 |
| assess_type | String(20) | 考核类型 |
| is_mixed_role | Boolean | 是否混合角色 |
| work_score | Numeric(8,2) | 工作积分得分 |
| work_score_max | Numeric(5,2) | 工作积分满分（30或50） |
| economic_score | Numeric(8,2) | 经济指标得分 |
| economic_score_max | Numeric(5,2) | 经济指标满分（20或30） |
| key_task_score | Numeric(5,2) | 重点任务得分（/10，仅基层管理人员） |
| work_goal_score | Numeric(8,2) | 工作目标完成度得分（/70，仅公共人员） |
| eval_score | Numeric(8,2) | 综合评价得分（/30） |
| bonus_score | Numeric(5,2) | 加减分（±10） |
| total_score | Numeric(8,2) | 总分 |
| ranking | Integer | 排名（同部门同类型内） |
| rating | String(20) | 评定等级 |
| leader_comment | String(1000) | 领导评语 |
| secondary_assess_type | String(20) | 第二考核类型 |
| secondary_work_score | Numeric(8,2) | 第二身份工作积分得分 |
| secondary_economic_score | Numeric(8,2) | 第二身份经济指标得分 |
| secondary_key_task_score | Numeric(5,2) | 第二身份重点任务得分 |
| secondary_eval_score | Numeric(8,2) | 第二身份综合评价得分 |
| secondary_bonus_score | Numeric(5,2) | 第二身份加减分 |
| secondary_total_score | Numeric(8,2) | 第二身份总分 |
| no_excellent_flag | Boolean | 不可评优标记（同年2次基本合格） |

### dept_targets（部门人均目标值）
各部门/组的人均利润目标值和人均自研收入目标值

### special_targets（专项目标值）
产品合同目标值、科技创新目标值

### project_type_coefficients（项目类型系数表）
项目类型与系数的对应关系

### indicator_coefficients（员工指标系数表）
职级与指标系数的对应关系

## API 接口清单

| 路径 | 方法 | 功能 | 权限 | 状态 |
|------|------|------|------|------|
| / | GET | 系统根路径 | 无 | ✅ |
| /health | GET | 健康检查 | 无 | ✅ |
| /docs | GET | API文档 | 无 | ✅ |
| /api/auth/login | POST | 登录获取Token | 无 | ✅ |
| /api/auth/change-password | POST | 修改密码 | 登录 | ✅ |
| /api/employees | GET | 员工列表（分页/筛选） | 登录 | ✅ |
| /api/employees | POST | 手动新增员工 | 管理员 | ✅ |
| /api/employees/{id} | GET | 获取单个员工 | 登录 | ✅ |
| /api/employees/{id} | PUT | 编辑员工信息 | 管理员 | ✅ |
| /api/employees/{id} | DELETE | 删除员工 | 管理员 | ✅ |
| /api/employees/{id}/reset-password | POST | 重置密码 | 管理员 | ✅ |
| /api/employees/import | POST | Excel导入员工 | 管理员 | ✅ |
| /api/employees/template | GET | 下载员工模板 | 无 | ✅ |
| /api/projects | GET | 项目列表（分页/筛选） | 登录 | ✅ |
| /api/projects | POST | 手动新增项目 | 管理员 | ✅ |
| /api/projects/{id} | GET | 获取单个项目 | 登录 | ✅ |
| /api/projects/{id} | PUT | 编辑项目信息 | 管理员 | ✅ |
| /api/projects/{id} | DELETE | 删除项目 | 管理员 | ✅ |
| /api/projects/import | POST | Excel导入项目 | 管理员 | ✅ |
| /api/projects/template | GET | 下载项目模板 | 无 | ✅ |
| /api/cycles | GET | 获取所有考核周期 | 登录 | ✅ |
| /api/cycles | POST | 创建新考核周期 | 管理员 | ✅ |
| /api/cycles/active | GET | 获取当前活跃周期 | 登录 | ✅ |
| /api/cycles/{id}/activate | POST | 切换活跃周期 | 管理员 | ✅ |
| /api/cycles/{id}/archive | POST | 归档考核周期 | 管理员 | ✅ |
| /api/cycles/{id}/phase | POST | 切换阶段（next/prev） | 管理员 | ✅ |
| /api/parameters/dept-targets | GET | 获取部门人均目标值 | 管理员 | ✅ |
| /api/parameters/dept-targets | POST | 保存部门人均目标值 | 管理员 | ✅ |
| /api/parameters/special-targets | GET | 获取专项目标值 | 管理员 | ✅ |
| /api/parameters/special-targets | POST | 保存专项目标值 | 管理员 | ✅ |
| /api/parameters/project-type-coeffs | GET | 获取项目类型系数表 | 管理员 | ✅ |
| /api/parameters/project-type-coeffs | POST | 保存项目类型系数 | 管理员 | ✅ |
| /api/parameters/project-type-coeffs/reset | POST | 重置项目类型系数 | 管理员 | ✅ |
| /api/parameters/indicator-coeffs | GET | 获取员工指标系数表 | 管理员 | ✅ |
| /api/parameters/indicator-coeffs | POST | 保存员工指标系数 | 管理员 | ✅ |
| /api/parameters/indicator-coeffs/reset | POST | 重置员工指标系数 | 管理员 | ✅ |
| /api/parameters/signing-probabilities | GET | 获取未签约项目列表 | 管理员 | ✅ |
| /api/parameters/signing-probabilities | POST | 保存签约概率 | 管理员 | ✅ |
| /api/participations | GET | 管理员查看所有参与度 | 管理员 | ✅ |
| /api/participations | POST | 保存/提交参与度 | 项目经理/管理员 | ✅ |
| /api/participations/{id} | DELETE | 删除参与度记录 | 项目经理/管理员 | ✅ |
| /api/participations/my-projects | GET | 获取负责的项目列表 | 项目经理/管理员 | ✅ |
| /api/participations/project/{id} | GET | 获取项目参与度 | 项目经理/管理员 | ✅ |
| /api/participations/summary | GET | 参与度填报概览 | 管理员 | ✅ |
| /api/public-scores | POST | 员工提交公共积分申报 | 登录 | ✅ |
| /api/public-scores | GET | 查询公共积分申报 | 登录（员工看自己/管理员看全部） | ✅ |
| /api/public-scores/{id} | PUT | 修改公共积分申报 | 登录（员工改自己/管理员改全部） | ✅ |
| /api/public-scores/{id} | DELETE | 删除公共积分申报 | 登录（员工删自己/管理员删全部） | ✅ |
| /api/scores/calculate | POST | 触发全量积分计算 | 管理员 | ✅ |
| /api/scores/details | GET | 查询积分明细 | 登录（按角色权限） | ✅ |
| /api/scores/details/{id} | PUT | 编辑积分明细 | 管理员 | ✅ |
| /api/scores/summary | GET | 查询积分汇总 | 登录（按角色权限） | ✅ |
| /api/scores/export | GET | 导出积分统计Excel | 管理员 | ✅ |
| /api/evaluations/relations/generate | POST | 自动生成互评关系 | 管理员 | ✅ |
| /api/evaluations/relations | GET | 查看互评关系列表 | 管理员 | ✅ |
| /api/evaluations/relations/{id} | PUT | 修改互评关系评价人 | 管理员 | ✅ |
| /api/evaluations/relations/export | GET | 导出互评关系Excel | 管理员 | ✅ |
| /api/evaluations/my-tasks | GET | 获取我的评价任务 | 登录 | ✅ |
| /api/evaluations/dimensions | GET | 获取评分维度与满分 | 登录 | ✅ |
| /api/evaluations/scores | POST | 提交评分 | 登录 | ✅ |
| /api/evaluations/scores/{relation_id} | GET | 查看评分详情 | 管理员/评价人 | ✅ |
| /api/evaluations/scores/{relation_id}/reset | POST | 重置评分 | 管理员 | ✅ |
| /api/evaluations/summaries/calculate | POST | 触发评分汇总计算 | 管理员 | ✅ |
| /api/evaluations/summaries | GET | 查询评分汇总 | 登录（按角色权限） | ✅ |
| /api/evaluations/summaries/export | GET | 导出评分汇总Excel | 管理员 | ✅ |
| /api/evaluations/progress | GET | 获取评价进度统计 | 管理员 | ✅ |
| /api/evaluations/work-goals/employees | GET | 获取待评公共人员列表 | 领导/管理员 | ✅ |
| /api/evaluations/work-goals | POST | 保存工作目标完成度评分 | 领导/管理员 | ✅ |
| /api/evaluations/work-goals | GET | 查询工作目标完成度评分 | 登录（按角色权限） | ✅ |
| /api/economic/calculate | POST | 触发经济指标全量计算 | 管理员 | ✅ |
| /api/economic/details | GET | 查询经济指标核算明细 | 登录（按角色权限） | ✅ |
| /api/economic/summary | GET | 查询经济指标得分汇总 | 登录（按角色权限） | ✅ |
| /api/economic/export | GET | 导出经济指标核算表Excel | 管理员 | ✅ |
| /api/bonus/records | GET | 查询加减分记录 | 管理员 | ✅ |
| /api/bonus/records | POST | 新增加减分记录 | 管理员 | ✅ |
| /api/bonus/records/{id} | DELETE | 删除加减分记录 | 管理员 | ✅ |
| /api/bonus/key-tasks | GET | 查询重点任务分数 | 管理员 | ✅ |
| /api/bonus/key-tasks | POST | 保存重点任务分数 | 管理员 | ✅ |
| /api/bonus/key-tasks/batch | POST | 批量保存重点任务分数 | 管理员 | ✅ |
| /api/bonus/export | GET | 导出加减分数据Excel | 管理员 | ✅ |
| /api/results/calculate | POST | 触发最终成绩全量计算 | 管理员 | ✅ |
| /api/results | GET | 查询最终考核成绩 | 登录（按角色权限） | ✅ |
| /api/results/{id}/rating | PUT | 设置评定等级 | 管理员 | ✅ |
| /api/results/{id}/comment | PUT | 编辑领导评语 | 管理员/领导 | ✅ |
| /api/results/export | GET | 导出成绩总表Excel | 管理员 | ✅ |
| /api/results/export-all | GET | 导出全部报表(4Sheet) | 管理员 | ✅ |
| /api/results/confirm | POST | 确认考核完成并归档 | 管理员 | ✅ |

## 业务规则备忘

1. **阶段状态**（1~5）仅为标识，不做系统级功能锁定
2. **经济规模系数**先按利润分段计算，再乘以签约概率（未签约项目）
3. **实施方式="产品+服务"**标识合同明确约定产品内容，用于产品化收入特殊规则
4. **参与度系数**：同一项目内，实施交付部合计为1，产品研发部合计为1（某部门无人则为0）
5. **公共活动积分上限**为该员工项目积分的15%，转型活动不设上限
6. **混合角色**按两种身份分别计算后取50%权重合并
7. **排名**在同部门、同考核类型内进行
8. **360评价匿名性**：评分详情API仅管理员和评价人本人可看，被评人不可查看具体评分来源
9. **评分提交后锁定**：评分提交后不可修改，管理员可通过重置接口允许重新评分
10. **工作目标完成度**：仅适用于公共人员，由同部门领导打分，满分70分
11. **score_details 与 public_scores 的关系**：
   - `public_scores` 是**公共积分申报原始表**，由员工填报活动信息（名称、类型、人月、复杂度），系统自动计算规模值、复杂性值、工作量系数和积分
   - `score_details` 是**积分明细汇总表**，汇集所有来源的积分（售前/交付/公共/转型），其中 phase="公共"或"转型" 的记录源自 public_scores
   - 计算流程：员工在 public_scores 申报 → 管理员审核 → 系统将审核通过的记录写入 score_details（phase="公共"/"转型"，project_id 为 null）→ 最终在 score_summaries 中汇总
   - 公共活动积分写入 score_details 时：base_score=10，workload_coeff=活动工作量系数，progress_coeff=1，participation_coeff=1

## 变更记录

| 日期 | 内容 | 影响范围 |
|------|------|----------|
| 2026-04-07 | 阶段一完成：项目脚手架、18张数据库表、Alembic迁移、FastAPI入口 | 全部后端基础文件 |
| 2026-04-08 | 修复遗留问题：projects表补充5个字段（start_date/end_date/customer_name/used_presale_progress/used_delivery_progress） | models/project.py, schemas/project.py, Alembic迁移 |
| 2026-04-08 | 阶段二完成：认证、员工CRUD、项目CRUD、Excel导入/模板下载 | routers/, services/, main.py |
| 2026-04-09 | 阶段三完成：考核周期管理、阶段切换、考核参数CRUD（5组）、项目参与度填报与校验 | routers/cycle.py, parameter.py, participation.py, services/ |
| 2026-04-09 | 补全CLAUDE.md数据模型文档：eval_summaries/work_goal_scores/bonus_records/key_task_scores/final_results完整字段定义；eval_relations/eval_scores/score_details/score_summaries补充漏记字段 | CLAUDE.md |
| 2026-04-09 | 阶段四完成：公共积分申报API（CRUD+自动计算规模值/复杂性值/工作量系数）、积分全量计算（售前/交付/公共/转型）、公共活动积分15%上限、积分明细与汇总生成、开方归一化得分、管理员编辑明细、Excel导出 | routers/public_score.py, score.py, services/public_score_service.py, score_service.py |
| 2026-04-09 | 阶段五完成：互评关系自动匹配算法、互评关系管理API（生成/查看/编辑/导出）、在线评分API（提交/查看/重置）、评分汇总计算（加权/折算30分）、工作目标完成度评分（领导→公共人员）、评价进度统计 | routers/evaluation.py, services/evaluation_service.py, schemas/evaluation.py |
| 2026-04-10 | 阶段六完成：经济指标计算（利润/自研收入/产品合同）、加减分CRUD（±10限制）、重点任务分数录入（批量）、最终成绩计算（4类考核公式）、排名（同部门同类型）、混合角色合并（50%权重）、评定等级设置、领导评语、成绩总表导出（分Sheet）、全量4Sheet导出、确认归档 | routers/economic.py, bonus.py, result.py, services/economic_service.py, bonus_service.py, result_service.py |
| 2026-04-12 | 阶段七批次4完成：工作台（角色卡片+管理员统计）、员工管理页（CRUD/导入/模板/重置密码）、项目管理页（CRUD/导入/模板/签约概率Drawer）；路由接入三个新页面 | frontend/src/pages/dashboard/, employee/, project/, router/routes.tsx |
| 2026-04-12 | 批次4.5完成：Neumorphism软萌风+深浅色模式。主题框架（ThemeProvider/tokens/useTheme）、5个Neu组件（NeuCard/Panel/Button/Switch/Slider）、主题预览页、登录页/布局/Dashboard/业务页全面升级为Neu风格、顶栏主题切换按钮 | frontend/src/theme/, components/neu/, pages/login, layouts/BasicLayout, pages/dashboard, pages/employee, pages/project, pages/changePassword, index.css, main.tsx, routes.tsx |
| 2026-04-12 | 批次6完成：项目参与度（PM填报+管理员概览/全量管理+同部门系数校验）、公共积分申报（员工CRUD+管理员筛选/修改工作量系数和积分）；路由接入两个新页面 | frontend/src/pages/participation/, publicScore/, router/routes.tsx |
| 2026-04-12 | 批次7完成：积分统计（触发计算/明细查询编辑/汇总查询/Excel导出）、经济指标核算（触发计算/明细查询/汇总查询/Excel导出）；路由接入两个新页面 | frontend/src/pages/score/, economic/, router/routes.tsx |
| 2026-04-12 | 批次8完成：360评价四个子页面（互评关系管理+进度看板、我的评价任务+在线评分、评分汇总计算导出、工作目标完成度评分）；路由接入四个新页面 | frontend/src/pages/evaluation/Relations.tsx, MyTasks.tsx, Summary.tsx, WorkGoal.tsx, router/routes.tsx |
| 2026-04-12 | 批次9完成：加减分CRUD+重点任务批量录入+导出、最终成绩计算/排名/评级Dropdown/评语/导出(分Sheet+全量4Sheet)/确认归档；路由接入两个新页面 | frontend/src/pages/bonus/, result/, router/routes.tsx |
| 2026-04-13 | 批次10完成：个人中心（基本信息+积分汇总+考核成绩）；路由清理移除Placeholder，所有页面路由均接入真实组件 | frontend/src/pages/profile/, router/routes.tsx |

### 阶段四：积分计算与公共积分申报 ✅

- **公共积分申报 API**：员工申报（POST /api/public-scores）、查询（GET）、编辑（PUT）、删除（DELETE）
- **申报自动计算**：规模值（按人月分段插值）、复杂性值（较简单0.6/中等1.0/极大1.8）、工作量系数、积分
- **管理员审核/修改**：管理员可直接修改工作量系数和积分，状态变为"管理员已修改"
- **积分全量计算**：POST /api/scores/calculate 触发，自动生成售前/交付/公共/转型积分明细
- **公共活动积分上限**：不超过该员工项目积分的15%，超出时按比例缩减
- **积分明细与汇总表**：自动生成 score_details 和 score_summaries
- **开方归一化得分**：基层管理人员30分制、业务人员/产品研发人员50分制
- **积分统计查询**：明细查询（GET /api/scores/details）、汇总查询（GET /api/scores/summary）
- **管理员编辑明细**：PUT /api/scores/details/{id}，修改后自动重算积分
- **Excel导出**：GET /api/scores/export，含积分汇总和积分明细两个Sheet

### 阶段五：360评价 ✅

- **互评关系自动匹配算法**：POST /api/evaluations/relations/generate 触发
  - 业务人员/产品研发人员：自动匹配4个同事（优先级：同部门同项目>同组>同部门不同组）+ 上级领导 + 部门领导
  - 基层管理人员：自动匹配4个部门员工 + 其他基层管理互评 + 部门领导
  - 公共人员：自动匹配4个部门员工 + 部门领导
- **互评关系管理 API**：查看（GET）、编辑评价人（PUT）、导出Excel（GET /api/evaluations/relations/export）
- **在线评分 API**：获取评价任务（GET /api/evaluations/my-tasks）、获取评分维度（GET /api/evaluations/dimensions）、提交评分（POST /api/evaluations/scores）
  - 评分维度按考核类型区分：业务人员(工作任务完成度60+工作态度40)、产品研发人员(工作任务完成度60+工作态度40)、基层管理人员(能力40+管理40+态度20)、公共人员(工作能力60+工作态度40)
  - 提交后不可修改，管理员可重置（POST /api/evaluations/scores/{id}/reset）
- **评分汇总计算**：POST /api/evaluations/summaries/calculate 触发加权汇总
  - 业务人员：同事均分×40% + 上级领导×30% + 部门领导×30%
  - 产品研发人员：同事均分×30% + 上级领导×40% + 部门领导×30%
  - 基层管理人员：部门员工均分×30% + 基层管理互评均分×30% + 部门领导×40%
  - 公共人员：部门员工均分×50% + 部门领导×50%
  - 最终得分 = 加权总分 / 100 × 30
- **工作目标完成度评分**：领导为公共人员打分（满分70分），POST /api/evaluations/work-goals
- **评价进度统计**：GET /api/evaluations/progress 返回总数/已完成/未完成/进度百分比
- **Excel导出**：互评关系导出、综合评价汇总导出

### 阶段六：经济指标、加减分与最终成绩 ✅

- **经济指标计算 API**：POST /api/economic/calculate 触发全量计算
  - 实施交付部：项目利润区块，得分 = 满分 × 完成值 / (人均目标值 × 指标系数)，业务人员满分20、基层管理满分30
  - 产品研发部：自研收入区块，前端/后端组20分制，产品组15+5(产品合同)，算法组15+5(科技创新)
  - 产品化收入特殊规则：合同约定产品(×1.2)、未约定但使用产品(自研15%)
- **经济指标查询/导出**：GET /api/economic/details、/summary、/export
- **加减分记录 CRUD**：GET/POST/DELETE /api/bonus/records
  - 单员工加减分总和限制-10~+10
- **重点任务分数录入**：POST /api/bonus/key-tasks（单个）、/api/bonus/key-tasks/batch（批量）
  - 仅基层管理人员，0~10分范围
- **加减分数据导出**：GET /api/bonus/export
- **最终成绩计算**：POST /api/results/calculate 触发全量计算
  - 基层管理人员：工作积分(30) + 经济指标(30) + 重点任务(10) + 综合评价(30) + 加减分(±10)
  - 公共人员：工作目标完成度(70) + 综合评价(30) + 加减分(±10)
  - 业务人员：工作积分(50) + 经济指标(20) + 综合评价(30) + 加减分(±10)
  - 产品研发人员：工作积分(50) + 经济指标(20) + 综合评价(30) + 加减分(±10)
- **排名**：同部门同考核类型内按总分降序，同分按工作积分→经济指标降序
- **混合角色合并**：两种身份分别计算后取50%权重合并
- **评定等级**：PUT /api/results/{id}/rating，管理员手动设置（优秀/合格/基本合格/不合格）
- **领导评语**：PUT /api/results/{id}/comment，管理员/领导可编辑
- **成绩总表导出**：GET /api/results/export，按考核类型分Sheet
- **全量导出**：GET /api/results/export-all，4个Sheet（积分统计+综合测评+经济指标+成绩总表）
- **确认完成归档**：POST /api/results/confirm

## 阶段七：前端开发（进行中）

**技术栈**：React 18 + TypeScript + Vite + Ant Design 5 + Ant Design Pro Components + React Router v6 + Zustand + Axios + dayjs

**权限策略**：严格按 JWT 解析出的角色字段进行菜单过滤和路由守卫，前端不做"切换视角"等调试旁路。

### 批次规划与进度

- [x] **批次 1：项目初始化与脚手架** ✅
  - Vite + React 18 + TypeScript 项目创建
  - 依赖安装（antd / @ant-design/pro-components / react-router-dom / zustand / axios / dayjs）
  - vite.config.ts（端口 5173、proxy → http://localhost:8000、`@/` 路径别名）
  - tsconfig.json、.env.development、.gitignore
  - 目录骨架：layouts/pages/components/services/stores/utils/types
  - **产出**：
    - 配置：[frontend/package.json](frontend/package.json)、[vite.config.ts](frontend/vite.config.ts)、[tsconfig.json](frontend/tsconfig.json) + [tsconfig.app.json](frontend/tsconfig.app.json) + [tsconfig.node.json](frontend/tsconfig.node.json)、[index.html](frontend/index.html)、[.env.development](frontend/.env.development)、[.env.production](frontend/.env.production)、[.gitignore](frontend/.gitignore)
    - 入口：[src/main.tsx](frontend/src/main.tsx)（ConfigProvider + zhCN + dayjs locale）、[src/App.tsx](frontend/src/App.tsx)（占位页）、[src/index.css](frontend/src/index.css)、[src/vite-env.d.ts](frontend/src/vite-env.d.ts)
    - 依赖：已安装 203 个 npm 包（antd 5.21+、@ant-design/pro-components 2.8+、react 18.3、react-router-dom 6.27、zustand 4.5、axios 1.7、dayjs 1.11、vite 5.4、typescript 5.6）
    - 验证：`tsc -b` 零错误，`npm run build` 成功（1471 modules → 550.55 kB，gzip 180.52 kB）
    - 启动：`cd assessment-system/frontend && npm run dev`（端口 5173，自动代理 `/api` → 后端 8000）

- [x] **批次 2：基础设施层** ✅
  - `services/request.ts`：axios 实例 + 请求拦截器（注入 JWT）+ 响应拦截器（统一 code 处理、401 跳登录、错误 message）
  - `services/api/*.ts`：按模块封装（auth/employee/project/cycle/parameter/participation/public_score/score/evaluation/economic/bonus/result）
  - `stores/userStore.ts`：用户信息、token、登录/登出
  - `stores/cycleStore.ts`：当前活跃周期、阶段
  - `utils/constants.ts`：角色、考核类型、阶段、评定等级枚举
  - `utils/format.ts`：数字/日期/百分比格式化
  - `types/*.ts`：与后端 Schema 对齐的 TS 类型
  - **产出**：
    - 类型定义：[src/types/index.ts](frontend/src/types/index.ts) — 528 行，覆盖所有 12 个后端模块的 Pydantic schema（ApiResponse / PaginatedData / Cycle / Employee / Project / 5 组考核参数 / Participation / PublicScore / ScoreDetail+Summary / EvalRelation+Score+Summary+Dimension+Progress+WorkGoal / EconomicDetail+Summary / BonusRecord+KeyTaskScore / FinalResult）。Decimal 字段统一声明为 `number | string` 以兼容 Pydantic 序列化的两种形式
    - 工具：[src/utils/constants.ts](frontend/src/utils/constants.ts)（角色/考核类型/部门/项目类型/阶段/评定/积分阶段/公共活动/复杂度/分页枚举，全部对齐后端 config.py）、[src/utils/format.ts](frontend/src/utils/format.ts)（formatDateTime/formatDate/formatNumber/formatMoney/formatCoeff/formatPercent/downloadBlob/extractFilename 等）
    - HTTP 层：[src/services/request.ts](frontend/src/services/request.ts) — axios 实例 + ApiError 类；请求拦截器注入 Bearer Token；响应拦截器处理 `{code, message, data}` 统一格式（code≠200 业务错误自动 toast）+ 401 清登录态跳 `/login?redirect=`；提供 get/post/postRaw/put/del/download/upload 便捷方法
    - API 模块（12 个）：[src/services/api/auth.ts](frontend/src/services/api/auth.ts)、[cycle.ts](frontend/src/services/api/cycle.ts)、[employee.ts](frontend/src/services/api/employee.ts)、[project.ts](frontend/src/services/api/project.ts)、[parameter.ts](frontend/src/services/api/parameter.ts)、[participation.ts](frontend/src/services/api/participation.ts)、[publicScore.ts](frontend/src/services/api/publicScore.ts)、[score.ts](frontend/src/services/api/score.ts)、[evaluation.ts](frontend/src/services/api/evaluation.ts)、[economic.ts](frontend/src/services/api/economic.ts)、[bonus.ts](frontend/src/services/api/bonus.ts)、[result.ts](frontend/src/services/api/result.ts)；[src/services/api/index.ts](frontend/src/services/api/index.ts) 统一导出。完整覆盖后端全部 90 条路由
    - 状态管理：[src/stores/userStore.ts](frontend/src/stores/userStore.ts)（Zustand + persist localStorage；token/user + setSession/clear/patchUser + isAdmin/isPm/isLeader/isEmployee/hasRole 便捷方法）；[src/stores/cycleStore.ts](frontend/src/stores/cycleStore.ts)（activeCycle + fetchActive/setActive/phaseName）
    - 验证：`tsc -p tsconfig.app.json --noEmit` 零错误，`npm run build` 成功（依然 1471 modules，因为 App.tsx 尚未 import 这些模块，tree-shaking 会移除未使用代码；批次 3 接入后会逐步纳入 bundle）
    - 代码量：新增 1555 行 TS

- [x] **批次 3：路由、布局与登录** ✅
  - `router.tsx`：路由表 + `RequireAuth` 守卫 + 按角色过滤菜单
  - `layouts/BasicLayout.tsx`：ProLayout（侧边菜单 + 顶栏 + 当前周期显示 + 用户下拉「修改密码/退出」）
  - `pages/Login/`：手机号+密码登录
  - `pages/ChangePassword/`：修改密码
  - **产出**：
    - 路由层：[src/router/routes.tsx](frontend/src/router/routes.tsx) — 集中声明菜单路由树（`AppRouteNode` 接口：path/title/icon/roles/element/children/hideInMenu），`filterRoutesByRole` 按角色递归过滤分组（自动剔除无可见叶子的空分组），`findFirstAccessibleRoute` 给出登录后首个可访问路径，`joinPath` 拼绝对路径。所有业务页面以 `Placeholder` 占位（标注归属批次），后续批次只替换 element 即可。
    - 守卫：[src/router/RequireAuth.tsx](frontend/src/router/RequireAuth.tsx) — 双层校验：未登录跳 `/login?redirect=...`；登录但角色不在白名单展示 antd 403 Result。
    - 路由表：[src/router/index.tsx](frontend/src/router/index.tsx) — `createBrowserRouter` 三大块：`/login`（公开）、`/`（RequireAuth 包 BasicLayout，子路由由 `buildRouteObjects` 把 AppRouteNode 树展平成绝对路径 RouteObject 列表，对带 roles 的叶子再包一层 RequireAuth 防 URL 直访）、`*` 兜底跳登录；`index` 自动重定向到 `/dashboard`。
    - 布局：[src/layouts/BasicLayout.tsx](frontend/src/layouts/BasicLayout.tsx) — `@ant-design/pro-components` 的 `ProLayout`（`layout="mix"` + 固定侧栏 + 固定顶栏 + Fluid 内容宽），通过 `menuDataRender` 注入按角色过滤后的菜单（`toMenuData` 负责把 AppRouteNode 转 MenuDataItem），`menuItemRender` 用 `<Link>` 接管点击；`actionsRender` 顶栏右侧展示 `当前周期：xxx + 阶段 Tag`（无活跃周期时显示灰底 Tag）；`avatarProps.render` 自定义用户下拉（个人信息 / 修改密码 / 退出登录，退出走 modal.confirm 二次确认）；进入受保护区时若 cycleStore 为空自动 fetchActive 一次；`menuFooterRender` 在展开态显示「姓名（角色）」。
    - 登录页：[src/pages/login/index.tsx](frontend/src/pages/login/index.tsx) — 居中卡片 + 渐变背景；手机号正则校验 `^1\d{10}$`；登录成功写 userStore、预拉活跃周期（失败不阻塞）、按 `?redirect=` 跳回；已登录访问 `/login` 时通过 `<Navigate>` 直接跳 redirect 目标。
    - 修改密码页：[src/pages/changePassword/index.tsx](frontend/src/pages/changePassword/index.tsx) — 三字段表单（旧密码 / 新密码 6-32 位 / 确认密码同步校验 `dependencies`），提交成功后清登录态强制重新登录；同时挂载在路由 `/profile/change-password` 与顶栏用户下拉。
    - 入口替换：[src/App.tsx](frontend/src/App.tsx) 由占位 Result 改为 `<RouterProvider router={router} />`；main.tsx 的 ConfigProvider/AntdApp 包裹保持不变（这样登录页/守卫/路由内的 `App.useApp()` 都能拿到 message/modal 上下文）。
    - 验证：`tsc -p tsconfig.app.json --noEmit` 零错误；`npm run build` 成功（4131 modules → 1115.99 kB / gzip 365.00 kB；模块数从批次 2 的 1471 跃升，是因为路由 + ProLayout + antd icons + react-router 全部进入 bundle）。
    - 后续批次接入约定：实现某个业务页面后，仅需把 `routes.tsx` 中对应 Placeholder 节点的 `element` 替换为真实组件即可，无需改动 router/index.tsx 或菜单生成逻辑；新页面如有更细的角色限制，把 roles 字段补上即可获得菜单过滤 + URL 直访拦截。

- [x] **批次 4：Dashboard 与基础数据管理** ✅
  - `pages/Dashboard/`：按角色渲染不同卡片（管理员/项目经理/普通员工/领导）
  - `pages/Employee/`：员工列表、增删改、Excel 导入、模板下载、重置密码
  - `pages/Project/`：项目列表、增删改、Excel 导入、模板下载、签约概率设置
  - **产出**：
    - 工作台：[src/pages/dashboard/index.tsx](frontend/src/pages/dashboard/index.tsx) — 顶部欢迎区（问候语 + 角色 / 部门 / 考核类型 Tag + 当前周期 + 阶段），无活跃周期时管理员视图弹 Alert 引导创建。管理员视图额外渲染 4 张 Statistic 卡（员工总数 / 项目总数 / 评价完成率 / 当前阶段），数据来自 `employeeApi.list({page_size:1})` / `projectApi.list({page_size:1})` 取 total + `evaluationApi.progress()`。下方按角色渲染不同的「快捷入口」彩色卡片网格 —— 管理员 6 张（员工/项目/周期/参数/积分/成绩）、PM 3 张（参与度/公共积分/我的评价）、领导 3 张（我的评价/工作目标/最终成绩）、普通员工 3 张（公共积分/我的评价/个人中心）。`Promise.allSettled` 包裹拉数据，单个请求失败不影响其他卡片。
    - 员工管理：[src/pages/employee/index.tsx](frontend/src/pages/employee/index.tsx) — Card + 顶栏 3 个按钮（下载模板 / 导入 Excel / 新增员工），筛选区 4 个控件（姓名手机号 search、部门 / 角色 / 考核类型 Select）+ 查询 / 重置；Table 11 列含固定首尾列（姓名固定左、操作固定右）和水平滚动 1300 px；操作列含编辑 / 重置密码 / 删除（Popconfirm 二次确认 + 重置密码用 modal.confirm）；分页 page/pageSize 状态化；EmployeeListQuery 直接拼后端 API。Modal 表单：姓名 + 手机号（正则 `^1\d{10}$`）+ 部门 Select + 组 / 中心 + 岗位 + 岗级 + 角色 Select + 考核类型 Select + 第二考核类型（混合角色） + 编辑态 is_active Switch；新增成功 toast 提示初始密码为手机号后 6 位。Excel 导入 Modal：Upload.Dragger（`beforeUpload` 阻止自动上传，校验扩展名 .xlsx/.xls） + 全量更新 Switch；导入返回 errors 时弹 modal.warning 滚动列表展示错误明细；下载模板调用 `employeeApi.downloadTemplate()` + `extractFilename` + `downloadBlob`。
    - 项目管理：[src/pages/project/index.tsx](frontend/src/pages/project/index.tsx) — 与员工页同构，顶栏多了「签约概率设置」按钮。Table 11 列：令号 / 名称 / 类型 Tag / 主承部门 / 项目经理 / 合同金额 / 利润 / 签约概率(百分比) / 工作量系数 / 状态 / 操作；金额和系数用 `formatMoney` / `formatCoeff` 渲染，水平滚动 1500 px。Modal 表单：12 个字段含项目令号（编辑禁用）/ 状态 / 名称 / 类型 / 实施方式 / 主承部门 / PM / 客户 / RangePicker 起止日期（dayjs）/ 4 个金额 InputNumber / 2 个进度系数 InputNumber（0~1 范围）；提交时 RangePicker 拆成 ISO 字符串，编辑时剔除 project_code。签约概率 Drawer：调 `parameterApi.listSigningProbabilities()` 拉未签约项目 → 行内 InputNumber 直接编辑，spProbMap 维护本地状态 → 保存时调 `saveSigningProbabilities`（后端会重算 economic_scale_coeff）→ 关闭后刷新主列表。
    - 路由接入：[src/router/routes.tsx](frontend/src/router/routes.tsx) 中 `/dashboard`、`/data/employees`、`/data/projects` 三个节点的 element 由 Placeholder 替换为真实页面（其余批次入口仍保持 Placeholder）。
    - 验证：`tsc -p tsconfig.app.json --noEmit` 零错误；`npm run build` 成功（4139 modules → 1631.21 kB / gzip 523.83 kB；模块数较批次 3 的 4131 仅微涨 8 个，因为大多数 antd 组件已在批次 3 进入 bundle）。
    - 后端对接注意：所有列表接口要求活跃周期存在，否则返回 400「没有活跃的考核周期」—— 工作台对管理员显式 Alert 引导，员工 / 项目页则由 axios 拦截器吐出错误 toast。员工导入和项目导入支持 `reimport=true` 全量更新，前端用 Switch 切换。重置密码后端不返回新密码，仅 toast 提示「已重置」（业务约定为手机号后 6 位）。

- [x] **批次 5：考核周期与参数设置** ✅
  - `pages/Cycle/`：周期创建、激活、归档、阶段前进/回退
  - `pages/Parameter/`：5 组参数设置（部门人均目标 / 专项目标 / 项目类型系数 / 员工指标系数 / 签约概率）
  - **产出**：
    - 考核周期管理：[src/pages/cycle/index.tsx](frontend/src/pages/cycle/index.tsx) — Card + Table 展示所有周期（名称/阶段/状态）；创建周期（Modal + 名称输入，提示自动继承上一周期）；激活周期（Popconfirm 确认，自动更新全局 cycleStore）；归档周期（Popconfirm 二次确认，归档后不可操作）；阶段前进/回退（modal.confirm 确认，显示目标阶段名称，边界禁用 1-5）；阶段 Tag 按阶段号着色。
    - 考核参数设置：[src/pages/parameter/index.tsx](frontend/src/pages/parameter/index.tsx) — Card + 5 个 Tabs：
      - Tab1 部门人均目标值：可编辑 Table（行内 InputNumber）+ 新增行（部门 Select + 组 Input + 目标值）+ 批量保存
      - Tab2 专项目标值：Form（产品合同目标值 + 科技创新目标值）InputNumber + 保存
      - Tab3 项目类型系数：可编辑 Table + 保存 + 重置默认（Popconfirm 确认）
      - Tab4 员工指标系数：可编辑 Table + 保存 + 重置默认（Popconfirm 确认）
      - Tab5 签约概率：未签约项目 Table + 行内百分比 InputNumber（50%~100%）+ 保存后自动重算经济规模系数；无未签约项目时空态提示
    - 路由接入：[src/router/routes.tsx](frontend/src/router/routes.tsx) 中 `/settings/cycles` 和 `/settings/parameters` 由 Placeholder 替换为真实页面
    - 验证：`tsc` 零错误；`npm run build` 成功（4151 modules → 1696.79 kB / gzip 542.36 kB）

- [x] **批次 6：参与度与公共积分** ✅
  - `pages/Participation/`：项目经理填报视图、管理员全量管理视图、校验提示
  - `pages/PublicScore/`：员工申报视图、管理员审核/修改视图
  - **产出**：
    - 项目参与度：[src/pages/participation/index.tsx](frontend/src/pages/participation/index.tsx) — Tabs 三栏布局（填报 / 概览 / 全量管理），项目经理仅显示填报 Tab，管理员额外显示概览统计和全量管理 Tab。填报 Tab：Select 选择项目 → 动态加载参与度记录 → 行内 InputNumber 编辑系数（0~1，精度4位）→ 添加员工（Select 联动排除已选）→ 保存/提交；同部门系数合计实时校验（±0.01容差），不通过时 Alert 警告且提交被拦截；部门系数合计 Tag 实时展示（绿色通过/黄色警告）。概览 Tab：Table 展示全部项目填报状态（已填/未填 Tag + 表头过滤器）。全量管理 Tab：支持按项目/部门筛选的 Table。
    - 公共积分申报：[src/pages/publicScore/index.tsx](frontend/src/pages/publicScore/index.tsx) — Card + Table（员工视图仅看自己的记录，管理员看全部）。管理员筛选区：员工姓名搜索 + 活动类型 + 状态 Select + 查询按钮。Table 列：[管理员额外]员工姓名 / 活动名称 / 类型(Tag) / 人月 / 复杂度 / 规模值 / 复杂性值 / 工作量系数 / 积分 / 状态(Tag) / 操作(编辑+删除)，水平滚动 1200~1300px。Modal 表单：活动名称 / 类型 Select / 人月 InputNumber / 复杂度 Select / 备注 TextArea；管理员编辑时额外显示工作量系数和积分两个 InputNumber 字段（可直接修改覆盖系统计算值）。状态 Tag：待审核(默认) / 管理员已修改(orange)。
    - 路由接入：[src/router/routes.tsx](frontend/src/router/routes.tsx) 中 `/declare/participation` 和 `/declare/public-score` 由 Placeholder 替换为真实页面
    - 验证：`tsc` 零错误；`npm run build` 成功（4155 modules → 1710.57 kB / gzip 546.13 kB）

- [x] **批次 7：积分统计与经济指标** ✅
  - `pages/Score/`：触发计算、明细查询/编辑、汇总查询、Excel 导出
  - `pages/Economic/`：触发计算、明细查询、汇总查询、Excel 导出
  - **产出**：
    - 积分统计：[src/pages/score/index.tsx](frontend/src/pages/score/index.tsx) — Card + Tabs 双栏（明细/汇总）。顶栏操作区：触发计算（modal.confirm 二次确认 → POST /api/scores/calculate）+ 导出 Excel（Blob 下载）。明细 Tab：筛选区 4 控件（员工姓名 / 项目名称 Input + 阶段 / 部门 Select）+ Table 12 列（员工 / 项目 / 阶段 Tag 着色 / 基础分 / 进度系数 / 工作量系数 / 参与系数 / 积分 / 参与人 / 完成工作 / 备注 / 操作），水平滚动 1400px，首尾列固定；操作列含编辑按钮 → Modal 表单（进度系数 / 工作量系数 InputNumber + 工作描述 / 备注 TextArea），提交后刷新列表。汇总 Tab：筛选区 3 控件（员工姓名 / 部门 / 考核类型）+ Table 8 列（员工 / 部门 / 考核类型 / 项目积分 / 公共积分 / 转型积分 / 总积分加粗 / 归一化得分 Tag），水平滚动 900px。
    - 经济指标核算：[src/pages/economic/index.tsx](frontend/src/pages/economic/index.tsx) — Card + Tabs 双栏（明细/汇总）。顶栏操作区：触发计算（modal.confirm）+ 导出 Excel。明细 Tab：筛选区 3 控件（员工姓名 / 部门 / 组中心）+ Table 14 列（员工 / 部门 / 组 / 岗级 / 考核类型 / 项目名称 / 指标类型 Tag 着色 / 原始值 / 参与系数 / 完成值 / 目标值 / 指标系数 / 满分 / 得分加粗），水平滚动 1600px，首尾列固定；rowKey 复合键。汇总 Tab：筛选区 2 控件（部门 / 组中心）+ Table 6 列（员工 / 部门 / 组 / 岗级 / 考核类型 / 总分 Tag）。
    - 路由接入：[src/router/routes.tsx](frontend/src/router/routes.tsx) 中 `/stats/score` 和 `/stats/economic` 由 Placeholder 替换为真实页面
    - 验证：`tsc` 零错误；`npm run build` 成功（4159 modules → 1723.39 kB / gzip 548.46 kB）

- [x] **批次 8：360 评价** ✅
  - `pages/Evaluation/Relations/`：互评关系生成、查看、编辑、导出
  - `pages/Evaluation/MyTasks/`：我的评价任务、在线评分
  - `pages/Evaluation/Summary/`：评分汇总查询、重置
  - `pages/Evaluation/WorkGoal/`：公共人员工作目标完成度录入
  - 进度统计看板
  - **产出**：
    - 互评关系管理：[src/pages/evaluation/Relations.tsx](frontend/src/pages/evaluation/Relations.tsx) — 顶部进度统计卡片（总数/已完成/未完成 Statistic + Progress 百分比进度条）；主卡片含生成互评关系按钮（modal.confirm）+ 导出 Excel；筛选区 3 控件（被评人姓名 / 评价人类型 / 部门）；Table 7 列（被评人 / 考核类型 / 评价人 / 评价人类型 Tag 着色 / 序号 / 状态 Tag / 操作）；编辑评价人 Modal（Select showSearch 员工列表，显示部门+组信息）。
    - 我的评价任务：[src/pages/evaluation/MyTasks.tsx](frontend/src/pages/evaluation/MyTasks.tsx) — 所有登录用户可见。Card 标题含待评/已完成计数 Tag；Table 5 列（被评人 / 考核类型 / 评价人类型 Tag / 状态 / 操作：待评→评分、已完成→查看）；评分 Modal 动态加载维度（按被评人考核类型），每维度 InputNumber（0~满分）+ 校验规则，提交后锁定；查看详情 Modal 用 Descriptions 展示各维度得分。
    - 评分汇总：[src/pages/evaluation/Summary.tsx](frontend/src/pages/evaluation/Summary.tsx) — 触发汇总计算 + 导出 Excel；筛选区 3 控件（员工 / 部门 / 考核类型）；Table 12 列（员工 / 部门 / 岗位 / 考核类型 / 同事1~4 / 上级领导 / 部门领导 / 加权总分加粗 / 最终得分(/30) Tag），水平滚动 1200px。
    - 工作目标完成度：[src/pages/evaluation/WorkGoal.tsx](frontend/src/pages/evaluation/WorkGoal.tsx) — 领导/管理员可见。加载公共人员列表 + 已有评分合并展示；Card 标题含已评/总数 Tag；Table 7 列（姓名 / 部门 / 组 / 岗位 / 状态 Tag / 评语 / 操作：评分/修改）；评分 Modal：InputNumber（0~70）+ TextArea 评语（1000字）。
    - 路由接入：[src/router/routes.tsx](frontend/src/router/routes.tsx) 中 `/evaluation/relations`、`/evaluation/my-tasks`、`/evaluation/summary`、`/evaluation/work-goal` 由 Placeholder 替换为真实页面；work-goal 角色权限修正为 ADMIN+LEADER
    - 验证：`tsc` 零错误；`npm run build` 成功（4163 modules → 1737.66 kB / gzip 551.54 kB）

- [x] **批次 9：加减分、重点任务与最终成绩** ✅
  - `pages/Bonus/`：加减分记录 CRUD、重点任务分数录入（单个/批量）、导出
  - `pages/Result/`：最终成绩计算、总表查询（排名/评级/评语编辑）、按类型导出、全量导出、确认完成归档
  - **产出**：
    - 加减分/重点任务：[src/pages/bonus/index.tsx](frontend/src/pages/bonus/index.tsx) — Card + Tabs 双栏。加减分 Tab：筛选区（部门/考核类型）+ 新增按钮；Table 6 列（员工/部门/考核类型/说明/分值 Tag 正绿负红/操作 Popconfirm 删除），水平滚动 800px；新增 Modal（Select 搜索员工 + 说明 TextArea + 分值 InputNumber ±10）。重点任务 Tab：批量保存按钮 + 提示文字；Table 3 列（员工 / 行内 InputNumber 0~10 / 当前值），rowKey=employee_id，编辑后统一批量保存。导出 Excel 按钮在 Card extra。
    - 最终成绩：[src/pages/result/index.tsx](frontend/src/pages/result/index.tsx) — Card 顶栏：触发计算 + 导出 Dropdown（成绩总表/全量4Sheet）+ 确认归档（danger）；筛选区 3 控件（员工/部门/考核类型）；Table 16 列（姓名/部门/组/岗级/考核类型/工作积分(含满分)/经济指标(含满分)/重点任务/工作目标/综合评价/加减分 Tag/总分加粗/排名/等级 Dropdown 设置/混合 Tag/操作：评语），水平滚动 1500px，首尾列固定；等级列管理员点击弹 Dropdown 菜单直接选等级（优秀金色/不合格红色）；评语 Modal（TextArea 1000字）；领导角色仅可编辑评语不可设等级和触发计算。
    - 路由接入：[src/router/routes.tsx](frontend/src/router/routes.tsx) 中 `/result/bonus` 和 `/result/final` 由 Placeholder 替换为真实页面
    - 验证：`tsc` 零错误；`npm run build` 成功（4167 modules → 1748.37 kB / gzip 553.94 kB）

- [x] **批次 10：个人中心与整体打磨** ✅
  - `pages/Profile/`：个人信息、查看本期成绩详情、修改密码
  - 路由清理：移除 Placeholder 组件及 Result 导入
  - **产出**：
    - 个人中心：[src/pages/profile/index.tsx](frontend/src/pages/profile/index.tsx) — 所有登录用户可见。顶部卡片 Descriptions 展示基本信息（姓名/部门/角色/考核类型/当前周期）+ 修改密码快捷按钮。下方双列布局：左列积分汇总卡片（项目积分/公共积分/转型积分/总积分/归一化得分 Statistic），右列考核成绩卡片（总分/排名/评定等级 + Descriptions 各维度得分 + 领导评语区块）；无数据时 Empty 空态；数据加载 Spin 状态。
    - 路由清理：[src/router/routes.tsx](frontend/src/router/routes.tsx) 移除 Placeholder 组件定义和 `Result` 导入，所有页面路由均已接入真实组件（前端零占位页）
    - 验证：`tsc` 零错误；`npm run build` 成功（4168 modules → 1752.36 kB / gzip 554.75 kB）

- [x] **批次 4.5：UI 视觉风格重构（Neumorphism 软萌风 + 深浅色模式）** ✅
  - **目标**：把现有 AntD 默认视觉升级为 Neumorphism（新拟态/软萌）风格，支持跟随系统的深/浅色模式，并在顶栏提供手动切换按钮。
  - **设计策略（混合方案）**：
    - **软萌化**：整体背景、ProLayout 侧栏/顶栏、卡片容器、Dashboard 统计块、按钮、Switch、Slider、登录页
    - **保持清晰**：Table、Form 控件、Descriptions、菜单选中态等数据密集区域（只做圆角/阴影轻微调整），避免可读性下降
    - **色彩体系**：浅色底 `#e4e9f0` + 双向阴影 `#b8c0cc / #ffffff`；深色底 `#2a2d35` + 双向阴影 `#1a1c22 / #3a3e48`
    - **圆角**：统一 `sm=12 / md=18 / lg=24 / xl=28`；**阴影强度**：`1/2/3` 三档
  - **产出**：
    - 主题框架：[src/theme/tokens.ts](frontend/src/theme/tokens.ts)（浅/深两套 NeuTokens + `buildAntdTheme` 映射 + CSS 变量生成）、[src/theme/ThemeProvider.tsx](frontend/src/theme/ThemeProvider.tsx)（三态模式管理 system/light/dark + `matchMedia` 跟随系统 + `localStorage('theme-mode')` 持久化 + CSS 变量注入 `<body>` + AntD `ConfigProvider` 含 `darkAlgorithm`）、[src/theme/useTheme.ts](frontend/src/theme/useTheme.ts)（`mode/resolvedMode/setMode/tokens`）
    - Neu 组件（5个）：[src/components/neu/NeuCard.tsx](frontend/src/components/neu/NeuCard.tsx)（外凸/内凹，3级阴影，hoverable）、[NeuPanel.tsx](frontend/src/components/neu/NeuPanel.tsx)（内凹面板+标题）、[NeuButton.tsx](frontend/src/components/neu/NeuButton.tsx)（default/primary，3尺寸，按下态内凹）、[NeuSwitch.tsx](frontend/src/components/neu/NeuSwitch.tsx)（轨道内凹+旋钮滑动）、[NeuSlider.tsx](frontend/src/components/neu/NeuSlider.tsx)（轨道内凹+accent填充）、[index.ts](frontend/src/components/neu/index.ts)统一导出
    - 主题预览页：[src/pages/system/themePreview/index.tsx](frontend/src/pages/system/themePreview/index.tsx)（集中展示全部 Neu 组件 + AntD Table/Form/Descriptions/Tag/Progress 融合效果 + 浅/深模式切换）；路由 `/system/theme-preview`（管理员菜单）
    - 登录页重构：[src/pages/login/index.tsx](frontend/src/pages/login/index.tsx)（渐变背景跟随深浅色 + NeuCard 外凸容器 + 圆形 logo + 输入框内凹阴影 + 按钮外凸）
    - 布局升级：[src/layouts/BasicLayout.tsx](frontend/src/layouts/BasicLayout.tsx)（ProLayout token 注入 Neu 色值 + 侧栏/顶栏背景绑定 CSS 变量 + 菜单选中态 + 用户头像外凸 + 底部用户信息内凹面板 + 顶栏主题切换下拉按钮 System/Light/Dark 三态）
    - Dashboard 升级：[src/pages/dashboard/index.tsx](frontend/src/pages/dashboard/index.tsx)（欢迎区/统计卡/快捷入口全部改用 NeuCard + 图标底色内凹 + accent 进入链接）
    - 业务页轻改：员工管理、项目管理、修改密码页 Card 容器添加 Neu 圆角 + 阴影
    - 全局样式：[src/index.css](frontend/src/index.css)（body 背景/文字色绑定 CSS 变量 + hoverable 卡片动画）
    - 入口替换：[src/main.tsx](frontend/src/main.tsx)（`ConfigProvider` → `ThemeProvider` 包裹）
    - 验证：`tsc` 零错误，`npm run build` 成功（4149 modules → 1677.86 kB / gzip 537.80 kB）

> 完成每个批次后，在此处将 `[ ]` 改为 `[x]`，并在批次行下方追加该批次实际产出的要点清单（页面文件、新增组件、后端对接注意事项等）。

## 启动方式

### 后端
```bash
cd assessment-system/backend
pip install -r requirements.txt
# 运行迁移
python -c "from alembic.config import Config; from alembic import command; command.upgrade(Config('alembic.ini'), 'head')"
# 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端
```bash
cd assessment-system/frontend
npm install        # 首次或依赖变化时执行
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # 生产构建
npm run lint       # TypeScript 类型检查
```
