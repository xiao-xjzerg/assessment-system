/**
 * 项目参与度接口（对接后端 /api/participations/*）
 */
import { get, post, del } from '@/services/request';
import type {
  Participation,
  ParticipationSave,
  ParticipationSummary,
  Project,
} from '@/types';

export const participationApi = {
  /** 项目经理查询自己负责的项目（管理员则返回所有） */
  listMyProjects: () => get<Project[]>('/participations/my-projects'),

  /** 某项目的参与度记录 */
  listByProject: (projectId: number) =>
    get<Participation[]>(`/participations/project/${projectId}`),

  /** 管理员：查询所有参与度 */
  listAll: (params: {
    project_id?: number;
    department?: string;
    status?: string;
  } = {}) => get<Participation[]>('/participations', { params }),

  /** 保存或提交参与度 */
  save: (body: ParticipationSave, submit = false) =>
    post<Participation[]>('/participations', body, { params: { submit } }),

  remove: (participationId: number) =>
    del<null>(`/participations/${participationId}`),

  /** 填报概览统计 */
  summary: () => get<ParticipationSummary[]>('/participations/summary'),
};
