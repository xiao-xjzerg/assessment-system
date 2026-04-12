/**
 * 经济指标核算接口（对接后端 /api/economic/*）
 */
import { get, post, download } from '@/services/request';
import type { EconomicDetail, EconomicSummary } from '@/types';

export const economicApi = {
  /** 管理员触发经济指标全量计算 */
  calculate: () => post<EconomicDetail[]>('/economic/calculate'),

  listDetails: (
    params: {
      employee_name?: string;
      department?: string;
      group_name?: string;
    } = {},
  ) => get<EconomicDetail[]>('/economic/details', { params }),

  listSummary: (
    params: {
      department?: string;
      group_name?: string;
    } = {},
  ) => get<EconomicSummary[]>('/economic/summary', { params }),

  exportExcel: () => download('/economic/export'),
};
