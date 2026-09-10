'use client';

import { useMemo, useState } from 'react';
import type { Theme } from '@/lib/theme';
import type { TS } from '../types';
import { ChartCard } from '../ChartCard';

export function ActivityHeatmap({
  tsHourly,
  t,
  isDark,
}: {
  tsHourly: TS | null;
  t: Theme;
  isDark: boolean;
}) {
  const [hovCell, setHovCell] = useState<{
    d: number;
    h: number;
    v: number;
    date: string;
  } | null>(null);
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const HOURS = Array.from({ length: 24 }, (_, i) => i);
  const { grid, dateLabels, totalInWindow } = useMemo(() => {
    const data: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const dateMap: Record<number, string> = {};
    let total = 0;
    (tsHourly?.points ?? []).forEach((pt) => {
      const d = new Date(pt.t);
      const dow = d.getUTCDay();
      const hour = d.getUTCHours();
      data[dow][hour] += pt.v;
      total += pt.v;
      if (!dateMap[dow])
        dateMap[dow] = d.toLocaleDateString('en-GB', {
          weekday: 'short',
          month: '2-digit',
          day: '2-digit',
          timeZone: 'UTC',
        });
    });
    const max = Math.max(...data.flat(), 1);
    return { grid: { data, max }, dateLabels: dateMap, totalInWindow: total };
  }, [tsHourly]);
  const getColor = (v: number) => {
    const pct = v / grid.max;
    if (pct < 0.001) return t.heatEmpty;
    if (pct < 0.2) return t.heatL1;
    if (pct < 0.4) return t.heatL2;
    if (pct < 0.65) return t.heatL3;
    if (pct < 0.85) return t.heatL4;
    return t.heatL5;
  };
  const peakHour = useMemo(() => {
    let best = { h: 0, v: 0 };
    HOURS.forEach((h) => {
      const total = DAYS.map((_, d) => grid.data[d][h]).reduce(
        (a, b) => a + b,
        0,
      );
      if (total > best.v) best = { h, v: total };
    });
    return best.h;
  }, [grid]);
  const loading = !tsHourly;
  return (
    <ChartCard t={t} isDark={isDark}>
      <div className='flex items-start justify-between mb-4 gap-3'>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: t.labelColor,
              marginBottom: 4,
            }}
          >
            Activity Heatmap · all channels
          </p>
          <p style={{ fontSize: 30, fontWeight: 700, color: t.text }}>
            {totalInWindow.toLocaleString()}
          </p>
          <p style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>
            {loading
              ? 'Loading…'
              : `messages · all channels · peak at ${peakHour}:00`}
          </p>
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            background: isDark ? t.inputBg : 'rgba(248,250,252,0.95)',
            border: `1px solid ${isDark ? t.cardBorder : 'rgba(15,23,42,0.08)'}`,
            fontSize: 11,
            color: t.textSub,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          7d
        </span>
      </div>
      {loading ? (
        <div
          style={{
            height: 140,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.textMuted,
            fontSize: 13,
          }}
        >
          Loading…
        </div>
      ) : (
        <>
          <div className='flex mb-1' style={{ paddingLeft: 30 }}>
            {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
              <div
                key={h}
                style={{
                  flex: '0 0 auto',
                  width: `${(3 / 24) * 100}%`,
                  fontSize: 9,
                  color: h === peakHour ? t.chartLinePrimary : t.textMuted,
                  textAlign: 'center',
                  fontWeight: h === peakHour ? 700 : 400,
                }}
              >
                {h}h
              </div>
            ))}
          </div>
          <div className='space-y-[3px]'>
            {DAYS.map((day, d) => (
              <div key={day} className='flex items-center gap-1'>
                <span
                  style={{
                    width: 26,
                    fontSize: 9,
                    color: t.textMuted,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {day}
                </span>
                <div className='flex gap-0.5 flex-1'>
                  {HOURS.map((h) => {
                    const v = grid.data[d][h];
                    const isHov = hovCell?.d === d && hovCell?.h === h;
                    return (
                      <div
                        key={h}
                        className='flex-1 rounded-[2px] cursor-pointer'
                        style={{
                          height: 13,
                          background: isHov ? t.chartLinePrimary : getColor(v),
                          transform: isHov ? 'scale(1.7)' : 'scale(1)',
                          boxShadow: isHov
                            ? `0 0 10px ${t.chartLinePrimary}88`
                            : 'none',
                          transition:
                            'transform .12s,box-shadow .12s,background .12s',
                          zIndex: isHov ? 10 : 1,
                          position: 'relative',
                        }}
                        onMouseEnter={() =>
                          setHovCell({ d, h, v, date: dateLabels[d] ?? day })
                        }
                        onMouseLeave={() => setHovCell(null)}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className='flex items-center gap-2 mt-4 flex-wrap'>
            <span style={{ fontSize: 9, color: t.textMuted }}>Less</span>
            {[0.02, 0.2, 0.4, 0.65, 0.85, 1].map((pct) => (
              <div
                key={pct}
                className='h-3 w-4 rounded-sm'
                style={{ background: getColor(pct * grid.max) }}
              />
            ))}
            <span style={{ fontSize: 9, color: t.textMuted }}>More</span>
            {hovCell ? (
              <div className='ml-auto flex items-center gap-2'>
                <span
                  style={{
                    fontSize: 12,
                    color: t.chartLinePrimary,
                    fontWeight: 700,
                  }}
                >
                  {hovCell.v.toLocaleString()}
                </span>
                <span style={{ fontSize: 11, color: t.textSub }}>
                  msgs · {hovCell.date} {hovCell.h}:00
                </span>
              </div>
            ) : (
              <div className='ml-auto'>
                <span style={{ fontSize: 10, color: t.textMuted }}>
                  hover a cell for details
                </span>
              </div>
            )}
          </div>
        </>
      )}
    </ChartCard>
  );
}

