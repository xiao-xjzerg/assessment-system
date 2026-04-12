/**
 * NeuSlider —— Neumorphism 风格滑块。
 *
 * 轨道内凹，已填充区域用 accent 色，
 * 拇指外凸圆形，拖动通过 mousedown/mousemove 实现。
 */
import { useCallback, useRef, type CSSProperties } from 'react';

export interface NeuSliderProps {
  value?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  disabled?: boolean;
  style?: CSSProperties;
}

export default function NeuSlider({
  value = 0,
  min = 0,
  max = 100,
  onChange,
  disabled,
  style,
}: NeuSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));

  const calcValue = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const v = Math.round(min + ratio * (max - min));
      onChange?.(v);
    },
    [min, max, onChange],
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    calcValue(e.clientX);

    const onMove = (ev: MouseEvent) => calcValue(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const trackStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: 10,
    borderRadius: 5,
    background: 'var(--neu-bg-sunken)',
    boxShadow: 'var(--neu-shadow-in-1)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    ...style,
  };

  const fillStyle: CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: `${pct}%`,
    borderRadius: 5,
    background: 'var(--neu-accent)',
    transition: 'width 0.1s ease',
  };

  const thumbStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: `${pct}%`,
    transform: 'translate(-50%, -50%)',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'var(--neu-bg-elevated)',
    boxShadow: 'var(--neu-shadow-out-1)',
    transition: 'left 0.1s ease',
  };

  return (
    <div ref={trackRef} style={trackStyle} onMouseDown={handleMouseDown}>
      <div style={fillStyle} />
      <div style={thumbStyle} />
    </div>
  );
}
