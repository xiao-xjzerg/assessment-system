/**
 * 全局常量、枚举定义。
 * 与后端 app/config.py 保持一致。
 */

// ==================== 角色 ====================
export const ROLE = {
  ADMIN: '管理员',
  PM: '项目经理',
  EMPLOYEE: '普通员工',
  LEADER: '领导',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ALL_ROLES: Role[] = [ROLE.ADMIN, ROLE.PM, ROLE.EMPLOYEE, ROLE.LEADER];
/**
 * 员工信息表中允许出现的角色（下拉选项 / 筛选器 / 导入校验）
 * 项目经理不再是员工表角色，由项目一览表的 pm_id 动态派生。
 */
export const EMPLOYEE_ROLES: Role[] = [ROLE.ADMIN, ROLE.EMPLOYEE, ROLE.LEADER];

// ==================== 考核类型 ====================
export const ASSESS_TYPE = {
  MANAGER: '基层管理人员',
  PUBLIC: '公共人员',
  BUSINESS: '业务人员',
  RD: '产品研发人员',
} as const;

export type AssessType = (typeof ASSESS_TYPE)[keyof typeof ASSESS_TYPE];

export const ALL_ASSESS_TYPES: AssessType[] = [
  ASSESS_TYPE.MANAGER,
  ASSESS_TYPE.PUBLIC,
  ASSESS_TYPE.BUSINESS,
  ASSESS_TYPE.RD,
];

// ==================== 部门 ====================
export const DEPARTMENT = {
  DELIVERY: '实施交付部',
  RD: '产品研发部',
} as const;

export type Department = (typeof DEPARTMENT)[keyof typeof DEPARTMENT];

export const ALL_DEPARTMENTS: Department[] = [DEPARTMENT.DELIVERY, DEPARTMENT.RD];

// ==================== 项目类型 ====================
export const PROJECT_TYPES = ['集成', '综合', '自研', '运营', '运维', '基金课题', '咨询', 'AI'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

// ==================== 实施方式 ====================
export const IMPL_METHODS = ['服务', '产品+服务'] as const;
export type ImplMethod = (typeof IMPL_METHODS)[number];

// ==================== 考核阶段 ====================
export const ASSESSMENT_PHASES: Record<number, string> = {
  1: '数据导入',
  2: '填报申报',
  3: '在线评分',
  4: '结果查看',
  5: '确认结束',
};

// ==================== 评定等级 ====================
export const RATING_LEVELS = ['优秀', '合格', '基本合格', '不合格'] as const;
export type RatingLevel = (typeof RATING_LEVELS)[number];

// ==================== 积分阶段 ====================
export const SCORE_PHASES = ['售前', '交付', '公共', '转型'] as const;
export type ScorePhase = (typeof SCORE_PHASES)[number];

// ==================== 公共活动类型 ====================
export const PUBLIC_ACTIVITY_TYPES = ['公共活动', '转型活动'] as const;
export type PublicActivityType = (typeof PUBLIC_ACTIVITY_TYPES)[number];

// ==================== 复杂度 ====================
export const COMPLEXITY_LEVELS = ['较简单', '中等', '极大'] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

// ==================== 存储 Key ====================
export const STORAGE_KEY = {
  TOKEN: 'assessment.token',
  USER: 'assessment.user',
  ACTIVE_CYCLE: 'assessment.activeCycle',
} as const;

// ==================== 默认分页 ====================
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];
