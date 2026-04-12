/**
 * NeuPanel —— 内凹面板，用于表单区域 / 统计区块等容器。
 */
import type { CSSProperties, ReactNode } from 'react';

export interface NeuPanelProps {
  children?: ReactNode;
  title?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export default function NeuPanel({ children, title, style, className }: NeuPanelProps) {
  const base: CSSProperties = {
    background: 'var(--neu-bg-sunken)',
    borderRadius: 'var(--neu-radius-md)',
    boxShadow: 'var(--neu-shadow-in-2)',
    padding: 24,
    ...style,
  };

  return (
    <div className={className} style={base}>
      {title && (
        <div
          style={{
            color: 'var(--neu-text-secondary)',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 16,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
