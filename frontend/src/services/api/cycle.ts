/**
 * 考核周期接口（对接后端 /api/cycles/*）
 */
import { get, post } from '@/services/request';
import type { Cycle, CycleCreate, PhaseUpdate } from '@/types';

export const cycleApi = {
  list: () => get<Cycle[]>('/cycles'),

  getActive: () => get<Cycle | null>('/cycles/active'),

  create: (body: CycleCreate) => post<Cycle>('/cycles', body),

  activate: (cycleId: number) => post<Cycle>(`/cycles/${cycleId}/activate`),

  archive: (cycleId: number) => post<Cycle>(`/cycles/${cycleId}/archive`),

  changePhase: (cycleId: number, body: PhaseUpdate) =>
    post<Cycle>(`/cycles/${cycleId}/phase`, body),
};
