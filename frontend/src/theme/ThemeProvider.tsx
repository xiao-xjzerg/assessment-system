/**
 * 主题 Provider —— 管理深/浅色模式 + CSS 变量注入 + AntD 主题配置。
 *
 * 三态切换：system（跟随系统）/ light / dark
 * 用户选择持久化到 localStorage（theme-mode 键）。
 */
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ConfigProvider, theme as antdTheme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import {
  lightTokens,
  darkTokens,
  tokensToCssVars,
  buildAntdTheme,
  type NeuTokens,
} from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedMode = 'light' | 'dark';

export interface ThemeContextValue {
  /** 用户选择的模式（含 system） */
  mode: ThemeMode;
  /** 实际生效的模式（只有 light / dark） */
  resolvedMode: ResolvedMode;
  /** 切换模式 */
  setMode: (m: ThemeMode) => void;
  /** 当前生效的 Neu token 对象 */
  tokens: NeuTokens;
}

const STORAGE_KEY = 'theme-mode';

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // SSR / 隐私模式
  }
  return 'system';
}

function getSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(mode: ThemeMode): ResolvedMode {
  if (mode === 'system') return getSystemPrefersDark() ? 'dark' : 'light';
  return mode;
}

export const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  resolvedMode: 'light',
  setMode: () => {},
  tokens: lightTokens,
});

/** 把 CSS 变量写到 document.body */
function applyCssVars(tokens: NeuTokens) {
  const vars = tokensToCssVars(tokens);
  const style = document.body.style;
  for (const [k, v] of Object.entries(vars)) {
    style.setProperty(k, v);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(readStoredMode);
  const [systemDark, setSystemDark] = useState(getSystemPrefersDark);

  // 监听系统主题变化
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  const resolvedMode: ResolvedMode = useMemo(() => {
    if (mode === 'system') return systemDark ? 'dark' : 'light';
    return mode;
  }, [mode, systemDark]);

  const tokens = resolvedMode === 'dark' ? darkTokens : lightTokens;

  // CSS 变量注入
  useEffect(() => {
    applyCssVars(tokens);
    // 同步设置 body 的 data-theme 属性，方便纯 CSS 选择器
    document.body.setAttribute('data-theme', resolvedMode);
  }, [tokens, resolvedMode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      // ignore
    }
  }, []);

  const antdThemeConfig = useMemo(() => buildAntdTheme(tokens, resolvedMode === 'dark'), [tokens, resolvedMode]);

  // 合并 darkAlgorithm
  const mergedTheme = useMemo(() => ({
    ...antdThemeConfig,
    algorithm: resolvedMode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
  }), [antdThemeConfig, resolvedMode]);

  const ctxValue = useMemo<ThemeContextValue>(
    () => ({ mode, resolvedMode, setMode, tokens }),
    [mode, resolvedMode, setMode, tokens],
  );

  return (
    <ThemeContext.Provider value={ctxValue}>
      <ConfigProvider locale={zhCN} theme={mergedTheme}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  );
}
