'use client';
import { DateFilter } from '@/components/date-filter';
import { RequireAuth } from '@/components/require-auth';
import {
  ConversationLimitBanner,
  LockedAccountBanner,
} from '@/components/billing/FeatureGate';
import { apiFetch } from '@/lib/api';
import { resolveMoodForLead, type Mood } from '@/lib/chat-classifiers';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import type { ApexOptions } from 'apexcharts';
import {
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  Globe,
  Inbox,
  Mail,
  MessageSquare,
  Radio,
  Search,
  SlidersHorizontal,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import PageBreadcrumb from '@/components/common/PageBreadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  getPageItems,
  TablePagination,
} from '@/components/ui/table-pagination';
import { useOutsideClick } from '@/hooks/useOutsideClick';

const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

// ─── Types ────────────────────────────────────────────────────────────────────
type TopicItem = { topic: string; count: number };
type TimeseriesPoint = {
  bucket: string;
  messages: number;
  conversations: number;
  leads: number;
  errors: number;
};
type DepthItem = {
  bucket: string;
  count: number;
  avg_intent_msg: number | null;
  avg_lead_msg: number | null;
};
type LeadItem = {
  id: number;
  conversation_id: number;
  external_user_id: string;
  display_name?: string | null;
  profile_pic_url?: string | null;
  is_user_follow_business?: boolean | null;
  channel: string;
  channel_id?: number | null;
  status: string;
  source: string;
  intent: string;
  service: string;
  contacts: { emails?: string[]; phones?: string[] };
  meta: {
    instagram_profile?: {
      profile_pic_url?: string | null;
      is_user_follow_business?: boolean | null;
    };
    score?: number;
    triggers?: string[];
    text_preview?: string;
    mood?: Mood;
    urgency?: string;
    objections?: string[];
    last_text?: string;
    last_message?: string;
    latest_message?: string;
  };
  last_text?: string;
  last_message?: string;
  latest_message?: string;
  text_preview?: string;
  updated_at: string | null;
};

function getLeadLastText(lead: LeadItem, fallback = 'No message preview') {
  return (
    lead?.meta?.last_text ||
    lead?.meta?.last_message ||
    lead?.meta?.latest_message ||
    lead?.meta?.text_preview ||
    lead?.last_text ||
    lead?.last_message ||
    lead?.latest_message ||
    lead?.text_preview ||
    fallback
  );
}

// ─── Palette ─────────────────────────────────────────────────────────────────
// Pulled from the TailAdmin token scale in globals.css. Used only where a chart
// series/SVG fill or a computed inline style needs a real color value —
// everything else is styled with Tailwind classes + dark: variants.
const PALETTE = {
  brand: '#465FFF',
  brandLight: '#7592FF',
  violet: '#7A5AF8',
  blueLight: '#0BA5EC',
  success: '#12B76A',
  warning: '#F79009',
  orange: '#FB6514',
  error: '#F04438',
  pink: '#EE46BC',
  gray: '#98A2B3',
};

const AXIS_LABEL = { light: '#667085', dark: '#98A2B3' };
const GRID_LINE = { light: '#F2F4F7', dark: '#1D2939' };

const KnownChannels = [
  'instagram',
  'facebook',
  'whatsapp',
  'telegram',
  'youtube',
  'website',
  'google',
] as const;

// ─── Config ───────────────────────────────────────────────────────────────────
const REPORT_ENDPOINT = '/admin/stats/report/generate';

const TOPIC_CFG: Record<string, { color: string; label: string }> = {
  pricing: { color: PALETTE.orange, label: 'Pricing' },
  support: { color: PALETTE.error, label: 'Support' },
  demo: { color: PALETTE.blueLight, label: 'Demo' },
  complaint: { color: PALETTE.pink, label: 'Complaint' },
  integration: { color: PALETTE.violet, label: 'Integration' },
  general_interest: { color: PALETTE.gray, label: 'General' },
};

const URGENCY_CFG: Record<
  string,
  { color: 'error' | 'warning' | 'success' | 'light'; label: string }
> = {
  critical: { color: 'error', label: 'Critical' },
  high: { color: 'warning', label: 'High' },
  medium: { color: 'warning', label: 'Medium' },
  low: { color: 'success', label: 'Low' },
  none: { color: 'light', label: 'None' },
};

const PIPE_CFG: Record<string, { color: string; bg: string }> = {
  new: { color: PALETTE.blueLight, bg: `${PALETTE.blueLight}18` },
  contacted: { color: PALETTE.warning, bg: `${PALETTE.warning}18` },
  qualified: { color: PALETTE.violet, bg: `${PALETTE.violet}18` },
  won: { color: PALETTE.success, bg: `${PALETTE.success}18` },
  lost: { color: PALETTE.error, bg: `${PALETTE.error}18` },
};

const CHANNEL_CFG: Record<string, { color: string; logo: React.ReactNode }> = {
  instagram: {
    color: '#E4405F',
    logo: (
      <Image src='/instagram.svg' width={16} height={16} alt='Instagram' />
    ),
  },
  facebook: {
    color: '#1877F2',
    logo: <Image src='/facebook.svg' width={16} height={16} alt='Facebook' />,
  },
  whatsapp: {
    color: '#25D366',
    logo: <Image src='/whatsapp.svg' width={16} height={16} alt='WhatsApp' />,
  },
  telegram: {
    color: '#229ED9',
    logo: <Image src='/telegram.svg' width={16} height={16} alt='Telegram' />,
  },
  youtube: {
    color: '#FF0000',
    logo: <Image src='/youtube.svg' width={16} height={16} alt='YouTube' />,
  },
  google: {
    color: '#4285F4',
    logo: <Image src='/google-map.svg' width={16} height={16} alt='Google' />,
  },
  website: {
    color: '#465FFF',
    logo: (
      <Image
        src='/brand-logo/website.png'
        width={16}
        height={16}
        alt='Google'
      />
    ),
  },
};

const DEPTH_BUCKETS = [
  { key: '1-2', label: '1–2' },
  { key: '3-5', label: '3–5' },
  { key: '6-10', label: '6–10' },
  { key: '10+', label: '10+' },
];

const PIPELINE_STAGES = [
  { key: 'new', color: PALETTE.blueLight },
  { key: 'contacted', color: PALETTE.warning },
  { key: 'qualified', color: PALETTE.violet },
  { key: 'won', color: PALETTE.success },
  { key: 'lost', color: PALETTE.error },
];

type Segment = 'hot' | 'watching' | 'won' | 'cold';

const SEGMENT_CFG: Record<
  Segment,
  {
    label: string;
    color: string;
    bg: string;
    badge: 'warning' | 'success' | 'light' | 'error';
  }
> = {
  hot: {
    label: 'Hot',
    color: PALETTE.orange,
    bg: `${PALETTE.orange}18`,
    badge: 'warning',
  },
  watching: {
    label: 'Watching',
    color: PALETTE.warning,
    bg: `${PALETTE.warning}16`,
    badge: 'warning',
  },
  won: {
    label: 'Won',
    color: PALETTE.success,
    bg: `${PALETTE.success}16`,
    badge: 'success',
  },
  cold: {
    label: 'Cold',
    color: PALETTE.gray,
    bg: `${PALETTE.gray}14`,
    badge: 'light',
  },
};

// ─── Adapters ────────────────────────────────────────────────────────────────
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

function adaptOverview(raw: RawOverviewStats) {
  return {
    conversations: raw.total_conversations ?? raw.conversations ?? 0,
    messages: raw.total_messages ?? raw.messages ?? 0,
    leads: raw.total_leads ?? raw.leads ?? 0,
    errors: raw.total_errors ?? raw.errors ?? 0,
    handoffs: raw.total_handoffs ?? raw.handoffs ?? 0,
    avg_latency_ms: raw.avg_latency_ms ?? 0,
  };
}

type RawReturningStats = {
  total_returning?: number;
  total_returning_users?: number;
  avg_returns?: number;
  avg_returns_per_user?: number;
  return_rate?: number | null;
  return_rate_pct?: number;
};

function adaptReturning(raw: RawReturningStats) {
  return {
    total_returning: raw.total_returning ?? raw.total_returning_users ?? 0,
    avg_returns: Math.round(raw.avg_returns ?? raw.avg_returns_per_user ?? 0),
    return_rate:
      raw.return_rate != null
        ? raw.return_rate
        : (raw.return_rate_pct ?? 0) / 100,
  };
}

type RawTopicsResponse =
  | TopicItem[]
  | { primary_breakdown?: TopicItem[] }
  | null
  | undefined;

function adaptTopics(raw: RawTopicsResponse): TopicItem[] {
  if (Array.isArray(raw))
    return raw.map((r) => ({ topic: r.topic, count: r.count }));
  if (Array.isArray(raw?.primary_breakdown)) {
    return raw.primary_breakdown.map((r) => ({
      topic: r.topic,
      count: r.count,
    }));
  }
  return [];
}

type RawDepthResponse =
  | DepthItem[]
  | {
      depth_distribution?: Record<string, number>;
      avg_intent_detected_at_message?: number | null;
      avg_lead_created_at_message?: number | null;
    }
  | null
  | undefined;

function adaptDepth(raw: RawDepthResponse): DepthItem[] {
  if (Array.isArray(raw)) return raw;
  const dist = raw?.depth_distribution ?? {};
  const avgIntent = raw?.avg_intent_detected_at_message ?? null;
  const avgLead = raw?.avg_lead_created_at_message ?? null;
  return [
    {
      bucket: '1-2',
      count: dist['1_to_2'] ?? 0,
      avg_intent_msg: avgIntent,
      avg_lead_msg: avgLead,
    },
    {
      bucket: '3-5',
      count: dist['3_to_5'] ?? 0,
      avg_intent_msg: avgIntent,
      avg_lead_msg: avgLead,
    },
    {
      bucket: '6-10',
      count: dist['6_to_10'] ?? 0,
      avg_intent_msg: avgIntent,
      avg_lead_msg: avgLead,
    },
    {
      bucket: '10+',
      count: dist['over_10'] ?? 0,
      avg_intent_msg: avgIntent,
      avg_lead_msg: avgLead,
    },
  ];
}

type RawPipelineResponse = {
  by_status?: { status: string; count?: number }[];
  pipeline?: Record<string, number>;
  [key: string]: unknown;
};

type RawTimeseriesRow = {
  bucket?: string;
  t?: string;
  messages?: number;
  conversations?: number;
  leads?: number;
  errors?: number;
  v?: number;
};

type RawTimeseriesResponse =
  | RawTimeseriesRow[]
  | { points?: { t: string; v: number }[] }
  | null
  | undefined;

async function fetchTimeseries(
  auth: boolean,
  rangeQuery = '',
): Promise<TimeseriesPoint[]> {
  const base = '/admin/stats/timeseries';
  const opts = { auth };
  const extra = rangeQuery ? `&${rangeQuery}` : '';
  const [msgs, convs, leads, errs] = await Promise.allSettled([
    apiFetch<RawTimeseriesResponse>(
      `${base}?metric=messages&interval=hour${extra}`,
      opts,
    ),
    apiFetch<RawTimeseriesResponse>(
      `${base}?metric=conversations&interval=hour${extra}`,
      opts,
    ),
    apiFetch<RawTimeseriesResponse>(
      `${base}?metric=leads&interval=hour${extra}`,
      opts,
    ),
    apiFetch<RawTimeseriesResponse>(
      `${base}?metric=errors&interval=hour${extra}`,
      opts,
    ),
  ]);

  const pts = (
    res: PromiseSettledResult<RawTimeseriesResponse>,
  ): { t: string; v: number }[] => {
    if (res.status !== 'fulfilled') return [];
    const val = res.value;
    if (Array.isArray(val)) {
      return val.map((p) => ({
        t: p.bucket ?? p.t ?? '',
        v: p.messages ?? p.conversations ?? p.leads ?? p.errors ?? p.v ?? 0,
      }));
    }
    if (Array.isArray(val?.points)) return val.points;
    return [];
  };

  const toMap = (points: { t: string; v: number }[]) =>
    Object.fromEntries(points.map((p) => [p.t, p.v]));
  const mMap = toMap(pts(msgs));
  const cMap = toMap(pts(convs));
  const lMap = toMap(pts(leads));
  const eMap = toMap(pts(errs));
  const allBuckets = [
    ...new Set([
      ...Object.keys(mMap),
      ...Object.keys(cMap),
      ...Object.keys(lMap),
      ...Object.keys(eMap),
    ]),
  ].sort();

  return allBuckets.map((t) => ({
    bucket: t,
    messages: mMap[t] ?? 0,
    conversations: cMap[t] ?? 0,
    leads: lMap[t] ?? 0,
    errors: eMap[t] ?? 0,
  }));
}
// ─── Helpers ─────────────────────────────────────────────────────────────────
const num = (n: number | null | undefined, d = 0) =>
  n == null ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: d });
const pct = (n: number | null | undefined) =>
  n == null ? '—' : `${Math.round(n * 100)}%`;

const ago = (iso: string | null) => {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

const getLabel = (lead: LeadItem) => {
  if (lead.display_name) return `@${lead.display_name.replace(/^@/, '')}`;
  const uid = lead.external_user_id || '';
  if (/^\d{10,}$/.test(uid)) return `User ···${uid.slice(-6)}`;
  return uid.startsWith('@') ? uid : `@${uid}`;
};

const getInitials = (label: string) => {
  const c = label.replace(/^@/, '');
  return c.startsWith('User ···') ? 'IG' : c.slice(0, 2).toUpperCase();
};

const getHue = (label: string) =>
  [...label].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

const getSegment = (lead: LeadItem): Segment => {
  if (lead.status === 'won') return 'won';
  const score = lead.meta?.score ?? 0;
  const urgency = lead.meta?.urgency || 'none';
  if (score >= 7 || urgency === 'critical' || urgency === 'high') return 'hot';
  if (score >= 4) return 'watching';
  return 'cold';
};

const CARD =
  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3';

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(CARD, 'px-5 pb-5 pt-5 sm:px-6 sm:pt-6')}>
      <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
        {title}
      </h3>
      {subtitle && (
        <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
          {subtitle}
        </p>
      )}
      <div className='mt-5'>{children}</div>
    </div>
  );
}

// ─── Toolbar controls ────────────────────────────────────────────────────────

// type CustomerSortOption = 'name_asc' | 'name_desc' | 'score' | 'updated';

function CustomerTabControls({
  sortOption,
  sortDropdownOpen,
  setSortDropdownOpen,
  onSortChange,
  onExport,
}: {
  sortOption: CustomerSortOption;
  sortDropdownOpen: boolean;
  setSortDropdownOpen: (value: boolean) => void;
  onSortChange: (value: CustomerSortOption) => void;
  onExport: () => void;
}) {
  const sortLabel =
    sortOption === 'name_asc'
      ? 'A–Z'
      : sortOption === 'name_desc'
        ? 'Z–A'
        : 'Last Updated';

  const sortOptions: {
    label: string;
    value: CustomerSortOption;
  }[] = [
    { label: 'A–Z', value: 'name_asc' },
    { label: 'Z–A', value: 'name_desc' },
    { label: 'Last Updated', value: 'updated' },
  ];

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <div className='relative'>
        <button
          type='button'
          onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
          className='flex items-center gap-1.5 whitespace-nowrap rounded-(--radius-control) border border-gray-200 bg-white px-3.5 py-2 type-caption font-semibold text-gray-600 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
        >
          <span>Sort: {sortLabel}</span>

          <span
            className={cn(
              'type-caption transition-transform',
              sortDropdownOpen && 'rotate-180',
            )}
          >
            ▾
          </span>
        </button>

        {sortDropdownOpen && (
          <div className='absolute right-0 top-[calc(100%+6px)] z-30 min-w-40 overflow-hidden rounded-(--radius-control) border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900'>
            {sortOptions.map((option) => {
              const active = sortOption === option.value;

              return (
                <button
                  key={option.value}
                  type='button'
                  onClick={() => {
                    onSortChange(option.value);
                    setSortDropdownOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-between px-3.5 py-2 text-left type-caption font-medium transition',
                    active
                      ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/12 dark:text-brand-400'
                      : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/3',
                  )}
                >
                  <span>{option.label}</span>
                  {active && <Check size={12} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <Button variant='outline' size='sm' onClick={onExport}>
        <Download size={14} />
        Download CSV
      </Button>
    </div>
  );
}

function WeeklyReportButton() {
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);

  async function generateReport() {
    setReporting(true);
    setReportMsg(null);
    try {
      await apiFetch(REPORT_ENDPOINT, { method: 'POST', auth: true });
      setReportMsg('Report queued — check your email shortly');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('404')) setReportMsg(`404 — endpoint not found`);
      else setReportMsg(msg || 'Failed to generate report');
    } finally {
      setReporting(false);
      setTimeout(() => setReportMsg(null), 6000);
    }
  }

  return (
    <div className='flex flex-col items-end gap-1.5'>
      <Button onClick={generateReport} disabled={reporting} variant='outline'>
        {reporting ? 'Generating…' : 'Weekly Report'}
      </Button>
      {reportMsg && (
        <div className='max-w-55 text-right type-caption text-gray-500 dark:text-gray-400'>
          {reportMsg}
        </div>
      )}
    </div>
  );
}

// ─── Charts (ApexCharts, matching the reference EcommerceMetrics/MonthlySalesChart/
// StatisticsChart/MonthlyTarget styling exactly) ──────────────────────────────
function EngagementBarChart({
  data,
  isDark,
}: {
  data: { label: string; value: number }[];
  isDark: boolean;
}) {
  const options: ApexOptions = {
    colors: [PALETTE.brand],
    chart: {
      fontFamily: 'Outfit, sans-serif',
      type: 'bar',
      toolbar: { show: false },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: '45%',
        borderRadius: 5,
        borderRadiusApplication: 'end',
      },
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 4, colors: ['transparent'] },
    xaxis: {
      categories: data.map((d) => d.label),
      title: {
        text: 'Messages',
        style: {
          color: isDark ? AXIS_LABEL.dark : AXIS_LABEL.light,
          fontSize: '13px',
          fontWeight: 500,
        },
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: isDark ? AXIS_LABEL.dark : AXIS_LABEL.light,
          fontSize: '12px',
        },
      },
    },
    yaxis: {
      title: {
        text: 'Avg. Conversations per User',
        style: {
          color: isDark ? AXIS_LABEL.dark : AXIS_LABEL.light,
          fontSize: '13px',
          fontWeight: 500,
        },
      },
      labels: {
        formatter: (val: number) => Math.round(val).toString(),
        style: {
          colors: isDark ? AXIS_LABEL.dark : AXIS_LABEL.light,
          fontSize: '12px',
        },
      },
    },
    grid: {
      borderColor: isDark ? GRID_LINE.dark : GRID_LINE.light,
      yaxis: { lines: { show: true } },
    },
    fill: { opacity: 1 },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (val: number) => `${val} users` },
    },
  };

  const series = [{ name: 'Users', data: data.map((d) => d.value) }];

  return (
    <ReactApexChart options={options} series={series} type='bar' height={220} />
  );
}

function ActivityAreaChart({
  data,
  isDark,
}: {
  data: TimeseriesPoint[];
  isDark: boolean;
}) {
  const categories = data.map(
    (d) => formatActivityBucket(d.bucket) ?? d.bucket,
  );
  const options: ApexOptions = {
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'left',
      fontFamily: 'Outfit',
      labels: { colors: isDark ? AXIS_LABEL.dark : AXIS_LABEL.light },
    },
    colors: [PALETTE.brand, PALETTE.success, PALETTE.orange, PALETTE.error],
    chart: {
      fontFamily: 'Outfit, sans-serif',
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
    },
    stroke: { curve: 'smooth', width: 2 },
    fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0 } },
    markers: { size: 0, hover: { size: 5 } },
    grid: {
      borderColor: isDark ? GRID_LINE.dark : GRID_LINE.light,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    dataLabels: { enabled: false },
    tooltip: { theme: isDark ? 'dark' : 'light', x: { show: true } },
    xaxis: {
      type: 'category',
      categories,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: {
          colors: isDark ? AXIS_LABEL.dark : AXIS_LABEL.light,
          fontSize: '11px',
        },
      },
    },
    yaxis: {
      labels: {
        style: {
          colors: isDark ? AXIS_LABEL.dark : AXIS_LABEL.light,
          fontSize: '11px',
        },
      },
    },
  };
  const series = [
    { name: 'Messages', data: data.map((d) => d.messages) },
    { name: 'Conversations', data: data.map((d) => d.conversations) },
    { name: 'Leads', data: data.map((d) => d.leads) },
    { name: 'Knowledge Gap', data: data.map((d) => d.errors) },
  ];
  return (
    <ReactApexChart
      options={options}
      series={series}
      type='area'
      height={300}
    />
  );
}

const DEFAULT_DONUT_COLORS = [
  '#465FFF', // brand
  '#12B76A', // green
  '#F79009', // orange
  '#F04438', // red
  '#7A5AF8', // purple
  '#0BA5EC', // blue
  '#EE46BC', // pink
  '#F7B027', // amber
  '#2ED3B7', // teal
  '#875BF7', // violet
  '#FB6514', // deep orange
  '#36BFFA', // sky
];

const TOPIC_FALLBACK_COLORS = [
  '#12B76A', // green
  '#F79009', // orange
  '#7A5AF8', // purple
  '#0BA5EC', // blue
  '#EE46BC', // pink
  '#F7B027', // amber
  '#2ED3B7', // teal
  '#875BF7', // violet
  '#FB6514', // deep orange
  '#36BFFA', // sky
  '#667085', // gray (last resort)
];

function fallbackColorForTopic(topic: string) {
  // stable hash so the same topic always gets the same color
  const hash = topic.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return TOPIC_FALLBACK_COLORS[hash % TOPIC_FALLBACK_COLORS.length];
}

function TopicDonutChart({
  data,
  isDark,
}: {
  data: { label: string; value: number; color?: string }[];
  isDark: boolean;
}) {
  const colors = data.map(
    (d, i) => d.color ?? DEFAULT_DONUT_COLORS[i % DEFAULT_DONUT_COLORS.length],
  );

  const options: ApexOptions = {
    chart: { type: 'donut', fontFamily: 'Outfit, sans-serif' },
    labels: data.map((d) => d.label),
    colors,
    legend: {
      position: 'bottom',
      fontFamily: 'Outfit',
      labels: { colors: isDark ? AXIS_LABEL.dark : AXIS_LABEL.light },
    },
    dataLabels: { enabled: false },
    stroke: { show: false, colors: [isDark ? '#0C111D' : '#FFFFFF'] },
    tooltip: { theme: isDark ? 'dark' : 'light' },
    plotOptions: {
      pie: {
        donut: {
          size: '65%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              color: isDark ? '#F9FAFB' : '#101828',
            },
          },
        },
      },
    },
  };

  const series = data.map((d) => d.value);

  return (
    <ReactApexChart
      options={options}
      series={series}
      type='donut'
      height={280}
    />
  );
}

function ConversionGauge({
  value,
  isDark,
}: {
  value: number;
  isDark: boolean;
}) {
  const options: ApexOptions = {
    colors: [PALETTE.brand],
    chart: {
      fontFamily: 'Outfit, sans-serif',
      type: 'radialBar',
      sparkline: { enabled: true },
    },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        hollow: { size: '70%' },
        track: {
          background: isDark ? '#1D2939' : '#E4E7EC',
          strokeWidth: '100%',
          margin: 5,
        },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: '30px',
            fontWeight: 700,
            offsetY: -8,
            color: isDark ? '#F9FAFB' : '#1D2939',
            formatter: (val) => `${val}%`,
          },
        },
      },
    },
    fill: { type: 'solid', colors: [PALETTE.brand] },
    stroke: { lineCap: 'round' },
    labels: ['Conversion'],
  };
  const series = [value];
  return (
    <ReactApexChart
      options={options}
      series={series}
      type='radialBar'
      height={260}
    />
  );
}

// ─── Shared atoms ────────────────────────────────────────────────────────────
function MetricCard({
  label,
  value,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'error' | 'gray';
}) {
  const toneClass: Record<string, string> = {
    brand:
      'bg-brand-50 text-brand-500 dark:bg-brand-500/12 dark:text-brand-400',
    success:
      'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
    warning:
      'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400',
    error:
      'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <div className={cn(CARD, 'p-6 md:p-6')}>
      <div
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-xl',
          toneClass[tone],
        )}
      >
        {icon}
      </div>
      <div className='mt-5'>
        <span className='type-small text-gray-500 dark:text-gray-400'>
          {label}
        </span>
        <h4 className='mt-2 text-title-sm font-bold text-gray-800 dark:text-white/90'>
          {value}
        </h4>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className='flex flex-col items-center py-8 text-center'>
      <Inbox size={26} className='mb-2 text-gray-300 dark:text-gray-700' />
      <p className='type-small text-gray-400 dark:text-gray-500'>{label}</p>
    </div>
  );
}

// ─── Customer ID Card ────────────────────────────────────────────────────────
function CustomerTableRow({
  lead,
  onClick,
  isDark,
}: {
  lead: LeadItem;
  onClick: () => void;
  isDark: boolean;
}) {
  const label = getLabel(lead);
  const ini = getInitials(label);
  const hue = getHue(label);
  const profilePic =
    lead.profile_pic_url ||
    lead.meta?.instagram_profile?.profile_pic_url ||
    null;
  const seg = getSegment(lead);
  const segCfg = SEGMENT_CFG[seg];
  const pipeCfg = PIPE_CFG[lead.status] || PIPE_CFG.new;
  const phone = lead.contacts?.phones?.[0] || '';
  const email = lead.contacts?.emails?.[0] || '';
  const preview = getLeadLastText(lead);
  const conversationHref = `/conversations/${lead.conversation_id}`;

  return (
    <tr
      onClick={onClick}
      className='cursor-pointer transition hover:bg-gray-50 dark:hover:bg-white/2'
    >
      <td className='px-5 py-3 sm:px-6'>
        <div className='flex items-center gap-3'>
          {profilePic ? (
            <img
              src={profilePic}
              alt={label}
              className='h-9 w-9 shrink-0 rounded-full object-cover'
            />
          ) : (
            <div
              className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full type-caption font-semibold'
              style={{
                background: isDark
                  ? `hsla(${hue},40%,28%,0.50)`
                  : `hsl(${hue},35%,94%)`,
                color: isDark ? `hsl(${hue},55%,72%)` : `hsl(${hue},45%,38%)`,
                border: `1px solid ${isDark ? `hsla(${hue},40%,50%,0.20)` : `hsla(${hue},40%,65%,0.30)`}`,
              }}
            >
              {ini}
            </div>
          )}
          <div className='min-w-0'>
            <span className='group relative block max-w-55 type-small font-medium text-gray-800 dark:text-white/90'>
              <span className='block truncate'>{label}</span>
              <span className='pointer-events-none absolute left-0 top-full z-50 mt-1 hidden max-w-70 group-hover:block'>
                <span className='absolute -top-1 left-3 h-2 w-2 rotate-45 rounded-xs bg-gray-900' />
                <span className='relative block rounded-(--radius-control) bg-gray-900 px-3 py-1.5 type-caption font-medium text-white shadow-lg'>
                  {label}
                </span>
              </span>
            </span>
            <span className='mt-1 block max-w-65 truncate type-caption text-gray-500 dark:text-gray-400'>
              {preview}
            </span>
          </div>
        </div>
      </td>

      <td className='px-6 py-3'>
        <span className='inline-flex items-center gap-2 type-small text-gray-700 dark:text-gray-300'>
          {CHANNEL_CFG[(lead.channel || '').toLowerCase()]?.logo || (
            <Globe size={16} className='text-gray-400 dark:text-gray-500' />
          )}
          <span className='truncate'>
            {lead.channel
              ? lead.channel.charAt(0).toUpperCase() + lead.channel.slice(1)
              : 'Channel'}
          </span>
        </span>
      </td>

      <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
        <span className='block max-w-50 truncate'>{email || '-'}</span>
      </td>

      <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
        {phone || '-'}
      </td>

      <td className='px-6 py-3 type-small capitalize text-gray-500 dark:text-gray-400'>
        <span style={{ color: pipeCfg.color }}>{lead.status || 'new'}</span>
      </td>

      <td className='px-6 py-3'>
        <Badge color={segCfg.badge}>{segCfg.label}</Badge>
      </td>

      <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
        {ago(lead.updated_at)}
      </td>

      <td className='px-6 py-3'>
        <Link
          href={conversationHref}
          onClick={(event) => event.stopPropagation()}
          className='inline-flex h-8 items-center gap-2 whitespace-nowrap rounded-(--radius-control) bg-brand-500 px-3 type-small font-medium text-white shadow-theme-xs hover:bg-brand-600'
        >
          <Eye size={14} />
          View conversation
        </Link>
      </td>
    </tr>
  );
}
function InfoItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className='min-w-0'>
      <p className='mb-1.5 type-caption leading-normal text-gray-500 dark:text-gray-400'>
        {label}
      </p>
      <p
        className={cn(
          'truncate type-small font-medium',
          !color && 'text-gray-800 dark:text-white/90',
        )}
        style={color ? { color } : undefined}
      >
        {value}
      </p>
    </div>
  );
}

// ─── Customer Modal ──────────────────────────────────────────────────────────
function getMoodEmoji(label?: string) {
  const mood = (label || '').toLowerCase();

  if (mood.includes('happy') || mood.includes('positive')) return '😊';
  if (mood.includes('excited')) return '🤩';
  if (mood.includes('interested') || mood.includes('curious')) return '🤔';
  if (mood.includes('neutral')) return '😐';
  if (mood.includes('confused')) return '😕';
  if (mood.includes('frustrated')) return '😣';
  if (mood.includes('angry') || mood.includes('negative')) return '😠';
  if (mood.includes('sad')) return '😔';

  return '💬';
}

function CustomerModal({
  lead,
  onClose,
  isDark,
}: {
  lead: LeadItem;
  onClose: () => void;
  isDark: boolean;
}) {
  const label = getLabel(lead);
  const ini = getInitials(label);
  const hue = getHue(lead.external_user_id || label);

  const profilePic =
    lead.profile_pic_url ||
    lead.meta?.instagram_profile?.profile_pic_url ||
    null;

  const seg = getSegment(lead);
  const segCfg = SEGMENT_CFG[seg];
  const pipeCfg = PIPE_CFG[lead.status] || PIPE_CFG.new;

  const urgency = lead.meta?.urgency || 'none';
  const urgCfg = URGENCY_CFG[urgency] || URGENCY_CFG.none;

  const emails = lead.contacts?.emails || [];
  const phones = lead.contacts?.phones || [];
  const lastText = getLeadLastText(lead, '');

  const mood = resolveMoodForLead({
    storedMood: lead.meta?.mood,
    text_preview: lastText,
    triggers: lead.meta?.triggers,
    intent: lead.intent,
  });

  const moodEmoji = getMoodEmoji(mood.label);

  const objections = lead.meta?.objections || [];

  const customTriggers = (lead.meta?.triggers || [])
    .filter((trigger) => trigger.startsWith('custom:'))
    .map((trigger) => trigger.replace('custom:', ''));

  const builtinTriggers = (lead.meta?.triggers || [])
    .filter(
      (trigger) =>
        !trigger.startsWith('custom:') && !trigger.startsWith('contact:'),
    )
    .map((trigger) =>
      trigger.replace(/^(intent|service):/, '').replace(/\(\d+\)$/, ''),
    );

  const [copied, setCopied] = useState<string | null>(null);

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);

      setTimeout(() => {
        setCopied(null);
      }, 1800);
    });
  };

  return (
    <Modal isOpen onClose={onClose} className='m-4 max-w-175'>
      <div className='no-scrollbar relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-(--radius-panel) bg-white dark:bg-gray-900'>
        {/* Header */}
        <div className='flex flex-col items-center gap-4 border-b border-gray-100 px-6 pb-6 pr-14 pt-8 dark:border-gray-800 sm:flex-row sm:items-center sm:text-left'>
          {profilePic ? (
            <img
              src={profilePic}
              alt={label}
              className='h-20 w-20 shrink-0 rounded-full border border-gray-200 object-cover dark:border-gray-800'
            />
          ) : (
            <div
              className='flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-gray-200 type-card-title font-bold dark:border-gray-800'
              style={{
                background: isDark
                  ? `hsla(${hue},40%,28%,0.50)`
                  : `hsl(${hue},35%,94%)`,
                color: isDark ? `hsl(${hue},55%,72%)` : `hsl(${hue},45%,38%)`,
              }}
            >
              {ini}
            </div>
          )}

          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center justify-center gap-2 sm:justify-start'>
              <h4 className='truncate type-card-title font-semibold text-gray-800 dark:text-white/90'>
                {label}
              </h4>

              <span
                className='inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-gray-200 bg-gray-50 px-2 text-lg dark:border-gray-700 dark:bg-gray-800'
                title={mood.label}
                aria-label={`Mood: ${mood.label}`}
              >
                {moodEmoji}
              </span>
            </div>

            <div className='mt-2 flex flex-wrap items-center justify-center gap-2 sm:justify-start'>
              <span className='inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'>
                {CHANNEL_CFG[(lead.channel || '').toLowerCase()]?.logo || (
                  <Globe
                    size={14}
                    className='text-gray-400 dark:text-gray-500'
                  />
                )}
              </span>

              <span
                className='w-fit rounded-full px-3 py-0.5 type-caption font-medium capitalize'
                style={{
                  color: pipeCfg.color,
                  background: pipeCfg.bg,
                }}
              >
                {lead.status || 'new'}
              </span>

              <Badge color={segCfg.badge}>{segCfg.label}</Badge>
            </div>

            <div className='mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:justify-start'>
              <div className='flex min-w-0 items-center gap-1.5'>
                <Mail
                  size={12}
                  className='shrink-0 text-gray-400 dark:text-gray-500'
                />

                <span className='max-w-52.5 truncate type-caption text-gray-500 dark:text-gray-400'>
                  {emails[0] || 'No email'}
                </span>

                {emails[0] && (
                  <button
                    type='button'
                    onClick={() => copyText(emails[0], 'email')}
                    className='shrink-0 text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                  >
                    {copied === 'email' ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                )}
              </div>

              <div className='flex min-w-0 items-center gap-1.5'>
                <span className='max-w-45 truncate type-caption text-gray-500 dark:text-gray-400'>
                  {phones[0] || 'No phone'}
                </span>

                {phones[0] && (
                  <button
                    type='button'
                    onClick={() => copyText(phones[0], 'phone')}
                    className='shrink-0 text-gray-400 transition hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                  >
                    {copied === 'phone' ? (
                      <Check size={12} />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                )}
              </div>

              <div className='flex items-center gap-1.5'>
                <Clock
                  size={12}
                  className='shrink-0 text-gray-400 dark:text-gray-500'
                />

                <span className='type-caption text-gray-500 dark:text-gray-400'>
                  Last active {ago(lead.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className='custom-scrollbar flex-1 overflow-y-auto px-6 py-6'>
          {lastText && (
            <div className='mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/3'>
              <p className='mb-1 type-caption text-gray-500 dark:text-gray-400'>
                Last message
              </p>

              <p className='type-small italic leading-relaxed text-gray-700 dark:text-gray-300'>
                &ldquo;{lastText}&rdquo;
              </p>
            </div>
          )}

          <h5 className='mb-4 type-body font-medium text-gray-800 dark:text-white/90'>
            Engagement
          </h5>

          <div className='grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-3'>
            <InfoItem
              label='Source'
              value={(lead.source || '—').replace(/_/g, ' ')}
            />

            <InfoItem
              label='Service'
              value={(lead.service || '—').replace(/_/g, ' ')}
            />

            <InfoItem
              label='Intent'
              value={(lead.intent || '—').replace(/_/g, ' ')}
            />
          </div>

          <div className='my-6 h-px bg-gray-100 dark:bg-gray-800' />

          <h5 className='mb-4 type-body font-medium text-gray-800 dark:text-white/90'>
            Signals
          </h5>

          <div className='grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-3'>
            <div className='min-w-0'>
              <p className='mb-1.5 type-caption leading-normal text-gray-500 dark:text-gray-400'>
                Mood
              </p>

              <div className='flex items-center gap-2'>
                <span className='text-xl leading-none' aria-hidden='true'>
                  {moodEmoji}
                </span>

                <span
                  className='truncate type-small font-medium'
                  style={{ color: mood.color }}
                >
                  {mood.label}
                </span>
              </div>
            </div>

            <div>
              <p className='mb-1.5 type-caption leading-normal text-gray-500 dark:text-gray-400'>
                Urgency
              </p>

              <Badge color={urgCfg.color}>{urgCfg.label}</Badge>
            </div>

            <InfoItem
              label='Objections'
              value={
                objections.length > 0 ? `${objections.length} detected` : 'None'
              }
              color={objections.length > 0 ? PALETTE.error : undefined}
            />
          </div>

          {(customTriggers.length > 0 || builtinTriggers.length > 0) && (
            <div className='mt-6'>
              <p className='mb-2.5 type-caption leading-normal text-gray-500 dark:text-gray-400'>
                Keywords &amp; Triggers
              </p>

              <div className='flex flex-wrap gap-2'>
                {customTriggers.map((keyword) => (
                  <Badge key={keyword} color='warning'>
                    {keyword}
                  </Badge>
                ))}

                {Array.from(new Set(builtinTriggers))
                  .slice(0, 8)
                  .map((trigger) => (
                    <Badge key={`builtin-${trigger}`} color='light'>
                      {trigger.replace(/_/g, ' ')}
                    </Badge>
                  ))}
              </div>
            </div>
          )}

          {objections.length > 0 && (
            <div className='mt-6'>
              <p className='mb-2.5 type-caption leading-normal text-gray-500 dark:text-gray-400'>
                Sales Objections
              </p>

              <div className='flex flex-wrap gap-2'>
                {objections.map((objection) => (
                  <Badge key={objection} color='error'>
                    {objection}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className='mt-6'>
            <p className='mb-3 type-caption leading-normal text-gray-500 dark:text-gray-400'>
              Pipeline Progress
            </p>

            <div className='flex gap-1.5'>
              {['new', 'contacted', 'qualified', 'won'].map((stage) => {
                const stageConfig = PIPE_CFG[stage] || PIPE_CFG.new;

                const order = ['new', 'contacted', 'qualified', 'won'];

                const currentStageIndex = order.indexOf(lead.status);

                const stageIndex = order.indexOf(stage);

                const done =
                  currentStageIndex >= 0 && stageIndex <= currentStageIndex;

                return (
                  <div key={stage} className='flex-1'>
                    <div
                      className='mb-1.5 h-1.5 rounded-full'
                      style={{
                        background: done
                          ? stageConfig.color
                          : isDark
                            ? 'rgba(255,255,255,.08)'
                            : 'rgba(15,23,42,.08)',
                      }}
                    />

                    <div
                      className='type-caption font-medium capitalize'
                      style={{
                        color: done
                          ? stageConfig.color
                          : isDark
                            ? 'rgba(255,255,255,.28)'
                            : 'rgba(15,23,42,.32)',
                      }}
                    >
                      {stage}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800'>
          <Button variant='outline' onClick={onClose}>
            Close
          </Button>

          <Link
            href={`/conversations/${lead.conversation_id}`}
            onClick={onClose}
          >
            <Button>Open Conversation</Button>
          </Link>
        </div>
      </div>
    </Modal>
  );
}


// ─── Customers Tab
// type CustomerSortOption =
//   | 'name_asc'
//   | 'name_desc'
//   | 'score_asc'
//   | 'score_desc'
//   | 'updated_asc'
//   | 'updated_desc';
// ───────────────────────────────────────────────────────────
function CustomersTab({
  isDark,
  sortOption,
  exportTrigger,
}: {
  isDark: boolean;
  sortOption: CustomerSortOption;
  exportTrigger: number;
}) {
  type CustomerSegment = 'total' | 'active' | 'trending' | 'dormant';
  type CustomerFilterKey = 'channel' | 'contact';

  const SEGMENT_CFG_TAB: Record<
    CustomerSegment,
    { label: string; description: string }
  > = {
    total: {
      label: 'Total Contacts',
      description: 'All captured contacts',
    },
    active: {
      label: 'Active Conversations',
      description: 'Updated in the last 7 days',
    },
    trending: {
      label: 'Trending Contacts',
      description: 'Score 7 or higher',
    },
    dormant: {
      label: 'Dormant Leads',
      description: 'Inactive for more than 7 days',
    },
  };

  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<LeadItem | null>(null);
  const [segFilter, setSegFilter] = useState<CustomerSegment>('total');

  // Empty array means all channels.
  const [chanFilter, setChanFilter] = useState<string[]>([]);

  const [search, setSearch] = useState('');
  const [debQ, setDebQ] = useState('');
  const [customersPage, setCustomersPage] = useState(1);
  const [openFilter, setOpenFilter] = useState<CustomerFilterKey | null>(null);

  const channelFilterRef = useRef<HTMLDivElement>(null);
  const contactFilterRef = useRef<HTMLDivElement>(null);

  const LIMIT = 30;
  const ACTIVE_DAYS = 7;
  const TRENDING_SCORE = 7;

  useOutsideClick(
    channelFilterRef,
    () => setOpenFilter(null),
    openFilter === 'channel',
  );

  useOutsideClick(
    contactFilterRef,
    () => setOpenFilter(null),
    openFilter === 'contact',
  );

  const isActiveLead = useCallback(
    (lead: LeadItem) =>
      Boolean(
        lead.updated_at &&
        (Date.now() - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24) <=
          ACTIVE_DAYS,
      ),
    [],
  );

  const isDormantLead = useCallback(
    (lead: LeadItem) => !lead.updated_at || !isActiveLead(lead),
    [isActiveLead],
  );

  const segmentMatches = useCallback(
    (lead: LeadItem) => {
      if (segFilter === 'total') return true;
      if (segFilter === 'active') return isActiveLead(lead);

      if (segFilter === 'trending') {
        return (lead.meta?.score ?? 0) >= TRENDING_SCORE;
      }

      return isDormantLead(lead);
    },
    [isActiveLead, isDormantLead, segFilter],
  );

  const segCounts = useMemo(
    () => ({
      total: leads.length,
      active: leads.filter(isActiveLead).length,
      trending: leads.filter(
        (lead) => (lead.meta?.score ?? 0) >= TRENDING_SCORE,
      ).length,
      dormant: leads.filter(isDormantLead).length,
    }),
    [isActiveLead, isDormantLead, leads],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebQ(search);
    }, 320);

    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(
    async (off = 0) => {
      setLoading(true);

      try {
        const qs = new URLSearchParams();

        qs.set('limit', String(LIMIT));
        qs.set('offset', String(off));

        if (debQ.trim()) {
          qs.set('q', debQ.trim());
        }

        /*
         * Do not send one channel to the backend because the UI now supports
         * multiple selected channels. The loaded results are filtered below.
         */
        const data = await apiFetch<{
          items: LeadItem[];
          total: number;
        }>(`/admin/leads?${qs}`, {
          auth: true,
        });

        setLeads(data.items || []);
      } finally {
        setLoading(false);
      }
    },
    [debQ],
  );

  useEffect(() => {
    // Fetch on mount and again whenever the debounced search query changes
    // (`load` is recreated when `debQ` changes). This is a standard
    // fetch-on-dependency-change effect; `load`'s synchronous
    // `setLoading(true)` at the top of an async fetch is the correct place
    // for a loading flag, not a derive-state-from-render antipattern, so
    // the newer set-state-in-effect check is a false positive here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(0);
  }, [load]);

  const channels = useMemo<string[]>(() => {
    const leadChannels = leads
      .map((lead) => lead.channel?.trim().toLowerCase())
      .filter((channel): channel is string => Boolean(channel));

    return Array.from(
      new Set<string>([...KnownChannels, ...leadChannels]),
    ).sort((a, b) => a.localeCompare(b));
  }, [leads]);

  const channelCounts = useMemo(
    () =>
      leads.reduce<Record<string, number>>((acc, lead) => {
        const channel = (lead.channel || 'unknown').toLowerCase();

        acc[channel] = (acc[channel] || 0) + 1;

        return acc;
      }, {}),
    [leads],
  );

  const toggleChannel = (channel: string) => {
    setChanFilter((current) =>
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel],
    );
  };

  const displayed = useMemo(() => {
    const list = leads.filter(segmentMatches).filter((lead) => {
      if (chanFilter.length === 0) return true;

      return chanFilter.includes((lead.channel || '').toLowerCase());
    });

    return [...list].sort((a, b) => {
      switch (sortOption) {
        case 'name_asc':
          return getLabel(a).localeCompare(getLabel(b), undefined, {
            sensitivity: 'base',
            numeric: true,
          });

        case 'name_desc':
          return getLabel(b).localeCompare(getLabel(a), undefined, {
            sensitivity: 'base',
            numeric: true,
          });

        case 'score_asc':
          return (a.meta?.score ?? 0) - (b.meta?.score ?? 0);

        case 'score_desc':
          return (b.meta?.score ?? 0) - (a.meta?.score ?? 0);

        // case 'updated_asc':
        //   return (
        //     new Date(a.updated_at || 0).getTime() -
        //     new Date(b.updated_at || 0).getTime()
        //   );

        // case 'updated_desc':
        default:
          return (
            new Date(b.updated_at || 0).getTime() -
            new Date(a.updated_at || 0).getTime()
          );
      }
    });
  }, [leads, segmentMatches, chanFilter, sortOption]);

  const pagedDisplayed = getPageItems(displayed, customersPage);

  const activeContactFilter = SEGMENT_CFG_TAB[segFilter];

  const activeChannelLabel =
    chanFilter.length === 0
      ? 'All channels'
      : chanFilter.length === 1
        ? chanFilter[0].charAt(0).toUpperCase() + chanFilter[0].slice(1)
        : `${chanFilter.length} channels`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCustomersPage(1);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [chanFilter, debQ, displayed.length, segFilter, sortOption]);

  const displayedRef = useRef<LeadItem[]>(displayed);

  useEffect(() => {
    displayedRef.current = displayed;
  }, [displayed]);

  useEffect(() => {
    const customersToExport = displayedRef.current;
    if (exportTrigger === 0 || !customersToExport.length) return;

    const headers = [
      'Name',
      'Channel',
      'Score',
      'Pipeline',
      'Intent',
      'Last Updated',
    ];

    const rows = customersToExport.map((lead) => [
      `"${lead.display_name || lead.external_user_id}"`,
      lead.channel,
      lead.meta?.score ?? 0,
      lead.status,
      lead.intent || '',
      lead.updated_at || 'N/A',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.setAttribute('download', `customers_export_${Date.now()}.csv`);

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }, [exportTrigger]);

  return (
    <>
      {modal && (
        <CustomerModal
          lead={modal}
          onClose={() => setModal(null)}
          isDark={isDark}
        />
      )}

      <div className='min-w-0 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3'>
        <div className='flex flex-col gap-2 border-b border-gray-100 px-5 py-5 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
          <h3 className='type-body font-semibold text-gray-800 dark:text-white/90'>
            Customers
          </h3>

          <div className='type-small font-medium text-gray-500 dark:text-gray-400'>
            {displayed.length} contacts
          </div>
        </div>

        <div className='min-w-0 px-5 py-5 sm:px-6'>
          <div className='flex flex-col gap-4 rounded-t-xl border border-b-0 border-gray-200 bg-white px-5 py-4 dark:border-white/5 dark:bg-white/1 lg:flex-row lg:items-center lg:justify-between'>
            <div>
              <h4 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                {activeContactFilter.label}
              </h4>

              <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                {activeContactFilter.description}
              </p>
            </div>

            <div className='flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end'>
              <div className='relative w-full sm:w-67.5'>
                <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400' />

                <input
                  type='search'
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Search name, intent, service'
                  className='h-10 w-full rounded-(--radius-control) border border-gray-300 bg-white py-2 pl-11 pr-4 type-small text-gray-800 shadow-theme-xs outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500'
                />
              </div>

              {/* Multi-channel filter */}
              <div ref={channelFilterRef} className='relative'>
                <Button
                  variant='outline'
                  onClick={() =>
                    setOpenFilter(openFilter === 'channel' ? null : 'channel')
                  }
                  className='min-w-41.25'
                >
                  <Radio size={14} className='shrink-0' />

                  {chanFilter.length > 0 && (
                    <span className='flex shrink-0 items-center'>
                      {chanFilter.slice(0, 3).map((channel, i) => (
                        <span
                          key={channel}
                          className={cn(
                            'flex h-4.5 w-4.5 items-center justify-center rounded-full bg-white dark:bg-gray-900',
                            i > 0 && '-ml-1.5',
                          )}
                        >
                          {CHANNEL_CFG[channel]?.logo || <Globe size={14} />}
                        </span>
                      ))}
                    </span>
                  )}

                  <span className='truncate'>{activeChannelLabel}</span>
                </Button>

                {openFilter === 'channel' && (
                  <div className='absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                    <button
                      type='button'
                      onClick={() => setChanFilter([])}
                      className={cn(
                        'flex w-full items-center justify-between rounded-(--radius-control) px-3 py-2 text-left type-small font-medium transition',
                        chanFilter.length === 0
                          ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/4',
                      )}
                    >
                      <span className='inline-flex items-center gap-2'>
                        <Radio size={14} className='shrink-0' />
                        <span>All channels</span>
                      </span>

                      <span className='type-caption text-gray-400 dark:text-gray-500'>
                        {leads.length}
                      </span>
                    </button>

                    <div className='my-1 border-t border-gray-100 dark:border-gray-800' />

                    {channels.map((channel) => {
                      const active = chanFilter.includes(channel);

                      const logo = CHANNEL_CFG[channel]?.logo;

                      return (
                        <button
                          key={channel}
                          type='button'
                          onClick={() => toggleChannel(channel)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-(--radius-control) px-3 py-2 text-left type-small font-medium capitalize transition',
                            active
                              ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/4',
                          )}
                        >
                          <span className='inline-flex min-w-0 items-center gap-2'>
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                active
                                  ? 'border-brand-500 bg-brand-500 text-white'
                                  : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900',
                              )}
                            >
                              {active && <Check size={11} strokeWidth={3} />}
                            </span>

                            {logo || <Globe size={14} className='shrink-0' />}

                            <span className='truncate'>{channel}</span>
                          </span>

                          <span className='type-caption text-gray-400 dark:text-gray-500'>
                            {channelCounts[channel] || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Contact segment filter */}
              <div ref={contactFilterRef} className='relative'>
                <Button
                  variant='outline'
                  onClick={() =>
                    setOpenFilter(openFilter === 'contact' ? null : 'contact')
                  }
                >
                  <SlidersHorizontal size={14} />
                  {activeContactFilter.label}
                </Button>

                {openFilter === 'contact' && (
                  <div className='absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                    {(
                      [
                        'total',
                        'active',
                        'trending',
                        'dormant',
                      ] as CustomerSegment[]
                    ).map((segment) => {
                      const active = segFilter === segment;

                      const cfg = SEGMENT_CFG_TAB[segment];

                      return (
                        <button
                          key={segment}
                          type='button'
                          onClick={() => {
                            setSegFilter(segment);
                            setOpenFilter(null);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-(--radius-control) px-3 py-2 text-left type-small font-medium transition',
                            active
                              ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/4',
                          )}
                        >
                          <span>{cfg.label}</span>

                          <span className='type-caption text-gray-400 dark:text-gray-500'>
                            {segCounts[segment] || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className='min-w-0 max-w-full overflow-hidden rounded-b-xl border border-gray-200 dark:border-white/5'>
            <div className='w-full overflow-x-auto'>
              <table className='lashvae-column-dividers min-h-72 min-w-370 table-fixed'>
                <colgroup>
                  <col className='w-75' />
                  <col className='w-37.5' />
                  <col className='w-55' />
                  <col className='w-38.75' />
                  <col className='w-37.5' />
                  <col className='w-35' />
                  <col className='w-36.25' />
                  <col className='w-55' />
                </colgroup>

                <thead className='border-b border-gray-100 dark:border-white/5'>
                  <tr>
                    {[
                      'Customer',
                      'Channel',
                      'Email',
                      'Phone',
                      'Pipeline',
                      'Segment',
                      'Last active',
                      'Actions',
                    ].map((header) => (
                      <th
                        key={header}
                        className='px-5 py-3 text-left type-body font-medium text-gray-500 dark:text-gray-400'
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className='divide-y divide-gray-100 dark:divide-white/5'>
                  {loading && (
                    <tr>
                      <td
                        colSpan={8}
                        className='px-5 py-14 text-center type-small text-gray-500 dark:text-gray-400'
                      >
                        Loading customers
                      </td>
                    </tr>
                  )}

                  {!loading && displayed.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className='px-5 py-14 text-center type-small text-gray-500 dark:text-gray-400'
                      >
                        {search.trim()
                          ? 'No customers match this search'
                          : 'No customers match these filters'}
                      </td>
                    </tr>
                  )}

                  {!loading &&
                    pagedDisplayed.map((lead) => (
                      <CustomerTableRow
                        key={lead.id}
                        lead={lead}
                        onClick={() => setModal(lead)}
                        isDark={isDark}
                      />
                    ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={customersPage}
              totalItems={displayed.length}
              onPageChange={setCustomersPage}
            />
          </div>
        </div>
      </div>
    </>
  );
}
function bucketHasTime(bucket?: string | null) {
  if (!bucket) return false;
  return /(?:T|\s)\d{1,2}:\d{2}/.test(bucket);
}

function formatActivityBucket(bucket?: string | null) {
  if (!bucket) return null;

  const hasTime = bucketHasTime(bucket);
  const parsed = new Date(bucket);

  if (!Number.isNaN(parsed.getTime())) {
    return hasTime
      ? parsed.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  if (hasTime) {
    const match = bucket.match(/(?:T|\s)(\d{1,2}:\d{2})/);
    return match?.[1] ?? bucket;
  }
  return bucket;
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function OverviewTab({
  isDark,
  dateRange,
}: {
  isDark: boolean;
  dateRange: { from: string; to: string } | null;
}) {
  const [overview, setOverview] = useState<ReturnType<
    typeof adaptOverview
  > | null>(null);
  const [depth, setDepth] = useState<DepthItem[]>([]);
  const [returning, setReturning] = useState<ReturnType<
    typeof adaptReturning
  > | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);

  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [pipeline, setPipeline] = useState<Record<string, number>>({});

  useEffect(() => {
    // Build ?from_ts&to_ts from the selected range (same convention as Leads).
    const params = new URLSearchParams();
    if (dateRange?.from) {
      params.set('from_ts', new Date(dateRange.from).toISOString());
    }
    if (dateRange?.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      params.set('to_ts', to.toISOString());
    }
    const q = params.toString();
    const suffix = q ? `?${q}` : '';
    const withRange = (base: string) =>
      base.includes('?') ? `${base}&${q}` : `${base}${suffix}`;

    (async () => {
      const [ov, dp, rt, tp, pipe] = await Promise.allSettled([
        apiFetch<RawOverviewStats>(withRange('/admin/stats/overview'), {
          auth: true,
        }),
        apiFetch<RawDepthResponse>(withRange('/admin/stats/depth'), {
          auth: true,
        }),
        apiFetch<RawReturningStats>(
          withRange('/admin/stats/returning-users'),
          {
            auth: true,
          },
        ),
        apiFetch<RawTopicsResponse>(withRange('/admin/stats/topics'), {
          auth: true,
        }),
        apiFetch<RawPipelineResponse>('/admin/leads/pipeline', {
          auth: true,
        }),
      ]);

      if (ov.status === 'fulfilled') setOverview(adaptOverview(ov.value));
      if (dp.status === 'fulfilled') setDepth(adaptDepth(dp.value));
      if (rt.status === 'fulfilled') setReturning(adaptReturning(rt.value));
      if (tp.status === 'fulfilled') setTopics(adaptTopics(tp.value));
      if (pipe.status === 'fulfilled') {
        const raw = pipe.value;
        let flat: Record<string, number> = {};
        if (raw && Array.isArray(raw.by_status)) {
          for (const item of raw.by_status) flat[item.status] = item.count ?? 0;
        } else if (raw?.pipeline && typeof raw.pipeline === 'object') {
          flat = raw.pipeline;
        } else if (typeof raw === 'object' && raw !== null) {
          for (const [k, v] of Object.entries(raw))
            if (typeof v === 'number') flat[k] = v as number;
        }
        setPipeline(flat);
      }

      const ts = await fetchTimeseries(true, q).catch(() => []);
      setTimeseries(ts);
    })();
  }, [dateRange]);

  const depthBars = DEPTH_BUCKETS.map((d) => ({
    label: d.label,
    value: depth.find((x) => x.bucket === d.key)?.count ?? 0,
  }));
const topicDonut = topics.map((t) => ({
  label: TOPIC_CFG[t.topic]?.label ?? t.topic,
  value: t.count,
  color: TOPIC_CFG[t.topic]?.color ?? fallbackColorForTopic(t.topic),
}));
  const convRate =
    overview && overview.conversations > 0
      ? Math.round((overview.leads / overview.conversations) * 100)
      : 0;

  const peakBucket =
    timeseries && timeseries.length > 0
      ? timeseries.reduce(
          (a, b) => (b.messages > a.messages ? b : a),
          timeseries[0],
        )
      : null;

  const peakLabel = formatActivityBucket(peakBucket?.bucket);
  const peakUsesTime = bucketHasTime(peakBucket?.bucket);
  const peakTitle = peakUsesTime ? 'Peak Activity' : 'Peak Day';

  const peakSubtitle = peakUsesTime ? 'busiest time slot' : 'busiest day';

  return (
    <div className='grid grid-cols-12 gap-4 md:gap-6'>
      <div className='col-span-12 space-y-4 xl:col-span-7 md:space-y-6'>
        <div className='grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6'>
          <MetricCard
            label='Conversations'
            value={overview?.conversations ?? '—'}
            icon={<MessageSquare className='icon-nav' />}
            tone='brand'
          />
          <MetricCard
            label='Messages'
            value={overview?.messages ?? '—'}
            icon={<Mail className='icon-nav' />}
            tone='gray'
          />
          <MetricCard
            label='Leads'
            value={overview?.leads ?? '—'}
            icon={<Target className='icon-nav' />}
            tone='success'
          />
          <MetricCard
            label='Handoffs'
            value={overview?.handoffs ?? '—'}
            icon={<Users className='icon-nav' />}
            tone='warning'
          />
          <MetricCard
            label='Avg Latency'
            value={overview ? `${num(overview.avg_latency_ms)}ms` : '—'}
            icon={<Zap className='icon-nav' />}
            tone='brand'
          />
          <MetricCard
            label='Knowledge Gap'
            value={
              overview && overview.conversations
                ? pct(overview.errors / overview.conversations)
                : '—'
            }
            icon={<AlertTriangle className='icon-nav' />}
            tone='error'
          />
        </div>

        <ChartCard
          title='Message Engagement'
          subtitle='How many users sent a given number of messages'
        >
          {depth.length > 0 ? (
            <EngagementBarChart data={depthBars} isDark={isDark} />
          ) : (
            <Empty label='Appears after new conversations' />
          )}
        </ChartCard>
      </div>

      <div className='col-span-12 xl:col-span-5 flex flex-col space-y-8'>
        <ChartCard
          title='Conversion Rate'
          subtitle='Leads captured per conversation'
        >
          {overview ? (
            <>
              <ConversionGauge value={convRate} isDark={isDark} />
              <p className='mx-auto -mt-6 max-w-70 text-center type-small text-gray-500 dark:text-gray-400'>
                {overview.leads} of {overview.conversations} conversations
                became leads.
              </p>
            </>
          ) : (
            <Empty label='No conversion data yet' />
          )}
        </ChartCard>
        {peakLabel && (
          <ChartCard title={peakTitle} subtitle={peakSubtitle}>
            <div className='text-center'>
              <div className='type-h2 font-bold text-gray-800 dark:text-white/90'>
                {peakLabel}
              </div>
              <div className='mt-3 rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/3'>
                <div className='type-caption uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                  Peak messages
                </div>
                <div className='type-body font-bold text-gray-800 dark:text-white/90'>
                  {peakBucket?.messages ?? 0}
                </div>
              </div>
            </div>
          </ChartCard>
        )}
      </div>

      <div className='col-span-12'>
        <ChartCard
          title='Activity Over Time'
          subtitle='Messages, conversations, leads and knowledge gap'
        >
          {timeseries && timeseries.length > 1 ? (
            <div className='max-w-full overflow-x-auto custom-scrollbar'>
              <div className='min-w-180 xl:min-w-full'>
                <ActivityAreaChart data={timeseries} isDark={isDark} />
              </div>
            </div>
          ) : (
            <Empty label='Timeseries data appears after activity' />
          )}
        </ChartCard>
      </div>

      <div className='col-span-12 xl:col-span-5'>
        <ChartCard
          title='Topic Breakdown'
          subtitle='What customers are asking about'
        >
          {topics.length > 0 ? (
            <TopicDonutChart data={topicDonut} isDark={isDark} />
          ) : (
            <Empty label='Appears after new conversations' />
          )}
        </ChartCard>
      </div>

      <div className='col-span-12 space-y-4 xl:col-span-7 md:space-y-6'>
        <ChartCard title='Pipeline Funnel' subtitle='Leads by pipeline stage'>
          {Object.keys(pipeline).length > 0 ? (
            <div className='flex flex-col gap-2'>
              {PIPELINE_STAGES.map((s) => {
                const count = pipeline[s.key] || 0;
                const tot =
                  Object.values(pipeline).reduce((a, v) => a + v, 0) || 1;
                return (
                  <div key={s.key} className='flex items-center gap-3'>
                    <span className='w-20 shrink-0 type-caption font-medium capitalize text-gray-500 dark:text-gray-400'>
                      {s.key}
                    </span>
                    <div className='h-2.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/5'>
                      <div
                        className='h-full rounded-full transition-all duration-700'
                        style={{
                          background: s.color,
                          width: `${Math.max((count / tot) * 100, count > 0 ? 5 : 1)}%`,
                        }}
                      />
                    </div>
                    <span className='w-6 shrink-0 text-right type-small font-semibold text-gray-800 dark:text-white/90'>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty label='No leads yet' />
          )}
        </ChartCard>

        <div className='col-span-12 space-y-4 xl:col-span-7 md:space-y-6'>
          <ChartCard title='Returning Users' subtitle='Customers who came back'>
            {returning ? (
              <div className='flex items-center gap-4'>
                <div className='text-center'>
                  <div className='type-h2 font-bold text-brand-500 dark:text-brand-400'>
                    {pct(returning.return_rate)}
                  </div>
                  <div className='mt-1 type-caption text-gray-400 dark:text-gray-500'>
                    return rate
                  </div>
                </div>
                <div className='flex flex-1 flex-col gap-2'>
                  <div className='rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/3'>
                    <div className='type-caption uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                      Total returning
                    </div>
                    <div className='type-body font-bold text-gray-800 dark:text-white/90'>
                      {num(returning.total_returning)}
                    </div>
                  </div>
                  <div className='rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/3'>
                    <div className='type-caption uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                      Avg returns/user
                    </div>
                    <div className='type-body font-bold text-gray-800 dark:text-white/90'>
                      {num(returning.avg_returns, 1)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <Empty label='No returning user data yet' />
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
type Tab = 'overview' | 'customers';

type CustomerSortOption =
  | 'name_asc'
  | 'name_desc'
  | 'score_asc'
  | 'score_desc'
  | 'updated'

export default function AnalyticsPage() {
  const { isDark } = useTheme();

  const [tab, setTab] = useState<Tab>('overview');

  const [sortOption, setSortOption] =
    useState<CustomerSortOption>('updated');

  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [exportTrigger, setExportTrigger] = useState(0);
  const [dateRange, setDateRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  useOutsideClick(dateFilterRef, () => setDateOpen(false), dateOpen);

  const TABS = [
    { id: 'overview' as Tab, label: 'Overview' },
    { id: 'customers' as Tab, label: 'Customers' },
  ];

  return (
    <RequireAuth>
      <div className='py-4'>
        <LockedAccountBanner />
        <ConversationLimitBanner />
        <PageBreadcrumb pageTitle='Analytics' />

      <div className='mb-6 flex flex-wrap items-start justify-end gap-3'>
        {tab === 'overview' && (
          <>
            <div ref={dateFilterRef} className='relative'>
              <DateFilter
                dateRange={dateRange}
                activePreset={activePreset}
                setDateRange={setDateRange}
                setActivePreset={setActivePreset}
                open={dateOpen}
                onToggle={() => setDateOpen((v) => !v)}
                onClose={() => setDateOpen(false)}
              />
            </div>
            <WeeklyReportButton />
          </>
        )}

        {tab === 'customers' && (
          <CustomerTabControls
            sortOption={sortOption}
            sortDropdownOpen={sortDropdownOpen}
            setSortDropdownOpen={setSortDropdownOpen}
            onSortChange={setSortOption}
            onExport={() => setExportTrigger((n) => n + 1)}
          />
        )}
      </div>

      <div className='mb-6 inline-flex gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1 dark:border-gray-800 dark:bg-white/3'>
        {TABS.map((t) => {
          const active = tab === t.id;

          return (
            <button
              key={t.id}
              type='button'
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-(--radius-control) px-4 py-2 type-small font-semibold transition',
                active
                  ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-white/10 dark:text-brand-400'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div key={tab}>
        {tab === 'overview' && (
          <OverviewTab isDark={isDark} dateRange={dateRange} />
        )}

        {tab === 'customers' && (
          <CustomersTab
            isDark={isDark}
            sortOption={sortOption}
            exportTrigger={exportTrigger}
          />
        )}
      </div>
      </div>
    </RequireAuth>
  );
}