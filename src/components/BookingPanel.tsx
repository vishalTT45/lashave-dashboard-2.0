import { useMemo, useState, useEffect, ReactElement } from 'react';
import { apiFetch } from '@/lib/api';

/* ───────────────────────── types ───────────────────────── */

type Booking = {
  id: string;
  customer_name?: string;
  start_time: string;
  end_time: string;
  channel?: string;
  profile_pic_url?: string;
  status: 'confirmed' | 'rescheduled' | 'cancelled' | string;
};

type SettingBooking = {
  booking_enabled: boolean;
  booking_slot_duration_minutes: string;
  booking_buffer_minutes: string;
  booking_timezone: string;
};

type LogoPlatformCfg = {
  logoSrc: string | null;
  label: string;
  color: string;
  bg: string;
  border: string;
  filter: string;
};

const IST_OFFSET_MINUTES = 330;

function getTodayYmdIST() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Treat "2026-06-24T10:00:00+01:00" as 2026-06-24 10:00 IST.
// This intentionally ignores the +01:00 part.
function getISTWallTimeMs(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/,
  );

  if (!match) return NaN;

  const [, yyyy, mm, dd, hh, min, ss = '0'] = match;

  const utcMs = Date.UTC(
    Number(yyyy),
    Number(mm) - 1,
    Number(dd),
    Number(hh),
    Number(min),
    Number(ss),
  );

  return utcMs - IST_OFFSET_MINUTES * 60 * 1000;
}

const isTodayIST = (value: string) => {
  return value.slice(0, 10) === getTodayYmdIST();
};

const isFutureIST = (value: string, now: number) => {
  const targetMs = getISTWallTimeMs(value);
  return Number.isFinite(targetMs) && targetMs > now;
};

/* ───────────────────────── avatar fallback ───────────────────────── */

const AVATAR_GRADIENTS: string[] = [
  'linear-gradient(135deg,var(--color-brand-300),var(--color-theme-purple-500),var(--color-success-400))',
  'linear-gradient(135deg,var(--color-theme-pink-500),var(--color-orange-500))',
  'linear-gradient(135deg,var(--color-success-400),var(--color-brand-400))',
  'linear-gradient(135deg,var(--color-theme-purple-500),var(--color-theme-pink-500))',
  'linear-gradient(135deg,var(--color-warning-400),var(--color-error-400))',
  'linear-gradient(135deg,var(--color-brand-500),var(--color-theme-purple-500))',
];

function hashString(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

const getAvatarGradient = (name?: string) =>
  name
    ? AVATAR_GRADIENTS[hashString(name) % AVATAR_GRADIENTS.length]
    : AVATAR_GRADIENTS[0];

const getInitial = (name?: string) => {
  const trimmed = name?.trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
};

/* ───────────────────────── platform glyphs (avatar corner badge) ───────────────────────── */

function InstagramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="9" height="9" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="#fff" strokeWidth="2" />
      <circle cx="12" cy="12" r="3.6" stroke="#fff" strokeWidth="2" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="#fff" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="9" height="9" fill="none">
      <path
        d="M14.8 4H13c-2.2 0-3.8 1.6-3.8 3.8V10H7v3h2.2v7h3v-7h2.3l.5-3h-2.8V8.2c0-.7.4-1.1 1.1-1.1h1.5V4z"
        fill="#fff"
      />
    </svg>
  );
}

function WhatsappGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="9" height="9" fill="none">
      <path
        d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.5A9 9 0 1 0 12 3z"
        fill="#fff"
        opacity="0.18"
      />
      <path
        d="M8.8 7.6c.3-.6.5-.6.9-.6h.4c.3 0 .5.1.6.4l.7 1.6c.1.3.1.5-.1.7l-.5.6c-.2.2-.2.4-.1.6.5.9 1.4 1.8 2.3 2.3.2.1.4.1.6-.1l.6-.5c.2-.2.4-.2.7-.1l1.6.7c.3.1.4.3.4.6v.4c0 .4 0 .7-.6 1-1 .5-2.4.4-4-.6-1.3-.8-2.7-2.2-3.5-3.5-1-1.6-1.1-3.1-.6-4z"
        fill="#fff"
      />
    </svg>
  );
}

function TelegramGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="9" height="9" fill="none">
      <path
        d="M21 4 2.5 11.2c-.7.3-.7 1.3.1 1.5l4.4 1.4 1.7 5.3c.2.7 1.1.9 1.6.3l2.4-2.6 4.6 3.4c.6.4 1.4.1 1.6-.6l3-15c.1-.7-.6-1.3-1.3-.9z"
        fill="#fff"
      />
      <path d="M8.5 14.1 17 8.3l-7.1 7.3-.2 2.6z" fill="#27A7E5" opacity="0.35" />
    </svg>
  );
}

function YoutubeGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="9" height="9" fill="none">
      <path d="M10 9.3v5.4l5-2.7z" fill="#fff" />
    </svg>
  );
}

function ChatGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="9" height="9" fill="none">
      <path d="M4 5h16v10H8l-4 4V5z" fill="#fff" opacity="0.9" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
      <path
        d="M5 5l14 14M19 5 5 19"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

const PLATFORM_CFG: Record<
  string,
  { label: string; bg: string; Glyph: () => ReactElement }
> = {
  instagram: {
    label: 'Instagram',
    bg: 'linear-gradient(135deg,var(--color-orange-500),var(--color-theme-pink-500),var(--color-theme-purple-500),var(--color-brand-600))',
    Glyph: InstagramGlyph,
  },
  whatsapp: { label: 'WhatsApp', bg: 'var(--color-success-500)', Glyph: WhatsappGlyph },
  telegram: { label: 'Telegram', bg: 'var(--color-brand-500)', Glyph: TelegramGlyph },
  facebook: { label: 'Facebook', bg: 'var(--color-brand-600)', Glyph: FacebookGlyph },
  youtube: { label: 'YouTube', bg: 'var(--color-error-500)', Glyph: YoutubeGlyph },
};

const DEFAULT_PLATFORM_CFG = {
  label: 'Chat',
  bg: 'var(--color-gray-400)',
  Glyph: ChatGlyph,
};

const getPlatformCfg = (channel?: string) =>
  (channel && PLATFORM_CFG[channel.toLowerCase()]) || DEFAULT_PLATFORM_CFG;

/* ───────────────────────── logo-image platform config (username icon) ───────────────────────── */

const LOGO_PLATFORM_CFG: Record<
  string,
  { logoSrc: string; label: string; color: string; bg: string; border: string; filter: string }
> = {
  instagram: {
    logoSrc: '/brand-logo/instagram.png',
    label: 'Instagram',
    color: 'var(--color-theme-pink-500)',
    bg: 'color-mix(in oklab, var(--color-theme-pink-500) 14%, transparent)',
    border: 'color-mix(in oklab, var(--color-theme-pink-500) 38%, transparent)',
    filter: 'none',
  },
  youtube: {
    logoSrc: '/brand-logo/youtube.png',
    label: 'YouTube',
    color: 'var(--color-error-500)',
    bg: 'color-mix(in oklab, var(--color-error-500) 14%, transparent)',
    border: 'color-mix(in oklab, var(--color-error-500) 34%, transparent)',
    filter: 'none',
  },
  whatsapp: {
    logoSrc: '/brand-logo/whatsapp.png',
    label: 'WhatsApp',
    color: 'var(--color-success-500)',
    bg: 'color-mix(in oklab, var(--color-success-500) 14%, transparent)',
    border: 'color-mix(in oklab, var(--color-success-500) 34%, transparent)',
    filter: 'none',
  },
  telegram: {
    logoSrc: '/brand-logo/telegram.png',
    label: 'Telegram',
    color: 'var(--color-brand-500)',
    bg: 'color-mix(in oklab, var(--color-brand-500) 14%, transparent)',
    border: 'color-mix(in oklab, var(--color-brand-500) 34%, transparent)',
    filter: 'none',
  },
  facebook: {
    logoSrc: '/brand-logo/facebook.png',
    label: 'Facebook',
    color: 'var(--color-brand-600)',
    bg: 'color-mix(in oklab, var(--color-brand-600) 14%, transparent)',
    border: 'color-mix(in oklab, var(--color-brand-600) 34%, transparent)',
    filter: 'none',
  },
};

const DEFAULT_LOGO_CFG = {
  logoSrc: '/brand-logo/website.png' as string | null,
  label: 'Channel',
  color: 'var(--color-gray-400)',
  bg: 'color-mix(in oklab, var(--color-gray-400) 12%, transparent)',
  border: 'color-mix(in oklab, var(--color-gray-400) 24%, transparent)',
  filter: 'none',
};

function formatChannelLabel(channel?: string) {
  const trimmed = channel?.trim();
  if (!trimmed) return 'Channel';

  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function getLogoPlatformCfg(channel?: string): LogoPlatformCfg {
  return (
    (channel ? LOGO_PLATFORM_CFG[channel.toLowerCase()] : undefined) ?? {
      ...DEFAULT_LOGO_CFG,
      label: formatChannelLabel(channel),
    }
  );
}

function PlatformIcon({
  cfg,
  size = 15,
}: {
  cfg: ReturnType<typeof getLogoPlatformCfg>;
  size?: number;
}) {
  if (!cfg?.logoSrc) {
    return (
      <span
        className="inline-flex h-5.25 w-5.25 shrink-0 items-center justify-center rounded-md text-[15px]"
        style={{ background: cfg.bg }}
      >
        📡
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md"
      style={{
        width: size + 6,
        height: size + 6,
        background: cfg.bg,
      }}
    >
      <img
        src={cfg.logoSrc}
        alt={cfg.label}
        style={{
          width: size,
          height: size,
          filter: cfg.filter,
        }}
      />
    </span>
  );
}

/* ───────────────────────── countdown badge ───────────────────────── */

function formatCountdown(target: string, now: number) {
  const targetTime = getISTWallTimeMs(target);

  if (!Number.isFinite(targetTime)) {
    return null;
  }

  const diff = targetTime - now;

  if (diff <= 0) return null;

  const totalSeconds = Math.floor(diff / 1000);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');

  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

function CountdownBadge({ target, now }: { target: string; now: number }) {
  const value = formatCountdown(target, now);
  if (!value) return <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">-</span>;

  return (
    <span
      className="inline-flex h-8 shrink-0 items-center justify-center rounded-[9px] bg-brand-50 px-3 type-small font-semibold tabular-nums leading-none text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
      style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
    >
      {value}
    </span>
  );
}

/* ───────────────────────── close button ───────────────────────── */

function CloseButton({ onClose }: { onClose: () => void }) {
  const [hover, setHover] = useState(false);

  const base =
    'inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full border transition duration-150 ease-out focus:outline-none focus:ring-3 focus:ring-brand-500/20 focus:border-brand-300';
  const idle =
    'border-border bg-muted text-muted-foreground hover:scale-[1.06]';
  const hoverCls = hover
    ? 'border-error-500/30 bg-error-500/10 text-error-500 scale-[1.06]'
    : idle;

  return (
    <button
      type="button"
      onClick={onClose}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-label="Close bookings panel"
      className={`${base} ${hoverCls}`}
    >
      <CloseGlyph />
    </button>
  );
}

/* ───────────────────────── table sections ───────────────────────── */

const TABLE_HEAD_CELL =
  'px-5 py-3.5 text-left type-caption font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 sm:px-6 whitespace-nowrap';

/* ───────────────────────── component ───────────────────────── */

export default function BookingPanel() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);
  const [isEnabled, setIsEnabled] = useState<boolean>();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<{ items: Booking[] }>('/admin/bookings', {
          auth: true,
        });

        setBookings(res.items || []);
      } catch (err) {
        console.error('Booking fetch failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch<SettingBooking>('/admin/booking/settings', {
          auth: true,
        });
        setIsEnabled(res.booking_enabled);
      } catch (err) {
        console.error('Booking settings fetch failed:', err);
      }
    })();
  }, []);

  // Drives the live countdown and lets bookings drop out of "Today"
  // automatically once their start time has passed.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  /* ───── helpers ───── */

  const formatTime = (value: string) => {
    const timePart = value.slice(11, 16); // "11:50"
    const [h, m] = timePart.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatSlot = (start: string, end?: string) =>
    end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);

  const formatDateIST = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) {
      const d = new Date(value);
      return Number.isNaN(d.getTime())
        ? value.slice(0, 10)
        : d.toLocaleDateString();
    }
    const [, y, m, d, hh, mm] = match;
    const istUtcMs =
      Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)) -
      IST_OFFSET_MINUTES * 60 * 1000;
    return new Date(istUtcMs).toLocaleDateString();
  };

  const formatTimeIST = (value: string) => {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!match) {
      const d = new Date(value);
      return Number.isNaN(d.getTime())
        ? value.slice(11, 16)
        : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const [, y, m, d, hh, mm] = match;
    const istUtcMs =
      Date.UTC(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm)) -
      IST_OFFSET_MINUTES * 60 * 1000;
    return new Date(istUtcMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateTime = (value: string) =>
    `${formatDateIST(value)} • ${formatTimeIST(value)}`;

  type StatusPillCfg = { label: string; cls: string };
  const statusPill = (status: string): StatusPillCfg => {
    switch (status) {
      case 'confirmed':
        return { label: 'Confirmed', cls: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500' };
      case 'rescheduled':
        return { label: 'Rescheduled', cls: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400' };
      case 'cancelled':
        return { label: 'Cancelled', cls: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80' };
      default:
        return { label: status, cls: 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400' };
    }
  };

  /* ───── derived state ───── */

  const todayBookings = useMemo<Booking[]>(
    () =>
      bookings.filter(
        (b) =>
          b.status !== 'cancelled' &&
          isTodayIST(b.start_time) &&
          isFutureIST(b.start_time, now),
      ),
    [bookings, now],
  );

  const upcomingBookings = useMemo(
    () =>
      bookings
        .filter(
          (b) =>
            isFutureIST(b.start_time, now) &&
            b.status !== 'cancelled' &&
            !isTodayIST(b.start_time),
        )
        .slice(0, 6),
    [bookings, now],
  );

  const todayCount = todayBookings.length;
  const upcomingCount = upcomingBookings.length;
  const totalShown = todayCount + upcomingCount;

  /* ───── row renderer ───── */

  function BookingTableRow({
    b,
    section,
  }: {
    b: Booking;
    section: 'today' | 'upcoming';
  }) {
    const logoCfg = getLogoPlatformCfg(b.channel);
    const pill = statusPill(b.status);
    const name = b.customer_name ?? 'Customer';
    return (
      <tr
        onClick={() => {
          window.location.href = '/availability';
        }}
        className="cursor-pointer transition hover:bg-gray-50 dark:hover:bg-white/2"
      >
        <td className="px-5 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative h-8.5 w-8.5 shrink-0">
              <CustomerAvatar name={name} profilePic={b.profile_pic_url} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p
                  className="truncate min-w-0 flex-1 type-small font-semibold text-gray-800 dark:text-white/90"
                  title={name}
                >
                  {name}
                </p>
                {section === 'today' && (
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
                    Today
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        <td className="px-5 py-3 sm:px-6">
          <span
            className="inline-flex items-center gap-2 type-small font-medium text-gray-700 dark:text-gray-300"
            title={logoCfg.label}
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5">
              <img
                src={logoCfg.logoSrc || '/brand-logo/website.png'}
                alt={logoCfg.label}
                className="h-4 w-4 shrink-0 object-contain"
              />
            </span>
            <span className="truncate">{logoCfg.label}</span>
          </span>
        </td>

        <td className="px-5 py-3 sm:px-6">
          <span className="whitespace-nowrap type-small font-medium tabular-nums text-gray-700 dark:text-gray-300">
            {section === 'today'
              ? formatSlot(b.start_time, b.end_time)
              : formatDateTime(b.start_time)}
          </span>
        </td>

        <td className="px-5 py-3 sm:px-6">
          <CountdownBadge target={b.start_time} now={now} />
        </td>

        <td className="px-5 py-3 sm:px-6">
          <span
            className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize leading-none ${pill.cls}`}
          >
            {pill.label}
          </span>
        </td>
      </tr>
    );
  }

  /* ───── UI ───── */

  if (!isEnabled) {
    return <></>;
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-3.5 font-semibold text-card-foreground shadow-sm backdrop-blur-sm transition hover:border-brand-300 hover:shadow focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
      >
        <span className="truncate type-small">Bookings</span>
        {todayCount > 0 && (
          <span
            className="inline-flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full px-1.5 type-micro font-semibold text-white"
            style={{ background: 'var(--color-theme-pink-500)' }}
          >
            {todayCount}
          </span>
        )}
      </button>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 type-small text-muted-foreground backdrop-blur-sm">
        Loading bookings…
      </div>
    );
  }

  const hasRows = totalShown > 0;

  return (
    <div className="min-w-0 w-full max-w-full overflow-hidden rounded-xl border border-gray-200 bg-card shadow-sm backdrop-blur-sm dark:border-white/5">
      <style>{`
        .bp-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
        .bp-scroll::-webkit-scrollbar-track { background: transparent; }
        .bp-scroll::-webkit-scrollbar-thumb {
          background: color-mix(in oklab, var(--color-gray-400) 55%, transparent);
          border-radius: 999px;
        }
        .bp-scroll::-webkit-scrollbar-thumb:hover {
          background: color-mix(in oklab, var(--color-gray-400) 80%, transparent);
        }
        .bp-scroll { scrollbar-width: thin; }

        @keyframes bp-pulse-ring {
          0% { transform: scale(0.9); opacity: 0.75; }
          80%, 100% { transform: scale(1.55); opacity: 0; }
        }
        .bp-pulse-ring { animation: bp-pulse-ring 1.5s ease-out infinite; }
      `}</style>

      {/* HEADER */}
      <div
        className={`relative px-5 pt-5 pb-4 sm:px-6 ${
          hasRows ? 'border-b border-gray-100 dark:border-white/5' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="type-label text-gray-400 uppercase tracking-[0.16em] dark:text-gray-500">
              Bookings
            </p>
            <h3 className="mt-1 type-card-title text-gray-800 dark:text-white/90">
              Today&rsquo;s Schedule
            </h3>
            <p className="mt-1 type-caption text-gray-500 dark:text-gray-400">
              {todayCount > 0 ? (
                <>
                  <span className="font-semibold text-brand-600 dark:text-brand-400">
                    {todayCount}
                  </span>{' '}
                  appointment{todayCount === 1 ? '' : 's'} today{' '}
                  {upcomingCount > 0 && (
                    <>
                      ·{' '}
                      <span className="font-semibold">
                        {upcomingCount}
                      </span>{' '}
                      upcoming
                    </>
                  )}
                </>
              ) : (
                <>
                  No appointments today — jump to{' '}
                  <a
                    href="/availability"
                    className="font-semibold text-brand-600 transition hover:text-brand-700 hover:underline dark:text-brand-400 dark:hover:text-brand-300"
                  >
                    All Bookings
                  </a>{' '}
                  for the full calendar.
                </>
              )}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {todayCount > 0 && (
              <div className="relative inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-error-500 via-theme-pink-500 to-orange-500 text-[15px] font-bold text-white shadow-[0_10px_30px_-12px_var(--color-theme-pink-500)]">
                {todayCount}
                <span className="bp-pulse-ring pointer-events-none absolute inset-0 rounded-full border-[3px] border-white/40" />
              </div>
            )}

            <CloseButton onClose={() => setIsOpen(false)} />
          </div>
        </div>
      </div>

      {hasRows && (
        <>
          {/* TABLE */}
          <div className="bp-scroll overflow-x-auto">
            <table className="lashvae-column-dividers min-w-190 w-full table-fixed">
              <colgroup>
                <col className="w-[27%]" />
                <col className="w-[18%]" />
                <col className="w-[27%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
              </colgroup>
              <thead className="border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th className={TABLE_HEAD_CELL}>Customer</th>
                  <th className={TABLE_HEAD_CELL}>Channel</th>
                  <th className={TABLE_HEAD_CELL}>Slot</th>
                  <th className={TABLE_HEAD_CELL}>Starts in</th>
                  <th className={TABLE_HEAD_CELL}>Status</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                {todayBookings.map((b) => (
                  <BookingTableRow key={b.id} b={b} section="today" />
                ))}

                {upcomingBookings.map((b) => (
                  <BookingTableRow key={b.id} b={b} section="upcoming" />
                ))}
              </tbody>
            </table>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-white/5 sm:px-6">
            <p className="type-micro text-gray-500 dark:text-gray-400">
              Showing{' '}
              <span className="font-semibold text-gray-800 dark:text-white/90">
                {totalShown}
              </span>{' '}
              booking{totalShown === 1 ? '' : 's'} · All times in IST
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/availability';
              }}
              className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-control) bg-brand-500 px-3.5 type-small font-medium text-white shadow-theme-xs transition hover:bg-brand-600 focus:outline-none focus:ring-3 focus:ring-brand-500/20"
            >
              View All Bookings
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m13 6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── CustomerAvatar ───────────────────────── */

function CustomerAvatar({
  name,
  profilePic,
}: {
  name: string;
  profilePic?: string;
}) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    // Resets local UI-only state (a flag, warning, or preview value)
    // when the relevant prop/dependency changes — not deriving render
    // output from state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBroken(false);
  }, [profilePic]);

  const gradient = getAvatarGradient(name);
  const initial = getInitial(name);

  if (broken || !profilePic) {
    return (
      <div
        className="flex h-8.5 w-8.5 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white shadow-[0_4px_14px_-6px_rgba(15,23,42,0.25)]"
        style={{ background: gradient }}
      >
        <span className="type-small leading-none">{initial}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={profilePic}
      alt={name}
      onError={() => setBroken(true)}
      className="h-8.5 w-8.5 shrink-0 rounded-full object-cover shadow-[0_4px_14px_-6px_rgba(15,23,42,0.25)]"
    />
  );
}
