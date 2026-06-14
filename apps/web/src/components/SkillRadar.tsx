import { motion } from 'framer-motion';
import type { SkillScoreView } from '@mentra/shared';

type Props = { skills: SkillScoreView[]; size?: number };

/** Radar chart of per-skill scores (0..100). Shows up to 8 axes. */
export function SkillRadar({ skills, size = 280 }: Props) {
  const data = skills.slice(0, 8);
  const n = data.length;
  const c = size / 2;
  const r = c - 48;

  if (n < 3) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-ink-muted">
        Not enough skills assessed to draw a radar yet.
      </div>
    );
  }

  const angleFor = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const point = (i: number, radius: number) => {
    const a = angleFor(i);
    return [c + Math.cos(a) * radius, c + Math.sin(a) * radius] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1].map((f) =>
    data.map((_, i) => point(i, r * f).join(',')).join(' '),
  );

  const scorePoly = data
    .map((s, i) => point(i, r * (Math.max(0, Math.min(100, s.score)) / 100)).join(','))
    .join(' ');

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-sm">
      {rings.map((ring, idx) => (
        <polygon key={idx} points={ring} fill="none" stroke="#262626" strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, r);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="#1f1f1f" strokeWidth="1" />;
      })}
      <motion.polygon
        points={scorePoly}
        fill="rgba(34,211,238,0.18)"
        stroke="#22d3ee"
        strokeWidth="2"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
        style={{ transformOrigin: `${c}px ${c}px` }}
      />
      {data.map((s, i) => {
        const [x, y] = point(i, r + 18);
        return (
          <text
            key={s.skillId}
            x={x}
            y={y}
            fontSize="9"
            fill="#a3a3a3"
            textAnchor={Math.abs(x - c) < 6 ? 'middle' : x > c ? 'start' : 'end'}
            dominantBaseline="middle"
          >
            {s.label}
          </text>
        );
      })}
    </svg>
  );
}
