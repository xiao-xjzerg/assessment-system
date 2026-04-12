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
import type { Role } from '@/utils/constants';

interface Props {
  /** 允许的角色；缺省时只校验登录态 */
  roles?: Role[];
  children: ReactNode;
}

export default function RequireAuth({ roles, children }: Props) {
  const location = useLocation();
  const token = useUserStore((s) => s.token);
  const user = useUserStore((s) => s.user);

  // 未登录 → 跳登录页并带 redirect
  if (!token || !user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  // 登录但角色不在白名单 → 403
  if (roles && roles.length > 0 && !roles.includes(user.role as Role)) {
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
