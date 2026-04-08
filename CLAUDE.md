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
│       │   └── project.py          # 项目 CRUD、导入、模板下载
│       └── services/               # 业务逻辑层
│           ├── __init__.py
│           ├── employee_service.py # 员工导入、校验、查询
│           ├── project_service.py  # 项目导入、校验、系数计算
│           └── excel_service.py    # Excel 解析与模板生成
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
| project_id | FK→projects | 项目ID |
| phase | String(20) | 项目阶段：售前/交付/公共/转型 |
| base_score | Numeric(8,2) | 基础分值 |
| progress_coeff | Numeric(6,4) | 进度系数 |
| workload_coeff | Numeric(10,4) | 工作量系数 |
| participation_coeff | Numeric(5,4) | 参与系数 |
| score | Numeric(10,2) | 分数=基础×进度×工作量×参与 |

### score_summaries（积分汇总）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| cycle_id/employee_id | FK | 关联 |
| project_score_total | Numeric(10,2) | 项目积分合计 |
| public_score_total | Numeric(10,2) | 公共积分合计 |
| transform_score_total | Numeric(10,2) | 转型积分合计 |
| total_score | Numeric(10,2) | 总积分 |
| normalized_score | Numeric(8,2) | 开方归一化得分 |

### eval_relations（互评关系）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| evaluatee_id | FK→employees | 被评人ID |
| evaluator_id | FK→employees | 评价人ID |
| evaluator_type | String(20) | 评价人类型：同事/上级领导/部门领导等 |
| evaluator_order | Integer | 评价人序号 |
| is_completed | Boolean | 是否已完成评分 |

### eval_scores（评分记录）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer PK | 自增主键 |
| relation_id | FK→eval_relations | 互评关系ID |
| dimension | String(50) | 评分维度 |
| max_score | Numeric(6,2) | 该维度满分 |
| score | Numeric(6,2) | 评分 |

### eval_summaries（评分汇总）
各同事评分、上级领导评分、部门领导评分、加权汇总得分、最终得分（折算到30分）

### work_goal_scores（工作目标完成度评分）
公共人员专用，领导打分，满分70分，含文字评语

### bonus_records（加减分记录）
员工加减分记录，-10~+10范围

### key_task_scores（重点任务分数）
基层管理人员专用，0~10分，线下评定后管理员录入

### final_results（最终考核成绩）
各维度得分、总分、排名、评定等级、混合角色支持

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

## 业务规则备忘

1. **阶段状态**（1~5）仅为标识，不做系统级功能锁定
2. **经济规模系数**先按利润分段计算，再乘以签约概率（未签约项目）
3. **实施方式="产品+服务"**标识合同明确约定产品内容，用于产品化收入特殊规则
4. **参与度系数**：同一项目内，实施交付部合计为1，产品研发部合计为1（某部门无人则为0）
5. **公共活动积分上限**为该员工项目积分的15%，转型活动不设上限
6. **混合角色**按两种身份分别计算后取50%权重合并
7. **排名**在同部门、同考核类型内进行
8. **score_details 与 public_scores 的关系**：
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

## 待开发

### 阶段三：考核参数与项目参与度
- 考核参数 CRUD API（部门目标值、专项目标值、项目类型系数、员工指标系数）
- 项目参与度 CRUD API（项目经理填写、管理员查看/修改）
- 参与度校验（同部门参与系数合计为1）
- 考核周期管理 API（创建、切换、归档）
- 阶段状态管理 API

### 阶段四：积分计算与公共积分申报
- 公共积分申报 API（员工申报、管理员审核/修改）
- 积分自动计算（售前/交付/公共/转型）
- 积分明细与汇总表生成
- 开方归一化得分计算
- 积分统计报表 API

### 阶段五：360评价
- 互评关系自动匹配算法
- 互评关系管理 API
- 在线评分 API
- 评分汇总计算（加权、折算到30分）
- 工作目标完成度评分（领导→公共人员）

### 阶段六：经济指标、加减分与最终成绩
- 经济指标计算 API
- 加减分记录 CRUD API
- 重点任务分数录入 API
- 最终成绩计算与汇总
- 排名（同部门同类型）
- 混合角色合并计算
- 成绩总表导出 Excel
- 全量导出（多Sheet）

### 阶段七：前端开发
- 前端项目初始化与路由配置
- 登录页面
- 管理员/项目经理/普通员工/领导 Dashboard
- 数据导入页面（员工、项目）
- 考核参数设置页面
- 项目参与度填报页面
- 公共积分申报页面
- 积分统计页面
- 经济指标页面
- 360评价页面
- 加减分与重点任务页面
- 成绩总表页面
- 个人中心页面

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

### 前端（待开发）
```bash
cd assessment-system/frontend
npm install
npm run dev
```
