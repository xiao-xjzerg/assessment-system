/**
 * 与后端 Pydantic schema 对齐的 TypeScript 类型定义。
 * 注意：后端 Decimal 序列化为字符串，但 Pydantic 的 model_dump() 仍输出为数字时需小心。
 * 这里统一用 `number | string` 以兼容两种情况，实际使用时通过 Number() 转换。
 */

// ==================== 通用响应 ====================
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

// ==================== 认证 ====================
export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user_id: number;
  name: string;
  role: string;
  assess_type: string;
  department: string;
  /** 是否在当前周期担任项目经理（派生角色，基于项目一览表 pm_id） */
  is_pm: boolean;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

// ==================== 考核周期 ====================
export interface Cycle {
  id: number;
  name: string;
  phase: number;
  is_active: boolean;
  is_archived: boolean;
  phase_name?: string;
}

export interface CycleCreate {
  name: string;
}

export interface PhaseUpdate {
  action: 'next' | 'prev';
}

// ==================== 员工 ====================
export interface Employee {
  id: number;
  cycle_id: number;
  name: string;
  department: string;
  group_name: string | null;
  position: string | null;
  grade: string | null;
  phone: string;
  role: string;
  assess_type: string;
  is_active: boolean;
  status: string | null;
  rating: string | null;
  leader_comment: string | null;
  /** 同周期内是否存在同名员工（后端派生） */
  is_duplicate_name?: boolean;
}

export interface EmployeeCreate {
  name: string;
  department: string;
  group_name?: string | null;
  position?: string | null;
  grade?: string | null;
  phone: string;
  role: string;
  assess_type: string;
}

export type EmployeeUpdate = Partial<EmployeeCreate> & {
  is_active?: boolean;
  rating?: string | null;
  leader_comment?: string | null;
};

export interface EmployeeListQuery {
  page?: number;
  page_size?: number;
  search?: string;
  department?: string;
  group_name?: string;
  role?: string;
  assess_type?: string;
}

export interface ImportResult {
  success_count: number;
  errors: string[];
  [key: string]: unknown;
}

// ==================== 项目 ====================
export interface Project {
  id: number;
  cycle_id: number;
  project_code: string;
  project_name: string;
  project_status: string | null;
  project_type: string;
  impl_method: string | null;
  department: string | null;
  customer_name: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_amount: number | string;
  project_profit: number | string;
  self_dev_income: number | string;
  product_contract_amount: number | string;
  presale_progress: number | string;
  delivery_progress: number | string;
  used_presale_progress: number | string;
  used_delivery_progress: number | string;
  pm_id: number | null;
  pm_name: string | null;
  economic_scale_coeff: number | string;
  project_type_coeff: number | string;
  workload_coeff: number | string;
  signing_probability: number | string;
  /** 项目经理姓名存在但未能唯一匹配到员工（缺失或同名冲突） */
  pm_missing?: boolean;
}

export interface ProjectCreate {
  project_code: string;
  project_name: string;
  project_type: string;
  impl_method?: string | null;
  department?: string | null;
  customer_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  contract_amount?: number | string;
  project_profit?: number | string;
  self_dev_income?: number | string;
  product_contract_amount?: number | string;
  presale_progress?: number | string;
  delivery_progress?: number | string;
  pm_name?: string | null;
  project_status?: string | null;
}

export type ProjectUpdate = Partial<ProjectCreate> & {
  workload_coeff?: number | string;
};

export interface ProjectListQuery {
  page?: number;
  page_size?: number;
  search?: string;
  project_type?: string;
  department?: string;
  project_status?: string;
}

// ==================== 考核参数 ====================
export interface DeptTarget {
  id: number;
  cycle_id: number;
  department: string;
  group_name: string | null;
  profit_target: number | string;
  income_target: number | string;
}

export interface DeptTargetItem {
  department: string;
  group_name?: string | null;
  profit_target: number | string;
  income_target: number | string;
}

export interface SpecialTarget {
  id: number;
  cycle_id: number;
  target_name: string;
  target_value: number | string;
}

export interface SpecialTargetSave {
  product_contract_target: number | string;
  tech_innovation_target: number | string;
}

export interface ProjectTypeCoeff {
  id: number;
  cycle_id: number;
  project_type: string;
  coefficient: number | string;
}

export interface ProjectTypeCoeffItem {
  project_type: string;
  coefficient: number | string;
}

export interface IndicatorCoeff {
  id: number;
  cycle_id: number;
  grade: string;
  coefficient: number | string;
}

export interface IndicatorCoeffItem {
  grade: string;
  coefficient: number | string;
}

export interface SigningProbabilityItem {
  project_id: number;
  signing_probability: number | string;
}

// ==================== 项目参与度 ====================
export interface Participation {
  id: number;
  cycle_id: number;
  project_id: number;
  employee_id: number;
  employee_name: string;
  department: string;
  participation_coeff: number | string;
  status: string | null;
}

export interface ParticipationItem {
  employee_id: number;
  employee_name: string;
  department: string;
  participation_coeff: number | string;
}

export interface ParticipationSave {
  project_id: number;
  items: ParticipationItem[];
}

export interface ParticipationSummary {
  project_id: number;
  project_name: string;
  project_code: string;
  department: string | null;
  pm_name: string | null;
  filled: boolean;
  [key: string]: unknown;
}

// ==================== 公共积分申报 ====================
export interface PublicScore {
  id: number;
  cycle_id: number;
  employee_id: number;
  employee_name: string;
  activity_name: string;
  activity_type: string;
  man_months: number | string;
  complexity: string;
  scale_value: number | string;
  complexity_value: number | string;
  workload_coeff: number | string;
  score: number | string;
  status: string | null;
  remark: string | null;
}

export interface PublicScoreCreate {
  activity_name: string;
  activity_type: string;
  man_months: number | string;
  complexity: string;
  remark?: string | null;
}

export interface PublicScoreUpdate {
  activity_name?: string;
  activity_type?: string;
  man_months?: number | string;
  complexity?: string;
  workload_coeff?: number | string;
  score?: number | string;
  remark?: string | null;
}

// ==================== 积分统计 ====================
export interface ScoreDetail {
  id: number;
  cycle_id: number;
  employee_id: number;
  employee_name: string;
  project_id: number | null;
  project_name: string | null;
  phase: string;
  base_score: number | string;
  progress_coeff: number | string;
  workload_coeff: number | string;
  participation_coeff: number | string;
  participant_name: string | null;
  participant_role: string | null;
  work_description: string | null;
  score: number | string;
  modified_by: string | null;
  remark: string | null;
}

export interface ScoreDetailUpdate {
  progress_coeff?: number | string;
  workload_coeff?: number | string;
  work_description?: string | null;
  remark?: string | null;
}

export interface ScoreSummary {
  id: number;
  cycle_id: number;
  employee_id: number;
  employee_name: string;
  department: string;
  assess_type: string;
  project_score_total: number | string;
  public_score_total: number | string;
  transform_score_total: number | string;
  total_score: number | string;
  normalized_score: number | string;
}

// ==================== 360 评价 ====================
export interface EvalRelation {
  id: number;
  cycle_id: number;
  evaluatee_id: number;
  evaluatee_name: string;
  evaluatee_assess_type: string;
  evaluator_id: number;
  evaluator_name: string;
  evaluator_type: string;
  evaluator_order: number;
  is_completed: boolean;
}

export interface EvalRelationUpdate {
  evaluator_id: number;
  evaluator_name: string;
}

export interface EvalDimension {
  dimension: string;
  max_score: number | string;
}

export interface EvalScoreItem {
  dimension: string;
  max_score: number | string;
  score: number | string;
}

export interface EvalScoreSubmit {
  relation_id: number;
  scores: EvalScoreItem[];
}

export interface EvalScore {
  id: number;
  cycle_id: number;
  relation_id: number;
  evaluatee_id: number;
  evaluator_id: number;
  dimension: string;
  max_score: number | string;
  score: number | string;
}

export interface EvalSummary {
  id: number;
  cycle_id: number;
  employee_id: number;
  employee_name: string;
  department: string;
  position: string | null;
  assess_type: string;
  colleague1_score: number | string;
  colleague2_score: number | string;
  colleague3_score: number | string;
  colleague4_score: number | string;
  superior_score: number | string;
  dept_leader_score: number | string;
  weighted_total: number | string;
  final_score: number | string;
}

export interface WorkGoalScoreCreate {
  employee_id: number;
  score: number | string;
  comment?: string | null;
}

export interface WorkGoalScore {
  id: number;
  cycle_id: number;
  employee_id: number;
  leader_id: number;
  score: number | string;
  comment: string | null;
}

export interface PublicEmployeeBrief {
  id: number;
  name: string;
  department: string;
  group_name: string | null;
  position: string | null;
}

export interface EvalProgress {
  total: number;
  completed: number;
  pending: number;
  progress: number;
}

// ==================== 经济指标 ====================
export interface EconomicDetail {
  employee_id: number;
  employee_name: string;
  department: string;
  group_name: string | null;
  grade: string | null;
  assess_type: string;
  project_name: string;
  indicator_type: string;
  raw_value: number;
  participation_coeff: number;
  completed_value: number;
  target_value: number;
  indicator_coeff: number;
  full_mark: number;
  score: number;
}

export interface EconomicSummary {
  employee_id: number;
  employee_name: string;
  department: string;
  group_name: string | null;
  grade: string | null;
  assess_type: string;
  total_score: number;
}

// ==================== 加减分 & 重点任务 ====================
export interface BonusRecord {
  id: number;
  cycle_id: number;
  employee_id: number;
  employee_name: string;
  department: string;
  assess_type: string;
  description: string;
  value: number | string;
}

export interface BonusRecordCreate {
  employee_id: number;
  description: string;
  value: number | string;
}

export interface KeyTaskScore {
  id: number;
  cycle_id: number;
  employee_id: number;
  employee_name: string;
  score: number | string;
}

export interface KeyTaskScoreUpdate {
  employee_id: number;
  score: number | string;
}

// ==================== 最终成绩 ====================
export interface FinalResult {
  id: number;
  cycle_id: number;
  employee_id: number;
  employee_name: string;
  department: string;
  group_name: string | null;
  position: string | null;
  grade: string | null;
  assess_type: string;
  work_score: number | string;
  work_score_max: number | string;
  economic_score: number | string;
  economic_score_max: number | string;
  key_task_score: number | string;
  work_goal_score: number | string;
  eval_score: number | string;
  bonus_score: number | string;
  total_score: number | string;
  ranking: number;
  rating: string | null;
  leader_comment: string | null;
  no_excellent_flag: boolean;
}
