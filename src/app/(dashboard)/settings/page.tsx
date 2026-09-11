'use client';

import { RequireAuth } from '@/components/require-auth';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import {
  Bot,
  CalendarDays,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  Globe2,
  Menu,
  MessageSquare,
  PlayCircle,
  Power,
  Save,
  TimerReset,
  User,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import CustomerInfoCard from '@/components/CustomerInfoCard';
import CustomerInfoModal from '@/components/CustomerInfoModal';
import NotificationSettingsCard from '@/components/settings/NotificationSettingsCard';
import PageBreadcrumb from '@/components/common/PageBreadcrumb';
import { SettingsActionRow } from '@/components/settings/SettingsActionRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useRouter, useSearchParams } from 'next/navigation';

type RawOverviewStats = {
  total_conversations?: number;
  conversations?: number;
  total_messages?: number;
  messages?: number;
  total_leads?: number;
  leads?: number;
  total_errors?: number;
  errors?: number;
  total_handoffs?: number;
  handoffs?: number;
  avg_latency_ms?: number;
};

type Settings = {
  system_prompt: string;
  opening_message: string;
  temperature: number;
  max_tokens: number;
  ai_enabled: boolean;

  // Handoff automation
  verified_ig_handoff_enabled: boolean;
  verified_ig_handoff_message: string;
  keyword_handoff_enabled: boolean;
  handoff_keywords: string[];
};

type AvailabilityItem = {
  id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type Booking = {
  id: number;
  conversation_id?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  channel: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  created_at?: string;
  profile_pic_url?: string | null;
  external_user_id?: string | null;
  instagram_profile?: {
    username?: string | null;
    profile_pic_url?: string | null;
  } | null;
};

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

const defaultAvailability: AvailabilityItem[] = DAYS.map((_, index) => ({
  day_of_week: index,
  start_time: '10:00',
  end_time: '19:00',
  is_active: index <= 4,
}));

interface BookingSettingsResponse {
  ok: boolean;
  booking_enabled: boolean;
  booking_advance_days?: number;
}

const BOOKING_WINDOW_MIN = 1;
const BOOKING_WINDOW_MAX = 365;
const BOOKING_WINDOW_PRESETS = [7, 30, 90, 180, 365] as const;

function clampBookingWindowDays(value: number) {
  return Math.max(
    BOOKING_WINDOW_MIN,
    Math.min(BOOKING_WINDOW_MAX, Math.round(value)),
  );
}

function formatBookingWindowDate(days: number) {
  return new Date(
    Date.now() + (days - 1) * 86_400_000,
  ).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function isUpcoming(dateStr: string) {
  return new Date(dateStr) > new Date();
}

const SELECT_CLASS =
  'h-10 w-full appearance-none rounded-(--radius-control) border border-gray-300 bg-transparent px-4 py-2 pr-8 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800';

const TIME_INPUT_CLASS =
  'h-10 w-full rounded-(--radius-control) border border-gray-300 bg-white px-3 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

const INPUT_CLASS =
  'h-10 rounded-(--radius-control) border-gray-300 px-4 py-2 type-small text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus-visible:border-brand-300 focus-visible:ring-3 focus-visible:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus-visible:border-brand-800';

const TEXTAREA_CLASS =
  'rounded-(--radius-control) border-gray-300 px-4 py-3 type-small text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus-visible:border-brand-300 focus-visible:ring-3 focus-visible:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus-visible:border-brand-800';

const SETTINGS_SECTIONS = [
  'ai',
  'profile',
  'booking',
  'channels',
  'knowledge',
  'billing',
];

function BookingWindowEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const days = clampBookingWindowDays(value);

  return (
    <div className='rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/2'>
      <div>
        <h4 className='type-small font-semibold text-gray-800 dark:text-white/90'>
          Booking window
        </h4>
        <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
          How many days ahead can customers book, starting from today?
        </p>
      </div>

      <div className='mt-4 flex items-center gap-3'>
        <span className='shrink-0 type-small text-gray-500 dark:text-gray-400'>
          Open for next
        </span>
        <input
          type='range'
          min={BOOKING_WINDOW_MIN}
          max={BOOKING_WINDOW_MAX}
          value={days}
          onChange={(e) =>
            onChange(clampBookingWindowDays(Number(e.target.value)))
          }
          className='h-2 flex-1 cursor-pointer accent-brand-500'
        />
        <div className='min-w-19.5 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-center type-small font-semibold text-brand-500 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400'>
          {days} day{days === 1 ? '' : 's'}
        </div>
      </div>

      <div className='mt-3 flex flex-wrap gap-2'>
        {BOOKING_WINDOW_PRESETS.map((preset) => {
          const active = days === preset;

          return (
            <button
              key={preset}
              type='button'
              onClick={() => onChange(preset)}
              className={cn(
                'rounded-lg px-3 py-1.5 type-caption font-semibold transition',
                active
                  ? 'border border-brand-300 bg-brand-50 text-brand-500 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400'
                  : 'border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-400 dark:hover:bg-white/3',
              )}
            >
              {preset === BOOKING_WINDOW_MAX ? '365d (max)' : `${preset}d`}
            </button>
          );
        })}
      </div>

      <p className='mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 type-small leading-6 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300'>
        Customers can pick any date from{' '}
        <strong>
          {new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </strong>{' '}
        to <strong>{formatBookingWindowDate(days)}</strong> — shifts forward
        automatically every day.
      </p>
    </div>
  );
}

export default function SettingsPage() {
  const { isDark } = useTheme();
  const searchParams = useSearchParams();
  const isWeekly = searchParams.get('weekly') === 'true';
  const requestedSection = searchParams.get('section');
  const initialSection = SETTINGS_SECTIONS.includes(requestedSection || '')
    ? (requestedSection as string)
    : 'ai';

  const [s, setS] = useState<Settings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  const [savingAI, setSavingAI] = useState(false);
  const [savedAI, setSavedAI] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [togglingAI, setTogglingAI] = useState(false);
  const [activeSection, setActiveSection] = useState(initialSection);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAvailabilityPanel, setShowAvailabilityPanel] = useState<
    true | false
  >(isWeekly ? true : false);
  const [availability, setAvailability] =
    useState<AvailabilityItem[]>(defaultAvailability);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);

  const router = useRouter();
  const settingsReturnHref = `/settings?section=${encodeURIComponent(activeSection)}`;

  useEffect(() => {
    if (SETTINGS_SECTIONS.includes(requestedSection || '')) {
      // Clamps/adjusts local state in response to a changing dependency
      // (e.g. pagination bounds, active tab) — reviewed; not a
      // derive-state-from-render antipattern in this context.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveSection(requestedSection as string);
    }
  }, [requestedSection]);

  /* Filtered list */
  const bookingStats = [
    {
      label: 'Upcoming',
      value: bookings.filter(
        (b) => isUpcoming(b.start_time) && b.status !== 'cancelled',
      ).length,
    },
    {
      label: 'Confirmed',
      value: bookings.filter((b) =>
        ['confirmed', 'rescheduled'].includes(b.status),
      ).length,
    },
    {
      label: 'Cancelled',
      value: bookings.filter((b) => b.status === 'cancelled').length,
    },
  ];

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);

    check();
    window.addEventListener('resize', check);

    return () => window.removeEventListener('resize', check);
  }, []);

  const [bookingSettings, setBookingSettings] = useState({
    booking_enabled: false,
    booking_slot_duration_minutes: 30,
    booking_buffer_minutes: 10,
    booking_timezone: 'Asia/Kolkata',
    booking_advance_days: 30,
  });

  const [advanceDaysDraft, setAdvanceDaysDraft] = useState(30);
  const [savingBookingSettings, setSavingBookingSettings] = useState(false);

  // Handoff automation state
  const [handoffKwInput, setHandoffKwInput] = useState('');
  const [savingHandoff, setSavingHandoff] = useState(false);
  const [savedHandoff, setSavedHandoff] = useState(false);
  const [togglingVerifiedHandoff, setTogglingVerifiedHandoff] = useState(false);
  const [togglingKeywordHandoff, setTogglingKeywordHandoff] = useState(false);

  const [testMsg, setTestMsg] = useState('What services do you offer?');
  const [testOut, setTestOut] = useState<{
    answer: string;
    latency_ms: number;
    model: string;
    provider?: string;
    faq_id?: number;
    faq_score?: number;
  } | null>(null);

  const [testing, setTesting] = useState(false);
  const [tenantId, setTenantId] = useState<string>('');

  const [healthOverview, setHealthOverview] = useState<{
    conversations: number;
    messages: number;
    leads: number;
    errors: number;
    handoffs: number;
    avg_latency_ms: number;
  } | null>(null);
  // Rendering this is a separate, pre-existing gap (fetched but not
  // yet surfaced in the UI) — out of scope for this pass, which is
  // only removing the `any` on the fetch itself.
  void healthOverview;

  const taRef = useRef<HTMLTextAreaElement>(null);

  const openAvailabilityPanel = () => {
    setAdvanceDaysDraft(bookingSettings.booking_advance_days || 30);
    setShowAvailabilityPanel(true);
  };

  const saveBookingSettings = async (
    settings: typeof bookingSettings = bookingSettings,
  ) => {
    try {
      setSavingBookingSettings(true);

      const payload = {
        ...settings,
        booking_advance_days: clampBookingWindowDays(
          settings.booking_advance_days || 30,
        ),
      };

      const data = await apiFetch<BookingSettingsResponse>(
        '/admin/booking/settings',
        {
          method: 'PUT',
          body: payload,
          auth: true,
        },
      );

      setBookingSettings(payload);
      setAdvanceDaysDraft(payload.booking_advance_days);

      if (data.booking_enabled) {
        setShowAvailabilityPanel(true);
      }
    } finally {
      setSavingBookingSettings(false);
    }
  };

  const updateAvailability = async (
    dayIndex: number,
    patch: Partial<AvailabilityItem>,
  ) => {
    setAvailability((prev) =>
      prev.map((item) =>
        item.day_of_week === dayIndex ? { ...item, ...patch } : item,
      ),
    );
  };

  const saveAvailability = async () => {
    try {
      setSavingAvailability(true);

      await apiFetch('/admin/booking/availability', {
        method: 'PUT',
        body: { items: availability },
        auth: true,
      });

      const nextAdvanceDays = clampBookingWindowDays(advanceDaysDraft);

      await apiFetch<BookingSettingsResponse>('/admin/booking/settings', {
        method: 'PUT',
        body: { booking_advance_days: nextAdvanceDays },
        auth: true,
      });

      setBookingSettings((prev) => ({
        ...prev,
        booking_advance_days: nextAdvanceDays,
      }));
      setAdvanceDaysDraft(nextAdvanceDays);

      setShowAvailabilityPanel(false);
    } finally {
      setSavingAvailability(false);
    }
  };

  async function load() {
    setErr('');

    try {
      const [data, me] = await Promise.all([
        apiFetch<Settings>('/admin/settings', { auth: true }),
        apiFetch<{ user: { tenant_id: string } }>('/admin/auth/me', {
          auth: true,
        }),
      ]);

      const bookingRes = await apiFetch<{
        booking_enabled: boolean;
        booking_slot_duration_minutes: number;
        booking_buffer_minutes: number;
        booking_timezone: string;
        booking_advance_days?: number;
      }>('/admin/booking/settings', { auth: true });

      const availabilityRes = await apiFetch<{ items: AvailabilityItem[] }>(
        '/admin/booking/availability',
        { auth: true },
      );
      const items = availabilityRes.items || [];
      if (items.length > 0) {
        setAvailability(
          defaultAvailability.map((day) => {
            const existing = items.find(
              (x) => x.day_of_week === day.day_of_week,
            );
            return existing || { ...day, is_active: false };
          }),
        );
      }

      const bookingsRes = await apiFetch<{ items: Booking[] }>(
        '/admin/bookings',
        { auth: true },
      );
      setBookings(bookingsRes.items || []);

      setBookingSettings({
        booking_enabled: bookingRes.booking_enabled,
        booking_slot_duration_minutes:
          bookingRes.booking_slot_duration_minutes ?? 30,
        booking_buffer_minutes: bookingRes.booking_buffer_minutes ?? 10,
        booking_timezone: bookingRes.booking_timezone ?? 'Asia/Kolkata',
        booking_advance_days: bookingRes.booking_advance_days ?? 30,
      });
      setAdvanceDaysDraft(bookingRes.booking_advance_days ?? 30);

      data.handoff_keywords = Array.isArray(data.handoff_keywords)
        ? data.handoff_keywords
        : [];

      // Sensible defaults if backend ever omits these
      data.verified_ig_handoff_enabled = Boolean(
        data.verified_ig_handoff_enabled,
      );
      data.keyword_handoff_enabled = Boolean(data.keyword_handoff_enabled);
      data.verified_ig_handoff_message =
        typeof data.verified_ig_handoff_message === 'string'
          ? data.verified_ig_handoff_message
          : '';

      data.system_prompt =
        typeof data.system_prompt === 'string'
          ? data.system_prompt.slice(0, 1000)
          : '';

      setS(data);
      setTenantId(me.user.tenant_id);
      setLoaded(true);

      apiFetch<RawOverviewStats>('/admin/stats/overview', { auth: true })
        .then((ov) =>
          setHealthOverview({
            conversations: ov.total_conversations ?? ov.conversations ?? 0,
            messages: ov.total_messages ?? ov.messages ?? 0,
            leads: ov.total_leads ?? ov.leads ?? 0,
            errors: ov.total_errors ?? ov.errors ?? 0,
            handoffs: ov.total_handoffs ?? ov.handoffs ?? 0,
            avg_latency_ms: ov.avg_latency_ms ?? 0,
          }),
        )
        .catch(() => {});
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to load settings');
    }
  }

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = taRef.current.scrollHeight + 'px';
    }
  }, [s?.system_prompt]);

  async function saveAISettings() {
    if (!s) return;

    setSavingAI(true);
    setErr('');

    try {
      await apiFetch('/admin/settings', {
        method: 'PUT',
        auth: true,
        body: {
          system_prompt: s.system_prompt,
          opening_message: s.opening_message,
          temperature: s.temperature,
          max_tokens: s.max_tokens,
        },
      });

      setSavedAI(true);
      setTimeout(() => setSavedAI(false), 2000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingAI(false);
    }
  }

  async function toggleAI() {
    if (!s) return;

    setTogglingAI(true);
    setErr('');

    const next = !s.ai_enabled;

    try {
      await apiFetch('/admin/settings', {
        method: 'PUT',
        auth: true,
        body: { ai_enabled: next },
      });

      setS((p) => (p ? { ...p, ai_enabled: next } : p));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setTogglingAI(false);
    }
  }

  // Handoff automation handlers
  async function toggleVerifiedHandoff() {
    if (!s) return;

    setTogglingVerifiedHandoff(true);
    setErr('');

    const next = !s.verified_ig_handoff_enabled;

    try {
      await apiFetch('/admin/settings', {
        method: 'PUT',
        auth: true,
        body: { verified_ig_handoff_enabled: next },
      });

      setS((p) => (p ? { ...p, verified_ig_handoff_enabled: next } : p));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setTogglingVerifiedHandoff(false);
    }
  }

  async function toggleKeywordHandoff() {
    if (!s) return;

    setTogglingKeywordHandoff(true);
    setErr('');

    const next = !s.keyword_handoff_enabled;

    try {
      await apiFetch('/admin/settings', {
        method: 'PUT',
        auth: true,
        body: { keyword_handoff_enabled: next },
      });

      setS((p) => (p ? { ...p, keyword_handoff_enabled: next } : p));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setTogglingKeywordHandoff(false);
    }
  }

  function addHandoffKw() {
    const kw = handoffKwInput.trim().toLowerCase();

    if (!kw || !s) return;

    if (s.handoff_keywords.includes(kw)) {
      setHandoffKwInput('');
      return;
    }

    setS((p) =>
      p ? { ...p, handoff_keywords: [...p.handoff_keywords, kw] } : p,
    );

    setHandoffKwInput('');
  }

  function removeHandoffKw(kw: string) {
    setS((p) =>
      p
        ? {
            ...p,
            handoff_keywords: p.handoff_keywords.filter((k) => k !== kw),
          }
        : p,
    );
  }

  async function saveHandoffSettings() {
    if (!s) return;

    setSavingHandoff(true);
    setErr('');

    try {
      await apiFetch('/admin/settings', {
        method: 'PUT',
        auth: true,
        body: {
          verified_ig_handoff_message: s.verified_ig_handoff_message,
          handoff_keywords: s.handoff_keywords,
        },
      });

      setSavedHandoff(true);
      setTimeout(() => setSavedHandoff(false), 2000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingHandoff(false);
    }
  }

  async function runTest() {
    setErr('');
    setTestOut(null);
    setTesting(true);

    try {
      const r = await apiFetch<{
        answer: string;
        latency_ms: number;
        model: string;
        provider?: string;
        faq_id?: number;
        faq_score?: number;
      }>('/internal/chat_api', {
        method: 'POST',
        auth: true,
        body: {
          tenant_id: tenantId,
          conversation_id: 'settings-test',
          message: testMsg,
          channel: 'test',
        },
      });

      setTestOut(r);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Test failed');
    } finally {
      setTesting(false);
    }
  }

  const settingsLoading = !loaded || !s;
  const isLive = s?.ai_enabled === true;

  const SETTINGS_ITEMS = [
    {
      key: 'ai',
      title: 'General',
      subtitle: 'Auto reply, tone and behavior',
      icon: <Bot size={20} />,
    },
    {
      key: 'profile',
      title: 'Profile',
      subtitle: 'Account and security settings',
      icon: <User size={20} />,
    },
    {
      key: 'booking',
      title: 'Smart Booking',
      subtitle: 'Manage booking preferences',
      icon: <CalendarDays size={20} />,
    },
    {
      key: 'channels',
      title: 'Channels',
      subtitle: 'Connect your channels',
      icon: <MessageSquare size={20} />,
    },
    {
      key: 'knowledge',
      title: 'Knowledge',
      subtitle: 'Manage files and FAQs',
      icon: <FileText size={20} />,
    },
    {
      key: 'billing',
      title: 'Billing',
      subtitle: 'Plan and billing details',
      icon: <CreditCard size={20} />,
    },
  ];

  return (
    <RequireAuth>
      <div className='py-4'>
        <PageBreadcrumb pageTitle='Settings' />

      {err && (
        <div className='mb-6 rounded-(--radius-control) border border-error-200 bg-error-50 px-4 py-3 type-small text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400'>
          {err}
        </div>
      )}

      <div className='grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr] lg:items-start'>
        {/* SIDEBAR */}
        <div>
          {isMobile && (
            <button
              onClick={() => setSettingsMenuOpen((p) => !p)}
              className='mb-3 flex h-10 w-full items-center justify-between rounded-(--radius-control) border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400 dark:hover:bg-white/3'
            >
              <span>Settings Menu</span>
              <Menu size={18} />
            </button>
          )}

          {(!isMobile || settingsMenuOpen) && (
            <div className='rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3'>
              <div className='border-b border-gray-100 px-5 py-4 dark:border-gray-800'>
                <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                  Settings
                </h3>
                <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                  Manage workspace preferences
                </p>
              </div>

              <div className='flex flex-col gap-1 p-3'>
                {SETTINGS_ITEMS.map((item) => {
                  const active = activeSection === item.key;

                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (item.key === 'profile') {
                          router.push('/profile');
                          return;
                        }

                        if (item.key === 'channels') {
                          router.push(
                            `/channels?from=settings&returnTo=${encodeURIComponent(settingsReturnHref)}`,
                          );
                          return;
                        }

                        if (item.key === 'knowledge') {
                          router.push(
                            `/faq?from=settings&returnTo=${encodeURIComponent(settingsReturnHref)}`,
                          );
                          return;
                        }

                        if (item.key === 'billing') {
                          router.push('/profile?billing=True');
                          return;
                        }

                        setActiveSection(item.key);
                        setSettingsMenuOpen(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 rounded-(--radius-control) px-3 py-3 text-left transition',
                        active
                          ? 'bg-brand-50 dark:bg-brand-500/12'
                          : 'hover:bg-gray-50 dark:hover:bg-white/3',
                      )}
                    >
                      <span className='flex items-center gap-3'>
                        <span
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-(--radius-control)',
                            active
                              ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-white/10 dark:text-brand-400'
                              : 'text-gray-500 dark:text-gray-400',
                          )}
                        >
                          {item.icon}
                        </span>

                        <span>
                          <span
                            className={cn(
                              'block type-small font-semibold',
                              active
                                ? 'text-brand-500 dark:text-brand-400'
                                : 'text-gray-700 dark:text-gray-300',
                            )}
                          >
                            {item.title}
                          </span>
                          <span className='mt-0.5 block type-caption font-normal text-gray-400 dark:text-gray-500'>
                            {item.subtitle}
                          </span>
                        </span>
                      </span>

                      <ChevronRight
                        size={16}
                        className={cn(
                          'shrink-0',
                          active
                            ? 'text-brand-400'
                            : 'text-gray-300 dark:text-gray-600',
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className='min-w-0'>
          {activeSection === 'ai' && (
            <div className='flex flex-col gap-6'>
              <NotificationSettingsCard />

              {/* AI enable card */}
              <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 sm:p-6'>
                <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <h2 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                      AI Auto Reply
                    </h2>
                    <p className='mt-1 type-small leading-6 text-gray-500 dark:text-gray-400'>
                      Control whether the bot responds automatically to incoming
                      messages
                    </p>
                  </div>

                  <Badge
                    color={isLive ? 'primary' : 'light'}
                    startIcon={
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          isLive ? 'animate-pulse bg-brand-500' : 'bg-gray-400',
                        )}
                      />
                    }
                  >
                    {isLive ? 'Live' : 'Paused'}
                  </Badge>
                </div>

                <div
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4',
                    isLive
                      ? 'border-brand-100 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/2',
                  )}
                >
                  <div>
                    <p className='flex items-center gap-1.5 type-small font-semibold text-gray-800 dark:text-white/90'>
                      <Bot size={16} className='text-brand-500' />
                      {isLive
                        ? 'AI is responding automatically'
                        : 'Manual mode - AI is paused'}
                    </p>
                    <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                      {isLive
                        ? 'All incoming messages get an AI reply. Click to pause.'
                        : 'Messages are saved but no auto replies are sent. Click to resume.'}
                    </p>
                  </div>

                  <Switch
                    checked={isLive}
                    disabled={settingsLoading || togglingAI}
                    onChange={toggleAI}
                  />
                </div>
              </div>

              {/* Handoff Automation */}
              <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 sm:p-6'>
                <div className='mb-2'>
                  <h2 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                    Handoff Automation
                  </h2>
                  <p className='mt-1 type-small leading-6 text-gray-500 dark:text-gray-400'>
                    Route conversations to your team automatically. The AI does
                    not reply when a handoff is triggered.
                  </p>
                </div>

                <div className='flex items-center justify-between gap-4 border-t border-gray-100 py-4 dark:border-gray-800'>
                  <div className='min-w-0'>
                    <p className='type-small font-semibold text-gray-800 dark:text-white/90'>
                      Auto-handoff verified Instagram accounts
                    </p>
                    <p className='mt-1 type-small text-gray-500 dark:text-gray-400 flex items-center gap-1'>
                      <svg
                        xmlns='http://www.w3.org/2000/svg'
                        viewBox='0 0 24 24'
                        fill='#0095F6'
                        className='h-4 w-4 shrink-0'
                      >
                        <path d='M22 12l-2.1-2.4.3-3.2-3.1-.7L15.5 3 12 4.6 8.5 3 6.9 5.7l-3.1.7.3 3.2L2 12l2.1 2.4-.3 3.2 3.1.7L8.5 21l3.5-1.6 3.5 1.6 1.6-2.7 3.1-.7-.3-3.2L22 12zm-11 3.2l-2.3-2.3 1.1-1.1 1.2 1.2 3.1-3.1 1.1 1.1-4.2 4.2z' />
                      </svg>

                      <span>
                        Verified Instagram profiles skip the AI and go straight
                        to your team.
                      </span>
                    </p>
                  </div>

                  <Switch
                    checked={!!s?.verified_ig_handoff_enabled}
                    disabled={!s || togglingVerifiedHandoff}
                    onChange={toggleVerifiedHandoff}
                  />
                </div>

                <div className='flex items-center justify-between gap-4 border-t border-gray-100 py-4 dark:border-gray-800'>
                  <div className='min-w-0'>
                    <p className='type-small font-semibold text-gray-800 dark:text-white/90'>
                      Auto-handoff on keywords
                    </p>
                    <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                      Hand off when a customer message contains any keyword
                      below.
                    </p>
                  </div>

                  <Switch
                    checked={!!s?.keyword_handoff_enabled}
                    disabled={!s || togglingKeywordHandoff}
                    onChange={toggleKeywordHandoff}
                  />
                </div>

                <div
                  className={cn(
                    'border-t border-gray-100 pt-4 dark:border-gray-800',
                    !s?.keyword_handoff_enabled && 'opacity-55',
                  )}
                >
                  <div className='mb-1.5 flex items-baseline justify-between'>
                    <Label className='mb-0'>Handoff keywords</Label>
                    <span className='font-mono type-caption font-medium text-brand-500 dark:text-brand-400'>
                      {s?.handoff_keywords?.length ?? 0} active
                    </span>
                  </div>

                  <p className='mb-2.5 type-small text-gray-500 dark:text-gray-400'>
                    Case-insensitive substring match. Use single words or short
                    phrases like <code>human</code>, <code>refund</code>,{' '}
                    <code>call me</code>.
                  </p>

                  <div className='mb-3 flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-white/2'>
                    {(s?.handoff_keywords?.length ?? 0) === 0 && (
                      <span className='type-small text-gray-400 dark:text-gray-600'>
                        No handoff keywords yet. Add one below.
                      </span>
                    )}

                    {(s?.handoff_keywords ?? []).map((kw) => (
                      <Badge key={kw} color='light' className='gap-1.5'>
                        {kw}
                        <button
                          type='button'
                          onClick={() => removeHandoffKw(kw)}
                          className='text-gray-400 transition hover:text-gray-700 dark:hover:text-white/80'
                          aria-label={`Remove ${kw}`}
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  <div className='mb-4 flex gap-2'>
                    <Input
                      value={handoffKwInput}
                      onChange={(e) => setHandoffKwInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addHandoffKw()}
                      placeholder='Type a keyword or phrase and press Enter'
                      className={INPUT_CLASS}
                    />

                    <Button
                      variant='outline'
                      size='lg'
                      onClick={addHandoffKw}
                      disabled={!handoffKwInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className='border-t border-gray-100 pt-4 dark:border-gray-800'>
                  <div className='mb-1.5 flex items-baseline justify-between'>
                    <Label className='mb-0'>Opening message</Label>
                    <span className='font-mono type-caption font-medium text-brand-500 dark:text-brand-400'>
                      {(s?.verified_ig_handoff_message || '').length} chars
                    </span>
                  </div>

                  <Textarea
                    rows={3}
                    value={s?.verified_ig_handoff_message || ''}
                    onChange={(e) =>
                      setS((p) =>
                        p
                          ? {
                              ...p,
                              verified_ig_handoff_message: e.target.value,
                            }
                          : p,
                      )
                    }
                    placeholder="Thanks for reaching out. I've passed this to our team and someone will reply shortly."
                    className={TEXTAREA_CLASS}
                  />

                  <p className='mt-1.5 type-small text-gray-500 dark:text-gray-400'>
                    Sent once to the customer when handoff is triggered. Used by
                    both verified and keyword paths. Leave blank to use the
                    default.
                  </p>
                </div>

                <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
                  <p className='type-small text-gray-500 dark:text-gray-400'>
                    Toggles save instantly. Keywords and message save here.
                  </p>

                  <Button
                    onClick={saveHandoffSettings}
                    disabled={savingHandoff}
                  >
                    {savingHandoff
                      ? 'Saving...'
                      : savedHandoff
                        ? 'Saved'
                        : 'Save handoff settings'}
                  </Button>
                </div>
              </div>

              {/* About */}
              <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 sm:p-6'>
                <h2 className='mb-4 type-card-title font-semibold text-gray-800 dark:text-white/90'>
                  About
                </h2>

                <div className='mb-1.5 flex items-baseline justify-between'>
                  <Label className='mb-0'>
                    Tell us more about your business
                  </Label>
                  <span
                    className={cn(
                      'font-mono type-caption font-semibold',
                      (s?.system_prompt || '').length >= 900
                        ? 'text-gray-800 dark:text-white/90'
                        : 'text-brand-500 dark:text-brand-400',
                    )}
                  >
                    {(s?.system_prompt || '').length}/1000 chars
                  </span>
                </div>

                <Textarea
                  ref={taRef}
                  value={s?.system_prompt || ''}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, 1000);

                    setS((p) => (p ? { ...p, system_prompt: value } : p));
                  }}
                  maxLength={1000}
                  rows={5}
                  placeholder='You are a helpful assistant for...'
                  className={cn(TEXTAREA_CLASS, 'min-h-30 resize-none')}
                />

                <div className='mt-4 flex justify-end'>
                  <Button onClick={saveAISettings} disabled={savingAI}>
                    {savingAI
                      ? 'Saving...'
                      : savedAI
                        ? 'Saved'
                        : 'Save AI settings'}
                  </Button>
                </div>
              </div>

              {/* Test */}
              <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 sm:p-6'>
                <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                  <div>
                    <h2 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                      Test Prompt
                    </h2>
                    <p className='mt-1 type-small leading-6 text-gray-500 dark:text-gray-400'>
                      Fire a live message against the current system prompt
                    </p>
                  </div>

                  {testing && (
                    <div className='flex items-center gap-2 type-caption font-semibold text-brand-500 dark:text-brand-400'>
                      <span className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500 dark:border-brand-500/30 dark:border-t-brand-400' />
                      Thinking...
                    </div>
                  )}
                </div>

                <div className='mb-4 flex gap-2'>
                  <Input
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runTest()}
                    placeholder='Type a test message'
                    className={INPUT_CLASS}
                  />

                  <Button
                    onClick={runTest}
                    disabled={testing || !testMsg.trim()}
                  >
                    <PlayCircle size={16} />
                    Run
                  </Button>
                </div>

                {testMsg && (
                  <div className='mb-2 flex justify-end'>
                    <div className='max-w-[65%] rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3.5 py-2 type-small text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300'>
                      {testMsg}
                    </div>
                  </div>
                )}

                {testOut && (
                  <div>
                    <div className='mb-2 flex gap-3'>
                      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                        <Bot size={16} />
                      </div>

                      <div className='flex-1 whitespace-pre-wrap rounded-(--radius-control) border border-gray-200 bg-white px-4 py-3 type-small leading-6 text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-200'>
                        {testOut.answer || (
                          <span className='italic text-gray-400 dark:text-gray-600'>
                            Empty response
                          </span>
                        )}
                      </div>
                    </div>

                    <div className='flex flex-wrap items-center gap-3 pl-10.5 type-caption text-gray-400 dark:text-gray-500'>
                      <span>Latency: {testOut.latency_ms}ms</span>
                      <span>Model: {testOut.model}</span>
                      {testOut.provider && (
                        <span>Provider: {testOut.provider}</span>
                      )}
                      {testOut.faq_id && <span>FAQ #{testOut.faq_id}</span>}
                      {testOut.faq_score != null && (
                        <span>Score: {testOut.faq_score}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === 'booking' && (
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 sm:p-6'>
              <div className='mb-6'>
                <Badge color='primary'>Smart Booking</Badge>
                <h2 className='mt-3 text-title-sm font-bold text-gray-800 dark:text-white/90'>
                  Smart Booking
                </h2>
                <p className='mt-2 max-w-xl type-small leading-6 text-gray-500 dark:text-gray-400'>
                  Configure how your customers can book appointments with you.
                </p>
              </div>

              <div className='flex flex-col gap-4'>
                <SettingsActionRow
                  icon={<Power size={28} />}
                  iconColorClass='bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                  title={`General (${
                    bookingSettings.booking_enabled ? 'Enabled' : 'Disabled'
                  })`}
                  description='Enable or disable Smart Booking and configure basic booking preferences.'
                  actionLabel='Configure'
                  actionColorClass='bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/8 dark:text-gray-300 dark:hover:bg-white/14'
                  onAction={() => setShowBookingModal(true)}
                >
                  <div className='mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                    {[
                      {
                        icon: <Clock3 size={16} />,
                        value: `${
                          bookingSettings.booking_slot_duration_minutes || 45
                        } min`,
                        label: 'Slot duration',
                      },
                      {
                        icon: <TimerReset size={16} />,
                        value: `${
                          bookingSettings.booking_buffer_minutes || 10
                        } min`,
                        label: 'Buffer time',
                      },
                      {
                        icon: <Globe2 size={16} />,
                        value:
                          bookingSettings.booking_timezone || 'Asia/Kolkata',
                        label: 'Timezone',
                      },
                      {
                        icon: <CalendarDays size={16} />,
                        value: `${
                          bookingSettings.booking_advance_days || 30
                        } days`,
                        label: 'Booking window',
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className='min-w-0 rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-gray-800 dark:bg-white/2'
                      >
                        <div className='mb-1.5 flex items-center gap-1.5 whitespace-nowrap type-caption font-medium text-gray-500 dark:text-gray-400'>
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        <div className='wrap-break-word type-small font-semibold text-gray-800 dark:text-white/90'>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </SettingsActionRow>

                <SettingsActionRow
                  icon={<CalendarDays size={28} />}
                  iconColorClass='bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                  title='Availability (Weekly)'
                  description='Set your working days and available hours for appointments.'
                  actionLabel='Configure'
                  actionColorClass='bg-brand-50 text-brand-500 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25'
                  onAction={openAvailabilityPanel}
                  onRowClick={openAvailabilityPanel}
                >
                  <div className='mt-4 flex flex-wrap gap-2'>
                    {availability.map((day, index) => (
                      <span
                        key={`${day.day_of_week}-${index}`}
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-(--radius-control) type-caption font-bold',
                          day.is_active
                            ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                            : 'bg-gray-100 text-gray-400 dark:bg-white/6 dark:text-gray-500',
                        )}
                      >
                        {DAYS[day.day_of_week][0]}
                      </span>
                    ))}
                  </div>
                </SettingsActionRow>

                <SettingsActionRow
                  icon={<CalendarDays size={28} />}
                  iconColorClass='bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                  title='Appointments'
                  description='View and manage your upcoming, rescheduled and cancelled appointments.'
                  actionLabel='View Bookings'
                  actionColorClass='bg-brand-50 text-brand-500 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25'
                  onAction={() => router.push('/availability')}
                  onRowClick={() => router.push('/availability')}
                >
                  <div className='mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3'>
                    {bookingStats.map((item) => (
                      <div
                        key={item.label}
                        className='min-w-0 rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-gray-800 dark:bg-white/2'
                      >
                        <div className='whitespace-nowrap type-caption font-medium text-gray-500 dark:text-gray-400'>
                          {item.label}
                        </div>
                        <div className='mt-1 wrap-break-word type-small font-semibold text-gray-800 dark:text-white/90'>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </SettingsActionRow>

                <CustomerInfoCard
                  onOpen={() => setShowCustomerInfoModal(true)}
                />
              </div>
            </div>
          )}

          {activeSection === 'billing' && (
            <div className='rounded-2xl border border-gray-200 bg-white p-10 text-center type-small text-gray-400 dark:border-gray-800 dark:bg-white/3 dark:text-gray-500'>
              Coming soon
            </div>
          )}
        </div>
      </div>

      {/* Booking settings modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        className='m-4 max-w-180'
      >
        <div className='custom-scrollbar relative max-h-[85vh] w-full overflow-y-auto rounded-2xl bg-white p-6 dark:bg-gray-900 sm:p-8'>
          <div className='mb-6 flex flex-wrap items-start justify-between gap-4 pr-10'>
            <div>
              <Badge color='primary' startIcon={<CalendarDays size={14} />}>
                Smart Booking
              </Badge>
              <h3 className='mt-3 type-h4 font-bold text-gray-800 dark:text-white/90 sm:type-h3'>
                Appointment booking
              </h3>
              <p className='mt-2.5 max-w-lg type-small leading-relaxed text-gray-500 dark:text-gray-400'>
                Let customers book appointments directly from Instagram DM and
                other connected channels. The AI checks your availability, shows
                open slots, confirms with the customer, and stores the booking.
              </p>
            </div>

            <button
              type='button'
              onClick={() =>
                setBookingSettings((prev) => ({
                  ...prev,
                  booking_enabled: !prev.booking_enabled,
                }))
              }
              className={cn(
                'inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-(--radius-control) px-4 type-small font-medium shadow-theme-xs transition',
                bookingSettings.booking_enabled
                  ? 'bg-brand-500 text-white hover:bg-brand-600'
                  : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/3',
              )}
            >
              <Power size={16} />
              {bookingSettings.booking_enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          <div className='mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            {[
              {
                icon: <Clock3 size={18} />,
                label: 'Slot Duration',
                value: `${
                  bookingSettings.booking_slot_duration_minutes || 45
                } min`,
              },
              {
                icon: <TimerReset size={18} />,
                label: 'Buffer Time',
                value: `${bookingSettings.booking_buffer_minutes || 10} min`,
              },
              {
                icon: <Globe2 size={18} />,
                label: 'Timezone',
                value: bookingSettings.booking_timezone || 'Asia/Kolkata',
              },
              {
                icon: <CalendarDays size={18} />,
                label: 'Booking Window',
                value: `${bookingSettings.booking_advance_days || 30} days`,
              },
            ].map((item) => (
              <div
                key={item.label}
                className='flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/3'
              >
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-control) bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                  {item.icon}
                </div>
                <div>
                  <div className='type-caption font-semibold text-gray-500 dark:text-gray-400'>
                    {item.label}
                  </div>
                  <div className='mt-0.5 type-small font-bold text-gray-800 dark:text-white/90'>
                    {item.value}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className='mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <div>
              <Label>Slot duration</Label>
              <select
                value={bookingSettings.booking_slot_duration_minutes || 45}
                onChange={(e) =>
                  setBookingSettings((prev) => ({
                    ...prev,
                    booking_slot_duration_minutes: Number(e.target.value),
                  }))
                }
                className={SELECT_CLASS}
              >
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes</option>
              </select>
            </div>

            <div>
              <Label>Buffer between slots</Label>
              <select
                value={bookingSettings.booking_buffer_minutes || 10}
                onChange={(e) =>
                  setBookingSettings((prev) => ({
                    ...prev,
                    booking_buffer_minutes: Number(e.target.value),
                  }))
                }
                className={SELECT_CLASS}
              >
                <option value={0}>No buffer</option>
                <option value={5}>5 minutes</option>
                <option value={10}>10 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>

            <div>
              <Label>Timezone</Label>
              <select
                value={bookingSettings.booking_timezone || 'Asia/Kolkata'}
                onChange={(e) =>
                  setBookingSettings((prev) => ({
                    ...prev,
                    booking_timezone: e.target.value,
                  }))
                }
                className={SELECT_CLASS}
              >
                <option value='Asia/Kolkata'>Asia/Kolkata</option>
                <option value='Europe/London'>Europe/London</option>
                <option value='Asia/Dubai'>Asia/Dubai</option>
                <option value='Asia/Singapore'>Asia/Singapore</option>
                <option value='America/New_York'>America/New_York</option>
              </select>
            </div>
          </div>

          <div className='mb-6'>
            <BookingWindowEditor
              value={bookingSettings.booking_advance_days || 30}
              onChange={(days) =>
                setBookingSettings((prev) => ({
                  ...prev,
                  booking_advance_days: days,
                }))
              }
            />
          </div>

          <div className='flex flex-wrap items-center justify-between gap-4'>
            <p className='type-caption text-gray-500 dark:text-gray-400'>
              Booking works only when this toggle is enabled. Customers stay
              inside their original chat.
            </p>

            <Button
              onClick={async () => {
                const nextSettings = {
                  ...bookingSettings,
                  booking_advance_days: clampBookingWindowDays(
                    bookingSettings.booking_advance_days || 30,
                  ),
                };
                await saveBookingSettings(nextSettings);
                setShowBookingModal(false);
              }}
              disabled={savingBookingSettings}
            >
              {savingBookingSettings ? 'Saving...' : 'Save booking settings'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Availability weekly modal */}
      <Modal
        isOpen={showAvailabilityPanel}
        onClose={() => setShowAvailabilityPanel(false)}
        className='m-4 max-w-190'
      >
        <div className='flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900'>
          <div className='border-b border-gray-100 px-6 py-5 pr-14 dark:border-gray-800'>
            <Badge color='primary' startIcon={<CalendarDays size={13} />}>
              Availability
            </Badge>
            <h2 className='mt-3 type-h4 font-bold text-gray-800 dark:text-white/90'>
              Weekly availability
            </h2>
            <p className='mt-1.5 type-small text-gray-500 dark:text-gray-400'>
              Choose active days and working hours for customer appointments.
            </p>
          </div>

          <div className='custom-scrollbar flex flex-col gap-4 overflow-y-auto p-6'>
            <BookingWindowEditor
              value={advanceDaysDraft}
              onChange={setAdvanceDaysDraft}
            />

            {availability.map((item) => (
              <div
                key={item.day_of_week}
                className={cn(
                  'grid grid-cols-1 items-center gap-3 rounded-xl border p-4 sm:grid-cols-[110px_70px_1fr]',
                  item.is_active
                    ? 'border-brand-100 bg-gray-50 dark:border-brand-500/20 dark:bg-white/3'
                    : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'type-small font-bold',
                    item.is_active
                      ? 'text-gray-800 dark:text-white/90'
                      : 'text-gray-400 dark:text-gray-600',
                  )}
                >
                  {DAYS[item.day_of_week]}
                </span>

                <button
                  type='button'
                  onClick={() =>
                    updateAvailability(item.day_of_week, {
                      is_active: !item.is_active,
                    })
                  }
                  className={cn(
                    'h-8.5 rounded-full type-caption font-bold transition',
                    item.is_active
                      ? 'bg-brand-500 text-white hover:bg-brand-600'
                      : 'bg-gray-100 text-gray-500 dark:bg-white/8 dark:text-gray-400',
                  )}
                >
                  {item.is_active ? 'ON' : 'OFF'}
                </button>

                <div className='grid grid-cols-[1fr_24px_1fr] items-center gap-2'>
                  <input
                    type='time'
                    value={item.start_time}
                    disabled={!item.is_active}
                    onChange={(e) =>
                      updateAvailability(item.day_of_week, {
                        start_time: e.target.value,
                      })
                    }
                    className={TIME_INPUT_CLASS}
                  />

                  <span className='text-center type-caption font-bold text-gray-300 dark:text-gray-600'>
                    to
                  </span>

                  <input
                    type='time'
                    value={item.end_time}
                    disabled={!item.is_active}
                    onChange={(e) =>
                      updateAvailability(item.day_of_week, {
                        end_time: e.target.value,
                      })
                    }
                    className={TIME_INPUT_CLASS}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className='flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800'>
            <Button
              variant='outline'
              onClick={() => setShowAvailabilityPanel(false)}
            >
              Discard
            </Button>

            <Button onClick={saveAvailability} disabled={savingAvailability}>
              <Save size={14} />
              {savingAvailability ? 'Saving...' : 'Save availability'}
            </Button>
          </div>
        </div>
      </Modal>

      {showCustomerInfoModal && (
        <CustomerInfoModal
          isDark={isDark}
          isMobile={isMobile}
          onClose={() => setShowCustomerInfoModal(false)}
          apiFetch={apiFetch}
        />
      )}
      </div>
    </RequireAuth>
  );
}