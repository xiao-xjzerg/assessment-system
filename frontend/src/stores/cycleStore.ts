/**
 * 当前活跃考核周期 Store。
 *
 * 用于在顶栏显示当前周期名称 + 阶段，以及在部分页面根据阶段做可操作性判断。
 * 数据来源：GET /api/cycles/active（登录后拉取一次，切换阶段后刷新）。
 */
import { create } from 'zustand';
import { cycleApi } from '@/services/api/cycle';
import { ASSESSMENT_PHASES, STORAGE_KEY } from '@/utils/constants';
import type { Cycle } from '@/types';

interface CycleState {
  activeCycle: Cycle | null;
  loading: boolean;
  /** 拉取活跃周期 */
  fetchActive: () => Promise<Cycle | null>;
  /** 手动设置（切换阶段/激活等操作后调用） */
  setActive: (cycle: Cycle | null) => void;
  /** 阶段名称（带兜底） */
  phaseName: () => string;
}

export const useCycleStore = create<CycleState>((set, get) => ({
  activeCycle: null,
  loading: false,

  fetchActive: async () => {
    set({ loading: true });
    try {
      const cycle = await cycleApi.getActive();
      set({ activeCycle: cycle });
      if (cycle) {
        localStorage.setItem(STORAGE_KEY.ACTIVE_CYCLE, JSON.stringify(cycle));
      } else {
        localStorage.removeItem(STORAGE_KEY.ACTIVE_CYCLE);
      }
      return cycle;
    } catch {
      return null;
    } finally {
      set({ loading: false });
    }
  },

  setActive: (cycle) => {
    set({ activeCycle: cycle });
    if (cycle) {
      localStorage.setItem(STORAGE_KEY.ACTIVE_CYCLE, JSON.stringify(cycle));
    } else {
      localStorage.removeItem(STORAGE_KEY.ACTIVE_CYCLE);
    }
  },

  phaseName: () => {
    const c = get().activeCycle;
    if (!c) return '';
    return c.phase_name || ASSESSMENT_PHASES[c.phase] || `阶段${c.phase}`;
  },
}));
