# 员工季度考核管理系统

面向实施交付部、产品研发部等业务团队的季度员工考核管理系统，覆盖基础数据维护、项目参与度、积分统计、经济指标、360 综合评价、加减分、最终成绩和归档结果查看等流程。

## 功能概览

- **基础数据**：员工管理、项目管理，支持 Excel 导入、模板下载和全量导出。
- **考核周期**：创建周期、激活周期、阶段流转、归档管理。
- **考核参数**：维护部门/组目标值、项目类型系数、员工指标系数、签约概率等参数。
- **项目参与度**：项目经理按项目阶段填报售前/交付参与度，管理员可查看和维护全量数据。
- **积分统计**：自动计算项目积分、公共积分、转型积分，并生成积分明细和汇总。
- **经济指标**：按利润、自研收入等维度核算员工经济指标得分。
- **360 评价**：生成互评关系、在线评分、管理员调整评价人、汇总综合评价得分。
- **加减分与重点任务**：维护加减分记录和重点任务得分。
- **最终成绩**：计算最终考核成绩、同部门同考核类型排名、评定等级、领导评语、导出报表。
- **归档结果**：管理员可查看和导出已归档周期的考核结果。
- **个人中心**：员工查看个人信息、本期积分、最终成绩和项目/申报明细。

## 技术栈

| 层级 | 技术 |
| --- | --- |
| 后端 | FastAPI 0.115、SQLAlchemy 2.x、Alembic、SQLite/aiosqlite |
| 前端 | React 18、Vite、TypeScript、Ant Design 5、Zustand |
| 认证 | JWT、python-jose、passlib/bcrypt |
| Excel | openpyxl、xlsxwriter |

## 快速启动

### 后端

```bash
cd backend
pip install -r requirements.txt
python -c "from alembic.config import Config; from alembic import command; command.upgrade(Config('alembic.ini'), 'head')"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API 文档：

```text
http://localhost:8000/docs
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

开发服务默认地址：

```text
http://localhost:5173
```

## 常用命令

后端语法检查：

```bash
cd backend
python -m compileall app
```

前端类型检查：

```bash
cd frontend
npm run lint
```

前端生产构建：

```bash
cd frontend
npm run build
```

数据库迁移到最新版本：

```bash
cd backend
python -c "from alembic.config import Config; from alembic import command; command.upgrade(Config('alembic.ini'), 'head')"
```

## 说明

- 当前默认数据库为 SQLite，开发数据位于 `backend/data/app.db`。
- `CLAUDE.md` 属于本地协作记录文件，已在 `.gitignore` 中忽略，不纳入 Git 提交。
- 详细业务操作可参考 [docs/系统操作手册.md](docs/系统操作手册.md)。
