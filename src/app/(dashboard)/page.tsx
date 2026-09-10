'use client';
import Link from 'next/link';

import {
  ATTENTION_CFG,
  AttentionCfg,
  type AttentionItem,
  type FaqGap,
  type TopicItem,
} from '@/components/dashboard/DashboardPanels';
import { adaptFaqGaps, adaptTopics } from '@/components/overview/adapters';
import { OnboardingCard } from '@/components/overview/onboarding/OnboardingCard';
import { OnboardingDrawer } from '@/components/overview/onboarding/OnboardingDrawer';
import { BIZ_QUESTIONS } from '@/components/overview/onboarding/data';
import { OVERVIEW_LIGHT } from '@/components/overview/theme';
import type {
  BizType,
  ChannelInfo,
  ChannelTS,
  Overview,
  Pipeline,
  TS,
} from '@/components/overview/types';
import { RequireAuth } from '@/components/require-auth';
import { apiFetch } from '@/lib/api';
import {
  analyzeKnowledgeWebsite,
  listKnowledgeDocuments,
  listWebsiteKnowledgeEntries,
  uploadKnowledgeCatalogue,
} from '@/lib/knowledge-api';
import { DARK } from '@/lib/theme';
import { useTheme } from '@/lib/theme-context';
import type { ApexOptions } from 'apexcharts';
import {
  AlertTriangle,
  Clock3,
  MessageSquare,
  Plus,
  Send,
  Target,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import BookingPanel from '@/components/BookingPanel';

const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});

const BRAND = '#465FFF';
const BRAND_LIGHT = '#9CB9FF';
const PIPELINE_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'];
const PIPELINE_COLORS = ['#465FFF', '#5E76FF', '#7592FF', '#9CB9FF', '#C2D6FF'];

type UnknownRecord = Record<string, unknown>;
type ItemsResponse = { items?: UnknownRecord[]; total?: number };
type AuthMeResponse = { user: { id: string; tenant_id?: string } };
type ScrapeResponse = { analysis_id: number | string; url?: string };
type UploadResponse = {
  document_id: number | string;
  job_id?: number | string | null;
  filename?: string;
};
type KnowledgeEntry = { source_url?: string; url?: string };
type KnowledgeDocument = {
  filename?: string;
  original_filename?: string;
};

function formatCompact(value: number | string | null | undefined) {
  if (typeof value === 'string') return value;
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(
    value ?? 0,
  );
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function numberValue(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

function numericValue(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeTimeValue(item: UnknownRecord) {
  return (
    stringValue(item.t) ||
    stringValue(item.bucket) ||
    stringValue(item.date) ||
    stringValue(item.day) ||
    stringValue(item.created_at)
  );
}

function normalizeMetricValue(item: UnknownRecord) {
  return numericValue(
    item.v ??
      item.value ??
      item.count ??
      item.messages ??
      item.total_messages ??
      item.message_count,
  );
}

function normalizePlatformKey(platform: string) {
  const key = platform
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  const aliases: Record<string, string> = {
    fb: 'facebook',
    google_reviews: 'google',
    google_map: 'google',
    google_maps: 'google',
    ig: 'instagram',
    insta: 'instagram',
    wa: 'whatsapp',
    yt: 'youtube',
  };

  return aliases[key] || key;
}

function adaptTimeseries(raw: unknown): TS {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as UnknownRecord)?.points)
      ? ((raw as UnknownRecord).points as unknown[])
      : Array.isArray((raw as UnknownRecord)?.items)
        ? ((raw as UnknownRecord).items as unknown[])
        : [];

  return {
    points: source
      .map((item) => {
        const record = (item || {}) as UnknownRecord;
        return {
          t: normalizeTimeValue(record),
          v: normalizeMetricValue(record),
        };
      })
      .filter((point) => point.t),
  };
}

function adaptChannelTimeseries(raw: unknown): ChannelTS {
  const points: ChannelTS['points'] = [];
  const channels = new Set<string>();

  const addPoint = (item: unknown, inheritedChannel?: string) => {
    const record = (item || {}) as UnknownRecord;
    const channel =
      inheritedChannel ||
      stringValue(record.channel) ||
      stringValue(record.platform) ||
      stringValue(record.channel_name) ||
      stringValue(record.name);
    const t = normalizeTimeValue(record);
    if (!channel || !t) return;

    channels.add(channel);
    points.push({
      t,
      channel,
      v: normalizeMetricValue(record),
    });
  };

  const rawRecord = (raw || {}) as UnknownRecord;
  const flatSource = Array.isArray(raw)
    ? raw
    : Array.isArray(rawRecord.points)
      ? (rawRecord.points as unknown[])
      : Array.isArray(rawRecord.items)
        ? (rawRecord.items as unknown[])
        : Array.isArray(rawRecord.data)
          ? (rawRecord.data as unknown[])
          : [];

  flatSource.forEach((item) => addPoint(item));

  const seriesField = rawRecord.series ?? rawRecord.channel_series;

  if (Array.isArray(seriesField)) {
    // Shape: series: [{ channel, points: [...] }, ...]
    seriesField.forEach((series) => {
      const record = (series || {}) as UnknownRecord;
      const channel =
        stringValue(record.channel) ||
        stringValue(record.platform) ||
        stringValue(record.name);
      const nestedPoints = Array.isArray(record.points)
        ? (record.points as unknown[])
        : Array.isArray(record.data)
          ? (record.data as unknown[])
          : [];

      if (nestedPoints.length) {
        nestedPoints.forEach((item) => addPoint(item, channel));
      } else {
        addPoint(record, channel);
      }
    });
  } else if (seriesField && typeof seriesField === 'object') {
    // Shape: series: { instagram: [...points], google: [...points], ... }
    Object.entries(seriesField as UnknownRecord).forEach(([channel, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => addPoint(item, channel));
      }
    });
  }

  return { channels: Array.from(channels), points };
}

function toDateStr(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return toDateStr(d);
}

function buildDateQuery(dateRange: { from: string; to: string } | null) {
  const dateQs = new URLSearchParams();

  if (dateRange?.from) {
    dateQs.set('from_ts', new Date(dateRange.from).toISOString());
  }
  if (dateRange?.to) {
    const to = new Date(dateRange.to);
    to.setHours(23, 59, 59, 999);
    dateQs.set('to_ts', to.toISOString());
  }

  const str = dateQs.toString();
  return {
    dq: str ? `&${str}` : '',
    dqOnly: str ? `?${str}` : '',
  };
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

function MetricCard({
  label,
  value,
  sub,
  icon,
  tone = 'default',
}: {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  tone?: 'default' | 'warning' | 'success' | 'danger';
}) {
  const iconToneClass =
    tone === 'warning'
      ? 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400'
      : tone === 'success'
        ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400'
        : tone === 'danger'
          ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400'
          : 'bg-brand-50 text-brand-600 dark:bg-brand-500/12 dark:text-brand-400';

  return (
    <Card className='p-4 sm:p-5'>
      <div className='flex items-start justify-between gap-2'>
        <span className='text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
          {label}
        </span>
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconToneClass}`}
        >
          {icon}
        </div>
      </div>
      <div className='mt-2'>
        <h3 className='text-3xl sm:text-[32px] font-bold leading-tight text-gray-800 dark:text-white/90'>
          {typeof value === 'number' ? formatCompact(value) : value}
        </h3>
        <p className='mt-1.5 type-caption text-gray-500 dark:text-gray-400'>
          {sub}
        </p>
      </div>
    </Card>
  );
}

function EmptyBlock({ label }: { label: string }) {
  return (
    <div className='flex min-h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 type-small text-gray-500 dark:border-gray-800 dark:text-gray-400'>
      {label}
    </div>
  );
}

function DateFilter({
  dateRange,
  activePreset,
  setDateRange,
  setActivePreset,
}: {
  dateRange: { from: string; to: string } | null;
  activePreset: number | null;
  setDateRange: (value: { from: string; to: string } | null) => void;
  setActivePreset: (value: number | null) => void;
}) {
  return (
    <div className='flex w-full min-w-0 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-white/3 lg:w-auto lg:flex-row lg:flex-wrap lg:items-center'>
      <div className='grid shrink-0 grid-cols-3 gap-1.5 lg:w-auto'>
        {[
          { label: 'Today', days: 0 },
          { label: '7 Days', days: 7 },
          { label: '30 Days', days: 30 },
        ].map((preset) => (
          <button
            key={preset.label}
            className={`h-8 whitespace-nowrap rounded-lg px-3 type-small font-medium transition ${
              activePreset === preset.days
                ? 'bg-brand-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5'
            }`}
            onClick={() => {
              setActivePreset(preset.days);
              setDateRange({
                from: daysAgo(preset.days),
                to: toDateStr(new Date()),
              });
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className='grid shrink-0 grid-cols-2 gap-1.5'>
        <input
          type='date'
          value={dateRange?.from ?? ''}
          onChange={(e) => {
            setActivePreset(null);
            setDateRange({
              from: e.target.value,
              to: dateRange?.to ?? toDateStr(new Date()),
            });
          }}
          className='h-8 min-w-32.5 rounded-lg border border-gray-200 bg-white px-2.5 type-small text-gray-700 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
        />
        <input
          type='date'
          value={dateRange?.to ?? ''}
          onChange={(e) => {
            setActivePreset(null);
            setDateRange({
              from: dateRange?.from ?? toDateStr(new Date()),
              to: e.target.value,
            });
          }}
          className='h-8 min-w-32.5 rounded-lg border border-gray-200 bg-white px-2.5 type-small text-gray-700 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
        />
      </div>

      {dateRange && (
        <button
          className='h-8 shrink-0 whitespace-nowrap rounded-lg border border-gray-200 px-3 type-small font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5'
          onClick={() => {
            setDateRange(null);
            setActivePreset(null);
          }}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function TopicsCard({
  topics,
  loading,
}: {
  topics: TopicItem[];
  loading: boolean;
}) {
  const max = Math.max(...topics.map((topic) => topic.count), 1);
  const total = topics.reduce((sum, topic) => sum + topic.count, 0);

  return (
    <Card className='p-4 sm:p-5'>
      <div className='mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0'>
          <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
            What customers want right now
          </h3>
          <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
            Real-time themes from customer chats: questions, objections, purchase signals, and service requests.
          </p>
        </div>
        <div className='inline-flex h-8 shrink-0 items-center justify-center rounded-(--radius-control) bg-brand-50 px-3 type-small font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'>
          {loading ? '-' : `${total} signals`}
        </div>
      </div>
      {loading ? (
        <EmptyBlock label='Loading topics' />
      ) : topics.length === 0 ? (
        <EmptyBlock label='No conversation topics detected yet' />
      ) : (
        <div className='overflow-hidden rounded-xl border border-gray-200 divide-y divide-gray-100 dark:border-gray-800 dark:divide-white/5'>
          {topics.slice(0, 8).map((topic) => {
            const pct = Math.max(Math.round((topic.count / max) * 100), 8);
            const label = topic.topic.replace(/_/g, ' ');
            return (
              <div
                key={topic.topic}
                className='grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition hover:bg-gray-50 dark:hover:bg-white/2 sm:px-5'
              >
                <div className='min-w-0'>
                  <span
                    className='block truncate type-small font-semibold capitalize text-gray-800 dark:text-white/90'
                    title={label}
                  >
                    {label}
                  </span>
                  <div className='mt-2 h-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/6'>
                    <div
                      className='h-full rounded-full bg-brand-500'
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <span className='shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-gray-700 dark:bg-white/5 dark:text-white/80'>
                  {topic.count} chats
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function MessagesAreaChart({
  points,
  total,
  avgLatency,
  isDark,
}: {
  points: { d: string; v: number }[];
  total: number;
  avgLatency: number | null;
  isDark: boolean;
}) {
  const options: ApexOptions = useMemo(
    () => ({
      legend: { show: false },
      colors: [BRAND, BRAND_LIGHT],
      chart: {
        fontFamily: 'Outfit, sans-serif',
        type: 'area',
        height: 220,
        toolbar: { show: false },
        zoom: { enabled: false },
        offsetY: 0,
      },
      stroke: { curve: 'straight', width: 2 },
      fill: {
        type: 'gradient',
        gradient: { opacityFrom: 0.5, opacityTo: 0 },
      },
      markers: { size: 0, hover: { size: 4 } },
      grid: {
        borderColor: isDark ? '#1D2939' : '#F2F4F7',
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: points.map((p) => p.d),
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { colors: isDark ? '#98A2B3' : '#667085', fontSize: '10px' },
        },
      },
      yaxis: {
        labels: {
          style: { colors: isDark ? '#98A2B3' : '#667085', fontSize: '10px' },
          formatter: (value: number) => formatCompact(Math.round(value)),
        },
      },
      tooltip: { theme: isDark ? 'dark' : 'light' },
    }),
    [points, isDark],
  );

  return (
    <Card className='p-4 sm:p-5'>
      <div className='mb-2 flex items-start justify-between gap-2'>
        <div>
          <p className='text-[10px] uppercase tracking-wider font-semibold text-gray-400 dark:text-gray-500'>
            Messages — All channels · Daily
          </p>
          <h3 className='mt-0.5 text-3xl font-bold text-gray-800 dark:text-white/90'>
            {total.toLocaleString()}
          </h3>
          <p className='mt-0.5 type-caption text-gray-500 dark:text-gray-400'>
            {avgLatency != null
              ? `avg ${avgLatency}ms response`
              : 'Daily message volume'}
          </p>
        </div>
        <button className='shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-white/3 dark:text-gray-400'>
          7 Days
        </button>
      </div>
      {points.length > 0 ? (
        <div className='-mx-2'>
          <ReactApexChart
            options={options}
            series={[{ name: 'Messages', data: points.map((p) => p.v) }]}
            type='area'
            height={220}
          />
        </div>
      ) : (
        <EmptyBlock label='No message data available for this range' />
      )}
    </Card>
  );
}

function FaqGapsCard({ gaps, loading }: { gaps: FaqGap[]; loading: boolean }) {
  return (
    <Card className='p-4 sm:p-5'>
      <div className='mb-3 flex items-start justify-between gap-2'>
        <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
          FAQ Content Gaps
        </h3>
        <span className='shrink-0 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-600 dark:bg-warning-500/15 dark:text-warning-400'>
          Top 5 most
        </span>
      </div>
      {loading ? (
        <EmptyBlock label='Loading FAQ gaps' />
      ) : gaps.length === 0 ? (
        <EmptyBlock label='No FAQ gaps found' />
      ) : (
        <div className='-mx-1 divide-y divide-gray-100 dark:divide-gray-800'>
          {gaps.slice(0, 5).map((gap, index) => (
            <div
              key={`${gap.query}-${index}`}
              className='flex items-start justify-between gap-3 px-1 py-2.5'
            >
              <p className='min-w-0 flex-1 whitespace-normal wrap-break-word type-small font-medium leading-5 text-gray-700 dark:text-gray-300'>
                &ldquo;{gap.query}&rdquo;
              </p>
              <span className='shrink-0 rounded-full border border-brand-100 bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-600 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400'>
                {gap.count}x
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function PipelineChart({
  pipeline,
  pipeMap,
  isDark,
}: {
  pipeline: Pipeline | null;
  pipeMap: Record<string, number>;
  isDark: boolean;
}) {
  const total = pipeline?.total_leads ?? 0;
  const series = PIPELINE_STATUSES.map((status) => pipeMap[status] || 0);
  const hasData = series.some((value) => value > 0);
  const options: ApexOptions = {
    chart: { type: 'donut', fontFamily: 'Outfit, sans-serif' },
    colors: PIPELINE_COLORS,
    labels: PIPELINE_STATUSES.map((status) => status.replace('_', ' ')),
    stroke: { width: 0 },
    dataLabels: { enabled: false },
    legend: { show: false },
    tooltip: { theme: isDark ? 'dark' : 'light' },
    plotOptions: {
      pie: {
        donut: {
          size: '80%',
          labels: {
            show: false,
          },
        },
      },
    },
  };

  return (
    <Card className='p-4 sm:p-5'>
      <div className='flex items-start justify-between mb-3'>
        <div>
          <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
            Lead Pipeline
          </h3>
        </div>
        <button className='rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-white/3 dark:text-gray-400'>
          all time
        </button>
      </div>

      {hasData ? (
        <>
          <div className='relative mb-2'>
            <ReactApexChart
              options={options}
              series={series}
              type='donut'
              height={280}
            />
            <div className='pointer-events-none absolute inset-0 flex flex-col items-center justify-center'>
              <h2 className='text-4xl font-bold text-gray-800 dark:text-white/90'>
                {total.toLocaleString()}
              </h2>
            </div>
          </div>
          <div className='mt-1 space-y-2.5'>
            {PIPELINE_STATUSES.map((status, index) => {
              const value = pipeMap[status] || 0;
              const pct = total > 0 ? Math.round((value / total) * 100) : 0;
              return (
                <div key={status}>
                  <div className='mb-1 flex items-center justify-between text-[11px]'>
                    <div className='flex items-center gap-1.5 font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400'>
                      <span
                        className='h-2 w-2 rounded-full'
                        style={{ backgroundColor: PIPELINE_COLORS[index] }}
                      />
                      {status}
                    </div>
                    <span className='font-semibold text-gray-500 dark:text-gray-400'>
                      {value}
                    </span>
                  </div>
                  <div className='h-0.75 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800'>
                    <div
                      className='h-full rounded-full'
                      style={{
                        width: `${Math.max(pct, value > 0 ? 8 : 0)}%`,
                        backgroundColor: PIPELINE_COLORS[index],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyBlock label='No lead pipeline data yet' />
      )}
    </Card>
  );
}

function ActiveChannelsCard({
  channels,
  messagesTodayByChannel,
  onConnectNow,
  loading,
}: {
  channels: ChannelInfo[];
  messagesTodayByChannel: Record<string, number>;
  onConnectNow: () => void;
  loading: boolean;
}) {
  const COMING_SOON = new Set(['youtube', 'whatsapp']);

  const ALL_PLATFORMS = [
    { platform: 'instagram', label: 'Instagram' },
    { platform: 'telegram', label: 'Telegram' },
    { platform: 'facebook', label: 'Facebook' },
    { platform: 'website', label: 'Website' },
    { platform: 'google', label: 'Google Maps' },
    { platform: 'youtube', label: 'YouTube' },
  ];

  const displayChannels = ALL_PLATFORMS.map((item) => {
    const match = channels.find(
      (channel) => normalizePlatformKey(channel.platform) === item.platform,
    );
    const displayName = match
      ? match.display_name ||
        match.account_name ||
        match.username ||
        match.platform
      : item.label;
    return {
      channel: match ?? null,
      platform: item.platform,
      label: item.label,
      displayName: item.platform === 'website' || item.platform === 'google'
        ? item.label
        : displayName,
      connected: Boolean(match),
      comingSoon: COMING_SOON.has(item.platform),
    };
  });

  const logoForPlatform = (platform?: string | null) => {
    const key = (platform || '').toLowerCase().trim();
    const logos: Record<string, string> = {
      facebook: '/brand-logo/facebook.png',
      google: '/brand-logo/google-map.png',
      google_maps: '/brand-logo/google-map.png',
      google_map: '/brand-logo/google-map.png',
      instagram: '/brand-logo/instagram.png',
      meta: '/brand-logo/meta.png',
      telegram: '/brand-logo/telegram.png',
      website: '/brand-logo/website.png',
      whatsapp: '/brand-logo/whatsapp.png',
      youtube: '/brand-logo/youtube.png',
    };

    return logos[key] || '/brand-logo/website.png';
  };

  const messagesForPlatform = (platform: string) => {
    const key = normalizePlatformKey(platform);
    return messagesTodayByChannel[key] || 0;
  };

  return (
    <div className='min-w-0 w-full grid auto-cols-fr gap-2 grid-cols-[repeat(auto-fit,minmax(160px,1fr))] sm:gap-2.5 sm:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] lg:gap-3 lg:grid-cols-[repeat(auto-fit,minmax(170px,1fr))]'>
      {displayChannels.map((item) => {
        const messagesToday = messagesForPlatform(item.platform);
        const isActive = Boolean(item.channel?.is_active);

        return (
          <div
            key={item.channel?.id || item.platform}
            className={`flex min-h-27 min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white/90 p-2.5 shadow-sm backdrop-blur dark:border-white/7 dark:bg-gray-900/60 sm:p-3 ${
              item.comingSoon ? 'opacity-75' : ''
            }`}
          >
            <div className='flex items-start gap-2 sm:gap-2.5 w-full min-w-0'>
              <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/10 sm:h-9 sm:w-9'>
                <Image
                  src={logoForPlatform(item.platform)}
                  alt={`${item.label} logo`}
                  width={28}
                  height={28}
                  className={`h-6 w-6 object-contain sm:h-7 sm:w-7 ${
                    item.comingSoon ? 'grayscale' : ''
                  }`}
                />
              </div>
              <div className='min-w-0 flex-1 w-full overflow-hidden'>
                <p className='w-full truncate text-[13px] font-semibold capitalize text-gray-800 dark:text-white/90 sm:type-small' title={item.label}>
                  {item.label}
                </p>
                <div className='mt-0.5 flex min-w-0 w-full items-center gap-1 overflow-hidden'>
                  {loading ? (
                    <span className='h-3 w-10 shrink-0 animate-pulse rounded-full bg-gray-100 dark:bg-white/5' />
                  ) : item.comingSoon ? (
                    <span className='inline-flex shrink-0 items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-white/5 dark:text-gray-400'>
                      <Clock3 className='h-2.5 w-2.5' />
                      Coming soon
                    </span>
                  ) : !item.connected ? (
                    <button
                      type='button'
                      onClick={onConnectNow}
                      className='inline-flex shrink-0 items-center gap-0.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-600 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-400'
                    >
                      <Plus className='h-2.5 w-2.5' />
                      Connect now
                    </button>
                  ) : isActive ? (
                    <span
                      className='inline-flex min-w-0 w-full items-center gap-1 text-[10px] font-medium text-success-600 dark:text-success-500'
                      title={`Live · ${item.displayName}`}
                    >
                      <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-success-500' />
                      <span className='min-w-0 truncate'>
                        Live · {item.displayName}
                      </span>
                    </span>
                  ) : (
                    <span className='inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-gray-500 dark:text-gray-400'>
                      <span className='h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400' />
                      Paused
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className='mt-auto flex items-end justify-between pt-2 sm:pt-2.5 w-full min-w-0'>
              <p className='text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500'>
                Msgs today
              </p>
              <p className='text-sm font-bold text-brand-600 dark:text-brand-400'>
                {loading || !item.connected || item.comingSoon
                  ? '0'
                  : messagesToday}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function timeAgo(iso: string | null) {
  if (!iso) return 'No timestamp';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return 'No timestamp';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const FALLBACK_CFG: AttentionCfg = {
  dot: 'bg-gray-400',
  badge: 'bg-gray-100 text-gray-600 dark:bg-gray-500/12 dark:text-gray-300',
  label: 'attention',
};

function getAttentionCfg(type: string): AttentionCfg {
  return ATTENTION_CFG[type] ?? FALLBACK_CFG;
}

function AttentionCard({
  items,
  loading,
}: {
  items: AttentionItem[];
  loading: boolean;
}) {
  const urgentCount = items.filter(
    (it) => it.type && it.type.toLowerCase().includes('angry'),
  ).length;

  return (
    <Card className='p-4 sm:p-5'>
      <div className='flex items-start justify-between mb-3'>
        <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
          Needs Attention
        </h3>
        {urgentCount > 0 && (
          <span className='rounded-full bg-error-50 px-2.5 py-1 text-[11px] font-semibold text-error-600 dark:bg-error-500/15 dark:text-error-400'>
            {urgentCount} urgent
          </span>
        )}
      </div>
      {loading ? (
        <EmptyBlock label='Loading attention items' />
      ) : items.length === 0 ? (
        <EmptyBlock label='No attention items right now' />
      ) : (
        <div className='-mx-1 divide-y divide-gray-100 dark:divide-gray-800'>
          {items.slice(0, 8).map((item, index) => {
            const cfg = getAttentionCfg(item.type);
            const href = item.conversation_id
              ? `/conversations/${item.conversation_id}`
              : '/conversations';
            const isUrgent =
              item.type && item.type.toLowerCase().includes('angry');

            return (
              <Link
                key={`${item.type}-${item.created_at}-${index}`}
                href={href}
                className='flex gap-2.5 px-1 py-2.5 hover:bg-gray-50 dark:hover:bg-white/2 rounded-lg transition-colors'
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${cfg.dot}`}
                />
                <div className='min-w-0 flex-1'>
                  <div className='flex items-start justify-between gap-2'>
                    <p className='truncate type-small font-medium text-gray-800 dark:text-white/90'>
                      @{item.sender_name || 'Unknown customer'}{' '}
                      <span className='font-normal text-gray-500 dark:text-gray-400'>
                        may be frustrated —{' '}
                      </span>
                      <span className='truncate text-gray-500 dark:text-gray-400'>
                        &ldquo;{item.message ||
                          'Review this conversation for next action.'}&rdquo;
                      </span>
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                        isUrgent
                          ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400'
                          : cfg.badge
                      }`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  <p className='mt-0.5 type-caption text-gray-400 dark:text-gray-500'>
                    {timeAgo(item.created_at)} · {item.tenant_id || 'Tenant'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export default function OverviewPage() {
  const router = useRouter();
  const { isDark } = useTheme();
  const onboardingTheme = isDark ? DARK : OVERVIEW_LIGHT;

  const [overview, setOverview] = useState<Overview | null>(null);
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [tsMessages, setTsMessages] = useState<TS | null>(null);
  const [tsMessagesByChannel, setTsMessagesByChannel] =
    useState<ChannelTS | null>(null);
  const [, setTsLeads] = useState<TS | null>(null);
  const [tsHandoffs, setTsHandoffs] = useState<TS | null>(null);
  // Fetched but not yet surfaced in this page's UI (the handoffsToday
  // calculation that used to read this was itself dead code and has
  // been removed) — preserving the fetch for a future chart/metric.
  void tsHandoffs;
  const [, setTsHourly] = useState<TS | null>(null);
  const [handoffConvCount, setHandoffConvCount] = useState<number>(0);
  // Fetched but not yet surfaced in this page's UI — preserving the
  // fetch for a future summary card rather than deleting it.
  void handoffConvCount;
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [hasFaqs, setHasFaqs] = useState(false);
  const [tenantId, setTenantId] = useState<string | undefined>();
  const [showTrainAI, setShowTrainAI] = useState(false);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [attentionLoading, setAttentionLoading] = useState(true);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [faqGaps, setFaqGaps] = useState<FaqGap[]>([]);
  const [faqLoading, setFaqLoading] = useState(true);
  const [dropoffTotal, setDropoffTotal] = useState(0);
  const [returningTotal, setReturningTotal] = useState(0);
  const [dateRange, setDateRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoaded(false);
        const { dq, dqOnly } = buildDateQuery(dateRange);
        const [
          byChannelRaw,
          o,
          p,
          m,
          l,
          h,
          hConvs,
          dailyMessagesRaw,
          channelsRes,
          faqs,
          me,
        ] = await Promise.all([
          apiFetch<unknown>(
            `/admin/stats/timeseries-by-channel?interval=day${dq}`,
            { auth: true },
          ),
          apiFetch<Overview>(`/admin/stats/overview${dqOnly}`, { auth: true }),
          apiFetch<Pipeline>('/admin/leads/pipeline', { auth: true }),
          apiFetch<unknown>(
            `/admin/stats/timeseries?metric=messages&interval=hour${dq}`,
            { auth: true },
          ),
          apiFetch<TS>(
            `/admin/stats/timeseries?metric=leads&interval=day${dq}`,
            { auth: true },
          ),
          apiFetch<TS>(
            `/admin/stats/timeseries?metric=handoffs&interval=day${dq}`,
            { auth: true },
          ),
          apiFetch<ItemsResponse>(
            '/admin/conversations?status=handoff&limit=1',
            { auth: true },
          ),
          apiFetch<unknown>(
            `/admin/stats/timeseries?metric=messages&interval=day${dq}`,
            { auth: true },
          ),
          apiFetch<{ items: ChannelInfo[] }>('/admin/channels', { auth: true }),
          apiFetch<ItemsResponse>('/admin/faq?limit=1', {
            auth: true,
          }),
          apiFetch<AuthMeResponse>('/admin/auth/me', { auth: true }).catch(
            (): AuthMeResponse => ({ user: { id: 'default' } }),
          ),
        ]);

        setOverview(o);
        setPipeline(p);
        setTsMessages(adaptTimeseries(dailyMessagesRaw));
        setTsMessagesByChannel(adaptChannelTimeseries(byChannelRaw));
        setTsLeads(l);
        setTsHandoffs(h);
        setHandoffConvCount(hConvs.total ?? hConvs.items?.length ?? 0);
        setTsHourly(adaptTimeseries(m));
        setChannels(channelsRes.items || []);

        const tid = me.user.tenant_id || me.user.id;
        const realFaqCount = faqs.items?.length || faqs.total || 0;
        let trained = realFaqCount > 0;
        try {
          if (typeof window !== 'undefined' && tid) {
            const flag = localStorage.getItem(`onboarding_trained:${tid}`);
            if (flag === '1') trained = true;
            localStorage.removeItem('onboarding_trained');
          }
        } catch {}
        setHasFaqs(trained);
        setTenantId(tid);
        setLoaded(true);
      } catch (e: unknown) {
        setErr(errorMessage(e, 'Failed to load overview'));
        setLoaded(true);
      }
    })();
  }, [dateRange]);

  useEffect(() => {
    const { dq, dqOnly } = buildDateQuery(dateRange);
    apiFetch<ItemsResponse>(`/admin/attention?limit=8${dq}`, { auth: true })
      .then((res) =>
        setAttentionItems(
          (res.items || []).map((item) => ({
            conversation_id: numberValue(item.conversation_id) ?? null,
            type: stringValue(item.type, 'handoff_needed'),
            sender_name:
              stringValue(item.sender_name) ||
              stringValue(item.channel_display_name) ||
              stringValue(item.external_user_id) ||
              'Unknown customer',
            tenant_id: stringValue(item.tenant_id),
            message:
              stringValue(item.message) || stringValue(item.title) || null,
            silence_min:
              typeof item.meta === 'object' && item.meta !== null
                ? (numberValue((item.meta as UnknownRecord).silence_min) ??
                  numberValue((item.meta as UnknownRecord).silence_minutes) ??
                  null)
                : null,
            created_at:
              stringValue(item.created_at) ||
              stringValue(item.last_message_at) ||
              new Date().toISOString(),
          })),
        ),
      )
      .catch(() => setAttentionItems([]))
      .finally(() => setAttentionLoading(false));

    apiFetch<unknown>(`/admin/stats/topics${dqOnly}`, { auth: true })
      .then((res) => setTopics(adaptTopics(res)))
      .catch(() => setTopics([]))
      .finally(() => setTopicsLoading(false));

    apiFetch<unknown>('/admin/stats/faq-gaps?limit=5', { auth: true })
      .then((res) => setFaqGaps(adaptFaqGaps(res)))
      .catch(() => setFaqGaps([]))
      .finally(() => setFaqLoading(false));

    apiFetch<UnknownRecord>(`/admin/stats/dropoffs${dqOnly}`, { auth: true })
      .then((res) => {
        const total =
          numberValue(res.total_dropoffs) ?? numberValue(res.total) ?? 0;
        const recovered = numberValue(res.recovered) ?? 0;
        setDropoffTotal(total - recovered);
      })
      .catch(() => setDropoffTotal(0));

    apiFetch<UnknownRecord>('/admin/stats/returning-users', { auth: true })
      .then((res) =>
        setReturningTotal(
          numberValue(res.total_returning) ??
            numberValue(res.total_returning_users) ??
            0,
        ),
      )
      .catch(() => setReturningTotal(0));
  }, [dateRange]);

  async function handleRunScrape(
    url: string,
  ): Promise<{ analysisId: number | string; url: string }> {
    try {
      const started = (await analyzeKnowledgeWebsite(
        url.trim(),
        50,
      )) as ScrapeResponse;
      return {
        analysisId: started.analysis_id,
        url: started.url || url.trim(),
      };
    } catch (e: unknown) {
      throw new Error(errorMessage(e, 'Scrape failed'));
    }
  }

  async function handleRunUpload(
    file: File,
    docCategory: string,
  ): Promise<{
    documentId: number | string;
    jobId?: number | string | null;
    filename: string;
  }> {
    try {
      const label = file.name.replace(/\.[^.]+$/, '');
      const response = (await uploadKnowledgeCatalogue(
        file,
        label,
        docCategory || undefined,
      )) as UploadResponse;
      return {
        documentId: response.document_id,
        jobId: response.job_id ?? null,
        filename: response.filename || file.name,
      };
    } catch (e: unknown) {
      throw new Error(errorMessage(e, 'Upload failed'));
    }
  }

  async function handleCheckDupUrl(url: string): Promise<boolean> {
    try {
      const q = url
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');
      if (!q) return false;
      const entries = (await listWebsiteKnowledgeEntries({
        pageSize: 100,
      }).catch(() => ({ items: [] }))) as
        | { items?: KnowledgeEntry[] }
        | KnowledgeEntry[];
      const items = Array.isArray(entries) ? entries : (entries.items ?? []);
      return items.some((e) => {
        const src = (e.source_url || e.url || '').toLowerCase();
        return (
          src.includes(q) ||
          q.includes(src.replace(/^https?:\/\//, '').replace(/\/$/, ''))
        );
      });
    } catch {
      return false;
    }
  }

  async function handleCheckDupFile(filename: string): Promise<boolean> {
    try {
      const docs = (await listKnowledgeDocuments().catch(() => [])) as
        | { items?: KnowledgeDocument[] }
        | KnowledgeDocument[];
      const list = Array.isArray(docs) ? docs : (docs.items ?? []);
      const name = filename.toLowerCase();
      return list.some(
        (d) => (d.filename || d.original_filename || '').toLowerCase() === name,
      );
    } catch {
      return false;
    }
  }

  async function handleRunQuestions(
    answers: Record<number, string>,
    biz: BizType,
    about: string,
  ): Promise<{ addedCount: number }> {
    const questions = BIZ_QUESTIONS[biz];
    const answeredPairs = Object.entries(answers).filter(([, v]) => v.trim());

    let added = 0;
    for (const [idxStr, answer] of answeredPairs) {
      const q = questions[parseInt(idxStr, 10)];
      if (!q) continue;
      try {
        await apiFetch('/admin/faq', {
          method: 'POST',
          auth: true,
          body: {
            question: q.faqQ,
            answer: answer.trim(),
            tags: `onboarding,${biz}`,
            synonyms: '',
            is_active: true,
          },
        });
        added += 1;
      } catch (e) {
        console.error('FAQ POST failed:', e);
      }
    }

    if (about) {
      try {
        const currentSettings = await apiFetch<{ system_prompt?: string }>(
          '/admin/settings',
          {
            auth: true,
          },
        );
        const existingPrompt = currentSettings?.system_prompt || '';
        const basePrompt = existingPrompt
          .replace(/\n*\[Business Information\][\s\S]*$/i, '')
          .trim();
        const updatedPrompt = `${basePrompt}

[Business Information]
${about}`.trim();
        await apiFetch('/admin/settings', {
          method: 'PUT',
          auth: true,
          body: { system_prompt: updatedPrompt },
        });
      } catch (e) {
        console.error('Failed to save business information:', e);
      }
    }

    try {
      const faqs = await apiFetch<ItemsResponse>('/admin/faq?limit=1', {
        auth: true,
      });
      setHasFaqs((faqs.items?.length || faqs.total || 0) > 0);
    } catch {
      setHasFaqs(true);
    }

    return { addedCount: added };
  }

  async function handleSetBizType(biz: BizType): Promise<void> {
    try {
      await apiFetch('/admin/settings', {
        method: 'PUT',
        auth: true,
        body: { business_type: biz },
      });
    } catch (e) {
      console.error('Failed to save business type:', e);
    }
  }

  function handleOnboardingFinish(payload: {
    coachTab: 'manual' | 'catalogue' | 'website' | 'saved';
    pendingScrape?: { analysisId: number | string; url: string };
    pendingUpload?: {
      documentId: number | string;
      jobId?: number | string | null;
      filename: string;
    };
  }) {
    try {
      localStorage.setItem('faq_coach_target', payload.coachTab);
      if (tenantId) {
        localStorage.setItem(`onboarding_trained:${tenantId}`, '1');
      }
      if (payload.pendingScrape) {
        localStorage.setItem(
          'pending_scrape',
          JSON.stringify(payload.pendingScrape),
        );
      }
      if (payload.pendingUpload) {
        localStorage.setItem(
          'pending_upload',
          JSON.stringify(payload.pendingUpload),
        );
      }
    } catch {}
    setHasFaqs(true);
    setShowTrainAI(false);
    router.push('/faq');
  }

  const hasChannels = channels.some((channel) => channel.is_active);
  const pipeMap = useMemo(() => {
    const m: Record<string, number> = {};
    (pipeline?.by_status || []).forEach((item) => {
      m[item.status] = item.count;
    });
    return m;
  }, [pipeline]);

  const todayMessages = useMemo(() => {
    if (!tsMessages?.points?.length) return 0;
    const today = toDateStr(new Date());
    return tsMessages.points.reduce(
      (total, point) => total + (point.t.startsWith(today) ? point.v : 0),
      0,
    );
  }, [tsMessages]);

  const messagesTodayByChannel = useMemo(() => {
    const today = toDateStr(new Date());
    return (tsMessagesByChannel?.points || []).reduce<Record<string, number>>(
      (totals, point) => {
        if (!point.t.startsWith(today)) return totals;
        const key = normalizePlatformKey(point.channel);
        totals[key] = (totals[key] || 0) + point.v;
        return totals;
      },
      {},
    );
  }, [tsMessagesByChannel]);

  const msgChart = useMemo(
    () =>
      (tsMessages?.points || []).map((point) => ({
        d: point.t.slice(5, 10),
        v: point.v,
      })),
    [tsMessages],
  );

  return (
    <RequireAuth>
      <div className='overflow-x-hidden py-4'>
        <div className='mb-4 min-w-0 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div className='min-w-0'>
            <p className='type-small font-medium text-brand-500 dark:text-brand-400'>
              Overview
            </p>
            <h1 className='mt-0.5 text-title-sm font-bold text-gray-800 dark:text-white/90'>
              Business dashboard
            </h1>
          </div>
          <DateFilter
            dateRange={dateRange}
            activePreset={activePreset}
            setDateRange={setDateRange}
            setActivePreset={setActivePreset}
          />
        </div>

        {showTrainAI && (
          <OnboardingDrawer
            onClose={() => setShowTrainAI(false)}
            onRunScrape={handleRunScrape}
            onRunUpload={handleRunUpload}
            onRunQuestions={handleRunQuestions}
            onSetBizType={handleSetBizType}
            onFinish={handleOnboardingFinish}
            onCheckDupUrl={handleCheckDupUrl}
            onCheckDupFile={handleCheckDupFile}
            t={onboardingTheme}
            isDark={isDark}
          />
        )}

        {err && (
          <div className='mb-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 type-small text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400'>
            {err}
          </div>
        )}

        {loaded && (!hasFaqs || !hasChannels) && (
          <div className='mb-4 min-w-0'>
            <OnboardingCard
              hasFaqs={hasFaqs}
              hasChannels={hasChannels}
              onTrainAI={() => setShowTrainAI(true)}
              onConnectChannel={() => router.push('/channels')}
              t={onboardingTheme}
              isDark={isDark}
              tenantId={tenantId}
            />
          </div>
        )}

        <div className='mb-4 min-w-0 w-full'>
          <BookingPanel />
        </div>

        <div className='mb-4 min-w-0 w-full'>
          <ActiveChannelsCard
            channels={channels}
            messagesTodayByChannel={messagesTodayByChannel}
            onConnectNow={() => router.push('/channels')}
            loading={!loaded}
          />
        </div>

        <div className='grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5 md:gap-4 min-w-0 w-full'>
          <MetricCard
            label='Conversations'
            value={overview?.total_conversations ?? 0}
            sub={`${overview?.open_conversations ?? 0} open now`}
            icon={<MessageSquare className='h-4 w-4' />}
          />
          <MetricCard
            label='Messages Sent'
            value={overview?.total_messages ?? 0}
            sub={
              overview?.avg_latency_ms != null
                ? `${overview.avg_latency_ms}ms avg`
                : `${todayMessages} today`
            }
            icon={<Send className='h-4 w-4' />}
          />
          <MetricCard
            label='Total Leads'
            value={overview?.total_leads ?? 0}
            sub={`${pipeMap.won || 0} won`}
            icon={<Target className='h-4 w-4' />}
            tone='success'
          />
          <MetricCard
            label='Drop-offs Unrecovered'
            value={dropoffTotal}
            sub={'check attention feed'}
            icon={<AlertTriangle className='h-4 w-4' />}
            tone='warning'
          />
          <MetricCard
            label='Returning Users'
            value={returningTotal}
            sub={'came back this week'}
            icon={
              <svg
                className='h-4 w-4'
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <path d='M21 12a9 9 0 1 1-3-6.7L21 8' />
                <path d='M21 3v5h-5' />
              </svg>
            }
          />
        </div>

        <div className='mt-4 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 min-w-0 w-full'>
          <div className='lg:col-span-7 min-w-0'>
            <AttentionCard items={attentionItems} loading={attentionLoading} />
          </div>

          <div className='lg:col-span-5 min-w-0'>
            <PipelineChart
              pipeline={pipeline}
              pipeMap={pipeMap}
              isDark={isDark}
            />
          </div>
        </div>

        <div className='mt-4 min-w-0 w-full'>
          <TopicsCard topics={topics} loading={topicsLoading} />
        </div>

        <div className='mt-4 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12 min-w-0 w-full'>
          <div className='lg:col-span-12 min-w-0'>
            <MessagesAreaChart
              points={msgChart}
              total={overview?.total_messages ?? 0}
              avgLatency={overview?.avg_latency_ms ?? null}
              isDark={isDark}
            />
          </div>

          <div className='lg:col-span-12 min-w-0'>
            <FaqGapsCard gaps={faqGaps} loading={faqLoading} />
          </div>
        </div>
      </div>
    </RequireAuth>
  );
}