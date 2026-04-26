/**
 * 应用路由表（React Router v6 createBrowserRouter）
 *
 * 结构：
 *   /login                       —— 登录页（公开）
 *   /                            —— 受保护，BasicLayout 外壳
 *     index → 自动重定向到 /dashboard
 *     dashboard / data/* / settings/* / ...（由 routes.tsx 定义）
 *   *                            —— 兜底 404 / 重定向到登录
 *
 * 角色权限在两层强制：
 *   1) RequireAuth 包裹整个 BasicLayout，确保未登录强制跳登录
 *   2) 每条受角色限制的叶子路由再用 RequireAuth(roles=[...]) 包一次，
 *      防止用户直接通过 URL 绕过菜单访问
 */
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import LoginPage from '@/pages/login';
import BasicLayout from '@/layouts/BasicLayout';
import RequireAuth from '@/router/RequireAuth';
import { appRoutes, joinPath, type AppRouteNode } from '@/router/routes';
import type { Role, AssessType } from '@/utils/constants';

/**
 * 把 AppRouteNode 树展开成 react-router 的扁平 RouteObject 子节点。
 * 注意：菜单父节点本身没有 element 时，仅作为分组，不生成路由记录，
 * 但其子节点的 path 仍然带上父段（在 BasicLayout 内菜单仍能展开）。
 */
function buildRouteObjects(nodes: AppRouteNode[], parent = ''): RouteObject[] {
  const result: RouteObject[] = [];
  for (const node of nodes) {
    const full = joinPath(parent, node.path);
    // 叶子（有 element）→ 注册路由
    if (node.element) {
      const hasRoles = !!node.roles && node.roles.length > 0;
      const hasAssessTypes = !!node.assessTypes && node.assessTypes.length > 0;
      const wrapped =
        hasRoles || hasAssessTypes ? (
          <RequireAuth
            roles={hasRoles ? (node.roles as Role[]) : undefined}
            assessTypes={hasAssessTypes ? (node.assessTypes as AssessType[]) : undefined}
          >
            {node.element}
          </RequireAuth>
        ) : (
          node.element
        );
      result.push({
        // createBrowserRouter 的 path 不要前导斜杠（相对父路由）
        path: full.replace(/^\/+/, ''),
        element: wrapped,
      });
    }
    // 有子节点 → 递归展开（不包子菜单本身的 path，因为我们用绝对路径模式）
    if (node.children && node.children.length > 0) {
      result.push(...buildRouteObjects(node.children, full));
    }
  }
  return result;
}

const protectedChildren: RouteObject[] = [
  { index: true, element: <Navigate to="/dashboard" replace /> },
  ...buildRouteObjects(appRoutes),
];

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <BasicLayout />
      </RequireAuth>
    ),
    children: protectedChildren,
  },
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
