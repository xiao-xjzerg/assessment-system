/**
 * 360 综合评价接口（对接后端 /api/evaluations/*）
 */
import { get, post, put, download } from '@/services/request';
import type {
  EvalRelation,
  EvalRelationUpdate,
  EvalScoreSubmit,
  EvalScore,
  EvalSummary,
  EvalDimension,
  EvalProgress,
  WorkGoalScoreCreate,
  WorkGoalScore,
  PublicEmployeeBrief,
} from '@/types';

export const evaluationApi = {
  // ---- 互评关系 ----
  generateRelations: () =>
    post<{ created: number }>('/evaluations/relations/generate'),

  listRelations: (
    params: {
      evaluatee_id?: number;
      evaluatee_name?: string;
      evaluator_type?: string;
      department?: string;
    } = {},
  ) => get<EvalRelation[]>('/evaluations/relations', { params }),

  updateRelation: (relationId: number, body: EvalRelationUpdate) =>
    put<EvalRelation>(`/evaluations/relations/${relationId}`, body),

  exportRelations: () => download('/evaluations/relations/export'),

  // ---- 在线评分 ----
  myTasks: () => get<EvalRelation[]>('/evaluations/my-tasks'),

  getDimensions: (assess_type: string) =>
    get<EvalDimension[]>('/evaluations/dimensions', { params: { assess_type } }),

  submitScores: (body: EvalScoreSubmit) =>
    post<EvalScore[]>('/evaluations/scores', body),

  getScoresByRelation: (relationId: number) =>
    get<EvalScore[]>(`/evaluations/scores/${relationId}`),

  /** 管理员重置评分 */
  resetScore: (relationId: number) =>
    post<EvalRelation>(`/evaluations/scores/${relationId}/reset`),

  // ---- 评分汇总 ----
  calculateSummaries: () => post<null>('/evaluations/summaries/calculate'),

  listSummaries: (
    params: {
      employee_name?: string;
      department?: string;
      assess_type?: string;
    } = {},
  ) => get<EvalSummary[]>('/evaluations/summaries', { params }),

  exportSummaries: () => download('/evaluations/summaries/export'),

  // ---- 评价进度 ----
  progress: () => get<EvalProgress>('/evaluations/progress'),

  // ---- 工作目标完成度 ----
  listPublicEmployees: () =>
    get<PublicEmployeeBrief[]>('/evaluations/work-goals/employees'),

  saveWorkGoal: (body: WorkGoalScoreCreate) =>
    post<WorkGoalScore>('/evaluations/work-goals', body),

  listWorkGoals: (params: { employee_id?: number } = {}) =>
    get<WorkGoalScore[]>('/evaluations/work-goals', { params }),
};
