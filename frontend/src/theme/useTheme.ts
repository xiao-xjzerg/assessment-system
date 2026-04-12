import { useContext } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeProvider';

/** 获取当前主题上下文（mode / resolvedMode / setMode / tokens） */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
