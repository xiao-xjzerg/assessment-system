/**
 * 公共积分申报接口（对接后端 /api/public-scores/*）
 */
import { get, post, put, del } from '@/services/request';
import type {
  PublicScore,
  PublicScoreCreate,
  PublicScoreUpdate,
} from '@/types';

export const publicScoreApi = {
  list: (
    params: {
      employee_id?: number;
      employee_name?: string;
      activity_type?: string;
      status?: string;
    } = {},
  ) => get<PublicScore[]>('/public-scores', { params }),

  create: (body: PublicScoreCreate) =>
    post<PublicScore>('/public-scores', body),

  update: (recordId: number, body: PublicScoreUpdate) =>
    put<PublicScore>(`/public-scores/${recordId}`, body),

  remove: (recordId: number) => del<null>(`/public-scores/${recordId}`),
};
