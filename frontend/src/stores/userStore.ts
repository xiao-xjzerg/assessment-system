/**
 * 用户登录态 Store（Zustand + localStorage 持久化）
 *
 * 权限策略：严格按后端 JWT 返回的 role 字段做前端菜单过滤和路由守卫。
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEY, ROLE, type Role } from '@/utils/constants';
import type { LoginResponse } from '@/types';

export interface UserProfile {
  user_id: number;
  name: string;
  role: string;
  assess_type: string;
  department: string;
}

interface UserState {
  token: string | null;
  user: UserProfile | null;

  /** 登录成功后写入 token 和用户信息 */
  setSession: (payload: LoginResponse) => void;
  /** 更新用户基本信息（不动 token） */
  patchUser: (patch: Partial<UserProfile>) => void;
  /** 清空登录态 */
  clear: () => void;

  // 便捷角色判断
  isAdmin: () => boolean;
  isPm: () => boolean;
  isLeader: () => boolean;
  isEmployee: () => boolean;
  hasRole: (...roles: Role[]) => boolean;
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,

      setSession: (payload) => {
        // 同步写入 localStorage 中的 TOKEN 独立键，供 axios 拦截器直接读取
        // （axios 拦截器在 persist hydration 完成前也能取到 token）
        localStorage.setItem(STORAGE_KEY.TOKEN, payload.token);
        set({
          token: payload.token,
          user: {
            user_id: payload.user_id,
            name: payload.name,
            role: payload.role,
            assess_type: payload.assess_type,
            department: payload.department,
          },
        });
      },

      patchUser: (patch) => {
        const current = get().user;
        if (!current) return;
        set({ user: { ...current, ...patch } });
      },

      clear: () => {
        localStorage.removeItem(STORAGE_KEY.TOKEN);
        set({ token: null, user: null });
      },

      isAdmin: () => get().user?.role === ROLE.ADMIN,
      isPm: () => get().user?.role === ROLE.PM,
      isLeader: () => get().user?.role === ROLE.LEADER,
      isEmployee: () => get().user?.role === ROLE.EMPLOYEE,
      hasRole: (...roles) => {
        const role = get().user?.role;
        return role ? roles.includes(role as Role) : false;
      },
    }),
    {
      name: STORAGE_KEY.USER,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    },
  ),
);
