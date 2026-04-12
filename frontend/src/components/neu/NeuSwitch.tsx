/**
 * NeuSwitch —— Neumorphism 风格开关。
 *
 * 关闭态：轨道内凹（shadowIn1），旋钮外凸左侧
 * 打开态：轨道填充 accent，旋钮滑到右侧
 */
import type { CSSProperties } from 'react';

export interface NeuSwitchProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export default function NeuSwitch({ checked, onChange, disabled, style }: NeuSwitchProps) {
  const trackW = 52;
  const trackH = 28;
  const knobSize = 22;
  const gap = 3;

  const track: CSSProperties = {
    position: 'relative',
    width: trackW,
    height: trackH,
    borderRadius: trackH / 2,
    background: checked ? 'var(--neu-accent)' : 'var(--neu-bg-sunken)',
    boxShadow: checked ? 'none' : 'var(--neu-shadow-in-1)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background 0.25s ease, box-shadow 0.25s ease',
    ...style,
  };

  const knob: CSSProperties = {
    position: 'absolute',
    top: gap,
    left: checked ? trackW - knobSize - gap : gap,
    width: knobSize,
    height: knobSize,
    borderRadius: '50%',
    background: 'var(--neu-bg-elevated)',
    boxShadow: 'var(--neu-shadow-out-1)',
    transition: 'left 0.25s ease',
  };

  return (
    <div
      style={track}
      role="switch"
      aria-checked={!!checked}
      onClick={() => !disabled && onChange?.(!checked)}
    >
      <div style={knob} />
    </div>
  );
}
