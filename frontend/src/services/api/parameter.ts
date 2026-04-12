/**
 * 考核参数接口（对接后端 /api/parameters/*）
 * 5 组参数：部门人均目标 / 专项目标 / 项目类型系数 / 员工指标系数 / 签约概率
 */
import { get, post } from '@/services/request';
import type {
  DeptTarget,
  DeptTargetItem,
  SpecialTarget,
  SpecialTargetSave,
  ProjectTypeCoeff,
  ProjectTypeCoeffItem,
  IndicatorCoeff,
  IndicatorCoeffItem,
  SigningProbabilityItem,
  Project,
} from '@/types';

export const parameterApi = {
  // ---- 部门人均目标 ----
  listDeptTargets: () => get<DeptTarget[]>('/parameters/dept-targets'),
  saveDeptTargets: (items: DeptTargetItem[]) =>
    post<DeptTarget[]>('/parameters/dept-targets', { items }),

  // ---- 专项目标 ----
  listSpecialTargets: () => get<SpecialTarget[]>('/parameters/special-targets'),
  saveSpecialTargets: (body: SpecialTargetSave) =>
    post<SpecialTarget[]>('/parameters/special-targets', body),

  // ---- 项目类型系数 ----
  listProjectTypeCoeffs: () =>
    get<ProjectTypeCoeff[]>('/parameters/project-type-coeffs'),
  saveProjectTypeCoeffs: (items: ProjectTypeCoeffItem[]) =>
    post<ProjectTypeCoeff[]>('/parameters/project-type-coeffs', { items }),
  resetProjectTypeCoeffs: () =>
    post<ProjectTypeCoeff[]>('/parameters/project-type-coeffs/reset'),

  // ---- 员工指标系数 ----
  listIndicatorCoeffs: () => get<IndicatorCoeff[]>('/parameters/indicator-coeffs'),
  saveIndicatorCoeffs: (items: IndicatorCoeffItem[]) =>
    post<IndicatorCoeff[]>('/parameters/indicator-coeffs', { items }),
  resetIndicatorCoeffs: () =>
    post<IndicatorCoeff[]>('/parameters/indicator-coeffs/reset'),

  // ---- 签约概率 ----
  listSigningProbabilities: () =>
    get<Project[]>('/parameters/signing-probabilities'),
  saveSigningProbabilities: (items: SigningProbabilityItem[]) =>
    post<null>('/parameters/signing-probabilities', { items }),
};
