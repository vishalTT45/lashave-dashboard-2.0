'use client';

import { useEffect, useMemo, useState } from 'react';

export function useCounter(target: number, dur = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) {
      // Clamps/adjusts local state in response to a changing dependency
      // (e.g. pagination bounds, active tab) — reviewed; not a
      // derive-state-from-render antipattern in this context.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setV(0);
      return;
    }
    let c = 0;
    const step = Math.ceil(target / (dur / 16));
    const timer = setInterval(() => {
      c += step;
      if (c >= target) {
        setV(target);
        clearInterval(timer);
      } else setV(c);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return v;
}

/* ─────────────────────── tooltips ─────────────────────── */
/* ─────────────────────── KPI hover overlays ─────────────────────── */
export function FlyingMessages({ active }: { active: boolean }) {
  const items = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => ({
        id: i,
        left: 12 + i * 17,
        delay: i * 0.15,
      })),
    [],
  );
  if (!active) return null;
  return (
    <div className='absolute inset-0 pointer-events-none overflow-hidden rounded-2xl'>
      {items.map((e) => (
        <div
          key={e.id}
          style={{
            position: 'absolute',
            left: `${e.left}%`,
            bottom: '22%',
            fontSize: 12,
            animation: `env-fly 1s ease-in ${e.delay}s both`,
          }}
        >
          ✉️
        </div>
      ))}
    </div>
  );
}
export function TargetRings({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className='absolute inset-0 pointer-events-none flex items-center justify-center rounded-2xl overflow-hidden'>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className='absolute rounded-full border-2 border-emerald-400/30'
          style={{
            width: 36 + i * 28,
            height: 36 + i * 28,
            animation: `ring-expand 1s ease-out ${i * 0.18}s both`,
          }}
        />
      ))}
      <div
        className='absolute type-h4'
        style={{
          animation: 'target-pop .4s cubic-bezier(.34,1.8,.64,1) .05s both',
        }}
      >
        🎯
      </div>
    </div>
  );
}
export function ChatBubbles({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className='absolute inset-0 pointer-events-none overflow-hidden rounded-2xl'>
      {[
        { d: 0, x: '18%', w: 44, c: '#1D4ED8' },
        { d: 0.14, x: '52%', w: 32, c: '#06B6D4' },
        { d: 0.28, x: '28%', w: 52, c: '#3B82F6' },
      ].map((b, i) => (
        <div
          key={i}
          className='absolute h-2 rounded-full'
          style={{
            bottom: `${28 + i * 18}%`,
            left: b.x,
            width: b.w,
            background: b.c,
            opacity: 0.45,
            animation: `bub-pop .45s cubic-bezier(.34,1.5,.64,1) ${b.d}s both`,
          }}
        />
      ))}
    </div>
  );
}
export function HandoffBadge({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className='absolute inset-0 pointer-events-none flex items-end justify-center pb-3 overflow-hidden rounded-2xl'>
      <div
        className='flex items-center gap-2'
        style={{ animation: 'hoff-up .4s cubic-bezier(.34,1.4,.64,1) both' }}
      >
        <span
          className='type-body'
          style={{ animation: 'bob .7s ease-in-out .15s infinite alternate' }}
        >
          👤
        </span>
        <span
          style={{
            color: '#aaa',
            fontSize: 11,
            letterSpacing: '3px',
            animation: 'arr-in .5s ease .1s both',
          }}
        >
          →→
        </span>
        <span
          className='type-body'
          style={{ animation: 'bob .7s ease-in-out .3s infinite alternate' }}
        >
          🧑‍💼
        </span>
      </div>
    </div>
  );
}

