"""FastAPI 入口，注册路由和中间件"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import auth, employee, project, cycle, parameter, participation, public_score, score, evaluation, economic, bonus, result


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    await init_db()
    yield


app = FastAPI(
    title="员工季度考核管理系统",
    description="实施交付部和产品研发部季度员工考核管理系统 API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router)
app.include_router(employee.router)
app.include_router(project.router)
app.include_router(cycle.router)
app.include_router(parameter.router)
app.include_router(participation.router)
app.include_router(public_score.router)
app.include_router(score.router)
app.include_router(evaluation.router)
app.include_router(economic.router)
app.include_router(bonus.router)
app.include_router(result.router)


@app.get("/")
async def root():
    return {"code": 200, "message": "员工季度考核管理系统 API", "data": None}


@app.get("/health")
async def health():
    return {"code": 200, "message": "healthy", "data": None}
