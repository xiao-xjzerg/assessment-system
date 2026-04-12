/**
 * 加减分与重点任务接口（对接后端 /api/bonus/*）
 */
import { get, post, del, download } from '@/services/request';
import type {
  BonusRecord,
  BonusRecordCreate,
  KeyTaskScore,
  KeyTaskScoreUpdate,
} from '@/types';

export const bonusApi = {
  // ---- 加减分 ----
  listRecords: (
    params: {
      employee_id?: number;
      department?: string;
      assess_type?: string;
    } = {},
  ) => get<BonusRecord[]>('/bonus/records', { params }),

  createRecord: (body: BonusRecordCreate) =>
    post<BonusRecord>('/bonus/records', body),

  removeRecord: (recordId: number) =>
    del<null>(`/bonus/records/${recordId}`),

  // ---- 重点任务分数 ----
  listKeyTasks: (params: { employee_id?: number } = {}) =>
    get<KeyTaskScore[]>('/bonus/key-tasks', { params }),

  saveKeyTask: (body: KeyTaskScoreUpdate) =>
    post<KeyTaskScore>('/bonus/key-tasks', body),

  batchSaveKeyTasks: (items: KeyTaskScoreUpdate[]) =>
    post<KeyTaskScore[]>('/bonus/key-tasks/batch', items),

  exportExcel: () => download('/bonus/export'),
};
