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
};
