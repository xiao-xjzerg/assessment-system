"""360综合评价路由"""
import io
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import ROLE_ADMIN, ROLE_LEADER, ROLE_PM, EVAL_DIMENSIONS
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.cycle import Cycle
from app.schemas.common import ResponseModel
from app.schemas.evaluation import (
    EvalRelationOut,
    EvalRelationUpdate,
    EvalScoreSubmit,
    EvalScoreOut,
    EvalSummaryOut,
    EvalProgressOut,
    WorkGoalScoreCreate,
    WorkGoalScoreOut,
)
from app.services.evaluation_service import (
    generate_eval_relations,
    get_eval_relations,
    update_eval_relation,
    get_my_eval_tasks,
    submit_eval_scores,
    get_eval_scores_by_relation,
    admin_reset_eval_score,
    calculate_eval_summaries,
    get_eval_summaries,
    get_public_employees_for_leader,
    save_work_goal_score,
    get_work_goal_scores,
    export_eval_relations_data,
    export_eval_summaries_data,
    get_eval_progress,
)

router = APIRouter(prefix="/api/evaluations", tags=["360综合评价"])


async def _get_active_cycle(db: AsyncSession) -> Cycle:
    result = await db.execute(select(Cycle).where(Cycle.is_active == True))
    cycle = result.scalar_one_or_none()
    if cycle is None:
        raise HTTPException(status_code=400, detail="没有活跃的考核周期")
    return cycle


# ========== 互评关系管理 ==========

@router.post("/relations/generate", response_model=ResponseModel)
async def generate_relations(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员生成互评关系（会清除并重新生成）"""
    cycle = await _get_active_cycle(db)
    result = await generate_eval_relations(db, cycle.id)
    return ResponseModel(
        message=f"互评关系生成完成，共创建{result['created']}条记录",
        data=result,
    )


@router.get("/relations", response_model=ResponseModel)
async def list_relations(
    evaluatee_id: Optional[int] = Query(None),
    evaluatee_name: Optional[str] = Query(None),
    evaluator_type: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员查看互评关系列表"""
    cycle = await _get_active_cycle(db)
    items = await get_eval_relations(
        db, cycle.id,
        evaluatee_id=evaluatee_id,
        evaluatee_name=evaluatee_name,
        evaluator_type=evaluator_type,
        department=department,
    )
    data = [EvalRelationOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.put("/relations/{relation_id}", response_model=ResponseModel)
async def edit_relation(
    relation_id: int,
    body: EvalRelationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员修改互评关系的评价人"""
    try:
        relation = await update_eval_relation(
            db, relation_id,
            new_evaluator_id=body.evaluator_id,
            new_evaluator_name=body.evaluator_name,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    data = EvalRelationOut.model_validate(relation).model_dump()
    return ResponseModel(message="修改成功", data=data)


@router.get("/relations/export", response_model=None)
async def export_relations(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """导出互评关系为Excel"""
    cycle = await _get_active_cycle(db)
    items = await export_eval_relations_data(db, cycle.id)

    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "互评关系"
    headers = ["被评人", "被评人考核类型", "评价人", "评价人类型", "序号", "是否已完成"]
    ws.append(headers)
    for r in items:
        ws.append([
            r.evaluatee_name, r.evaluatee_assess_type,
            r.evaluator_name, r.evaluator_type,
            r.evaluator_order, "是" if r.is_completed else "否",
        ])
    for col_idx, col in enumerate(ws.columns, 1):
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26 else "A"].width = max(max_len * 2 + 2, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=eval_relations_{cycle.name}.xlsx"},
    )


# ========== 在线评分 ==========

@router.get("/my-tasks", response_model=ResponseModel)
async def list_my_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """获取当前用户需要完成的评价任务"""
    cycle = await _get_active_cycle(db)
    items = await get_my_eval_tasks(db, cycle.id, current_user.id)
    data = [EvalRelationOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.get("/dimensions", response_model=ResponseModel)
async def get_dimensions(
    assess_type: str = Query(..., description="被评人考核类型"),
):
    """获取指定考核类型的评分维度与满分"""
    dims = EVAL_DIMENSIONS.get(assess_type)
    if dims is None:
        raise HTTPException(status_code=400, detail=f"未知考核类型: {assess_type}")
    data = [{"dimension": k, "max_score": v} for k, v in dims.items()]
    return ResponseModel(data=data)


@router.post("/scores", response_model=ResponseModel)
async def submit_scores(
    body: EvalScoreSubmit,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """提交评分（提交后不可修改，除非管理员重置）"""
    try:
        scores_data = [s.model_dump() for s in body.scores]
        records = await submit_eval_scores(
            db, body.relation_id, scores_data, current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    data = [EvalScoreOut.model_validate(r).model_dump() for r in records]
    return ResponseModel(message="评分提交成功", data=data)


@router.get("/scores/{relation_id}", response_model=ResponseModel)
async def get_scores(
    relation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """查看某个互评关系的评分详情（管理员可看全部，其他人只能看自己参与的）"""
    from app.models.evaluation import EvalRelation as ER
    result = await db.execute(select(ER).where(ER.id == relation_id))
    relation = result.scalar_one_or_none()
    if relation is None:
        raise HTTPException(status_code=404, detail="互评关系不存在")

    # 权限检查：管理员可看全部，评价人看自己的，被评人看匿名汇总（不在此接口）
    if current_user.role != ROLE_ADMIN and current_user.id != relation.evaluator_id:
        raise HTTPException(status_code=403, detail="无权查看此评分详情")

    items = await get_eval_scores_by_relation(db, relation_id)
    data = [EvalScoreOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.post("/scores/{relation_id}/reset", response_model=ResponseModel)
async def reset_scores(
    relation_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员重置评分（允许重新评分）"""
    try:
        relation = await admin_reset_eval_score(db, relation_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    data = EvalRelationOut.model_validate(relation).model_dump()
    return ResponseModel(message="评分已重置", data=data)


# ========== 评分汇总 ==========

@router.post("/summaries/calculate", response_model=ResponseModel)
async def trigger_summary_calculation(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """管理员触发评分汇总计算"""
    cycle = await _get_active_cycle(db)
    count = await calculate_eval_summaries(db, cycle.id)
    return ResponseModel(message=f"评分汇总计算完成，共{count}人")


@router.get("/summaries", response_model=ResponseModel)
async def list_summaries(
    employee_name: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    assess_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """查询评分汇总。管理员/领导可查全部，其他人查自己"""
    cycle = await _get_active_cycle(db)

    if current_user.role in (ROLE_ADMIN, ROLE_LEADER):
        items = await get_eval_summaries(
            db, cycle.id,
            employee_name=employee_name,
            department=department,
            assess_type=assess_type,
        )
    else:
        items = await get_eval_summaries(
            db, cycle.id,
            employee_name=current_user.name,
        )

    data = [EvalSummaryOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)


@router.get("/summaries/export", response_model=None)
async def export_summaries(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """导出综合评价汇总为Excel"""
    cycle = await _get_active_cycle(db)
    items = await export_eval_summaries_data(db, cycle.id)

    from openpyxl import Workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "综合评价汇总"
    headers = [
        "姓名", "部门", "岗位", "考核类型",
        "同事1评分", "同事2评分", "同事3评分", "同事4评分",
        "上级领导评分", "部门领导评分",
        "加权汇总得分", "最终得分(30分制)",
    ]
    ws.append(headers)
    for s in items:
        ws.append([
            s.employee_name, s.department, s.position or "", s.assess_type,
            float(s.colleague1_score), float(s.colleague2_score),
            float(s.colleague3_score), float(s.colleague4_score),
            float(s.superior_score), float(s.dept_leader_score),
            float(s.weighted_total), float(s.final_score),
        ])
    for col_idx, col in enumerate(ws.columns, 1):
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[chr(64 + col_idx) if col_idx <= 26 else "A"].width = max(max_len * 2 + 2, 12)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=eval_summaries_{cycle.name}.xlsx"},
    )


# ========== 评价进度 ==========

@router.get("/progress", response_model=ResponseModel)
async def get_progress(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_ADMIN])),
):
    """获取评价进度统计"""
    cycle = await _get_active_cycle(db)
    data = await get_eval_progress(db, cycle.id)
    return ResponseModel(data=data)


# ========== 工作目标完成度评分 ==========

@router.get("/work-goals/employees", response_model=ResponseModel)
async def list_public_employees(
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_LEADER, ROLE_ADMIN])),
):
    """获取领导需要打分的公共人员列表"""
    cycle = await _get_active_cycle(db)
    try:
        employees = await get_public_employees_for_leader(
            db, cycle.id, current_user.id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    data = [
        {
            "id": e.id,
            "name": e.name,
            "department": e.department,
            "group_name": e.group_name,
            "position": e.position,
        }
        for e in employees
    ]
    return ResponseModel(data=data)


@router.post("/work-goals", response_model=ResponseModel)
async def save_work_goal(
    body: WorkGoalScoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(require_roles([ROLE_LEADER, ROLE_ADMIN])),
):
    """领导保存工作目标完成度评分（满分70分）"""
    cycle = await _get_active_cycle(db)
    try:
        record = await save_work_goal_score(
            db, cycle.id, current_user.id,
            employee_id=body.employee_id,
            score=body.score,
            comment=body.comment,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    data = WorkGoalScoreOut.model_validate(record).model_dump()
    return ResponseModel(message="保存成功", data=data)


@router.get("/work-goals", response_model=ResponseModel)
async def list_work_goals(
    employee_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: Employee = Depends(get_current_user),
):
    """查询工作目标完成度评分。领导/管理员可查全部，其他人查自己"""
    cycle = await _get_active_cycle(db)

    if current_user.role in (ROLE_ADMIN, ROLE_LEADER):
        items = await get_work_goal_scores(
            db, cycle.id,
            employee_id=employee_id,
            leader_id=current_user.id if current_user.role == ROLE_LEADER else None,
        )
    else:
        items = await get_work_goal_scores(
            db, cycle.id,
            employee_id=current_user.id,
        )

    data = [WorkGoalScoreOut.model_validate(i).model_dump() for i in items]
    return ResponseModel(data=data)
