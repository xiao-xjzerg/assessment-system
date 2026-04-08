# 员工季度考核管理系统

面向实施交付部和产品研发部（约200人）的季度员工考核管理系统。

## 功能概览

- 数据管理：Excel导入员工信息和项目一览表
- 积分计算：项目积分自动计算、开方归一化折算
- 经济指标：项目利润/自研收入核算
- 360评价：自动匹配评价人、在线评分、加权汇总
- 成绩汇总：自动计算总分、排名、四张报表导出

## 快速启动

### 后端

```bash
cd backend
pip install -r requirements.txt
python -c "from alembic.config import Config; from alembic import command; command.upgrade(Config('alembic.ini'), 'head')"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

访问 http://localhost:8000/docs 查看API文档。

### 前端

```bash
cd frontend
npm install
npm run dev
```

## 技术栈

- 后端：FastAPI + SQLAlchemy 2.0 + SQLite (aiosqlite)
- 前端：React 18 + Ant Design 5 + Vite
- 认证：JWT (python-jose + passlib)
