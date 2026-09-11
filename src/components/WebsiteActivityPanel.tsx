'use client';

/**
 * WebsiteActivityPanel — live visitor context for a website-channel conversation.
 *
 * Integration (in the conversation detail page):
 *   1. Import:
 *        import { WebsiteActivityPanel } from '@/components/WebsiteActivityPanel';
 *   2. Slot into the right column, gated by channel:
 *        {convo?.channel === 'website' && (
 *          <WebsiteActivityPanel
 *            conversationId={Number(id)}
 *            theme={th}
 *            isDark={isDark}
 *          />
 *        )}
 *
 * The component polls /admin/conversations/:id/activity every 3s while mounted
 * and gracefully renders skeletons / empty states.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

type JourneyEntry = {
  path: string;
  title?: string;
  entered_at?: number;
  duration_ms?: number;
  max_scroll_pct?: number;
};

type Snapshot = {
  status: 'active' | 'idle' | 'away';
  last_seen_ts: number;
  idle_seconds: number;
  session_started_ts: number;
  current_path?: string | null;
  current_title?: string | null;
  current_scroll_pct: number;
  current_page_start_ts: number;
  entry_page?: string | null;
  referrer?: string | null;
  returning_visitor: boolean;
  device?: {
    ua?: string;
    is_mobile?: boolean;
    screen_w?: number;
    screen_h?: number;
    lang?: string;
    tz?: string;
  } | null;
  location?: {
    country?: string;
    city?: string;
    region?: string;
    tz?: string;
  } | null;
  journey: JourneyEntry[];
  ai_summary?: string | null;
};

type ActivityResponse = {
  channel_supported: boolean;
  activity_enabled: boolean;
  snapshot: Snapshot | null;
  ai_summary: string | null;
};

type Theme = {
  text: string;
  textSub: string;
  textMuted: string;
  cardBg: string;
  cardBorder: string;
  divider: string;
};

const STATUS_META = {
  active: { color: '#22c55e', label: 'Active' },
  idle: { color: '#f59e0b', label: 'Idle' },
  away: { color: '#94a3b8', label: 'Away' },
};

function formatRelative(sec: number): string {
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return `${m}m ${remS}s`;
}

function shortBrowser(ua: string): string {
  if (!ua) return 'Unknown';
  const m = ua.match(/(Firefox|Chrome|Safari|Edg|Opera)\/(\d+)/);
  if (m) {
    const name = m[1] === 'Edg' ? 'Edge' : m[1];
    return `${name} ${m[2]}`;
  }
  return 'Browser';
}

function shortOS(ua: string): string {
  if (!ua) return '';
  if (/Windows NT 10/.test(ua)) return 'Windows 10';
  if (/Windows NT 11/.test(ua)) return 'Windows 11';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Mac OS X/.test(ua)) return 'macOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad/.test(ua)) return 'iOS';
  if (/Linux/.test(ua)) return 'Linux';
  return '';
}

function shortReferrer(ref?: string | null): string {
  if (!ref) return '(direct)';
  try {
    const u = new URL(ref);
    return u.host;
  } catch {
    return ref.slice(0, 40);
  }
}

// ── Component ─────────────────────────────────────────────────────────────
export function WebsiteActivityPanel({
  conversationId,
  theme,
  isDark,
}: {
  conversationId: number;
  theme: Theme;
  isDark: boolean;
}) {
  const [data, setData] = useState<ActivityResponse | null>(null);
  // Read value intentionally unused for now — setError still tracks
  // fetch failures so a future error UI can consume it without
  // re-wiring the fetch logic.
  const [, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      const resp = await apiFetch<ActivityResponse>(
        `/admin/conversations/${conversationId}/activity`,
        { auth: true },
      );
      if (mountedRef.current) {
        setData(resp);
        setError(null);
      }
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Failed to load activity');
      }
    }
  }, [conversationId]);

  useEffect(() => {
    mountedRef.current = true;
    // Fetch on mount and poll every 3s. `fetchData`'s setData/setError
    // are the correct place for a loading/data flag on an async fetch,
    // not a derive-state-from-render antipattern — same established
    // false-positive class as the other fetch-on-mount effects in this
    // codebase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    const iv = setInterval(() => {
      fetchData();
      // `now` is tracked as state (updated on the same cadence as the
      // data refresh) instead of calling Date.now() directly during
      // render, which is an impure call React's rules disallow there.
      setNow(Date.now());
    }, 3000);
    return () => {
      mountedRef.current = false;
      clearInterval(iv);
    };
  }, [fetchData]);

  // Hide entirely for non-website channels or when tracking is disabled
  if (!data) return null;
  if (!data.channel_supported) return null;

  const th = theme;
  const cardStyle: React.CSSProperties = {
    background: isDark ? 'rgba(255,255,255,.02)' : th.cardBg,
    border: `1px solid ${isDark ? 'rgba(255,255,255,.06)' : th.cardBorder}`,
    borderRadius: 10,
    padding: '11px 12px',
    marginBottom: 10,
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '.08em',
    color: th.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  };

  // No activity_enabled OR no snapshot yet → show a soft empty state
  if (!data.activity_enabled) {
    return (
      <div style={{ animation: 'fadeUp .4s ease .2s both' }}>
        <div style={labelStyle}>Website activity</div>
        <div style={{ ...cardStyle, fontSize: 11.5, color: th.textMuted, lineHeight: 1.5 }}>
          Activity tracking is disabled for this widget. Enable it in{' '}
          <span style={{ color: th.textSub, fontWeight: 600 }}>Widget → Settings</span>.
        </div>
      </div>
    );
  }
  if (!data.snapshot) {
    return (
      <div style={{ animation: 'fadeUp .4s ease .2s both' }}>
        <div style={labelStyle}>Website activity</div>
        <div style={{ ...cardStyle, fontSize: 11.5, color: th.textMuted, lineHeight: 1.5 }}>
          Waiting for visitor to open the chat. Activity is only captured after they engage.
        </div>
      </div>
    );
  }

  const snap = data.snapshot;
  const statusInfo = STATUS_META[snap.status] || STATUS_META.away;
  const currentPageMs = snap.current_page_start_ts
    ? now - snap.current_page_start_ts
    : 0;
  const sessionMs = snap.session_started_ts ? now - snap.session_started_ts : 0;
  const journey = snap.journey || [];

  return (
    <div style={{ animation: 'fadeUp .4s ease .2s both' }}>
      {/* Section label */}
      <div
        style={{
          ...labelStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            background: statusInfo.color,
            borderRadius: '50%',
            boxShadow: snap.status === 'active' ? `0 0 6px ${statusInfo.color}` : 'none',
            animation: snap.status === 'active' ? 'lw-pulse 2s ease infinite' : 'none',
          }}
        />
        Website activity · {statusInfo.label}
      </div>

      {/* AI summary banner */}
      {data.ai_summary && (
        <div
          style={{
            background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
            borderRadius: 10,
            padding: '12px 14px',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '.08em',
              color: 'rgba(255,255,255,.7)',
              textTransform: 'uppercase',
              marginBottom: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <span>✨</span> AI Context
          </div>
          <div style={{ fontSize: 12, color: '#fff', lineHeight: 1.5, fontWeight: 500 }}>
            {data.ai_summary}
          </div>
        </div>
      )}

      {/* Currently on */}
      {snap.current_path && (
        <div style={cardStyle}>
          <div style={labelStyle}>Currently on</div>
          <div
            style={{
              fontFamily: 'ui-monospace,monospace',
              fontSize: 12,
              color: th.text,
              fontWeight: 600,
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={snap.current_path}
          >
            {snap.current_path}
          </div>
          {snap.current_title && (
            <div
              style={{
                fontSize: 10.5,
                color: th.textMuted,
                marginBottom: 8,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={snap.current_title}
            >
              {snap.current_title}
            </div>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 10,
              color: th.textMuted,
              marginBottom: 4,
            }}
          >
            <span>⏱ {formatDuration(currentPageMs)}</span>
            <span>{snap.current_scroll_pct}% scrolled</span>
          </div>
          <div
            style={{
              width: '100%',
              height: 3,
              background: isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${snap.current_scroll_pct}%`,
                height: '100%',
                background: statusInfo.color,
                borderRadius: 2,
                transition: 'width .3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Journey timeline */}
      {journey.length > 0 && (
        <div style={cardStyle}>
          <div style={labelStyle}>Journey · {journey.length} page{journey.length === 1 ? '' : 's'}</div>
          <div style={{ position: 'relative', paddingLeft: 14 }}>
            <div
              style={{
                position: 'absolute',
                left: 3,
                top: 6,
                bottom: 6,
                width: 1,
                background: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)',
              }}
            />
            {journey.map((j, i) => {
              const isCurrent = i === journey.length - 1;
              const dotBg = isCurrent
                ? statusInfo.color
                : isDark
                ? 'rgba(255,255,255,.2)'
                : 'rgba(0,0,0,.2)';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: i === journey.length - 1 ? 0 : 8,
                    position: 'relative',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      left: -14,
                      width: isCurrent ? 9 : 7,
                      height: isCurrent ? 9 : 7,
                      borderRadius: '50%',
                      background: dotBg,
                      border: `2px solid ${isDark ? '#0a0e1c' : '#fff'}`,
                      boxShadow: isCurrent ? `0 0 6px ${statusInfo.color}` : 'none',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: 'ui-monospace,monospace',
                      fontSize: 10.5,
                      color: th.text,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                    title={j.path}
                  >
                    {j.path}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      color: isCurrent ? statusInfo.color : th.textMuted,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {isCurrent ? 'now' : formatDuration(j.duration_ms || 0)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Device */}
      {snap.device && (
        <div style={cardStyle}>
          <div style={labelStyle}>Device</div>
          <div style={{ fontSize: 11, color: th.text, marginBottom: 2 }}>
            {shortBrowser(snap.device.ua || '')}
            {shortOS(snap.device.ua || '') && ` · ${shortOS(snap.device.ua || '')}`}
            {snap.device.is_mobile && ' · Mobile'}
          </div>
          {snap.location && (snap.location.city || snap.location.country) && (
            <div style={{ fontSize: 10.5, color: th.textMuted }}>
              {[snap.location.city, snap.location.country].filter(Boolean).join(', ')}
              {snap.location.tz && ` · ${snap.location.tz}`}
            </div>
          )}
        </div>
      )}

      {/* Session */}
      <div style={{ ...cardStyle, marginBottom: 0 }}>
        <div style={labelStyle}>Session</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            marginBottom: 4,
          }}
        >
          <span style={{ color: th.textMuted }}>Started</span>
          <span style={{ color: th.text }}>
            {sessionMs > 0 ? formatRelative(Math.floor(sessionMs / 1000)) : '—'}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            marginBottom: 4,
          }}
        >
          <span style={{ color: th.textMuted }}>Visitor type</span>
          <span style={{ color: th.text }}>
            {snap.returning_visitor ? 'Returning' : 'New'}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
          }}
        >
          <span style={{ color: th.textMuted }}>From</span>
          <span
            style={{
              color: th.text,
              fontFamily: 'ui-monospace,monospace',
              maxWidth: 130,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={snap.referrer || ''}
          >
            {shortReferrer(snap.referrer)}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes lw-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .6; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}