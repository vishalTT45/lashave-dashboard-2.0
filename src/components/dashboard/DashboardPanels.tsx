'use client';

import type { Theme } from '@/lib/theme';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AttentionCfg = {
  dot: string;
  badge: string;
  label: string;
};




export const ATTENTION_CFG: Record<string, AttentionCfg> = {
  handoff_needed: {
    dot: 'bg-[#8B5CF6]',
    badge:
      'bg-[#8B5CF6]/10 text-[#7C3AED] dark:bg-[#8B5CF6]/20 dark:text-[#A78BFA]',
    label: 'handoff',
  },
  angry_customer: {
    dot: 'bg-error-500',
    badge:
      'bg-error-50 text-error-600 dark:bg-error-500/12 dark:text-error-400',
    label: 'angry',
  },
  hot_lead: {
    dot: 'bg-[#F97316]',
    badge:
      'bg-[#F97316]/10 text-[#EA580C] dark:bg-[#F97316]/20 dark:text-[#FB923C]',
    label: 'hot lead',
  },
  no_team_reply: {
    dot: 'bg-warning-500',
    badge:
      'bg-warning-50 text-warning-600 dark:bg-warning-500/12 dark:text-warning-400',
    label: 'waiting',
  },
  faq_gap: {
    dot: 'bg-[#06B6D4]',
    badge:
      'bg-[#06B6D4]/10 text-[#0891B2] dark:bg-[#06B6D4]/20 dark:text-[#22D3EE]',
    label: 'FAQ gap',
  },
  error: {
    dot: 'bg-error-600',
    badge:
      'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400',
    label: 'error',
  },
  returning_lead: {
    dot: 'bg-success-500',
    badge:
      'bg-success-50 text-success-600 dark:bg-success-500/12 dark:text-success-400',
    label: 'returning lead',
  },
  payment_issue: {
    dot: 'bg-[#EC4899]',
    badge:
      'bg-[#EC4899]/10 text-[#DB2777] dark:bg-[#EC4899]/20 dark:text-[#F472B6]',
    label: 'payment',
  },
  dropoff: {
    dot: 'bg-error-500',
    badge:
      'bg-error-50 text-error-600 dark:bg-error-500/12 dark:text-error-400',
    label: 'drop-off',
  },
  returning: {
    dot: 'bg-[#06B6D4]',
    badge:
      'bg-[#06B6D4]/10 text-[#0891B2] dark:bg-[#06B6D4]/20 dark:text-[#22D3EE]',
    label: 'returning',
  },
  lead_won: {
    dot: 'bg-success-500',
    badge:
      'bg-success-50 text-success-600 dark:bg-success-500/12 dark:text-success-400',
    label: 'won',
  },
  lead_qualified: {
    dot: 'bg-[#A78BFA]',
    badge:
      'bg-[#A78BFA]/10 text-[#7C3AED] dark:bg-[#A78BFA]/20 dark:text-[#C4B5FD]',
    label: 'qualified',
  },
  ai_disabled: {
    dot: 'bg-warning-500',
    badge:
      'bg-warning-50 text-warning-600 dark:bg-warning-500/12 dark:text-warning-400',
    label: 'AI off',
  },
};



export type AttentionType =
  | 'handoff_needed'
  | 'angry_customer'
  | 'hot_lead'
  | 'no_team_reply'
  | 'faq_gap'
  | 'error'
  | 'returning_lead'
  | 'payment_issue'
  | 'dropoff'
  | 'returning'
  | 'lead_won'
  | 'lead_qualified'
  | 'ai_disabled'
  | string;

export type AttentionItem = {
  type: AttentionType;
  sender_name: string | null;
  tenant_id: string;
  message: string | null;
  silence_min: number | null;
  created_at: string;
  conversation_id?: number | null;
};

export type TopicItem = {
  topic: string;
  count: number;
};

export type FaqGap = {
  query: string;
  count: number;
  last_seen: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return '—';

  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '—';

  const s = Math.floor((Date.now() - time) / 1000);

  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function formatName(name: string | null, fallback = 'unknown'): string {
  if (!name) return fallback;
  return name.startsWith('@') ? name : `@${name}`;
}

function truncate(text: string, max = 52): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// ─────────────────────────────────────────────────────────────────────────────
// Attention item config
// ─────────────────────────────────────────────────────────────────────────────

type ItemCfg = {
  dot: string;
  border: string;
  badge: {
    bg: string;
    color: string;
    label: string;
  };
  pulse: boolean;
  buildText: (item: AttentionItem) => string;
};

const ITEM_CFG: Record<string, ItemCfg> = {
  handoff_needed: {
    dot: '#8B5CF6',
    border: '#8B5CF6',
    pulse: true,
    badge: {
      bg: 'rgba(139,92,246,0.10)',
      color: '#7C3AED',
      label: 'handoff',
    },
    buildText: (item) => {
      const name = formatName(item.sender_name, 'Customer');
      const msg = item.message ? ` — ${truncate(item.message)}` : '';
      return `${name} needs human attention${msg}`;
    },
  },

  angry_customer: {
    dot: '#EF4444',
    border: '#EF4444',
    pulse: true,
    badge: {
      bg: 'rgba(239,68,68,0.10)',
      color: '#DC2626',
      label: 'angry',
    },
    buildText: (item) => {
      const name = formatName(item.sender_name, 'Customer');
      const msg = item.message ? ` — "${truncate(item.message)}"` : '';
      return `${name} may be frustrated${msg}`;
    },
  },

  hot_lead: {
    dot: '#F97316',
    border: '#F97316',
    pulse: true,
    badge: {
      bg: 'rgba(249,115,22,0.10)',
      color: '#EA580C',
      label: 'hot lead',
    },
    buildText: (item) => {
      const name = formatName(item.sender_name, 'Customer');
      const msg = item.message ? ` — ${truncate(item.message)}` : '';
      return `${name} looks ready to convert${msg}`;
    },
  },

  no_team_reply: {
    dot: '#F59E0B',
    border: '#F59E0B',
    pulse: true,
    badge: {
      bg: 'rgba(245,158,11,0.10)',
      color: '#D97706',
      label: 'waiting',
    },
    buildText: (item) => {
      const name = formatName(item.sender_name, 'Customer');
      const mins = item.silence_min ? ` for ${item.silence_min} min` : '';
      return `${name} is waiting for a team reply${mins}`;
    },
  },

  faq_gap: {
    dot: '#06B6D4',
    border: '#06B6D4',
    pulse: false,
    badge: {
      bg: 'rgba(6,182,212,0.10)',
      color: '#0891B2',
      label: 'FAQ gap',
    },
    buildText: (item) => {
      const name = formatName(item.sender_name, 'Customer');
      const msg = item.message
        ? ` asked: "${truncate(item.message)}"`
        : 'asked something the AI could not answer';
      return `${name} ${msg}`;
    },
  },

  error: {
    dot: '#DC2626',
    border: '#DC2626',
    pulse: true,
    badge: {
      bg: 'rgba(220,38,38,0.10)',
      color: '#B91C1C',
      label: 'error',
    },
    buildText: (item) => {
      const msg = item.message ? ` — ${truncate(item.message)}` : '';
      return `System issue detected${msg}`;
    },
  },

  returning_lead: {
    dot: '#10B981',
    border: '#10B981',
    pulse: false,
    badge: {
      bg: 'rgba(16,185,129,0.10)',
      color: '#059669',
      label: 'returning lead',
    },
    buildText: (item) =>
      `${formatName(item.sender_name, 'Customer')} returned after showing interest`,
  },

  payment_issue: {
    dot: '#EC4899',
    border: '#EC4899',
    pulse: true,
    badge: {
      bg: 'rgba(236,72,153,0.10)',
      color: '#DB2777',
      label: 'payment',
    },
    buildText: (item) => {
      const name = formatName(item.sender_name, 'Customer');
      const msg = item.message ? ` — ${truncate(item.message)}` : '';
      return `${name} may have a payment or order issue${msg}`;
    },
  },

  // Backward-compatible old dashboard types
  dropoff: {
    dot: '#EF4444',
    border: '#EF4444',
    pulse: true,
    badge: {
      bg: 'rgba(239,68,68,0.10)',
      color: '#DC2626',
      label: 'drop-off',
    },
    buildText: (item) => {
      const name = formatName(item.sender_name);
      const mins = item.silence_min ? ` — silent ${item.silence_min} min` : '';
      const msg = item.message ? ` after: "${truncate(item.message, 40)}"` : '';
      return `${name}${mins}${msg}`;
    },
  },

  returning: {
    dot: '#06B6D4',
    border: '#06B6D4',
    pulse: false,
    badge: {
      bg: 'rgba(6,182,212,0.10)',
      color: '#0891B2',
      label: 'returning',
    },
    buildText: (item) =>
      `${formatName(item.sender_name)} came back after close`,
  },

  lead_won: {
    dot: '#10B981',
    border: '#10B981',
    pulse: false,
    badge: {
      bg: 'rgba(16,185,129,0.10)',
      color: '#059669',
      label: 'won',
    },
    buildText: (item) => `Lead won — ${formatName(item.sender_name)} confirmed`,
  },

  lead_qualified: {
    dot: '#A78BFA',
    border: '#A78BFA',
    pulse: false,
    badge: {
      bg: 'rgba(167,139,250,0.10)',
      color: '#7C3AED',
      label: 'qualified',
    },
    buildText: (item) => `${formatName(item.sender_name)} qualified as a lead`,
  },

  ai_disabled: {
    dot: '#F59E0B',
    border: '#F59E0B',
    pulse: false,
    badge: {
      bg: 'rgba(245,158,11,0.10)',
      color: '#D97706',
      label: 'AI off',
    },
    buildText: (item) =>
      `@${item.tenant_id} — AI disabled, conversations accumulating`,
  },
};

const FALLBACK_CFG: ItemCfg = {
  dot: '#64748B',
  border: '#64748B',
  pulse: false,
  badge: {
    bg: 'rgba(100,116,139,0.10)',
    color: '#475569',
    label: 'attention',
  },
  buildText: (item) => {
    const name = formatName(item.sender_name, 'Customer');
    const msg = item.message ? ` — ${truncate(item.message)}` : '';
    return `${name} needs attention${msg}`;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PANEL 1 — AttentionFeed
// ─────────────────────────────────────────────────────────────────────────────

export function AttentionFeed({
  items,
  loading,
  t,
  isDark,
}: {
  items: AttentionItem[];
  loading: boolean;
  t: Theme;
  isDark: boolean;
}) {
  const urgentTypes = new Set([
    'handoff_needed',
    'angry_customer',
    'hot_lead',
    'no_team_reply',
    'payment_issue',
    'dropoff',
  ]);

  const urgentCount = items.filter((i) => urgentTypes.has(i.type)).length;

  return (
    <div
      style={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 14,
        padding: '14px 16px',
        overflow: 'hidden',
        boxShadow: isDark ? 'none' : '0 8px 24px rgba(15,23,42,0.06)',
      }}
    >
      <style>{`
        @keyframes feedItemIn {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: none; }
        }

        @keyframes dotPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
          50%      { box-shadow: 0 0 0 5px rgba(239,68,68,0); }
        }

        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: t.labelColor,
          }}
        >
          Needs attention
        </div>

        {urgentCount > 0 && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 20,
              background: 'rgba(239,68,68,0.10)',
              color: '#DC2626',
              border: '1px solid rgba(239,68,68,0.20)',
              flexShrink: 0,
            }}
          >
            {urgentCount} urgent
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonFeed t={t} />
      ) : items.length === 0 ? (
        <EmptyState
          label='All clear — nothing needs attention right now'
          t={t}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {items.map((item, i) => {
            const cfg = ITEM_CFG[item.type] ?? FALLBACK_CFG;

            const href = item.conversation_id
              ? `/conversations/${item.conversation_id}`
              : '/conversations';

            return (
              <Link
                key={`${item.type}-${item.created_at}-${i}`}
                href={href}
                style={{
                  display: 'block',

                  color: 'inherit',
                  textDecoration: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginTop: 3,

                    padding: '8px 0',
                    borderBottom:
                      i < items.length - 1
                        ? `1px solid ${t.cardBorder}`
                        : 'none',
                    borderTop:
                      i < items.length - 1
                        ? `1px solid ${t.cardBorder}`
                        : 'none',
                    borderLeft: `2px solid ${cfg.border}`,
                    paddingLeft: 8,
                    animation: `feedItemIn .4s ease ${i * 55}ms both`,
                    cursor: 'pointer',
                    borderRadius: 8,
                    transition: 'background .18s ease, transform .18s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDark
                      ? 'rgba(255,255,255,0.035)'
                      : 'rgba(15,23,42,0.035)';
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: cfg.dot,
                      flexShrink: 0,
                      marginTop: 4,
                      animation: cfg.pulse
                        ? 'dotPulse 1.5s ease-in-out infinite'
                        : 'none',
                    }}
                  />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.text,
                        lineHeight: 1.45,
                      }}
                    >
                      {cfg.buildText(item)}{' '}
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 7px',
                          borderRadius: 20,
                          background: cfg.badge.bg,
                          color: cfg.badge.color,
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {cfg.badge.label}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: 10,
                        color: t.textMuted,
                        marginTop: 2,
                      }}
                    >
                      {timeAgo(item.created_at)} · @{item.tenant_id}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL 2 — TopicsPanel
// ─────────────────────────────────────────────────────────────────────────────

const TOPIC_COLORS: Record<string, string> = {
  pricing: '#1D4ED8',
  booking: '#06B6D4',
  appointment: '#06B6D4',
  support: '#F87171',
  product: '#A78BFA',
  availability: '#A78BFA',
  complaint: '#EF4444',
  refund: '#F97316',
  hours: '#F59E0B',
  general_interest: '#94A3B8',
  integration: '#818CF8',
  demo: '#22D3EE',
};

function topicColor(topic: string): string {
  const lower = topic.toLowerCase();

  for (const [key, color] of Object.entries(TOPIC_COLORS)) {
    if (lower.includes(key)) return color;
  }

  return '#94A3B8';
}

function TopicBar({
  topic,
  count,
  max,
  index,
  t,
  isDark,
}: {
  topic: string;
  count: number;
  max: number;
  index: number;
  t: Theme;
  isDark: boolean;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  const color = topicColor(topic);
  const [hov, setHov] = useState(false);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    const timer = setTimeout(
      () => {
        el.style.transition = 'width 0.9s cubic-bezier(0.34,1.2,0.64,1)';
        el.style.width = `${pct}%`;
      },
      400 + index * 80,
    );

    return () => clearTimeout(timer);
  }, [pct, index]);

  const label = topic
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        marginBottom: 8,
        animation: `feedItemIn .4s ease ${index * 70}ms both`,
        transition: 'opacity .15s',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
          gap: 8,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: t.text }}>
          {label}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color, marginLeft: 8 }}>
          {count}
        </span>
      </div>

      <div
        style={{
          height: 8,
          borderRadius: 4,
          background: isDark
            ? 'rgba(141,166,255,0.08)'
            : 'rgba(29,78,216,0.07)',
          overflow: 'hidden',
        }}
      >
        <div
          ref={barRef}
          style={{
            height: '100%',
            borderRadius: 4,
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
            width: '0%',
            boxShadow: hov ? `0 0 8px ${color}66` : 'none',
            transition: 'box-shadow .2s',
          }}
        />
      </div>
    </div>
  );
}

export function TopicsPanel({
  topics,
  loading,
  t,
  isDark,
}: {
  topics: TopicItem[];
  loading: boolean;
  t: Theme;
  isDark: boolean;
}) {
  const max = Math.max(...topics.map((x) => x.count), 1);
  const total = topics.reduce((sum, x) => sum + x.count, 0);
 

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        padding: '20px',

        background: isDark
          ? 'linear-gradient(135deg, rgba(18,22,44,.92), rgba(10,14,30,.94))'
          : '#ffffff',
        border: `1px solid ${
          isDark ? 'rgba(141,166,255,.18)' : 'rgba(15,23,42,0.08)'
        }`,
        boxShadow: isDark
          ? '0 18px 48px rgba(0,0,0,.35)'
          : '0 18px 45px rgba(15,23,42,0.08)',
      }}
    >
      <div
        aria-hidden='true'
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          // background: isDark
          //   ? 'radial-gradient(circle at 16% 12%, rgba(141,166,255,.18), transparent 32%), radial-gradient(circle at 88% 10%, rgba(6,182,212,.12), transparent 28%)'
          //   : 'radial-gradient(circle at 16% 12%, rgba(37,99,235,.10), transparent 32%), radial-gradient(circle at 88% 10%, rgba(6,182,212,.12), transparent 28%)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'flex-start',
            marginBottom: 18,
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 10px',
                borderRadius: 999,
                // background: isDark
                //   ? 'rgba(141,166,255,.12)'
                //   : 'rgba(37,99,235,.08)',
                // backgroundColor: '#ffff',
                border: `1px solid ${
                  isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(226, 232, 240, 0.8)'
                }`,
                color: isDark ? '#A8BFFF' : '#2563EB',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                marginBottom: 10,
              }}
            >
              <span>Customer Intent Radar</span>
            </div>

            <h3
              style={{
                margin: 0,
                color: t.text,
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '-.6px',
                lineHeight: 1.15,
              }}
            >
              What customers want right now
            </h3>

            <p
              style={{
                margin: '6px 0 0',
                color: t.textSub,
                fontSize: 13,
                lineHeight: 1.55,
                maxWidth: 620,
              }}
            >
              Real-time themes from customer chats — questions, objections,
              purchase signals, and service requests.
            </p>
          </div>

          <div
            style={{
              minWidth: 92,
              padding: '10px 12px',
              borderRadius: 14,
              background: isDark ? 'rgba(255,255,255,.045)' : '#FFFFFF',
              border: `1px solid ${
                isDark ? 'rgba(255,255,255,.08)' : 'rgba(15,23,42,.08)'
              }`,
              boxShadow: isDark ? 'none' : '0 8px 20px rgba(15,23,42,.06)',
              textAlign: 'right',
            }}
          >
            <div
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: t.text,
                lineHeight: 1,
              }}
            >
              {loading ? '—' : total}
            </div>
            <div
              style={{
                fontSize: 10,
                color: t.textMuted,
                marginTop: 4,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                fontWeight: 700,
              }}
            >
              Signals
            </div>
          </div>
        </div>

        {loading ? (
          <SkeletonFeed t={t} />
        ) : topics.length === 0 ? (
          <EmptyState label='No conversation topics detected yet' t={t} />
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 10,
            }}
          >
            {topics.slice(0, 8).map((topic, i) => {
              const pct = Math.round((topic.count / max) * 100);
              
              const accent =
                i % 4 === 0
                  ? '#2563EB'
                  : i % 4 === 1
                    ? '#06B6D4'
                    : i % 4 === 2
                      ? '#10B981'
                      : '#D97706';

              return (
                <div
                  key={`${topic.topic}-${i}`}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 16,
                    padding: '13px 14px',
                    background: isDark
                      ? 'rgba(255,255,255,.045)'
                      : 'rgba(255,255,255,.86)',
                    border: `1px solid ${
                      isDark ? 'rgba(255,255,255,.08)' : 'rgba(15,23,42,.08)'
                    }`,
                    boxShadow: isDark
                      ? 'none'
                      : '0 10px 24px rgba(15,23,42,.06)',
                    animation: `feedItemIn .45s ease ${i * 60}ms both`,
                  }}
                >
                  <div

                  // remove redial graident
                    style={{
                      position: 'absolute',
                      inset: 0,
                      pointerEvents: 'none',
                    }}
                  />

                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 8,
                        alignItems: 'flex-start',
                        marginBottom: 10,
                      }}
                    >
                      <div
                        style={{
                          color: t.text,
                          fontSize: 13,
                          fontWeight: 600,
                          lineHeight: 1.35,
                          textTransform: 'capitalize',
                        }}
                      >
                        {topic.topic}
                      </div>

                      <div
                        style={{
                          padding: '3px 8px',
                          borderRadius: 999,
                          background: `${accent}14`,
                          color: accent,
                          fontSize: 11,
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {topic.count}
                      </div>
                    </div>

                    <div
                      style={{
                        height: 7,
                        borderRadius: 999,
                        overflow: 'hidden',
                        background: isDark
                          ? 'rgba(255,255,255,.07)'
                          : 'rgba(15,23,42,.07)',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${accent}, ${accent}99)`,
                          transition: 'width .7s ease',
                        }}
                      />
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: 7,
                        fontSize: 10,
                        color: t.textMuted,
                      }}
                    >
                      <span>Demand weight</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PANEL 3 — FaqGapsPanel
// ─────────────────────────────────────────────────────────────────────────────

export function FaqGapsPanel({
  gaps,
  loading,
  t,
  isDark,
}: {
  gaps: FaqGap[];
  loading: boolean;
  t: Theme;
  isDark: boolean;
}) {
  return (
    <div
      style={{
        background: t.cardBg,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 14,
        padding: '14px 16px',
        height: '100%',
        boxShadow: isDark ? 'none' : '0 8px 24px rgba(15,23,42,0.06)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: t.labelColor,
          }}
        >
          FAQ content gaps
        </div>

        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 20,
            background: 'rgba(245,158,11,0.10)',
            color: '#D97706',
            border: '1px solid rgba(245,158,11,0.20)',
            flexShrink: 0,
          }}
        >
          top misses
        </span>
      </div>

      {loading ? (
        <SkeletonList t={t} />
      ) : gaps.length === 0 ? (
        <EmptyState label='Unmatched FAQ queries appear here' t={t} />
      ) : (
        <div>
          {gaps.slice(0, 5).map((gap, i) => (
            <div
              key={`${gap.query}-${i}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 0',
                borderBottom:
                  i < Math.min(gaps.length, 5) - 1
                    ? `1px solid ${t.cardBorder}`
                    : 'none',
                animation: `feedItemIn .4s ease ${i * 60}ms both`,
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: t.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '78%',
                }}
              >
                &quot;{gap.query}&quot;
              </span>

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: t.accent,
                  flexShrink: 0,
                  marginLeft: 8,
                }}
              >
                {gap.count}×
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton loaders
// ─────────────────────────────────────────────────────────────────────────────

function SkeletonLine({ w, t }: { w: string; t: Theme }) {
  return (
    <div
      style={{
        height: 10,
        borderRadius: 5,
        width: w,
        background: `linear-gradient(90deg, ${t.cardBorder} 25%, ${t.cardBg} 50%, ${t.cardBorder} 75%)`,
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

function SkeletonFeed({ t }: { t: Theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: t.cardBorder,
              flexShrink: 0,
              marginTop: 3,
            }}
          />
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <SkeletonLine w={`${60 + i * 10}%`} t={t} />
            <SkeletonLine w='40%' t={t} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonBars({ t, isDark }: { t: Theme; isDark: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[80, 65, 45, 35, 25].map((w, i) => (
        <div key={i}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 4,
            }}
          >
            <SkeletonLine w='40%' t={t} />
            <SkeletonLine w='15%' t={t} />
          </div>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: isDark
                ? 'rgba(141,166,255,0.08)'
                : 'rgba(29,78,216,0.07)',
            }}
          >
            <div
              style={{
                height: '100%',
                borderRadius: 4,
                width: `${w}%`,
                background: t.cardBorder,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonList({ t }: { t: Theme }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <SkeletonLine w={`${50 + i * 7}%`} t={t} />
          <SkeletonLine w='12%' t={t} />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label, t }: { label: string; t: Theme }) {
  return (
    <div style={{ padding: '20px 0', textAlign: 'center' }}>
      <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.3 }}>📭</div>
      <p style={{ fontSize: 12, color: t.textMuted }}>{label}</p>
    </div>
  );
}
