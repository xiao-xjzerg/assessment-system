/**
 * 应用路由表
 *
 * 本文件定义”受保护区”（BasicLayout 内部）的菜单路由。
 * 每条路由可选 roles 控制可见性 —— 若缺省则对所有登录用户可见。
 */
import type { ReactNode } from 'react';
import {
  DashboardOutlined,
  TeamOutlined,
  ProjectOutlined,
  SettingOutlined,
  FormOutlined,
  BarChartOutlined,
  SolutionOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import ChangePasswordPage from '@/pages/changePassword';
import CyclePage from '@/pages/cycle';
import DashboardPage from '@/pages/dashboard';
import EmployeePage from '@/pages/employee';
import ParameterPage from '@/pages/parameter';
import ProjectPage from '@/pages/project';
import ParticipationPage from '@/pages/participation';
import PublicScorePage from '@/pages/publicScore';
import KeyTaskPage from '@/pages/keyTask';
import ScorePage from '@/pages/score';
import EconomicPage from '@/pages/economic';
import RelationsPage from '@/pages/evaluation/Relations';
import MyTasksPage from '@/pages/evaluation/MyTasks';
import EvalSummaryPage from '@/pages/evaluation/Summary';
import WorkGoalPage from '@/pages/evaluation/WorkGoal';
import BonusPage from '@/pages/bonus';
import ResultPage from '@/pages/result';
import ProfilePage from '@/pages/profile';
import ThemePreviewPage from '@/pages/system/themePreview';
import { ROLE, type Role, type AssessType } from '@/utils/constants';


export interface AppRouteNode {
  /** 相对于 BasicLayout 的路径段（不以 / 开头） */
  path: string;
  /** 菜单显示名 */
  title: string;
  /** 菜单图标（可选） */
  icon?: ReactNode;
  /** 允许的角色；未指定视为所有登录用户 */
  roles?: Role[];
  /**
   * 允许的考核类型（可选）；
   * 仅当用户 role === 普通员工 时生效（ADMIN/LEADER 不受此字段限制）。
   * 用于"重点任务申报"这类按 assess_type 区分的场景：
   *   roles=[ADMIN, LEADER, EMPLOYEE] + assessTypes=[基层管理人员]
   *   ⇒ 管理员/领导照常可见，普通员工仅基层管理人员可见。
   */
  assessTypes?: AssessType[];
  /** 路由对应组件；有 children 时可省略（作为菜单分组） */
  element?: ReactNode;
  /** 子路由 */
  children?: AppRouteNode[];
  /** 不在菜单中显示（但仍是有效路由） */
  hideInMenu?: boolean;
}

/**
 * 路由定义。路径段之间不写前导斜杠，BasicLayout 会根据层级拼接。
 */
export const appRoutes: AppRouteNode[] = [
  {
    path: 'dashboard',
    title: '工作台',
    icon: <DashboardOutlined />,
    element: <DashboardPage />,
  },
  {
    path: 'data',
    title: '基础数据',
    icon: <TeamOutlined />,
    roles: [ROLE.ADMIN],
    children: [
      {
        path: 'employees',
        title: '员工管理',
        icon: <TeamOutlined />,
        roles: [ROLE.ADMIN],
        element: <EmployeePage />,
      },
      {
        path: 'projects',
        title: '项目管理',
        icon: <ProjectOutlined />,
        roles: [ROLE.ADMIN],
        element: <ProjectPage />,
      },
    ],
  },
  {
    path: 'settings',
    title: '考核设置',
    icon: <SettingOutlined />,
    roles: [ROLE.ADMIN],
    children: [
      {
        path: 'cycles',
        title: '考核周期',
        roles: [ROLE.ADMIN],
        element: <CyclePage />,
      },
      {
        path: 'parameters',
        title: '考核参数',
        roles: [ROLE.ADMIN],
        element: <ParameterPage />,
      },
    ],
  },
  {
    path: 'declare',
    title: '填报申报',
    icon: <FormOutlined />,
    children: [
      {
        path: 'participation',
        title: '项目参与度',
        roles: [ROLE.ADMIN, ROLE.PM, ROLE.LEADER],
        element: <ParticipationPage />,
      },
      {
        path: 'public-score',
        title: '公共积分申报',
        element: <PublicScorePage />,
      },
      {
        path: 'key-task',
        title: '重点任务申报',
        roles: [ROLE.ADMIN, ROLE.LEADER, ROLE.EMPLOYEE],
        // 普通员工中仅基层管理人员可见；管理员/领导不受此限制
        assessTypes: ['基层管理人员'],
        element: <KeyTaskPage />,
      },
    ],
  },
  {
    path: 'stats',
    title: '统计分析',
    icon: <BarChartOutlined />,
    roles: [ROLE.ADMIN],
    children: [
      {
        path: 'score',
        title: '积分统计',
        roles: [ROLE.ADMIN],
        element: <ScorePage />,
      },
      {
        path: 'economic',
        title: '经济指标',
        roles: [ROLE.ADMIN],
        element: <EconomicPage />,
      },
    ],
  },
  {
    path: 'evaluation',
    title: '360 评价',
    icon: <SolutionOutlined />,
    children: [
      {
        path: 'relations',
        title: '互评关系',
        roles: [ROLE.ADMIN],
        element: <RelationsPage />,
      },
      {
        path: 'my-tasks',
        title: '我的评价',
        element: <MyTasksPage />,
      },
      {
        path: 'summary',
        title: '评分汇总',
        roles: [ROLE.ADMIN],
        element: <EvalSummaryPage />,
      },
      {
        path: 'work-goal',
        title: '公共人员工作目标',
        roles: [ROLE.ADMIN, ROLE.LEADER],
        element: <WorkGoalPage />,
      },
    ],
  },
  {
    path: 'result',
    title: '结果管理',
    icon: <TrophyOutlined />,
    roles: [ROLE.ADMIN, ROLE.LEADER],
    children: [
      {
        path: 'bonus',
        title: '加减分',
        roles: [ROLE.ADMIN],
        element: <BonusPage />,
      },
      {
        path: 'final',
        title: '最终成绩',
        roles: [ROLE.ADMIN, ROLE.LEADER],
        element: <ResultPage />,
      },
    ],
  },
  {
    path: 'system',
    title: '系统设置',
    icon: <SettingOutlined />,
    roles: [ROLE.ADMIN],
    children: [
      {
        path: 'theme-preview',
        title: '主题预览',
        roles: [ROLE.ADMIN],
        element: <ThemePreviewPage />,
      },
    ],
  },
  {
    path: 'profile',
    title: '个人中心',
    icon: <UserOutlined />,
    children: [
      {
        path: 'me',
        title: '个人信息',
        element: <ProfilePage />,
      },
      {
        path: 'change-password',
        title: '修改密码',
        element: <ChangePasswordPage />,
      },
    ],
  },
];

// ==================== 辅助函数 ====================

/** 判断一条路由节点对指定用户是否可见。
 *
 * 规则：
 *  - 未登录（无 role）：一律不可见；
 *  - 路由未指定 roles：所有已登录用户可见；
 *  - 路由指定 roles：用户 role 命中即可见；
 *  - 若 roles 包含"项目经理"且用户 isPm 为 true，也视为命中（派生 PM 权限）；
 *  - 若节点进一步指定 assessTypes，仅对角色=普通员工生效：
 *    user.assess_type ∈ assessTypes 才命中；管理员/领导不受此限制。
 */
export function isRouteVisible(
  node: AppRouteNode,
  role: string | undefined,
  isPm = false,
  assessType?: string | null,
): boolean {
  if (!role) return false;
  if (!node.roles || node.roles.length === 0) return true;
  const roleMatched =
    node.roles.includes(role as Role) || (isPm && node.roles.includes(ROLE.PM));
  if (!roleMatched) return false;
  if (node.assessTypes && node.assessTypes.length > 0 && role === ROLE.EMPLOYEE) {
    return !!assessType && node.assessTypes.includes(assessType as AssessType);
  }
  return true;
}

/** 按用户角色+派生 PM+考核类型 过滤一棵路由树 */
export function filterRoutesByRole(
  nodes: AppRouteNode[],
  role: string | undefined,
  isPm = false,
  assessType?: string | null,
): AppRouteNode[] {
  const result: AppRouteNode[] = [];
  for (const node of nodes) {
    if (!isRouteVisible(node, role, isPm, assessType)) continue;
    if (node.children && node.children.length > 0) {
      const children = filterRoutesByRole(node.children, role, isPm, assessType);
      if (children.length === 0) continue;
      result.push({ ...node, children });
    } else {
      result.push({ ...node });
    }
  }
  return result;
}

/** 把相对路径按层级拼成绝对路径 */
export function joinPath(parent: string, segment: string): string {
  const p = parent.endsWith('/') ? parent.slice(0, -1) : parent;
  const s = segment.startsWith('/') ? segment.slice(1) : segment;
  return `${p}/${s}`;
}

/** 查找首个可访问的叶子路由绝对路径（用于登录后重定向到有权限的第一个页面） */
export function findFirstAccessibleRoute(
  nodes: AppRouteNode[],
  role: string | undefined,
  isPm = false,
  assessType?: string | null,
  parent = '',
): string | null {
  for (const node of nodes) {
    if (node.hideInMenu) continue;
    if (!isRouteVisible(node, role, isPm, assessType)) continue;
    const full = joinPath(parent, node.path);
    if (node.children && node.children.length > 0) {
      const found = findFirstAccessibleRoute(node.children, role, isPm, assessType, full);
      if (found) return found;
    } else if (node.element) {
      return full;
    }
  }
  return null;
}
