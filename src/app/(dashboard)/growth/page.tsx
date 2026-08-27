'use client';

import { RequireAuth } from '@/components/require-auth';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import type { ApexOptions } from 'apexcharts';
import {
  AlertTriangle,
  Brain,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileText,
  Film,
  Flame,
  Globe,
  GlobeIcon,
  Hash,
  Lightbulb,
  Loader2,
  MapPin,
  Menu,
  Megaphone,
  MessageCircle,
  Play,
  Radar,
  RefreshCw,
  Rocket,
  Sparkles,
  Target,
  Trophy,
  Wand2,
  Zap,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';

import PageBreadcrumb from '@/components/common/PageBreadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import {
  getPageItems,
  getTotalPages,
  TablePagination,
} from '@/components/ui/table-pagination';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

/* ─────────────────────── types ─────────────────────── */
type GrowthItem = {
  title?: string;
  topic?: string;
  name?: string;
  action?: string;
  reason?: string;
  insight?: string;
  conversation_id?: string;
  channel?: string;
  priority?: string;
  impact?: string;
  cta?: string;
  mentions?: number;
  evidence?: string;
  recommended_action?: string;
  suggested_message?: string;
  lead_or_customer?: string;
  day?: string;
  why?: string;
  goal?: string;
  channels?: string[];
  format?: string;
  estimated_value?: string;
  sample?: string;
  why_it_matters?: string;
  suggested_fix?: string;
  can_regenerate?: boolean;
};

type GrowthReport = {
  growth_score?: number;
  biggest_opportunity?: string;
  biggest_risk?: string;
  executive_summary?: string;
  customer_voice?: GrowthItem[];
  complaints?: GrowthItem[];
  opportunities?: GrowthItem[];
  content_ideas?: GrowthItem[];
  campaigns?: GrowthItem[];
  weekly_action_plan?: GrowthItem[];
  quick_wins?: GrowthItem[];
  urgent_actions?: GrowthItem[];
  consultant?: ConsultantResponse;
  radar?: RadarResponse;
};

type LatestGrowthResponse = {
  exists: boolean;
  id?: number;
  week_start?: string;
  week_end?: string;
  created_at?: string;
  report?: GrowthReport;
};

type GrowthHistoryItem = {
  id: number;
  week_start?: string;
  week_end?: string;
  created_at?: string;
  growth_score?: number;
  biggest_opportunity?: string;
  biggest_risk?: string;
};

type GrowthHistoryResponse = {
  ok: boolean;
  reports: GrowthHistoryItem[];
};

type GrowthOverviewResponse = {
  ok: boolean;
  week_start?: string;
  week_end?: string;
  can_regenerate?: boolean;
  metrics?: {
    conversations?: number;
    messages?: number;
    leads?: number;
    complaints?: number;
    faq_gaps?: number;
    dropoffs?: number;
    returning_users?: number;
    opportunities?: number;
  };
  signals?: {
    counts?: Record<string, number>;
    customer_voice?: GrowthItem[];
    complaints?: GrowthItem[];
    opportunities?: GrowthItem[];
    quick_wins?: GrowthItem[];
    urgent_actions?: GrowthItem[];
  };
  latest_report_exists?: boolean;
  latest_report_id?: number;
  latest_report_created_at?: string;
  report?: GrowthReport;
  consultant?: ConsultantResponse;
  radar?: RadarResponse;
  weekly_generated?: boolean;
  weekly_generated_at?: string;
  weekly_resets_at?: string;
  next_regeneration_at?: string;
};

type ScriptResponse = {
  ok: boolean;
  script: {
    title?: string;
    hook?: string;
    scenes?: {
      scene: number;
      visual: string;
      voiceover: string;
      onscreen_text: string;
    }[];
    caption?: string;
    cta?: string;
    hashtags?: string[];
    thumbnail_text?: string;
  };
};

/* ─── Consultant types ─── */
type ConsultantIdea = {
  title: string;
  description: string;
  category: 'offline' | 'hybrid' | 'online' | 'partnership';
  tags: string[];
  data_evidence?: string;
  estimated_cost?: string;
  viral_potential?: string;
  difficulty?: string;
  expected_outcome?: string;
  thumbnail?: string;
};

type ConsultantResponse = {
  ok: boolean;
  ideas: ConsultantIdea[];
  consultant_note?: string;
};

type ActionPlanStep = {
  step: number;
  title: string;
  description: string;
  timeline?: string;
  resources_needed?: string;
  cost?: string;
};

type ActionPlanResponse = {
  ok: boolean;
  plan: {
    idea_title?: string;
    timeline?: string;
    steps?: ActionPlanStep[];
    success_metrics?: string[];
    risks?: string[];
    quick_start?: string;
  };
};

/* ─── Radar types ─── */
type RadarTrend = {
  title: string;
  description: string;
  category: 'trending' | 'industry' | 'competitor';
  source_url?: string;
  match_score: number;
  match_reason?: string;
  implementation?: string;
  urgency?: 'act_now' | 'this_week' | 'this_month' | 'watch';
  thumbnail?: string;
};

type RadarResponse = {
  ok: boolean;
  trends: RadarTrend[];
  radar_summary?: string;
  search_sources?: Record<string, number>;
};

/* ─────────────────────── palette ─────────────────────── */
const PALETTE = {
  brand: '#465FFF',
  success: '#12B76A',
  warning: '#F79009',
  error: '#F04438',
};

type BadgeColor = 'primary' | 'success' | 'error' | 'warning' | 'info' | 'light' | 'dark';

function priorityBadgeColor(p?: string): BadgeColor {
  const v = p?.toLowerCase();
  if (v === 'high') return 'error';
  if (v === 'medium') return 'warning';
  return 'success';
}

const CATEGORY_BADGE: Record<ConsultantIdea['category'], BadgeColor> = {
  offline: 'error',
  hybrid: 'warning',
  online: 'info',
  partnership: 'success',
};

const URGENCY_BADGE: Record<NonNullable<RadarTrend['urgency']>, { color: BadgeColor; label: string }> = {
  act_now: { color: 'error', label: 'Act now' },
  this_week: { color: 'warning', label: 'This week' },
  this_month: { color: 'info', label: 'This month' },
  watch: { color: 'light', label: 'Watch' },
};

const CARD =
  'rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]';

type GrowthSectionKey =
  | 'report-history'
  | 'growth-consultant'
  | 'content-ideas'
  | 'campaigns'
  | 'weekly-action-plan'
  | 'custom-reel-script'
  | 'trending'
  | 'industry'
  | 'competitor';

/* ─────────────────────── helpers ─────────────────────── */
function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function itemTitle(item: GrowthItem) {
  return (
    item.title ||
    item.topic ||
    item.name ||
    item.action ||
    item.goal ||
    'Untitled item'
  );
}

function itemDescription(item: GrowthItem) {
  return (
    item.insight ||
    item.reason ||
    item.why ||
    item.why_it_matters ||
    item.evidence ||
    item.recommended_action ||
    item.suggested_fix ||
    item.suggested_message ||
    item.sample ||
    item.estimated_value ||
    item.impact ||
    ''
  );
}

function compactText(text?: string, fallback = 'No insight available yet.') {
  if (!text?.trim()) return fallback;
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > 155 ? `${clean.slice(0, 155)}...` : clean;
}

/* ─────────────────────── shared atoms ─────────────────────── */
function Section({
  icon,
  title,
  sub,
  count,
  action,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(CARD, 'p-6 sm:p-6')}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
            {icon}
          </div>
          <div>
            <h2 className="type-body font-semibold text-gray-800 dark:text-white/90">{title}</h2>
            {sub && <p className="mt-0.5 type-small text-gray-500 dark:text-gray-400">{sub}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {typeof count === 'number' && (
            <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-gray-100 px-2 type-caption font-semibold text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
              {count}
            </span>
          )}
          {action}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex min-h-[110px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-5 py-8 text-center dark:border-gray-700">
      <Sparkles size={20} className="text-gray-300 dark:text-gray-700" />
      <p className="type-small text-gray-400 dark:text-gray-500">{text}</p>
    </div>
  );
}

function GrowthGauge({ score, isDark }: { score: number; isDark: boolean }) {
  const color = score >= 70 ? PALETTE.success : score >= 40 ? PALETTE.warning : PALETTE.error;
  const options: ApexOptions = {
    colors: [color],
    chart: { fontFamily: 'Outfit, sans-serif', type: 'radialBar', sparkline: { enabled: true } },
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        hollow: { size: '70%' },
        track: { background: isDark ? '#1D2939' : '#E4E7EC', strokeWidth: '100%', margin: 5 },
        dataLabels: {
          name: { show: false },
          value: {
            fontSize: '26px',
            fontWeight: 700,
            offsetY: -6,
            color: isDark ? '#F9FAFB' : '#1D2939',
            formatter: (val) => `${val}`,
          },
        },
      },
    },
    fill: { type: 'solid', colors: [color] },
    stroke: { lineCap: 'round' },
    labels: ['Growth score'],
  };
  return <ReactApexChart options={options} series={[score]} type="radialBar" height={190} />;
}

/* ─────────────────────── Action grid (Weekly Action Plan) ─────────────────────── */
function ActionGrid({ items, empty }: { items?: GrowthItem[]; empty: string }) {
  if (!items?.length) return <Empty text={empty} />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item, idx) => (
        <div
          key={`${itemTitle(item)}-${idx}`}
          className="flex flex-col rounded-xl border border-gray-200 p-4 dark:border-gray-800"
        >
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-brand-50 type-caption font-semibold text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
              {idx + 1}
            </span>
            {item.priority && <Badge color={priorityBadgeColor(item.priority)}>{item.priority}</Badge>}
          </div>
          <h3 className="type-small font-semibold text-gray-800 dark:text-white/90">{itemTitle(item)}</h3>
          <p className="mt-1.5 flex-1 type-caption leading-relaxed text-gray-500 dark:text-gray-400">
            {compactText(itemDescription(item))}
          </p>
          {item.cta && (
            <div className="mt-3 type-caption font-semibold text-brand-500 dark:text-brand-400">{item.cta}</div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────── Content Ideas grid ─────────────────────── */
function MagazineGrid({
  items,
  empty,
  onAction,
  onRegenerate,
  canRegenerate,
  nextRegenDate,
  scriptCache: cache,
}: {
  items?: GrowthItem[];
  empty: string;
  onAction?: (item: GrowthItem) => void;
  onRegenerate?: (item: GrowthItem) => void;
  scriptCache?: Record<string, any>;
  canRegenerate?: boolean;
  nextRegenDate?: Date | null;
}) {
  if (!items?.length) return <Empty text={empty} />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item, idx) => {
        const title = itemTitle(item);
        const isCached = cache && cache[title.toLowerCase()];
        return (
          <div
            key={`${title}-${idx}`}
            className="flex flex-col rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-[10px] bg-brand-50 type-caption font-semibold text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                {String(idx + 1).padStart(2, '0')}
              </span>
              {item.priority && <Badge color={priorityBadgeColor(item.priority)}>{item.priority}</Badge>}
            </div>
            <h3 className="type-small font-semibold text-gray-800 dark:text-white/90">{title}</h3>
            <p className="mt-1.5 flex-1 type-caption leading-relaxed text-gray-500 dark:text-gray-400">
              {compactText(itemDescription(item))}
            </p>
            {item.cta && (
              <div className="mt-3 inline-block w-fit rounded-[10px] bg-gray-100 px-2 py-1 type-caption text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                {item.cta}
              </div>
            )}
            {onAction && (
              <div className="mt-3 flex items-center gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => onAction(item)}>
                  {isCached ? (
                    <>
                      <Eye size={13} /> View script
                    </>
                  ) : (
                    <>
                      <Wand2 size={13} /> Generate script
                    </>
                  )}
                </Button>
                {isCached && onRegenerate && (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => onRegenerate(item)}
                    disabled={!canRegenerate}
                    title={
                      canRegenerate
                        ? 'Regenerate script'
                        : `Available on ${nextRegenDate?.toLocaleDateString('en-GB')}`
                    }
                  >
                    <RefreshCw size={13} />
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────── Campaigns timeline ─────────────────────── */
const CHANNEL_CFG: Record<string, { color: string; logo: React.ReactNode }> = {
  instagram: {
    color: '#E4405F',
    logo: <img src='/instagram.svg' width={12} height={12} alt='Instagram' />,
  },
  facebook: {
    color: '#1877F2',
    logo: <img src='/facebook.svg' width={12} height={12} alt='Facebook' />,
  },
  whatsapp: {
    color: '#25D366',
    logo: <img src='/whatsapp.svg' width={12} height={12} alt='WhatsApp' />,
  },
  telegram: {
    color: '#229ED9',
    logo: <img src='/telegram.svg' width={12} height={12} alt='Telegram' />,
  },
  youtube: {
    color: '#FF0000',
    logo: <img src='/youtube.svg' width={12} height={12} alt='YouTube' />,
  },
  google: {
    color: '#4285F4',
    logo: <img src='/google-map.svg' width={12} height={12} alt='Google' />,
  },
  website: {
    color: '#465FFF',
    logo: <Globe size={12} className='text-brand-500' />,
  },
};

function CampaignTimeline({
  items,
  empty,
  onAction,
  onRegenerate,
  nextRegenDate,
  canRegenerate,
  scriptCache: cache,
}: {
  items?: GrowthItem[];
  empty: string;
  onAction?: (item: GrowthItem) => void;
  onRegenerate?: (item: GrowthItem) => void;
  nextRegenDate?: Date | null;
  canRegenerate?: boolean;
  scriptCache?: Record<string, any>;
}) {
  if (!items?.length) return <Empty text={empty} />;

  return (
    <div className="flex flex-col gap-3">
      {items.map((item, idx) => {
        const title = itemTitle(item);
        const isCached = cache && cache[title.toLowerCase()];
        return (
          <div
            key={`${title}-${idx}`}
            className='rounded-xl border border-gray-200 p-4 dark:border-gray-800'
          >
            <div className='mb-2 flex flex-wrap items-center gap-2'>
              <span className='flex h-7 w-7 items-center justify-center rounded-[10px] bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                {idx === 0 ? (
                  <Trophy size={13} />
                ) : (
                  <span className='type-caption font-semibold'>{idx + 1}</span>
                )}
              </span>
              {item.priority && (
                <Badge color={priorityBadgeColor(item.priority)}>
                  {item.priority}
                </Badge>
              )}
              {item.day && (
                <span className='ml-auto flex items-center gap-1 type-caption text-gray-400 dark:text-gray-500'>
                  <CalendarDays size={11} /> {item.day}
                </span>
              )}
            </div>
            <h3 className='type-small font-semibold text-gray-800 dark:text-white/90'>
              {title}
            </h3>
            <p className='mt-1.5 type-caption leading-relaxed text-gray-500 dark:text-gray-400'>
              {compactText(itemDescription(item))}
            </p>
            <div className='mt-3 flex items-center justify-between gap-2'>
              {item.channels?.length ? (
                <div className='flex flex-wrap gap-1.5'>
                  {item.channels.map((ch) => (
                    <span
                      key={ch}
                      className='inline-flex items-center gap-1 rounded-[10px] bg-gray-100 px-2 py-0.5 type-caption text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'
                    >
                      {CHANNEL_CFG[ch.toLowerCase()]?.logo || (
                        <GlobeIcon
                          size={11}
                          className='text-gray-400 dark:text-gray-500'
                        />
                      )}
                      {ch}
                    </span>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <div className='flex items-center gap-1.5'>
                {onAction && (
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => onAction(item)}
                  >
                    {isCached ? (
                      <>
                        <Eye size={12} /> View
                      </>
                    ) : (
                      <>
                        <Wand2 size={12} /> Script
                      </>
                    )}
                  </Button>
                )}
                {isCached && onRegenerate && (
                  <Button
                    variant='outline'
                    size='icon-sm'
                    onClick={() => onRegenerate(item)}
                    disabled={!canRegenerate}
                    title={
                      canRegenerate
                        ? 'Regenerate'
                        : `Available on ${nextRegenDate?.toLocaleDateString('en-GB')}`
                    }
                  >
                    <RefreshCw size={12} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────── modal building blocks ─────────────────────── */
function ModalSection({
  icon,
  label,
  color,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="mb-2 flex items-center gap-1.5 type-caption font-semibold uppercase tracking-wide"
        style={{ color: color || undefined }}
      >
        {icon} {label}
      </div>
      {children}
    </div>
  );
}

const TEXT_BLOCK =
  'rounded-xl border border-gray-200 bg-gray-50 p-4 type-small leading-relaxed text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300';

/* ─────────────────────── Main Page ─────────────────────── */
export default function GrowthPage() {
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [latest, setLatest] = useState<LatestGrowthResponse | null>(null);
  const [overview, setOverview] = useState<GrowthOverviewResponse | null>(null);
  const [activeSection, setActiveSection] =
    useState<GrowthSectionKey>('growth-consultant');
  const [isMobile, setIsMobile] = useState(false);
  const [growthMenuOpen, setGrowthMenuOpen] = useState(false);

  const [history, setHistory] = useState<GrowthHistoryItem[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<GrowthHistoryItem | null>(null);

  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptTopic, setScriptTopic] = useState('');
  const [script, setScript] = useState<ScriptResponse['script'] | null>(null);

  const [historyPage, setHistoryPage] = useState(1);

  const [scriptCache, setScriptCache] = useState<Record<string, ScriptResponse['script']>>({});

  /* ── AI Growth Consultant ── */
  const [consultantIdeas, setConsultantIdeas] = useState<ConsultantIdea[]>([]);
  const [consultantNote, setConsultantNote] = useState('');
  const [actionPlan, setActionPlan] = useState<ActionPlanResponse['plan'] | null>(null);
  const [actionPlanLoading, setActionPlanLoading] = useState(false);
  const [actionPlanIdea, setActionPlanIdea] = useState('');
  const [selectedIdea, setSelectedIdea] = useState<ConsultantIdea | null>(null);

  /* ── Growth Radar ── */
  const [radarTrends, setRadarTrends] = useState<RadarTrend[]>([]);
  const [radarSummary, setRadarSummary] = useState('');
  const [radarTab, setRadarTab] = useState<'trending' | 'industry' | 'competitor'>('trending');
  const [radarScannedAt, setRadarScannedAt] = useState<string | null>(null);
  const [expandedRadarIdx, setExpandedRadarIdx] = useState<number | null>(null);

  const report = overview?.report;

  const weeklyGeneratedAt = overview?.weekly_generated_at || latest?.created_at;
  const nextRegenDate = overview?.next_regeneration_at
    ? new Date(overview.next_regeneration_at)
    : weeklyGeneratedAt
      ? new Date(new Date(weeklyGeneratedAt).getTime() + 7 * 24 * 60 * 60 * 1000)
      : null;
  const canRegenerate = overview?.can_regenerate ?? (!nextRegenDate || new Date() >= nextRegenDate);
  const hasGenerated = overview?.weekly_generated === true || !!weeklyGeneratedAt;

  const counts = useMemo(() => {
    const customerVoice = report?.customer_voice?.length || 0;
    const complaints = Math.max(report?.complaints?.length || 0, overview?.metrics?.complaints || 0);
    const opportunities = Math.max(report?.opportunities?.length || 0, overview?.metrics?.opportunities || 0);
    const contentIdeas = report?.content_ideas?.length || 0;
    const campaigns = report?.campaigns?.length || 0;
    const weeklyActions = report?.weekly_action_plan?.length || 0;

    return {
      customerVoice,
      complaints,
      opportunities,
      contentIdeas,
      campaigns,
      weeklyActions,
      total: customerVoice + complaints + opportunities + contentIdeas + campaigns + weeklyActions,
    };
  }, [report, overview]);

  const focusLine = useMemo(() => {
    if (report?.executive_summary) return report.executive_summary;
    const voice = report?.customer_voice?.[0] ? itemTitle(report.customer_voice[0]) : 'customer questions';
    const opp = report?.opportunities?.[0] ? itemTitle(report.opportunities[0]) : 'growth opportunities';
    return `Customers are talking about ${voice}. This week, use ${opp} to convert more conversations.`;
  }, [report]);

  async function loadLatest() {
    setLoading(true);
    setErr(null);

    try {
      const [overviewRes, historyRes] = await Promise.allSettled([
        apiFetch<GrowthOverviewResponse>('/admin/growth/overview', { auth: true }),
        apiFetch<GrowthHistoryResponse>('/admin/growth/history?limit=20', { auth: true }),
      ]);

      if (overviewRes.status === 'fulfilled') {
        const ov = overviewRes.value;
        setOverview(ov);

        setLatest({
          exists: ov.latest_report_exists ?? false,
          id: ov.latest_report_id,
          week_start: ov.week_start,
          week_end: ov.week_end,
          created_at: ov.latest_report_created_at,
          report: ov.report,
        });

        const consultant = ov.consultant ?? ov.report?.consultant ?? null;
        setConsultantIdeas(consultant?.ideas ?? []);
        setConsultantNote(consultant?.consultant_note ?? '');

        const radar = ov.radar ?? ov.report?.radar ?? null;
        setRadarTrends(radar?.trends ?? []);
        setRadarSummary(radar?.radar_summary ?? '');
        setRadarScannedAt(
          ov.latest_report_created_at ??
          ov.weekly_generated_at ??
          null,
        );
      } else {
        throw overviewRes.reason;
      }

      if (historyRes.status === 'fulfilled') {
        setHistory(historyRes.value.reports || []);
      }
    } catch (e: any) {
      const msg =
        typeof e?.message === 'string' ? e.message : typeof e === 'string' ? e : JSON.stringify(e, null, 2);
      setErr(msg || 'Failed to load Growth data');
    } finally {
      setLoading(false);
    }
  }

  const wait = (milliseconds: number) =>
    new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  async function waitForGrowthGeneration(): Promise<void> {
    const maxAttempts = 90; // 3 minutes at 2-second intervals

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const status = await apiFetch<{
        status: 'idle' | 'queued' | 'processing' | 'completed' | 'failed';
        error?: string | null;
        report_id?: number | null;
      }>('/admin/growth/generation-status', {
        auth: true,
      });

      if (status.status === 'completed') {
        await loadLatest();
        return;
      }

      if (status.status === 'failed') {
        await loadLatest();
        throw new Error(
          status.error ||
          'The new plan could not be completed. Your previous plan is still available.',
        );
      }

      await wait(2000);
    }

    throw new Error(
      'Generation is taking longer than expected. Your previous plan remains available; refresh shortly to check the new plan.',
    );
  }

  async function generateReport() {
    if (generating) return;

    setGenerating(true);
    setErr(null);

    try {
      const res = await apiFetch<{
        status: 'queued' | 'already_processing' | 'not_due';
        queued: boolean;
      }>('/admin/growth/generate', {
        method: 'POST',
        auth: true,
        body: {},
      });

      if (res.status === 'not_due') {
        await loadLatest();
        return;
      }

      await waitForGrowthGeneration();
    } catch (e: any) {
      setErr(
        e?.message ||
        'The new plan could not be generated. Your previous plan remains available.',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function generateScript(topic: string, context?: string, forceRegenerate = false) {
    const safeTopic = typeof topic === 'string' ? topic.trim() : itemTitle(topic as any).trim();

    const safeContext =
      typeof context === 'string' ? context.trim() : context ? JSON.stringify(context) : '';

    if (!safeTopic) {
      setErr('Topic is required to generate a script');
      return;
    }

    const cacheKey = safeTopic.toLowerCase();
    if (!forceRegenerate && scriptCache[cacheKey]) {
      setScriptTopic(safeTopic);
      setScript(scriptCache[cacheKey]);
      return;
    }

    setScriptTopic(safeTopic);
    setScript(null);
    setScriptLoading(true);
    setErr(null);

    try {
      const res = await apiFetch<ScriptResponse>('/admin/growth/script', {
        method: 'POST',
        auth: true,
        body: {
          topic: safeTopic,
          context: safeContext,
          format_type: 'reel',
          force: forceRegenerate,
        },
      });

      const result = res.script || {
        title: safeTopic,
        hook: 'Script generated, but the response was empty.',
      };
      setScript(result);
      setScriptCache((prev) => ({ ...prev, [cacheKey]: result }));
    } catch (e: any) {
      const msg =
        typeof e?.message === 'string' ? e.message : typeof e === 'string' ? e : JSON.stringify(e, null, 2);

      setScript({
        title: 'Script Generation Failed',
        hook: msg || 'Please check the /admin/growth/script request payload and backend response.',
      });
    } finally {
      setScriptLoading(false);
    }
  }

  async function loadActionPlan(ideaTitle: string, ideaDescription: string) {
    setActionPlanIdea(ideaTitle);
    setActionPlan(null);
    setActionPlanLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<ActionPlanResponse>('/admin/growth/consultant/action-plan', {
        method: 'POST',
        auth: true,
        body: { title: ideaTitle, description: ideaDescription },
      });
      setActionPlan(res.plan || null);
    } catch (e: any) {
      setActionPlan({
        idea_title: 'Action Plan Failed',
        quick_start: e?.message || 'Failed to generate action plan.',
      });
    } finally {
      setActionPlanLoading(false);
    }
  }

  const filteredRadarTrends = useMemo(
    () => radarTrends.filter((tr) => tr.category === radarTab),
    [radarTrends, radarTab],
  );

  const historyTotalPages = getTotalPages(history.length, 8);
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedHistory = getPageItems(history, currentHistoryPage, 8);

  useEffect(() => {
    loadLatest();
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);

    check();
    window.addEventListener('resize', check);

    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (historyPage <= historyTotalPages) return;
    setHistoryPage(historyTotalPages);
  }, [historyPage, historyTotalPages]);

  const GROWTH_NAV: {
    key: GrowthSectionKey;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
      {
        key: 'growth-consultant',
        title: 'Growth Consultant',
        subtitle: 'Strategic growth ideas',
        icon: <Brain size={20} />,
        count: consultantIdeas.length,
      },
      {
        key: 'content-ideas',
        title: 'Content Ideas',
        subtitle: 'Social post angles',
        icon: <Lightbulb size={20} />,
        count: counts.contentIdeas,
      },
      {
        key: 'campaigns',
        title: 'Campaigns',
        subtitle: 'Weekly campaign angles',
        icon: <Megaphone size={20} />,
        count: counts.campaigns,
      },
      {
        key: 'weekly-action-plan',
        title: 'Weekly Action Plan',
        subtitle: 'Execution checklist',
        icon: <CheckCircle2 size={20} />,
        count: counts.weeklyActions,
      },
      {
        key: 'custom-reel-script',
        title: 'Generate a Custom Reel Script',
        subtitle: 'Create reel scripts',
        icon: <Wand2 size={20} />,
      },
      {
        key: 'trending',
        title: 'Trending now',
        subtitle: 'Live market trends',
        icon: <Flame size={20} />,
        count: radarTrends.filter((tr) => tr.category === 'trending').length,
      },
      {
        key: 'industry',
        title: 'Industry shifts',
        subtitle: 'Category changes',
        icon: <MapPin size={20} />,
        count: radarTrends.filter((tr) => tr.category === 'industry').length,
      },
      {
        key: 'competitor',
        title: 'Competitor moves',
        subtitle: 'Competitive activity',
        icon: <Target size={20} />,
        count: radarTrends.filter((tr) => tr.category === 'competitor').length,
      },
      {
        key: 'report-history',
        title: 'Report History',
        subtitle: 'Previous weekly reports',
        icon: <CalendarDays size={20} />,
        count: history.length,
      },
    ];

  return (
    <RequireAuth>
      <PageBreadcrumb pageTitle='Growth' />

      <div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
        <div>
          <Badge color='primary' startIcon={<Sparkles size={13} />}>
            AI Growth Studio
          </Badge>
          <p className='mt-2 max-w-xl type-small text-gray-500 dark:text-gray-400'>
            Turn customer conversations into weekly actions, content ideas and
            follow-ups.
          </p>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          {/* {hasGenerated && (
            <span className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 type-caption font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'>
              <Clock size={13} />
              Updated {fmtDate(latest?.created_at)}
            </span>
          )} */}

          <Button
            variant='outline'
            onClick={loadLatest}
            disabled={loading}
          >
            {loading ? (
              <Loader2 size={15} className='animate-spin' />
            ) : (
              <RefreshCw size={15} />
            )}
            Refresh
          </Button>

          {hasGenerated && !canRegenerate ? (
            <span className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 type-caption font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400'>
              <CalendarDays size={13} />
              Regenerate on{' '}
              {nextRegenDate?.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          ) : (
            <Button onClick={generateReport} disabled={generating}>
              {generating ? (
                <Loader2 size={15} className='animate-spin' />
              ) : (
                <RefreshCw size={15} />
              )}
              {generating
                ? 'Generating...'
                : hasGenerated
                  ? 'Regenerate Plan'
                  : 'Generate Plan'}
            </Button>
          )}
        </div>
      </div>

      {err && (
        <div className='mb-6 flex items-center gap-3 rounded-[10px] border border-error-200 bg-error-50 px-4 py-3 type-small text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400'>
          <AlertTriangle size={16} className='shrink-0' />
          {err}
        </div>
      )}

      {loading ? (
        <div className='flex min-h-[260px] flex-col items-center justify-center gap-3 text-center'>
          <div className='h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-brand-500 dark:border-gray-800 dark:border-t-brand-400' />
          <span className='type-small text-gray-400 dark:text-gray-500'>
            Loading Growth report...
          </span>
        </div>
      ) : !latest?.exists ? (
        <div
          className={cn(
            CARD,
            'flex flex-col items-center px-6 py-16 text-center',
          )}
        >
          <div className='mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
            <Sparkles size={30} />
          </div>
          <h2 className='type-h4 font-semibold text-gray-800 dark:text-white/90'>
            No Growth plan yet
          </h2>
          <p className='mx-auto mt-2 max-w-md type-small leading-relaxed text-gray-500 dark:text-gray-400'>
            Generate your first weekly growth plan from conversations, leads,
            complaints and FAQs.
          </p>
          <Button
            className='mt-6'
            onClick={generateReport}
            disabled={generating || (hasGenerated && !canRegenerate)}
          >
            {generating ? (
              <Loader2 size={15} className='animate-spin' />
            ) : (
              <Zap size={15} />
            )}
            {generating ? 'Generating...' : 'Generate Weekly Plan'}
          </Button>
        </div>
      ) : (
        <div className='flex flex-col gap-6'>
          {/* Hero */}
          <div className={cn(CARD, 'p-6 sm:p-6')}>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-[190px_1fr] md:items-center'>
              <div className='mx-auto w-full max-w-[190px]'>
                <GrowthGauge
                  score={report?.growth_score || 0}
                  isDark={isDark}
                />
              </div>
              <div>
                <h2 className='type-h4 font-semibold text-gray-800 dark:text-white/90'>
                  This Week&apos;s Growth Plan
                </h2>
                <p className='mt-1.5 type-small leading-relaxed text-gray-500 dark:text-gray-400'>
                  A simple weekly view of what customers are saying, what needs
                  fixing and where growth can come from.
                </p>
                <div className='mt-3 flex flex-wrap gap-2'>
                  <span className='inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 type-caption font-medium text-gray-500 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400'>
                    <CalendarDays size={13} />
                    Generated {fmtDate(weeklyGeneratedAt ?? undefined)} · Next
                    on {fmtDate(overview?.next_regeneration_at ?? undefined)}
                  </span>
                  <Badge color='primary' startIcon={<Target size={13} />}>
                    {counts.total} useful signals
                  </Badge>
                </div>
              </div>
            </div>

            {focusLine && (
              <div className='mt-5 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/25 dark:bg-brand-500/10'>
                <div className='mb-1 flex items-center gap-1.5 type-caption font-semibold text-brand-600 dark:text-brand-400'>
                  <Sparkles size={13} /> This week&apos;s focus
                </div>
                <p className='type-small leading-relaxed text-gray-700 dark:text-gray-200'>
                  {focusLine}
                </p>
              </div>
            )}
          </div>

          <div className='grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr] lg:items-start'>
            <div>
              {isMobile && (
                <button
                  type='button'
                  onClick={() => setGrowthMenuOpen((p) => !p)}
                  className='mb-3 flex h-10 w-full items-center justify-between rounded-[10px] border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.03]'
                >
                  <span>Growth Menu</span>
                  <Menu size={18} />
                </button>
              )}

              {(!isMobile || growthMenuOpen) && (
                <div className='overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/40 shadow-theme-xs dark:border-brand-500/20 dark:bg-brand-500/[0.05]'>
                  <div className='border-b border-brand-100 bg-white/70 px-5 py-4 dark:border-brand-500/15 dark:bg-white/[0.02]'>
                    <div className='flex items-center gap-2'>
                      <div className='flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-100 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'>
                        <Menu size={16} />
                      </div>

                      <div>
                        <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                          Growth Menu
                        </h3>

                        <p className='mt-0.5 type-caption text-gray-500 dark:text-gray-400'>
                          Explore your growth tools
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className='flex flex-col gap-1.5 p-3'>
                    {GROWTH_NAV.map((item) => {
                      const active = activeSection === item.key;

                      return (
                        <button
                          key={item.key}
                          type='button'
                          onClick={() => {
                            setActiveSection(item.key);
                            if (
                              item.key === 'trending' ||
                              item.key === 'industry' ||
                              item.key === 'competitor'
                            ) {
                              setRadarTab(item.key);
                              setExpandedRadarIdx(null);
                            }
                            setGrowthMenuOpen(false);
                          }}
                          className={cn(
                            'group flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left transition-all',
                            active
                              ? 'border-brand-200 bg-white shadow-theme-xs dark:border-brand-500/25 dark:bg-brand-500/[0.12]'
                              : 'border-transparent bg-white/40 hover:border-brand-100 hover:bg-white dark:bg-white/[0.02] dark:hover:border-brand-500/15 dark:hover:bg-white/[0.05]',
                          )}
                        >
                          <span className='flex min-w-0 items-center gap-3'>
                            <span
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]',
                                active
                                  ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-white/10 dark:text-brand-400'
                                  : 'text-gray-500 dark:text-gray-400',
                              )}
                            >
                              {item.icon}
                            </span>

                            <span className='min-w-0'>
                              <span
                                className={cn(
                                  'block truncate type-small font-semibold',
                                  active
                                    ? 'text-brand-500 dark:text-brand-400'
                                    : 'text-gray-700 dark:text-gray-300',
                                )}
                              >
                                {item.title}
                              </span>
                              <span className='mt-0.5 block truncate type-caption font-normal text-gray-400 dark:text-gray-500'>
                                {item.subtitle}
                              </span>
                            </span>
                          </span>

                          <span className='flex shrink-0 items-center gap-2'>
                            {typeof item.count === 'number' && (
                              <span className='rounded-full bg-brand-50 px-1.5 py-0.5 type-caption font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'>
                                {item.count}
                              </span>
                            )}
                            <ChevronRight
                              size={16}
                              className={cn(
                                active
                                  ? 'text-brand-400'
                                  : 'text-gray-300 dark:text-gray-600',
                              )}
                            />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className='min-w-0 space-y-6'>
              {/* Cooldown / status pill */}
              {hasGenerated && (
                <div
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl px-4 py-2 type-small font-medium',
                    canRegenerate
                      ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400',
                  )}
                >
                  {canRegenerate ? (
                    <RefreshCw size={14} />
                  ) : (
                    <CheckCircle2 size={14} />
                  )}
                  {canRegenerate
                    ? 'Cooldown complete — you can regenerate your plan now.'
                    : `Generated ${fmtDate(weeklyGeneratedAt)} · Next regeneration available ${nextRegenDate?.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                </div>
              )}
              {activeSection === 'report-history' && (
                <Section
                  icon={<CalendarDays size={20} />}
                  title='Report History'
                  sub='Previous weekly growth reports'
                  count={history.length}
                >
                  {history.length === 0 ? (
                    <Empty text='No previous weekly reports yet.' />
                  ) : (
                    <>
                      <div className='flex flex-col gap-3'>
                        {paginatedHistory.map((h) => {
                          const isCurrent = h.id === history[0]?.id;
                          const scoreColor =
                            typeof h.growth_score === 'number'
                              ? h.growth_score >= 70
                                ? PALETTE.success
                                : h.growth_score >= 40
                                  ? PALETTE.warning
                                  : PALETTE.error
                              : undefined;

                          return (
                            <div
                              key={h.id}
                              onClick={() => setSelectedHistory(h)}
                              className='flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3.5 transition hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
                            >
                              <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                                <CalendarDays size={15} />
                              </div>
                              <div className='min-w-0 flex-1'>
                                <div className='flex flex-wrap items-center gap-2 type-small font-semibold text-gray-800 dark:text-white/90'>
                                  {fmtDate(h.week_start)} –{' '}
                                  {fmtDate(h.week_end)}
                                  {isCurrent && (
                                    <Badge color='success'>Current</Badge>
                                  )}
                                </div>
                                <p className='mt-0.5 truncate type-caption text-gray-500 dark:text-gray-400'>
                                  {compactText(
                                    h.biggest_opportunity,
                                    'No summary available.',
                                  )}
                                </p>
                              </div>
                              {typeof h.growth_score === 'number' && (
                                <div className='text-right'>
                                  <div
                                    className='type-card-title font-bold'
                                    style={{ color: scoreColor }}
                                  >
                                    {h.growth_score}
                                  </div>
                                  <div className='type-caption text-gray-400 dark:text-gray-500'>
                                    score
                                  </div>
                                </div>
                              )}
                              <ChevronRight
                                size={16}
                                className='shrink-0 text-gray-300 dark:text-gray-600'
                              />
                            </div>
                          );
                        })}
                      </div>

                      <TablePagination
                        page={currentHistoryPage}
                        totalItems={history.length}
                        onPageChange={setHistoryPage}
                        pageSize={8}
                      />
                    </>
                  )}
                </Section>
              )}

              {/* AI Growth Consultant */}
              {activeSection === 'growth-consultant' && (
                <Section
                  icon={<Brain size={20} />}
                  title='Growth Consultant'
                  sub={
                    consultantIdeas.length
                      ? 'Tap a card for the full plan'
                      : 'Unconventional ideas tailored to your business'
                  }
                  count={consultantIdeas.length}
                >
                  {consultantNote && (
                    <div className='mb-4 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/25 dark:bg-brand-500/10'>
                      <div className='mb-1 flex items-center gap-1.5 type-caption font-semibold text-brand-600 dark:text-brand-400'>
                        <Brain size={13} /> Consultant note
                      </div>
                      <p className='type-small leading-relaxed text-gray-700 dark:text-gray-200'>
                        {consultantNote}
                      </p>
                    </div>
                  )}

                  {consultantIdeas.length === 0 ? (
                    <Empty
                      text={
                        generating
                          ? 'Generating consultant ideas...'
                          : 'Click "Generate Plan" above to get strategic growth ideas from your AI consultant.'
                      }
                    />
                  ) : (
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                      {consultantIdeas.map((idea, idx) => (
                        <div
                          key={`${idea.title}-${idx}`}
                          onClick={() => setSelectedIdea(idea)}
                          className='cursor-pointer overflow-hidden rounded-xl border border-gray-200 transition hover:-translate-y-0.5 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700'
                        >
                          <div
                            className='flex aspect-[16/9] min-h-[160px] items-center justify-center bg-gray-50 bg-cover bg-center dark:bg-white/[0.03]'
                            style={
                              idea.thumbnail
                                ? { backgroundImage: `url(${idea.thumbnail})` }
                                : undefined
                            }
                          >
                            {!idea.thumbnail && (
                              <Sparkles
                                size={26}
                                className='text-gray-300 dark:text-gray-700'
                              />
                            )}
                          </div>
                          <div className='p-3.5'>
                            <Badge
                              color={CATEGORY_BADGE[idea.category] || 'primary'}
                              className='capitalize'
                            >
                              {idea.category}
                            </Badge>
                            <h3 className='mt-2 type-small font-semibold text-gray-800 dark:text-white/90'>
                              {idea.title}
                            </h3>
                            <p className='mt-1.5 type-caption leading-relaxed text-gray-500 dark:text-gray-400'>
                              {compactText(idea.description, 'No description')}
                            </p>
                            <div className='mt-2.5 flex flex-wrap gap-1.5'>
                              {idea.estimated_cost && (
                                <span className='rounded-[10px] bg-gray-100 px-2 py-0.5 type-caption text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'>
                                  {idea.estimated_cost === 'free'
                                    ? 'Free'
                                    : `${idea.estimated_cost} cost`}
                                </span>
                              )}
                              {idea.viral_potential && (
                                <Badge
                                  color={
                                    idea.viral_potential === 'high'
                                      ? 'success'
                                      : 'warning'
                                  }
                                >
                                  {idea.viral_potential} viral
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {(activeSection === 'trending' ||
                activeSection === 'industry' ||
                activeSection === 'competitor') && (
                  <Section
                    icon={
                      activeSection === 'trending' ? (
                        <Flame size={20} />
                      ) : activeSection === 'industry' ? (
                        <MapPin size={20} />
                      ) : (
                        <Target size={20} />
                      )
                    }
                    title={
                      GROWTH_NAV.find((item) => item.key === activeSection)
                        ?.title || 'Market Signals'
                    }
                    sub={
                      radarScannedAt
                        ? `Scanned ${fmtDate(radarScannedAt)}`
                        : "What's trending now and how you can use it"
                    }
                    count={filteredRadarTrends.length}
                  >
                    {radarSummary && (
                      <div className='mb-4 rounded-xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-500/25 dark:bg-warning-500/10'>
                        <div className='mb-1 flex items-center gap-1.5 type-caption font-semibold text-warning-700 dark:text-orange-300'>
                          <Radar size={13} /> Market overview
                        </div>
                        <p className='type-small leading-relaxed text-gray-700 dark:text-gray-200'>
                          {radarSummary}
                        </p>
                      </div>
                    )}

                    {filteredRadarTrends.length > 0 ? (
                      <div className='flex flex-col gap-3'>
                        {filteredRadarTrends.map((trend, idx) => {
                          const urgency =
                            URGENCY_BADGE[trend.urgency || 'watch'] ||
                            URGENCY_BADGE.watch;
                          const scoreColor =
                            trend.match_score >= 80
                              ? PALETTE.success
                              : trend.match_score >= 60
                                ? PALETTE.warning
                                : '#94A3B8';
                          const isExpanded = expandedRadarIdx === idx;
                          const CategoryIcon =
                            trend.category === 'trending'
                              ? Flame
                              : trend.category === 'industry'
                                ? MapPin
                                : Target;

                          return (
                            <div
                              key={`${trend.title}-${idx}`}
                              className='overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800'
                            >
                              <div className='grid grid-cols-1 sm:grid-cols-[1fr_140px]'>
                                <div className='p-4'>
                                  <div className='mb-1.5 flex items-center gap-2'>
                                    <Badge
                                      color={urgency.color}
                                      startIcon={
                                        trend.urgency === 'act_now' ? (
                                          <Flame size={11} />
                                        ) : (
                                          <Clock size={11} />
                                        )
                                      }
                                    >
                                      {urgency.label}
                                    </Badge>
                                    {trend.source_url && (
                                      <a
                                        href={trend.source_url}
                                        target='_blank'
                                        rel='noopener noreferrer'
                                        className='type-caption text-gray-400 no-underline hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                                      >
                                        {(() => {
                                          try {
                                            return new URL(
                                              trend.source_url,
                                            ).hostname.replace('www.', '');
                                          } catch {
                                            return '';
                                          }
                                        })()}
                                      </a>
                                    )}
                                  </div>
                                  <div className='mb-1.5 type-small font-semibold text-gray-800 dark:text-white/90'>
                                    {trend.title}
                                  </div>
                                  <p className='mb-2.5 type-caption leading-relaxed text-gray-500 dark:text-gray-400'>
                                    {trend.description}
                                  </p>

                                  <div className='mb-2.5 flex items-center gap-2'>
                                    <div className='h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-white/[0.06]'>
                                      <div
                                        className='h-full rounded-full transition-all duration-700'
                                        style={{
                                          width: `${trend.match_score}%`,
                                          background: scoreColor,
                                        }}
                                      />
                                    </div>
                                    <span
                                      className='type-caption font-semibold'
                                      style={{ color: scoreColor }}
                                    >
                                      {trend.match_score}%
                                    </span>
                                  </div>

                                  <button
                                    type='button'
                                    onClick={() =>
                                      setExpandedRadarIdx(isExpanded ? null : idx)
                                    }
                                    className='flex items-center gap-1.5 type-caption font-semibold text-brand-500 dark:text-brand-400'
                                  >
                                    <ChevronDown
                                      size={13}
                                      className={cn(
                                        'transition-transform',
                                        isExpanded && 'rotate-180',
                                      )}
                                    />
                                    How you can use this
                                  </button>

                                  {isExpanded && trend.implementation && (
                                    <>
                                      <div className='mt-2.5 rounded-[10px] bg-gray-50 p-3 type-caption leading-relaxed text-gray-600 dark:bg-white/[0.03] dark:text-gray-300'>
                                        {trend.implementation}
                                      </div>
                                      <Button
                                        variant='outline'
                                        size='sm'
                                        className='mt-2.5'
                                        onClick={() =>
                                          generateScript(
                                            trend.title,
                                            trend.implementation ||
                                            trend.description,
                                          )
                                        }
                                      >
                                        <Film size={13} /> Reel script
                                      </Button>
                                    </>
                                  )}
                                </div>
                                <div
                                  className='flex min-h-[110px] items-center justify-center bg-gray-50 bg-cover bg-center dark:bg-white/[0.03]'
                                  style={
                                    trend.thumbnail
                                      ? {
                                        backgroundImage: `url(${trend.thumbnail})`,
                                      }
                                      : undefined
                                  }
                                >
                                  {!trend.thumbnail && (
                                    <CategoryIcon
                                      size={26}
                                      className='text-gray-300 dark:text-gray-700'
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Empty
                        text={
                          radarTrends.length === 0
                            ? generating
                              ? 'Scanning market trends...'
                              : 'Click "Generate Plan" above to scan live market trends for your business.'
                            : `No ${radarTab} trends found. Try another tab.`
                        }
                      />
                    )}
                  </Section>
                )}

              {activeSection === 'content-ideas' && (
                <Section
                  icon={<Lightbulb size={20} />}
                  title='Content Ideas'
                  sub='Turn customer questions into social content'
                  count={counts.contentIdeas}
                >
                  <MagazineGrid
                    items={report?.content_ideas}
                    empty='No content ideas generated yet.'
                    onAction={(item) =>
                      generateScript(itemTitle(item), itemDescription(item))
                    }
                    onRegenerate={(item) =>
                      generateScript(
                        itemTitle(item),
                        itemDescription(item),
                        true,
                      )
                    }
                    canRegenerate={canRegenerate}
                    nextRegenDate={nextRegenDate}
                    scriptCache={scriptCache}
                  />
                </Section>
              )}

              {activeSection === 'campaigns' && (
                <Section
                  icon={<Megaphone size={20} />}
                  title='Campaigns'
                  sub='Campaign angles you can run this week'
                  count={counts.campaigns}
                >
                  <CampaignTimeline
                    items={report?.campaigns}
                    empty='No campaigns suggested yet.'
                    onAction={(item) =>
                      generateScript(itemTitle(item), itemDescription(item))
                    }
                    onRegenerate={(item) =>
                      generateScript(
                        itemTitle(item),
                        itemDescription(item),
                        true,
                      )
                    }
                    canRegenerate={canRegenerate}
                    nextRegenDate={nextRegenDate}
                    scriptCache={scriptCache}
                  />
                </Section>
              )}

              {/* Weekly Action Plan */}
              {activeSection === 'weekly-action-plan' && (
                <Section
                  icon={<CheckCircle2 size={20} />}
                  title='Weekly Action Plan'
                  sub='A simple execution list for the team'
                  count={counts.weeklyActions}
                >
                  <ActionGrid
                    items={report?.weekly_action_plan}
                    empty='No weekly action plan yet.'
                  />
                </Section>
              )}

              {/* Custom script generator */}
              {activeSection === 'custom-reel-script' && (
                <Section
                  icon={<Wand2 size={20} />}
                  title='Generate a Custom Reel Script'
                  sub='Enter any growth topic and create a script immediately'
                >
                  <div className='flex flex-wrap gap-3'>
                    <Input
                      value={scriptTopic}
                      onChange={(e) => setScriptTopic(e.target.value)}
                      placeholder='Example: How faster replies increase Instagram sales'
                      className='min-w-[280px] flex-1'
                    />
                    <Button
                      disabled={scriptLoading || !scriptTopic.trim()}
                      onClick={() => generateScript(scriptTopic)}
                    >
                      {scriptLoading ? (
                        <Loader2 size={15} className='animate-spin' />
                      ) : (
                        <Play size={15} />
                      )}
                      Generate Script
                    </Button>
                  </div>
                </Section>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════ Script Modal ══════ */}
      <Modal
        isOpen={scriptLoading || !!script}
        onClose={() => !scriptLoading && setScript(null)}
        className='m-4 max-w-[820px]'
      >
        <div className='flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[20px] bg-white dark:bg-gray-900'>
          <div className='flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5 pr-14 dark:border-gray-800'>
            <div className='flex items-center gap-3'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                <Film size={18} />
              </div>
              <div>
                <h2 className='type-body font-semibold text-gray-800 dark:text-white/90'>
                  {script?.title || 'Reel Script'}
                </h2>
                <p className='mt-0.5 type-caption text-gray-500 dark:text-gray-400'>
                  {scriptTopic || 'Generated content idea'}
                  {script?.scenes?.length
                    ? ` · ${script.scenes.length} scenes`
                    : ''}
                </p>
              </div>
            </div>
          </div>

          <div className='flex-1 overflow-y-auto px-6 py-5'>
            {scriptLoading ? (
              <div className='flex min-h-[220px] flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400'>
                <Loader2 size={26} className='animate-spin' />
                <span className='type-small font-medium'>
                  Generating script...
                </span>
              </div>
            ) : script ? (
              <div className='flex flex-col gap-5'>
                {script.hook && (
                  <ModalSection
                    icon={<Sparkles size={13} />}
                    label='Hook'
                    color={PALETTE.brand}
                  >
                    <div className={TEXT_BLOCK}>{script.hook}</div>
                  </ModalSection>
                )}

                {script.scenes?.length ? (
                  <ModalSection
                    icon={<Film size={13} />}
                    label='Storyboard'
                    color={PALETTE.brand}
                  >
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                      {script.scenes.map((scene) => (
                        <div
                          key={scene.scene}
                          className='overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800'
                        >
                          <div className='bg-brand-50 px-3.5 py-2 type-caption font-semibold uppercase tracking-wide text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'>
                            Scene {scene.scene}
                          </div>
                          <div className='flex flex-col gap-2 p-3.5'>
                            <div>
                              <span className='type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                                Visual
                              </span>
                              <p className='type-caption leading-relaxed text-gray-700 dark:text-gray-300'>
                                {scene.visual}
                              </p>
                            </div>
                            <div>
                              <span className='type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                                Voiceover
                              </span>
                              <p className='type-caption leading-relaxed text-gray-700 dark:text-gray-300'>
                                {scene.voiceover}
                              </p>
                            </div>
                            <div>
                              <span className='type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                                On-screen
                              </span>
                              <p className='type-caption leading-relaxed text-gray-700 dark:text-gray-300'>
                                {scene.onscreen_text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ModalSection>
                ) : null}

                {script.caption && (
                  <ModalSection
                    icon={<MessageCircle size={13} />}
                    label='Caption'
                    color={PALETTE.brand}
                  >
                    <div className={TEXT_BLOCK}>{script.caption}</div>
                  </ModalSection>
                )}

                <div className='flex flex-wrap gap-4'>
                  {script.cta && (
                    <div className='flex-1 basis-[220px]'>
                      <ModalSection
                        icon={<Target size={13} />}
                        label='CTA'
                        color={PALETTE.brand}
                      >
                        <div className={TEXT_BLOCK}>{script.cta}</div>
                      </ModalSection>
                    </div>
                  )}
                  {script.thumbnail_text && (
                    <div className='flex-1 basis-[220px]'>
                      <ModalSection
                        icon={<FileText size={13} />}
                        label='Thumbnail text'
                        color={PALETTE.brand}
                      >
                        <div className={TEXT_BLOCK}>
                          {script.thumbnail_text}
                        </div>
                      </ModalSection>
                    </div>
                  )}
                </div>

                {script.hashtags?.length ? (
                  <ModalSection
                    icon={<Hash size={13} />}
                    label='Hashtags'
                    color={PALETTE.brand}
                  >
                    <div className='flex flex-wrap gap-2'>
                      {script.hashtags.map((tag) => (
                        <Badge key={tag} color='primary'>
                          {tag.startsWith('#') ? tag : `#${tag}`}
                        </Badge>
                      ))}
                    </div>
                  </ModalSection>
                ) : null}
              </div>
            ) : null}
          </div>

          {script && !scriptLoading && (
            <div className='flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800'>
              <Button
                variant='outline'
                onClick={() => {
                  const parts: string[] = [];
                  if (script.title) parts.push(`Title: ${script.title}`);
                  if (script.hook) parts.push(`Hook: ${script.hook}`);
                  script.scenes?.forEach((s) => {
                    parts.push(
                      `Scene ${s.scene}:\n  Visual: ${s.visual}\n  Voiceover: ${s.voiceover}\n  On-screen: ${s.onscreen_text}`,
                    );
                  });
                  if (script.caption) parts.push(`Caption: ${script.caption}`);
                  if (script.cta) parts.push(`CTA: ${script.cta}`);
                  if (script.thumbnail_text)
                    parts.push(`Thumbnail: ${script.thumbnail_text}`);
                  if (script.hashtags?.length)
                    parts.push(`Hashtags: ${script.hashtags.join(' ')}`);
                  navigator.clipboard?.writeText(parts.join('\n\n'));
                }}
              >
                <Copy size={14} /> Copy script
              </Button>
              <Button
                onClick={() => generateScript(scriptTopic, undefined, true)}
                disabled={!canRegenerate}
              >
                <RefreshCw size={14} /> Regenerate
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════ Consultant Idea Detail Modal ══════ */}
      {selectedIdea && (
        <Modal
          isOpen
          onClose={() => setSelectedIdea(null)}
          className='m-4 max-w-[640px]'
        >
          <div className='max-h-[85vh] w-full overflow-y-auto rounded-[20px] bg-white dark:bg-gray-900'>
            {selectedIdea.thumbnail && (
              <div
                className='aspect-[16/9] min-h-[220px] bg-cover bg-center'
                style={{ backgroundImage: `url(${selectedIdea.thumbnail})` }}
              />
            )}
            <div className='p-6 pr-14'>
              <div className='mb-3 flex flex-wrap items-center gap-2'>
                <Badge
                  color={CATEGORY_BADGE[selectedIdea.category] || 'primary'}
                  className='capitalize'
                >
                  {selectedIdea.category}
                </Badge>
                {selectedIdea.viral_potential && (
                  <Badge
                    color={
                      selectedIdea.viral_potential === 'high'
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {selectedIdea.viral_potential} viral potential
                  </Badge>
                )}
                {selectedIdea.estimated_cost && (
                  <Badge
                    color={
                      selectedIdea.estimated_cost === 'free'
                        ? 'success'
                        : 'info'
                    }
                  >
                    {selectedIdea.estimated_cost === 'free'
                      ? 'Zero cost'
                      : `${selectedIdea.estimated_cost} cost`}
                  </Badge>
                )}
              </div>
              <h2 className='mb-2.5 type-card-title font-semibold text-gray-800 dark:text-white/90'>
                {selectedIdea.title}
              </h2>
              <p className='mb-4 type-small leading-relaxed text-gray-600 dark:text-gray-300'>
                {selectedIdea.description}
              </p>

              {selectedIdea.data_evidence && (
                <div className='mb-3.5 rounded-[10px] bg-brand-50 p-3.5 type-caption leading-relaxed text-gray-600 dark:bg-brand-500/10 dark:text-gray-300'>
                  <span className='font-semibold text-brand-600 dark:text-brand-400'>
                    Data evidence:{' '}
                  </span>
                  {selectedIdea.data_evidence}
                </div>
              )}

              {selectedIdea.expected_outcome && (
                <div className='mb-3.5 rounded-[10px] bg-success-50 p-3.5 type-caption leading-relaxed text-gray-600 dark:bg-success-500/10 dark:text-gray-300'>
                  <span className='font-semibold text-success-700 dark:text-success-400'>
                    Expected outcome:{' '}
                  </span>
                  {selectedIdea.expected_outcome}
                </div>
              )}

              {selectedIdea.tags?.length > 0 && (
                <div className='mb-5 flex flex-wrap gap-1.5'>
                  {selectedIdea.tags.map((tag) => (
                    <span
                      key={tag}
                      className='rounded-[10px] bg-gray-100 px-2 py-0.5 type-caption text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'
                    >
                      {tag.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}

              <div className='flex flex-wrap gap-3'>
                <Button
                  className='flex-1'
                  onClick={() => {
                    loadActionPlan(
                      selectedIdea.title,
                      selectedIdea.description,
                    );
                    setSelectedIdea(null);
                  }}
                >
                  <Wand2 size={15} /> Generate action plan
                </Button>
                <Button
                  variant='outline'
                  className='flex-1'
                  onClick={() => {
                    generateScript(
                      selectedIdea.title,
                      selectedIdea.description,
                    );
                    setSelectedIdea(null);
                  }}
                >
                  <Film size={15} /> Create reel script
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ══════ Action Plan Modal ══════ */}
      <Modal
        isOpen={actionPlanLoading || !!actionPlan}
        onClose={() => !actionPlanLoading && setActionPlan(null)}
        className='m-4 max-w-[720px]'
      >
        <div className='flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[20px] bg-white dark:bg-gray-900'>
          <div className='flex items-center gap-3 border-b border-gray-100 px-6 py-5 pr-14 dark:border-gray-800'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400'>
              <Rocket size={18} />
            </div>
            <div>
              <h2 className='type-body font-semibold text-gray-800 dark:text-white/90'>
                {actionPlan?.idea_title || actionPlanIdea || 'Action Plan'}
              </h2>
              <p className='mt-0.5 type-caption text-gray-500 dark:text-gray-400'>
                {actionPlan?.timeline
                  ? `Timeline: ${actionPlan.timeline}`
                  : 'Step-by-step execution plan'}
              </p>
            </div>
          </div>

          <div className='flex-1 overflow-y-auto px-6 py-5'>
            {actionPlanLoading ? (
              <div className='flex min-h-[220px] flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400'>
                <Loader2 size={26} className='animate-spin' />
                <span className='type-small font-medium'>
                  Building your action plan...
                </span>
              </div>
            ) : actionPlan ? (
              <div className='flex flex-col gap-5'>
                {actionPlan.quick_start && (
                  <ModalSection
                    icon={<Zap size={13} />}
                    label='Quick start (do this in 30 min)'
                    color={PALETTE.success}
                  >
                    <div className='rounded-xl border-l-[3px] border-success-500 bg-success-50 p-4 type-small leading-relaxed text-gray-700 dark:bg-success-500/10 dark:text-gray-200'>
                      {actionPlan.quick_start}
                    </div>
                  </ModalSection>
                )}

                {actionPlan.steps?.length ? (
                  <ModalSection
                    icon={<CheckCircle2 size={13} />}
                    label='Steps'
                    color={PALETTE.brand}
                  >
                    <div className='flex flex-col gap-3'>
                      {actionPlan.steps.map((step) => (
                        <div
                          key={step.step}
                          className='rounded-xl border border-gray-200 p-4 dark:border-gray-800'
                        >
                          <div className='mb-1.5 flex items-center gap-2'>
                            <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-[10px] bg-success-50 type-caption font-semibold text-success-600 dark:bg-success-500/15 dark:text-success-400'>
                              {step.step}
                            </span>
                            <span className='type-small font-semibold text-gray-800 dark:text-white/90'>
                              {step.title}
                            </span>
                            {step.timeline && (
                              <span className='ml-auto flex items-center gap-1 type-caption text-gray-400 dark:text-gray-500'>
                                <Clock size={10} /> {step.timeline}
                              </span>
                            )}
                          </div>
                          <p className='type-caption leading-relaxed text-gray-500 dark:text-gray-400'>
                            {step.description}
                          </p>
                          {step.cost && step.cost !== 'free' && (
                            <Badge color='warning' className='mt-1.5'>
                              Cost: {step.cost}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ModalSection>
                ) : null}

                {actionPlan.success_metrics?.length ? (
                  <ModalSection
                    icon={<Target size={13} />}
                    label='Success metrics'
                    color={PALETTE.success}
                  >
                    <div className='flex flex-col gap-1.5'>
                      {actionPlan.success_metrics.map((m, i) => (
                        <div
                          key={i}
                          className='flex items-center gap-2 rounded-[10px] bg-gray-50 px-3 py-2 type-caption text-gray-700 dark:bg-white/[0.03] dark:text-gray-300'
                        >
                          <CheckCircle2
                            size={12}
                            className='shrink-0 text-success-500'
                          />{' '}
                          {m}
                        </div>
                      ))}
                    </div>
                  </ModalSection>
                ) : null}

                {actionPlan.risks?.length ? (
                  <ModalSection
                    icon={<AlertTriangle size={13} />}
                    label='Risks to watch'
                    color={PALETTE.error}
                  >
                    <div className='flex flex-col gap-1.5'>
                      {actionPlan.risks.map((r, i) => (
                        <div
                          key={i}
                          className='flex items-center gap-2 rounded-[10px] bg-error-50 px-3 py-2 type-caption text-gray-700 dark:bg-error-500/10 dark:text-gray-300'
                        >
                          <AlertTriangle
                            size={12}
                            className='shrink-0 text-error-500'
                          />{' '}
                          {r}
                        </div>
                      ))}
                    </div>
                  </ModalSection>
                ) : null}
              </div>
            ) : null}
          </div>

          {actionPlan && !actionPlanLoading && (
            <div className='flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800'>
              <Button
                variant='outline'
                onClick={() => {
                  const parts: string[] = [];
                  if (actionPlan.idea_title)
                    parts.push(`# ${actionPlan.idea_title}`);
                  if (actionPlan.quick_start)
                    parts.push(`Quick start: ${actionPlan.quick_start}`);
                  if (actionPlan.timeline)
                    parts.push(`Timeline: ${actionPlan.timeline}`);
                  actionPlan.steps?.forEach((s) => {
                    parts.push(
                      `\nStep ${s.step}: ${s.title}\n${s.description}${s.timeline ? `\nWhen: ${s.timeline}` : ''}${s.cost ? `\nCost: ${s.cost}` : ''}`,
                    );
                  });
                  if (actionPlan.success_metrics?.length)
                    parts.push(
                      `\nSuccess metrics:\n${actionPlan.success_metrics.map((m) => `- ${m}`).join('\n')}`,
                    );
                  navigator.clipboard?.writeText(parts.join('\n'));
                }}
              >
                <Copy size={14} /> Copy plan
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════ History Detail Modal ══════ */}
      {selectedHistory && (
        <Modal
          isOpen
          onClose={() => setSelectedHistory(null)}
          className='m-4 max-w-[560px]'
        >
          <div className='max-h-[85vh] w-full overflow-y-auto rounded-[20px] bg-white dark:bg-gray-900'>
            <div className='flex items-center gap-3 border-b border-gray-100 px-6 py-5 pr-14 dark:border-gray-800'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                <CalendarDays size={18} />
              </div>
              <div>
                <h2 className='type-body font-semibold text-gray-800 dark:text-white/90'>
                  {fmtDate(selectedHistory.week_start)} –{' '}
                  {fmtDate(selectedHistory.week_end)}
                </h2>
                <p className='mt-0.5 type-caption text-gray-500 dark:text-gray-400'>
                  Generated {fmtDate(selectedHistory.created_at)}
                </p>
              </div>
            </div>

            <div className='flex flex-col gap-5 px-6 py-5'>
              {typeof selectedHistory.growth_score === 'number' && (
                <ModalSection
                  icon={<Target size={13} />}
                  label='Growth score'
                  color={PALETTE.brand}
                >
                  <div className={TEXT_BLOCK}>
                    {selectedHistory.growth_score} / 100
                  </div>
                </ModalSection>
              )}

              {selectedHistory.biggest_opportunity && (
                <ModalSection
                  icon={<Rocket size={13} />}
                  label='Biggest opportunity'
                  color={PALETTE.success}
                >
                  <div className='rounded-xl bg-success-50 p-4 type-small leading-relaxed text-gray-700 dark:bg-success-500/10 dark:text-gray-200'>
                    {selectedHistory.biggest_opportunity}
                  </div>
                </ModalSection>
              )}

              {selectedHistory.biggest_risk && (
                <ModalSection
                  icon={<AlertTriangle size={13} />}
                  label='Biggest risk'
                  color={PALETTE.error}
                >
                  <div className='rounded-xl bg-error-50 p-4 type-small leading-relaxed text-gray-700 dark:bg-error-500/10 dark:text-gray-200'>
                    {selectedHistory.biggest_risk}
                  </div>
                </ModalSection>
              )}
            </div>
          </div>
        </Modal>
      )}
    </RequireAuth>
  );
}