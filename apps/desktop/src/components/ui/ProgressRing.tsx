import type { FC, ReactNode } from "react";

interface Props {
  /** 0–1 */
  value: number;
  size?: number;
  thickness?: number;
  trackColor?: string;
  color?: string;
  children?: ReactNode;
}

/**
 * Donut progress ring rendered as two concentric circles. Uses
 * `stroke-dasharray` to display the filled arc — works at any size and
 * inherits theme colours by default.
 */
export const ProgressRing: FC<Props> = ({
  value,
  size = 96,
  thickness = 10,
  trackColor = "var(--color-surfaceMuted)",
  color = "var(--color-primary)",
  children,
}) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const dash = c * clamped;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 320ms cubic-bezier(0.2,0,0,1)" }}
        />
      </svg>
      {children && <div className="ring-label">{children}</div>}
    </div>
  );
};

interface DonutProps {
  /** Each slice's value (any units) — angles computed proportionally. */
  segments: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  trackColor?: string;
  children?: ReactNode;
}

/** Multi-segment donut for breakdowns like flashcard deck distribution. */
export const Donut: FC<DonutProps> = ({
  segments,
  size = 100,
  thickness = 12,
  trackColor = "var(--color-surfaceMuted)",
  children,
}) => {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1;
  let offset = 0;
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={thickness}
        />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const dasharray = `${len} ${c - len}`;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            />
          );
        })}
      </svg>
      {children && <div className="donut-center">{children}</div>}
    </div>
  );
};
