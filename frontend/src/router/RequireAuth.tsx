/**
 * 路由守卫：未登录跳 /login，已登录但角色不匹配则展示 403。
 *
 * 用法：包裹需要保护的整棵子树（通常是 BasicLayout）。
 * 也可以在叶子路由再次包裹以收紧角色范围。
 */
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Result, Button } from 'antd';
import { useUserStore } from '@/stores/userStore';
import { ROLE, type Role, type AssessType } from '@/utils/constants';

interface Props {
  /** 允许的角色；缺省时只校验登录态 */
  roles?: Role[];
  /** 允许的考核类型；仅对 role=普通员工 生效 */
  assessTypes?: AssessType[];
  children: ReactNode;
}

export default function RequireAuth({ roles, assessTypes, children }: Props) {
  const location = useLocation();
  const token = useUserStore((s) => s.token);
  const user = useUserStore((s) => s.user);

  // 未登录 → 跳登录页并带 redirect
  if (!token || !user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  // 登录但角色不在白名单 → 403
  // 兼容派生 PM：白名单包含"项目经理"且 user.is_pm 为真时视为命中
  // （与 router/routes.tsx `isRouteVisible` 和 dependencies.py `require_roles` 的口径一致）
  const matchRole = roles ? roles.includes(user.role as Role) : false;
  const matchPm = !!(roles && roles.includes(ROLE.PM) && user.is_pm);
  const roleOk = !roles || roles.length === 0 || matchRole || matchPm;

  // assessTypes 进一步限制：仅对 EMPLOYEE 生效
  let assessOk = true;
  if (assessTypes && assessTypes.length > 0 && user.role === ROLE.EMPLOYEE) {
    assessOk =
      !!user.assess_type && assessTypes.includes(user.assess_type as AssessType);
  }

  if (!roleOk || !assessOk) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="抱歉，您没有访问该页面的权限。"
        extra={
          <Button type="primary" href="/dashboard">
            返回工作台
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}
