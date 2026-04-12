/**
 * 主题 Token —— Neumorphism 软萌风（浅/深两套）
 *
 * 设计要点：
 *   - 浅色：底色偏冷灰（#e0e5ec），阴影用冷灰 #b8c0cc + 纯白 #ffffff 形成软凸/软凹
 *   - 深色：底色 #2a2d35，阴影用更深 #1a1c22 + 略亮 #3a3e48（**不能简单反色**，
 *     暗色 Neumorphism 需要"暗部更暗、亮部只略亮"才有立体感，否则整体糊成一团）
 *   - 所有数值以 CSS 变量形式注入到 <body>，业务组件通过 var(--neu-xxx) 消费，
 *     切主题时只需替换变量即可，无需 re-render 组件树
 */
import type { ThemeConfig } from 'antd';

/** 两套主题共享的语义键 */
export interface NeuTokens {
  /** 页面 / 容器背景 */
  bg: string;
  /** 比 bg 略深的沉入色（用于 inset 容器内部） */
  bgSunken: string;
  /** 比 bg 略亮的浮起色（某些 hover 态） */
  bgElevated: string;
  /** 主文字 */
  textPrimary: string;
  /** 次要文字 */
  textSecondary: string;
  /** 禁用 / 极弱文字 */
  textTertiary: string;
  /** 分割线 */
  border: string;
  /** 强调色（主按钮、链接、选中） */
  accent: string;
  /** 强调色 hover */
  accentHover: string;

  // —— Neumorphism 阴影（软凸） —— //
  /** 外凸阴影强度 1（小控件，如 28-40px） */
  shadowOut1: string;
  /** 外凸阴影强度 2（中等，如 48-80px 按钮） */
  shadowOut2: string;
  /** 外凸阴影强度 3（卡片、面板） */
  shadowOut3: string;

  // —— Neumorphism 阴影（软凹 / 内陷） —— //
  /** 内凹阴影强度 1（键槽、slider track） */
  shadowIn1: string;
  /** 内凹阴影强度 2（大型凹槽容器） */
  shadowIn2: string;

  /** 按下/聚焦态的内凹阴影 */
  shadowPressed: string;
}

/** 浅色：冷灰底 */
export const lightTokens: NeuTokens = {
  bg: '#e4e9f0',
  bgSunken: '#d5dae3',
  bgElevated: '#edf1f7',
  textPrimary: '#2f3a4f',
  textSecondary: '#6b7a90',
  textTertiary: '#a0aec0',
  border: '#cfd6e0',
  accent: '#5b8def',
  accentHover: '#4178e6',

  shadowOut1: '3px 3px 6px #b8c0cc, -3px -3px 6px #ffffff',
  shadowOut2: '6px 6px 14px #b8c0cc, -6px -6px 14px #ffffff',
  shadowOut3: '10px 10px 24px #b8c0cc, -10px -10px 24px #ffffff',

  shadowIn1: 'inset 3px 3px 6px #b8c0cc, inset -3px -3px 6px #ffffff',
  shadowIn2: 'inset 6px 6px 14px #b8c0cc, inset -6px -6px 14px #ffffff',

  shadowPressed: 'inset 4px 4px 10px #b8c0cc, inset -4px -4px 10px #ffffff',
};

/** 深色：深蓝灰底 —— 暗部 #1a1c22 极深，亮部 #3a3e48 只略亮 */
export const darkTokens: NeuTokens = {
  bg: '#2a2d35',
  bgSunken: '#23262d',
  bgElevated: '#32363f',
  textPrimary: '#e6e9f0',
  textSecondary: '#a3a9b8',
  textTertiary: '#6b7286',
  border: '#3a3e48',
  accent: '#7ea9ff',
  accentHover: '#96bbff',

  shadowOut1: '3px 3px 6px #1a1c22, -3px -3px 6px #3a3e48',
  shadowOut2: '6px 6px 14px #1a1c22, -6px -6px 14px #3a3e48',
  shadowOut3: '10px 10px 24px #1a1c22, -10px -10px 24px #3a3e48',

  shadowIn1: 'inset 3px 3px 6px #1a1c22, inset -3px -3px 6px #3a3e48',
  shadowIn2: 'inset 6px 6px 14px #1a1c22, inset -6px -6px 14px #3a3e48',

  shadowPressed: 'inset 4px 4px 10px #1a1c22, inset -4px -4px 10px #3a3e48',
};

/** 统一圆角 token（不随深浅色变化） */
export const radius = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 28,
} as const;

/** 把 NeuTokens 转成 CSS 变量声明（注入到 :root / body） */
export function tokensToCssVars(t: NeuTokens): Record<string, string> {
  return {
    '--neu-bg': t.bg,
    '--neu-bg-sunken': t.bgSunken,
    '--neu-bg-elevated': t.bgElevated,
    '--neu-text-primary': t.textPrimary,
    '--neu-text-secondary': t.textSecondary,
    '--neu-text-tertiary': t.textTertiary,
    '--neu-border': t.border,
    '--neu-accent': t.accent,
    '--neu-accent-hover': t.accentHover,
    '--neu-shadow-out-1': t.shadowOut1,
    '--neu-shadow-out-2': t.shadowOut2,
    '--neu-shadow-out-3': t.shadowOut3,
    '--neu-shadow-in-1': t.shadowIn1,
    '--neu-shadow-in-2': t.shadowIn2,
    '--neu-shadow-pressed': t.shadowPressed,
    '--neu-radius-sm': `${radius.sm}px`,
    '--neu-radius-md': `${radius.md}px`,
    '--neu-radius-lg': `${radius.lg}px`,
    '--neu-radius-xl': `${radius.xl}px`,
  };
}

/**
 * 把 Neu tokens 映射到 AntD 5 ConfigProvider theme
 *
 * 策略：只改动颜色 / 圆角 / 关键阴影等"外观 token"，
 * 不动组件密度、字号等结构性 token —— 因为业务页 Table/Form 要保持清晰。
 */
export function buildAntdTheme(t: NeuTokens, isDark: boolean): ThemeConfig {
  return {
    token: {
      colorPrimary: t.accent,
      colorBgBase: t.bg,
      colorBgLayout: t.bg,
      colorBgContainer: isDark ? t.bgElevated : '#f2f5fb',
      colorBgElevated: isDark ? t.bgElevated : '#f2f5fb',
      colorText: t.textPrimary,
      colorTextSecondary: t.textSecondary,
      colorTextTertiary: t.textTertiary,
      colorBorder: t.border,
      colorBorderSecondary: t.border,
      borderRadius: radius.sm,
      borderRadiusLG: radius.md,
      borderRadiusSM: 8,
      boxShadow: t.shadowOut2,
      boxShadowSecondary: t.shadowOut1,
    },
    components: {
      // 按钮：保留 AntD 结构，但用 Neu 风格的软阴影代替默认描边
      Button: {
        borderRadius: radius.sm,
        controlHeight: 36,
        primaryShadow: 'none',
        defaultShadow: 'none',
      },
      // 卡片：大圆角 + Neu 阴影
      Card: {
        borderRadiusLG: radius.md,
        boxShadowTertiary: t.shadowOut2,
      },
      // Table：保持相对清爽，仅调圆角和 header 背景
      Table: {
        borderRadius: radius.sm,
        headerBg: isDark ? t.bgSunken : '#dde3ed',
        headerColor: t.textSecondary,
        rowHoverBg: isDark ? t.bgElevated : '#edf1f7',
      },
      // Layout：背景跟随主色
      Layout: {
        bodyBg: t.bg,
        headerBg: t.bg,
        siderBg: t.bg,
      },
      // Menu：软萌化但保留选中态可见性
      Menu: {
        itemBg: 'transparent',
        subMenuItemBg: 'transparent',
        itemSelectedBg: isDark ? t.bgSunken : '#d5dae3',
        itemSelectedColor: t.accent,
        itemHoverBg: isDark ? t.bgElevated : '#edf1f7',
        itemBorderRadius: radius.sm,
      },
      // Input：轻度内凹
      Input: {
        borderRadius: radius.sm,
        activeShadow: 'none',
      },
      Select: {
        borderRadius: radius.sm,
      },
      Modal: {
        borderRadiusLG: radius.lg,
      },
    },
  };
}
