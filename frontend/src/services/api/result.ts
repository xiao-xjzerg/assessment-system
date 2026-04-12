/**
 * 最终考核成绩接口（对接后端 /api/results/*）
 */
import { get, post, put, download } from '@/services/request';
import type { FinalResult } from '@/types';

export const resultApi = {
  /** 管理员触发最终成绩全量计算 */
  calculate: () => post<FinalResult[]>('/results/calculate'),

  list: (
    params: {
      department?: string;
      assess_type?: string;
      employee_name?: string;
    } = {},
  ) => get<FinalResult[]>('/results', { params }),

  /** 管理员设置评定等级 */
  setRating: (resultId: number, rating: string) =>
    put<FinalResult>(`/results/${resultId}/rating`, { rating }),

  /** 管理员/领导编辑领导评语 */
  setComment: (resultId: number, leader_comment: string) =>
    put<FinalResult>(`/results/${resultId}/comment`, { leader_comment }),

  /** 导出成绩总表（按考核类型分 Sheet） */
  exportExcel: () => download('/results/export'),

  /** 全量导出（4 个 Sheet：积分/综合测评/经济指标/成绩总表） */
  exportAll: () => download('/results/export-all'),

  /** 管理员确认考核完成并归档 */
  confirm: () => post<null>('/results/confirm'),
};
