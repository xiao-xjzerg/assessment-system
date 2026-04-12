/**
 * Axios 实例与拦截器。
 *
 * 后端统一响应格式：{code, message, data}
 *   - HTTP 200 + code=200 → 正常，返回 data
 *   - HTTP 200 + code!=200 → 业务错误，抛出 ApiError（message 提示）
 *   - HTTP 4xx/5xx → axios 抛异常，FastAPI 的 HTTPException 响应体为 {detail: "..."}
 *   - HTTP 401 → 清空登录态并跳转登录页
 */
import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { message as antdMessage } from 'antd';
import type { ApiResponse } from '@/types';
import { STORAGE_KEY } from '@/utils/constants';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/** 业务错误（HTTP 200 但 code 非 200 的情况） */
export class ApiError extends Error {
  code: number;
  data: unknown;
  constructor(code: number, message: string, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.data = data;
  }
}

const http: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

// ==================== 请求拦截器 ====================
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(STORAGE_KEY.TOKEN);
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ==================== 响应拦截器 ====================
http.interceptors.response.use(
  (response: AxiosResponse) => {
    // 二进制流（导出 Excel 等）直接返回 response，由调用方处理
    if (
      response.config.responseType === 'blob' ||
      response.config.responseType === 'arraybuffer'
    ) {
      return response;
    }

    const body = response.data as ApiResponse<unknown>;
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 200) {
        return response;
      }
      // 业务错误
      antdMessage.error(body.message || '请求失败');
      return Promise.reject(new ApiError(body.code, body.message, body.data));
    }
    // 非标准响应，直接放行
    return response;
  },
  (error: AxiosError<{ detail?: string }>) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail;

    if (status === 401) {
      // 清空登录态并跳转登录页
      localStorage.removeItem(STORAGE_KEY.TOKEN);
      localStorage.removeItem(STORAGE_KEY.USER);
      antdMessage.error(detail || '登录已失效，请重新登录');
      // 避免在登录页重复跳转
      if (!location.pathname.startsWith('/login')) {
        const redirect = encodeURIComponent(location.pathname + location.search);
        location.href = `/login?redirect=${redirect}`;
      }
    } else if (status === 403) {
      antdMessage.error(detail || '权限不足');
    } else if (status === 404) {
      antdMessage.error(detail || '资源不存在');
    } else if (status && status >= 500) {
      antdMessage.error(detail || '服务器开小差了，请稍后重试');
    } else if (detail) {
      antdMessage.error(detail);
    } else if (error.message) {
      antdMessage.error(error.message);
    }

    return Promise.reject(error);
  },
);

// ==================== 便捷方法 ====================

/** GET 请求，返回 data 字段 */
export async function get<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.get<ApiResponse<T>>(url, config);
  return res.data.data;
}

/** POST 请求，返回 data 字段 */
export async function post<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.post<ApiResponse<T>>(url, body, config);
  return res.data.data;
}

/** POST 请求，返回完整响应体（含 code/message/data） */
export async function postRaw<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig,
): Promise<ApiResponse<T>> {
  const res = await http.post<ApiResponse<T>>(url, body, config);
  return res.data;
}

/** PUT 请求，返回 data 字段 */
export async function put<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.put<ApiResponse<T>>(url, body, config);
  return res.data.data;
}

/** DELETE 请求，返回 data 字段 */
export async function del<T = unknown>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await http.delete<ApiResponse<T>>(url, config);
  return res.data.data;
}

/** 下载文件（返回 Blob + 响应头） */
export async function download(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<Blob>> {
  return http.get<Blob>(url, {
    ...config,
    responseType: 'blob',
  });
}

/** 上传文件（multipart/form-data） */
export async function upload<T = unknown>(
  url: string,
  file: File,
  extra?: Record<string, string | number | boolean>,
  config?: AxiosRequestConfig,
): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const params = extra ?? {};
  const res = await http.post<ApiResponse<T>>(url, form, {
    ...config,
    headers: {
      'Content-Type': 'multipart/form-data',
      ...(config?.headers as Record<string, string> | undefined),
    },
    params,
  });
  return res.data.data;
}

export default http;
