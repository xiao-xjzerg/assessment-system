/**
 * 加减分与重点任务接口（对接后端 /api/bonus/*）
 */
import { get, post, put, del, download } from '@/services/request';
import type {
  BonusRecord,
  BonusRecordCreate,
  KeyTaskScore,
  KeyTaskScoreCreate,
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

  // ---- 重点任务申报（多条申请制） ----
  listKeyTasks: (params: { employee_id?: number } = {}) =>
    get<KeyTaskScore[]>('/bonus/key-tasks', { params }),

  createKeyTask: (body: KeyTaskScoreCreate) =>
    post<KeyTaskScore>('/bonus/key-tasks', body),

  updateKeyTask: (id: number, body: KeyTaskScoreUpdate) =>
    put<KeyTaskScore>(`/bonus/key-tasks/${id}`, body),

  removeKeyTask: (id: number) =>
    del<null>(`/bonus/key-tasks/${id}`),

  exportExcel: () => download('/bonus/export'),
};
