/**
 * NeuButton —— Neumorphism 风格按钮。
 *
 * 默认态外凸，按下态内凹，hover 时阴影增强。
 * primary 变体：填充 accent 色 + 白色文字。
 */
import { useState, type CSSProperties, type ReactNode } from 'react';

export interface NeuButtonProps {
  children?: ReactNode;
  variant?: 'default' | 'primary';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  block?: boolean;
  style?: CSSProperties;
  className?: string;
  onClick?: () => void;
}

const SIZE_MAP = {
  small: { height: 32, padding: '0 14px', fontSize: 13 },
  medium: { height: 40, padding: '0 20px', fontSize: 14 },
  large: { height: 48, padding: '0 28px', fontSize: 16 },
};

export default function NeuButton({
  children,
  variant = 'default',
  size = 'medium',
  disabled,
  block,
  style,
  className,
  onClick,
}: NeuButtonProps) {
  const [pressed, setPressed] = useState(false);
  const s = SIZE_MAP[size];

  const isPrimary = variant === 'primary';

  const base: CSSProperties = {
    display: block ? 'flex' : 'inline-flex',
    width: block ? '100%' : undefined,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: s.height,
    padding: s.padding,
    fontSize: s.fontSize,
    fontWeight: 500,
    border: 'none',
    borderRadius: 'var(--neu-radius-sm)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'box-shadow 0.2s ease, transform 0.15s ease, background 0.2s ease',
    background: isPrimary ? 'var(--neu-accent)' : 'var(--neu-bg)',
    color: isPrimary ? '#ffffff' : 'var(--neu-text-primary)',
    boxShadow: pressed ? 'var(--neu-shadow-pressed)' : 'var(--neu-shadow-out-1)',
    transform: pressed ? 'scale(0.97)' : 'none',
    ...style,
  };

  return (
    <button
      className={className}
      style={base}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
    >
      {children}
    </button>
  );
}
