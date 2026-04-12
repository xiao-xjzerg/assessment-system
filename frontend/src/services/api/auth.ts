/**
 * 认证接口（对接后端 /api/auth/*）
 */
import { post } from '@/services/request';
import type { LoginRequest, LoginResponse, ChangePasswordRequest } from '@/types';

export const authApi = {
  /** 手机号 + 密码登录 */
  login: (body: LoginRequest) => post<LoginResponse>('/auth/login', body),

  /** 修改密码（需要已登录） */
  changePassword: (body: ChangePasswordRequest) =>
    post<null>('/auth/change-password', body),
};
