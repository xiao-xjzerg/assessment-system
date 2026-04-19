/**
 * 员工管理接口（对接后端 /api/employees/*）
 */
import { get, post, put, del, download, upload } from '@/services/request';
import type {
  Employee,
  EmployeeCreate,
  EmployeeUpdate,
  EmployeeListQuery,
  PaginatedData,
  ImportResult,
} from '@/types';

export const employeeApi = {
  list: (params: EmployeeListQuery = {}) =>
    get<PaginatedData<Employee>>('/employees', { params }),

  getById: (id: number) => get<Employee>(`/employees/${id}`),

  create: (body: EmployeeCreate) => post<Employee>('/employees', body),

  update: (id: number, body: EmployeeUpdate) =>
    put<Employee>(`/employees/${id}`, body),

  remove: (id: number) => del<null>(`/employees/${id}`),

  resetPassword: (id: number) => post<null>(`/employees/${id}/reset-password`),

  /** 下载员工导入模板 */
  downloadTemplate: () => download('/employees/template'),

  /** 导入员工 Excel；reimport=true 为全量更新 */
  importExcel: (file: File, reimport = false) =>
    upload<ImportResult>('/employees/import', file, { reimport }),

  /**
   * 拉取当前周期全部员工（用于下拉选人等场景）。
   * 后端 page_size 上限为 100，这里按页循环合并；筛选条件与 list 一致。
   */
  async fetchAll(params: Omit<EmployeeListQuery, 'page' | 'page_size'> = {}): Promise<Employee[]> {
    const pageSize = 100;
    const first = await get<PaginatedData<Employee>>('/employees', {
      params: { ...params, page: 1, page_size: pageSize },
    });
    const all = [...first.items];
    const totalPages = Math.ceil(first.total / pageSize);
    for (let page = 2; page <= totalPages; page++) {
      const resp = await get<PaginatedData<Employee>>('/employees', {
        params: { ...params, page, page_size: pageSize },
      });
      all.push(...resp.items);
    }
    return all;
  },
};
