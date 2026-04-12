/**
 * NeuCard —— Neumorphism 风格卡片。
 *
 * 外凸阴影 + 大圆角；可选 inset 模式（内凹容器）。
 * 消费 CSS 变量，不依赖 props 传色值 —— 切主题时自动跟随。
 */
import type { CSSProperties, ReactNode } from 'react';

export interface NeuCardProps {
  children?: ReactNode;
  /** 内凹（inset）还是外凸（raised，默认） */
  variant?: 'raised' | 'inset';
  /** 阴影强度 1/2/3，默认 2 */
  level?: 1 | 2 | 3;
  /** 自定义样式 */
  style?: CSSProperties;
  /** 自定义 className */
  className?: string;
  /** 是否可 hover 浮动 */
  hoverable?: boolean;
  onClick?: () => void;
}

export default function NeuCard({
  children,
  variant = 'raised',
  level = 2,
  style,
  className,
  hoverable,
  onClick,
}: NeuCardProps) {
  const shadowVar =
    variant === 'inset'
      ? level === 1
        ? 'var(--neu-shadow-in-1)'
        : 'var(--neu-shadow-in-2)'
      : level === 1
        ? 'var(--neu-shadow-out-1)'
        : level === 2
          ? 'var(--neu-shadow-out-2)'
          : 'var(--neu-shadow-out-3)';

  const base: CSSProperties = {
    background: variant === 'inset' ? 'var(--neu-bg-sunken)' : 'var(--neu-bg)',
    borderRadius: 'var(--neu-radius-md)',
    boxShadow: shadowVar,
    padding: 24,
    transition: 'box-shadow 0.25s ease, transform 0.25s ease',
    cursor: hoverable || onClick ? 'pointer' : undefined,
    ...style,
  };

  return (
    <div
      className={`neu-card ${hoverable ? 'neu-card--hoverable' : ''} ${className || ''}`}
      style={base}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
