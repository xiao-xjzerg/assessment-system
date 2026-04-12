/**
 * 项目管理接口（对接后端 /api/projects/*）
 */
import { get, post, put, del, download, upload } from '@/services/request';
import type {
  Project,
  ProjectCreate,
  ProjectUpdate,
  ProjectListQuery,
  PaginatedData,
  ImportResult,
} from '@/types';

export const projectApi = {
  list: (params: ProjectListQuery = {}) =>
    get<PaginatedData<Project>>('/projects', { params }),

  getById: (id: number) => get<Project>(`/projects/${id}`),

  create: (body: ProjectCreate) => post<Project>('/projects', body),

  update: (id: number, body: ProjectUpdate) =>
    put<Project>(`/projects/${id}`, body),

  remove: (id: number) => del<null>(`/projects/${id}`),

  downloadTemplate: () => download('/projects/template'),

  importExcel: (file: File, reimport = false) =>
    upload<ImportResult>('/projects/import', file, { reimport }),
};
