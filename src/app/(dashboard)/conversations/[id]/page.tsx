'use client';

import { RequireAuth } from '@/components/require-auth';
import { WebsiteActivityPanel } from '@/components/WebsiteActivityPanel';
import { apiFetch } from '@/lib/api';
import { resolveMoodForLead } from '@/lib/chat-classifiers';
import { useTheme } from '@/lib/theme-context';
import type { ApexOptions } from 'apexcharts';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  Users,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

type ConvoResp = {
  conversation: {
    id: number;
    channel: string;
    channel_id?: number;
    external_user_id: string;
    display_name?: string | null;
    status: string;
    created_at: string;
    last_message_at?: string | null;
    summary?: string | null;
    meta?: {
      video_id?: string;
      video_title?: string;
      video_thumbnail?: string;
      video_published_at?: string;
    } | null;
  };
  lead: null | {
    id: number;
    status: string;
    source: string;
    intent: string;
    service: string;
    contacts: { emails?: string[]; phones?: string[] };
    meta: {
      score?: number;
      triggers?: string[];
      text_preview?: string;
      mood?: { mood: string; emoji: string; color: string; label: string };
      instagram_profile?: {
        username?: string;
        profile_pic_url?: string;
        is_user_follow_business?: boolean;
      };
    };
  };
  messages: {
    id: number;
    role: string;
    content: string;
    created_at: string;
    latency_ms?: number | null;
    provider?: string;
  }[];
};

const PIPELINE = ['new', 'contacted', 'qualified', 'won', 'lost', 'onHold'];
const BRAND = '#465FFF';

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

type ChannelTheme = {
  logo: string;
  accent: string; // send button + active accents
  accentHover: string;
  bubble: string; // assistant/agent bubble bg
  bubbleText: string;
  ring: string; // input focus ring
};

const CHANNEL_THEME: Record<string, ChannelTheme> = {
  whatsapp: {
    logo: '/brand-logo/whatsapp.png',
    accent: 'bg-brand-500',
    accentHover: 'hover:bg-brand-600',
    bubble: 'bg-brand-500',
    bubbleText: 'text-white',
    ring: 'focus:border-brand-300 focus:ring-brand-500/10',
  },
  instagram: {
    logo: '/brand-logo/instagram.png',
    accent: 'bg-brand-500',
    accentHover: 'hover:bg-brand-600',
    bubble: 'bg-brand-500',
    bubbleText: 'text-white',
    ring: 'focus:border-brand-300 focus:ring-brand-500/10',
  },
  facebook: {
    logo: '/brand-logo/facebook.png',
    accent: 'bg-brand-500',
    accentHover: 'hover:bg-brand-600',
    bubble: 'bg-brand-500',
    bubbleText: 'text-white',
    ring: 'focus:border-brand-300 focus:ring-brand-500/10',
  },
  telegram: {
    logo: '/brand-logo/telegram.png',
    accent: 'bg-brand-500',
    accentHover: 'hover:bg-brand-600',
    bubble: 'bg-brand-500',
    bubbleText: 'text-white',
    ring: 'focus:border-brand-300 focus:ring-brand-500/10',
  },
  youtube: {
    logo: '/brand-logo/youtube.png',
    accent: 'bg-brand-500',
    accentHover: 'hover:bg-brand-600',
    bubble: 'bg-brand-500',
    bubbleText: 'text-white',
    ring: 'focus:border-brand-300 focus:ring-brand-500/10',
  },
  website: {
    logo: '/brand-logo/website.png',
    accent: 'bg-brand-500',
    accentHover: 'hover:bg-brand-600',
    bubble: 'bg-brand-500',
    bubbleText: 'text-white',
    ring: 'focus:border-brand-300 focus:ring-brand-500/10',
  },
};

function getChannelTheme(channel?: string | null): ChannelTheme {
  const key = (channel || '').toLowerCase();
  return CHANNEL_THEME[key] || CHANNEL_THEME.website;
}

function platformLabel(value?: string | null) {
  if (!value) return 'Channel';
  const labels: Record<string, string> = {
    instagram: 'Instagram',
    facebook: 'Facebook',
    telegram: 'Telegram',
    whatsapp: 'WhatsApp',
    youtube: 'YouTube',
    website: 'Website',
  };
  const key = value.toLowerCase();
  return labels[key] || value.charAt(0).toUpperCase() + value.slice(1);
}

function displayName(data?: ConvoResp | null) {
  const convo = data?.conversation;
  if (!convo) return 'Conversation';
  const name = convo.display_name?.trim();
  if (name) return convo.channel === 'website' ? name : `@${name}`;
  if (convo.channel === 'website') return `Website Visitor #${convo.id}`;
  const uid = convo.external_user_id || '';
  if (/^\d{10,}$/.test(uid)) return `User ${uid.slice(-8)}`;
  return uid || `${platformLabel(convo.channel)} User #${convo.id}`;
}

function initials(value: string) {
  return value
    .replace('@', '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatLatency(ms?: number | null) {
  if (ms == null) return 'Not available';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function statusClass(status?: string) {
  switch (status?.toLowerCase()) {
    case 'open':
      return 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500';
    case 'handoff':
      return 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400';
    case 'blocked':
      return 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80';
  }
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3 ${className}`}
    >
      {children}
    </div>
  );
}

function MessageMixChart({
  data,
  isDark,
}: {
  data: ConvoResp | null;
  isDark: boolean;
}) {
  const user =
    data?.messages.filter((message) => message.role === 'user').length ?? 0;
  const assistant =
    data?.messages.filter(
      (message) => message.role === 'assistant' && message.provider !== 'human',
    ).length ?? 0;
  const human =
    data?.messages.filter(
      (message) => message.role === 'assistant' && message.provider === 'human',
    ).length ?? 0;

  const options: ApexOptions = {
    chart: { type: 'donut', fontFamily: 'Outfit, sans-serif' },
    labels: ['Customer', 'AI', 'Agent'],
    colors: ['#465FFF', '#7592FF', '#9CB9FF'],
    legend: {
      position: 'bottom',
      labels: { colors: isDark ? '#98A2B3' : '#667085' },
    },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    plotOptions: { pie: { donut: { size: '70%' } } },
  };

  return (
    <Card className='px-3.5 py-3 sm:px-4 sm:py-3.5'>
      <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
        Message Mix
      </h3>
      <p className='mt-0.5 hidden type-caption text-gray-500 dark:text-gray-400 sm:block'>
        Manual, AI, and agent messages
      </p>
      <div className='-my-1'>
        <ReactApexChart
          options={options}
          series={[user, assistant, human]}
          type='donut'
          height={170}
        />
      </div>
    </Card>
  );
}

function LatencyChart({
  data,
  isDark,
}: {
  data: ConvoResp | null;
  isDark: boolean;
}) {
  const rows = (data?.messages || [])
    .filter((message) => message.latency_ms != null)
    .slice(-8)
    .map((message, index) => ({
      label: `#${index + 1}`,
      value: Math.round(((message.latency_ms || 0) / 1000) * 100) / 100,
    }));

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      fontFamily: 'Outfit, sans-serif',
    },
    colors: [BRAND],
    grid: { borderColor: isDark ? '#1F2937' : '#E5E7EB' },
    plotOptions: { bar: { borderRadius: 4, columnWidth: '44%' } },
    dataLabels: { enabled: false },
    xaxis: {
      categories: rows.map((row) => row.label),
      labels: { style: { colors: isDark ? '#98A2B3' : '#667085' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: isDark ? '#98A2B3' : '#667085' },
        formatter: (value) => `${value}s`,
      },
    },
    tooltip: { y: { formatter: (value) => `${value}s` } },
  };

  return (
    <Card className='px-3.5 py-3 sm:px-4 sm:py-3.5'>
      <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
        Response Latency
      </h3>
      <p className='mt-0.5 hidden type-caption text-gray-500 dark:text-gray-400 sm:block'>
        Recent AI response times
      </p>
      {rows.length > 0 ? (
        <div className='-my-1.5'>
          <ReactApexChart
            options={options}
            series={[{ name: 'Latency', data: rows.map((row) => row.value) }]}
            type='bar'
            height={160}
          />
        </div>
      ) : (
        <div className='flex h-35 items-center justify-center type-caption text-gray-500 dark:text-gray-400'>
          No latency data
        </div>
      )}
    </Card>
  );
}

function MessageBubble({
  message,
  theme,
}: {
  message: ConvoResp['messages'][number];
  theme: ChannelTheme;
}) {
  const fromCustomer = message.role === 'user';
  const fromHuman = message.provider === 'human';

  return (
    <div className={`flex ${fromCustomer ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 ${
          fromCustomer
            ? 'rounded-tl-md border border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300'
            : fromHuman
              ? 'rounded-tr-md bg-gray-800 text-white dark:bg-white/10'
              : `rounded-tr-md ${theme.bubble} ${theme.bubbleText}`
        }`}
      >
        <p className='whitespace-pre-wrap type-small leading-6'>
          {message.content}
        </p>
        <div
          className={`mt-2 flex items-center gap-2 type-caption ${fromCustomer ? 'text-gray-400' : 'text-white/70'}`}
        >
          <span>{formatDate(message.created_at)}</span>
          {message.latency_ms != null && (
            <span>{formatLatency(message.latency_ms)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className='mx-auto max-w-screen-2xl p-4 md:p-6'>
      <div className='h-[calc(100vh-150px)] animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5' />
    </div>
  );
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { isDark } = useTheme();
  const bottomRef = useRef<HTMLDivElement>(null);
  const rawId = params?.id;
  const id = Number(Array.isArray(rawId) ? rawId[0] : rawId);

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant',
    });
  }, [id]);

  const [data, setData] = useState<ConvoResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [leadStatus, setLeadStatus] = useState('new');
  const [savingStage, setSavingStage] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return;
    setErr(null);
    try {
      const response = await apiFetch<ConvoResp>(`/admin/conversations/${id}`, {
        auth: true,
      });
      setData(response);
      setLeadStatus(response.lead?.status || 'new');
      apiFetch(`/admin/conversations/${id}/mark-read`, {
        method: 'POST',
        auth: true,
      }).catch(() => {});
      // window.setTimeout(
      //   () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }),
      //   50,
      // );
    } catch (error) {
      setErr(errorMessage(error, 'Failed to load conversation'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function act(type: 'handoff' | 'reopen' | 'close') {
    setActionLoading(type);
    setErr(null);
    try {
      await apiFetch(`/admin/conversations/${id}/${type}`, {
        method: 'POST',
        auth: true,
      });
      await load();
    } catch (error) {
      setErr(errorMessage(error, `${type} failed`));
    } finally {
      setActionLoading(null);
    }
  }

  async function sendReply() {
    const content = replyText.trim();
    if (!content || sending) return;
    setSending(true);
    setErr(null);
    try {
      await apiFetch(`/admin/conversations/${id}/reply`, {
        method: 'POST',
        auth: true,
        body: { content },
      });
      setReplyText('');
      await load();
    } catch (error) {
      setErr(errorMessage(error, 'Send failed'));
    } finally {
      setSending(false);
    }
  }

  async function saveStage() {
    if (!data?.lead) return;
    setSavingStage(true);
    setErr(null);
    try {
      await apiFetch(`/admin/leads/${data.lead.id}/status`, {
        method: 'POST',
        auth: true,
        body: { status: leadStatus },
      });
      await load();
    } catch (error) {
      setErr(errorMessage(error, 'Save failed'));
    } finally {
      setSavingStage(false);
    }
  }

  const convo = data?.conversation;
  const lead = data?.lead;
  const messages = useMemo(() => data?.messages || [], [data?.messages]);
  const channelTheme = useMemo(
    () => getChannelTheme(convo?.channel),
    [convo?.channel],
  );

  const customerName = displayName(data);
  const profilePic = lead?.meta?.instagram_profile?.profile_pic_url;
  const isClosed = convo?.status === 'closed';
  const isHandoff = convo?.status === 'handoff';
  const avgLatency = useMemo(() => {
    const values = messages
      .map((message) => message.latency_ms)
      .filter((value): value is number => value != null);
    if (!values.length) return null;
    return Math.round(
      values.reduce((sum, value) => sum + value, 0) / values.length,
    );
  }, [messages]);
  const mood = useMemo(
    () =>
      resolveMoodForLead({
        storedMood: lead?.meta?.mood,
        text_preview: lead?.meta?.text_preview,
        triggers: lead?.meta?.triggers,
        intent: lead?.intent,
        messages,
      }),
    [lead, messages],
  );

  if (loading) {
    return (
      <RequireAuth>
        <DetailSkeleton />
      </RequireAuth>
    );
  }

  return (
    <RequireAuth>
      <div className='py-5'>
        <div className='mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-3'>
            <button
              type='button'
              onClick={() => router.push('/conversations')}
              className='flex h-9 w-9 items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400 dark:hover:bg-white/5'
              aria-label='Back to conversations'
            >
              <ArrowLeft className='h-4.5 w-4.5' />
            </button>
            <div>
              <h1 className='type-h3 font-semibold text-gray-800 dark:text-white/90'>
                Conversation Detail
              </h1>
              <p className='mt-1 type-caption text-gray-500 dark:text-gray-400'>
                Review messages, customer context, and lead stage.
              </p>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <button
              type='button'
              onClick={() => void load()}
              className='inline-flex h-9 items-center gap-1.5 rounded-(--radius-control) border border-gray-200 bg-white px-3.5 type-small font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300'
            >
              <RefreshCw className='h-4 w-4' />
              Refresh
            </button>
          </div>
        </div>

        {err && (
          <div className='mb-5 flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 type-small text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
            {err}
          </div>
        )}

        {/* Customer header card (compact — aligned inline metrics row) */}
        <Card className='mb-5 overflow-hidden px-5 py-4 sm:px-6'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex min-w-0 items-center gap-3.5'>
              <div className='relative h-11 w-11 shrink-0'>
                <div className='h-11 w-11 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-gray-800'>
                  {profilePic ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profilePic}
                      alt={customerName}
                      className='h-full w-full object-cover'
                    />
                  ) : (
                    <div className='flex h-full w-full items-center justify-center type-small font-semibold text-gray-700 dark:text-gray-300'>
                      {initials(customerName)}
                    </div>
                  )}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={channelTheme.logo}
                  alt={platformLabel(convo?.channel)}
                  className='absolute -bottom-0.5 -right-0.5 h-4.5 w-4.5 rounded-lg border-2 border-white bg-white object-contain dark:border-gray-900'
                />
              </div>
              <div className='min-w-0'>
                <div className='flex items-center gap-1.5'>
                  <h2 className='truncate type-card-title font-semibold text-gray-800 dark:text-white/90'>
                    {customerName}
                  </h2>
                  {lead?.meta?.score != null && (
                    <span className='shrink-0 rounded-full bg-brand-50 px-1.5 py-0 text-[10px] font-bold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'>
                      {lead.meta.score}
                    </span>
                  )}
                </div>
                <div className='mt-1 flex flex-wrap items-center gap-1.5'>
                  <span className='inline-flex items-center type-caption font-medium text-gray-500 dark:text-gray-400'>
                    {platformLabel(convo?.channel)}
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold capitalize ${statusClass(convo?.status)}`}
                  >
                    {convo?.status || 'unknown'}
                  </span>
                  {lead && (
                    <span className='inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-semibold capitalize text-gray-700 dark:bg-white/5 dark:text-gray-300'>
                      {lead.intent || 'Unclassified'}
                    </span>
                  )}
                  {lead && (
                    <span className='inline-flex items-center rounded-full bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold capitalize text-success-700 dark:bg-success-500/10 dark:text-success-400'>
                      {lead.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Metric tiles — 4 in a row, compact */}
            <div className='grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5'>
              <div className='rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2 dark:border-white/5 dark:bg-white/2'>
                <p className='type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                  Msgs
                </p>
                <p className='mt-0.5 type-small font-semibold text-gray-800 dark:text-white/90'>
                  {messages.length}
                </p>
              </div>
              <div className='rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2 dark:border-white/5 dark:bg-white/2'>
                <p className='type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                  Avg
                </p>
                <p className='mt-0.5 type-small font-semibold text-gray-800 dark:text-white/90'>
                  {avgLatency != null ? formatLatency(avgLatency) : '—'}
                </p>
              </div>
              <div className='rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2 dark:border-white/5 dark:bg-white/2'>
                <p className='type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                  Mood
                </p>
                <p className='mt-0.5 flex items-center gap-1 type-small font-semibold text-gray-800 dark:text-white/90'>
                  <span>{mood?.emoji || '🙂'}</span>
                  <span className='truncate'>{mood?.label || '—'}</span>
                </p>
              </div>
              <div className='rounded-xl border border-gray-100 bg-gray-50 px-2.5 py-2 dark:border-white/5 dark:bg-white/2'>
                <p className='type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                  Opened
                </p>
                <p className='mt-0.5 type-small font-semibold text-gray-800 dark:text-white/90'>
                  {formatDate(convo?.created_at)}
                </p>
              </div>
            </div>
          </div>

          {convo?.summary && (
            <div className='mt-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-white/5 dark:bg-white/2'>
              <p className='type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                Conversation summary
              </p>
              <p className='mt-1 type-caption leading-5.5 text-gray-700 dark:text-gray-300'>
                {convo.summary}
              </p>
            </div>
          )}
        </Card>

        {/* Main 2-col content: Messages (col-8) | stacked sidebar (col-4) */}
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-4'>
          <div className='lg:col-span-8'>
            <Card className='overflow-hidden'>
              {/* Messages header */}
              <div className='flex items-center justify-between border-b border-gray-100 px-5 py-2.5 dark:border-white/5 sm:px-6'>
                <div className='flex items-center gap-1.5'>
                  <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                    Messages
                  </h3>
                  <span className='rounded-full bg-gray-100 px-1.5 py-0 type-caption font-semibold text-gray-600 dark:bg-white/5 dark:text-gray-400'>
                    {messages.length}
                  </span>
                </div>
                <p className='hidden type-caption text-gray-500 dark:text-gray-400 sm:block'>
                  Last {formatDate(convo?.last_message_at)}
                </p>
              </div>

              {/* Messages body */}
              <div className='h-105 space-y-3 overflow-y-auto bg-gray-50 px-5 py-3.5 custom-scrollbar dark:bg-gray-900 sm:px-6'>
                {messages.length === 0 ? (
                  <div className='flex h-full items-center justify-center type-small text-gray-500 dark:text-gray-400'>
                    No messages found
                  </div>
                ) : (
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      theme={channelTheme}
                    />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Reply input + action buttons (compact inline) */}
              <div className='border-t border-gray-100 bg-white px-5 py-3 dark:border-white/5 dark:bg-white/3 sm:px-6 sm:py-3.5'>
                <div className='flex items-center gap-2'>
                  <input
                    type='text'
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        (event.metaKey || event.ctrlKey) &&
                        event.key === 'Enter' &&
                        !isHandoff
                      ) {
                        void sendReply();
                      }
                    }}
                    disabled={isHandoff}
                    placeholder={
                      isHandoff
                        ? 'Conversation handed off — use Back to AI to reply…'
                        : 'Message as agent…'
                    }
                    className={`h-9 min-w-0 flex-1 rounded-full border border-gray-300 bg-transparent px-4 type-caption font-medium text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 ${channelTheme.ring} ${isHandoff ? 'cursor-not-allowed opacity-60' : ''}`}
                  />
                  <button
                    type='button'
                    onClick={() => void sendReply()}
                    disabled={!replyText.trim() || sending || isHandoff}
                    className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full px-4 type-caption font-semibold text-white disabled:opacity-60 ${channelTheme.accent} ${channelTheme.accentHover} ${isHandoff ? 'cursor-not-allowed' : ''}`}
                  >
                    {sending ? (
                      <Loader2 className='h-3.5 w-3.5 animate-spin' />
                    ) : (
                      <Send className='h-3.5 w-3.5' />
                    )}
                    <span>Send</span>
                  </button>
                </div>

                <div className='mt-2.5 flex flex-wrap items-center gap-1.5'>
                  <button
                    type='button'
                    onClick={() => void act(isHandoff ? 'reopen' : 'handoff')}
                    disabled={Boolean(actionLoading)}
                    className='inline-flex h-8 items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-2.5 type-caption font-semibold text-success-700 disabled:opacity-60 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400'
                  >
                    {actionLoading === 'handoff' ||
                    actionLoading === 'reopen' ? (
                      <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin' />
                    ) : (
                      <Users className='h-3.5 w-3.5 shrink-0' />
                    )}
                    <span>{isHandoff ? 'Back to AI' : 'Handoff'}</span>
                  </button>
                  <button
                    type='button'
                    onClick={() => void act(isClosed ? 'reopen' : 'close')}
                    disabled={Boolean(actionLoading)}
                    className='inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 type-caption font-semibold text-gray-700 disabled:opacity-60 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300'
                  >
                    {actionLoading === 'close' || actionLoading === 'reopen' ? (
                      <Loader2 className='h-3.5 w-3.5 shrink-0 animate-spin' />
                    ) : (
                      <CheckCircle2 className='h-3.5 w-3.5 shrink-0' />
                    )}
                    <span>{isClosed ? 'Reopen' : 'Close'}</span>
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right sidebar: Message Mix + Pipeline (with Contacts inside) + Response Latency — fills column top-to-bottom */}
          <div className='grid grid-cols-1 content-start gap-3.5 lg:col-span-4'>
            <MessageMixChart data={data} isDark={isDark} />

            {/* Pipeline stage + Contacts inside (matching original: Contacts nested, not standalone) */}
            <Card className='px-3.5 py-3 sm:px-4 sm:py-3.5'>
              <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                Pipeline stage
              </h3>
              {lead ? (
                <>
                  <div className='mt-2.5 space-y-2'>
                    <div>
                      <select
                        value={leadStatus}
                        onChange={(event) => setLeadStatus(event.target.value)}
                        className='h-8.5 w-full rounded-(--radius-control) border border-gray-300 bg-transparent px-3 type-caption font-medium text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
                      >
                        {PIPELINE.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage.charAt(0).toUpperCase() + stage.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type='button'
                      onClick={() => void saveStage()}
                      disabled={savingStage || leadStatus === lead.status}
                      className='inline-flex h-8.5 w-full items-center justify-center gap-1.5 rounded-(--radius-control) bg-brand-500 px-3 type-caption font-semibold text-white shadow-theme-xs hover:bg-brand-600 disabled:opacity-60'
                    >
                      {savingStage && (
                        <Loader2 className='h-3.5 w-3.5 animate-spin' />
                      )}
                      Save stage
                    </button>
                  </div>
                  {lead.contacts.emails?.length ||
                  lead.contacts.phones?.length ? (
                    <div className='mt-2.5 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 dark:border-white/5 dark:bg-white/2'>
                      <p className='type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
                        Contacts
                      </p>
                      <div className='mt-1.5 space-y-1.5 type-caption'>
                        {lead.contacts.emails?.length ? (
                          <div className='space-y-0.5'>
                            {(lead.contacts.emails || []).map((email) => (
                              <p
                                key={email}
                                className='truncate font-medium text-gray-700 dark:text-gray-300'
                              >
                                {email}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        {lead.contacts.phones?.length ? (
                          <div className='space-y-0.5'>
                            {(lead.contacts.phones || []).map((phone) => (
                              <p
                                key={phone}
                                className='truncate font-medium text-gray-700 dark:text-gray-300'
                              >
                                {phone}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className='mt-2.5 flex items-start gap-2.5 rounded-xl border border-gray-100 bg-gray-50 p-2.5 dark:border-white/5 dark:bg-white/2'>
                  <ShieldAlert className='mt-0.5 h-3.5 w-3.5 text-gray-500 dark:text-gray-400' />
                  <p className='type-caption text-gray-500 dark:text-gray-400'>
                    No lead has been created.
                  </p>
                </div>
              )}
            </Card>

            <LatencyChart data={data} isDark={isDark} />
          </div>
        </div>

        {convo?.channel === 'website' && (
          <WebsiteActivityPanel
            conversationId={id}
            theme={{
              text: isDark ? '#F9FAFB' : '#101828',
              textSub: isDark ? '#D0D5DD' : '#344054',
              textMuted: isDark ? '#98A2B3' : '#667085',
              cardBg: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
              cardBorder: isDark ? '#1F2937' : '#E5E7EB',
              divider: isDark ? '#1F2937' : '#E5E7EB',
            }}
            isDark={isDark}
          />
        )}
      </div>
    </RequireAuth>
  );
}