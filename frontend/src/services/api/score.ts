/**
 * 积分统计接口（对接后端 /api/scores/*）
 */
import { get, post, put, download } from '@/services/request';
import type { ScoreDetail, ScoreDetailUpdate, ScoreSummary } from '@/types';

export const scoreApi = {
  /** 管理员触发全量积分计算 */
  calculate: () => post<null>('/scores/calculate'),

  listDetails: (
    params: {
      employee_id?: number;
      employee_name?: string;
      project_name?: string;
      phase?: string;
      department?: string;
    } = {},
  ) => get<ScoreDetail[]>('/scores/details', { params }),

  updateDetail: (detailId: number, body: ScoreDetailUpdate) =>
    put<ScoreDetail>(`/scores/details/${detailId}`, body),

  listSummary: (
    params: {
      employee_name?: string;
      department?: string;
      assess_type?: string;
    } = {},
  ) => get<ScoreSummary[]>('/scores/summary', { params }),

  exportExcel: () => download('/scores/export'),
};
