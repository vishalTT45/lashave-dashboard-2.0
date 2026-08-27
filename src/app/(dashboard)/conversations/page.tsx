'use client';

import {
  ChannelFilter,
  ChannelFilterValueLabel,
  useChannelFilter,
} from '@/components/channel-filter';
import { DateFilter } from '@/components/date-filter';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { TablePagination } from '@/components/ui/table-pagination';
import { useOutsideClick } from '@/hooks/useOutsideClick';
import { apiFetch } from '@/lib/api';
import {
  Category,
  detectCategory,
  Mood,
  resolveMoodForLead,
} from '@/lib/chat-classifiers';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Eye,
  HelpCircle,
  List,
  MessageCircle,
  Package,
  Radio,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type IntentHistoryItem = {
  score?: number;
  intent?: string;
  category?: string;
  service?: string;
  at_update?: number;
  text_preview?: string;
};

type ConvoItem = {
  id: number;
  unread_count?: number;
  channel: string;
  external_user_id: string;
  display_name?: string | null;
  profile_pic_url?: string | null;
  is_user_follow_business?: boolean | null;
  is_verified_user?: boolean | null;
  status: string;
  last_message_at: string | null;
  created_at?: string | null;
  channel_id?: number | null;
  preview: string;
  lead?: {
    id: number;
    status: string;
    intent: string;
    service: string;
    contacts?: { emails?: string[]; phones?: string[] };
    meta?: {
      text_preview?: string;
      triggers?: string[];
      mood?: Mood;
      intent_history?: IntentHistoryItem[];
      instagram_profile?: {
        profile_pic_url?: string | null;
      };
      [key: string]: unknown;
    };
  } | null;
};

type ConversationsResponse = {
  items: ConvoItem[];
  limit: number;
  offset: number;
  total?: number;
};

const PAGE_SIZE = 25;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
}

function timeAgo(iso: string | null) {
  if (!iso) return 'No activity';
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return 'No activity';
  const diff = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const CHANNEL_LOGOS: Record<string, string> = {
  facebook: '/brand-logo/facebook.png',
  google: '/brand-logo/google-map.png',
  instagram: '/brand-logo/instagram.png',
  meta: '/brand-logo/meta.png',
  telegram: '/brand-logo/telegram.png',
  website: '/brand-logo/website.png',
  whatsapp: '/brand-logo/whatsapp.png',
  youtube: '/brand-logo/youtube.png',
};

function platformLabel(channel?: string) {
  if (!channel) return 'Unknown';
  const map: Record<string, string> = {
    instagram: 'Instagram',
    youtube: 'YouTube',
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    facebook: 'Facebook',
    website: 'Website',
    test: 'Test',
  };
  return map[channel.toLowerCase()] || channel.charAt(0).toUpperCase() + channel.slice(1);
}

function displayName(c: ConvoItem) {
  const name = c.display_name?.trim();
  if (name) return c.channel === 'website' ? name : `@${name}`;
  const uid = c.external_user_id || '';
  if (c.channel === 'website') return `Website Visitor #${c.id}`;
  if (/^\d{10,}$/.test(uid)) return `User ${uid.slice(-8)}`;
  return uid || `${platformLabel(c.channel)} User #${c.id}`;
}

function getConversationIntents(lead?: ConvoItem['lead']): string[] {
  if (!lead) return [];
  const history = lead.meta?.intent_history ?? [];
  const historyIntents = history
    .map((item) => item.intent || item.category)
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase());

  const storedIntents = String(lead.intent || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set([...storedIntents, ...historyIntents])];
}

function conversationMatchesCategory(lead: ConvoItem['lead'], category: Category): boolean {
  if (!lead) return false;
  const intents = getConversationIntents(lead);
  const services = String(lead.service || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (category === 'complaint') return intents.includes('complaint');
  if (category === 'feedback') return intents.includes('feedback');
  if (category === 'order') {
    return intents.includes('order') || intents.includes('order_enquiry') || services.includes('order');
  }
  if (category === 'enquiry') {
    return (
      intents.includes('enquiry') ||
      intents.includes('general_enquiry') ||
      intents.includes('general_interest') ||
      intents.includes('pricing')
    );
  }
  return false;
}

function getCategory(item: ConvoItem): Category | null {
  const lead = item.lead;
  if (!lead) return null;

  if (conversationMatchesCategory(lead, 'complaint')) return 'complaint';
  if (conversationMatchesCategory(lead, 'feedback')) return 'feedback';
  if (conversationMatchesCategory(lead, 'order')) return 'order';
  if (conversationMatchesCategory(lead, 'enquiry')) return 'enquiry';

  const mood = resolveMoodForLead({
    storedMood: lead.meta?.mood,
    text_preview: lead.meta?.text_preview,
    triggers: lead.meta?.triggers,
    intent: lead.intent,
  });

  return detectCategory({
    text_preview: lead.meta?.text_preview,
    triggers: lead.meta?.triggers,
    intent: lead.intent,
    service: lead.service,
    mood: mood.mood,
    contacts: lead.contacts,
  });
}

function isRealLead(lead?: ConvoItem['lead']): boolean {
  if (!lead) return false;
  const status = String(lead.status || '').toLowerCase();
  return ['qualified', 'won', 'hot', 'warm'].includes(status);
}

const STAT_FILTERS: {
  key: string;
  label: string;
  tone: keyof typeof STAT_TONE;
  icon: React.ReactNode;
}[] = [
    { key: 'all', label: 'Total', tone: 'gray', icon: <List className='h-5 w-5' /> },
    { key: 'complaint', label: 'Complaint', tone: 'error', icon: <AlertTriangle className='h-5 w-5' /> },
    { key: 'feedback', label: 'Feedback', tone: 'brand', icon: <MessageCircle className='h-5 w-5' /> },
    { key: 'order', label: 'Order', tone: 'warning', icon: <Package className='h-5 w-5' /> },
    { key: 'enquiry', label: 'Enquiry', tone: 'brand', icon: <HelpCircle className='h-5 w-5' /> },
    { key: 'open', label: 'Open', tone: 'success', icon: <CheckCircle2 className='h-5 w-5' /> },
    { key: 'handoff', label: 'Handoff', tone: 'warning', icon: <ArrowRightLeft className='h-5 w-5' /> },
    { key: 'lead', label: 'With lead', tone: 'success', icon: <Target className='h-5 w-5' /> },
  ];

function badgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'open':
      return 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500';
    case 'handoff':
      return 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400';
    case 'blocked':
      return 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500';
    case 'closed':
      return 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80';
    default:
      return 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400';
  }
}

function leadBadgeClass(status: string) {
  switch (status.toLowerCase()) {
    case 'won':
    case 'qualified':
      return 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500';
    case 'lost':
      return 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500';
    case 'contacted':
      return 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400';
    default:
      return 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400';
  }
}

const STAT_TONE: Record<string, string> = {
  brand: 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400',
  error: 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  gray: 'bg-gray-100 text-gray-700 dark:bg-white/[0.06] dark:text-gray-300',
};

function ConversationAvatar({
  conversation,
  size = 40,
}: {
  conversation: ConvoItem;
  size?: number;
}) {
  const name = displayName(conversation);
  const image =
    conversation.profile_pic_url ||
    conversation.lead?.meta?.instagram_profile?.profile_pic_url;

  if (image) {
    return (
      <Image
        width={size}
        height={size}
        src={image}
        alt={name}
        unoptimized
        style={{ height: size, width: size }}
        className='rounded-full object-cover'
      />
    );
  }

  const initials = name.replace(/^@/, '').slice(0, 2).toUpperCase();
  return (
    <div
      style={{ height: size, width: size }}
      className='flex items-center justify-center rounded-full bg-gray-100 type-small font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    >
      {initials || 'U'}
    </div>
  );
}

const INBOX_TABS: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <List size={13} /> },
  { key: 'open', label: 'Open', icon: <CheckCircle2 size={13} /> },
  { key: 'handoff', label: 'Handoff', icon: <ArrowRightLeft size={13} /> },
  { key: 'closed', label: 'Closed', icon: <XCircle size={13} /> },
];

type InboxFilterKey = 'conversation' | 'channel' | 'date' | 'category';

export default function ConversationsPage() {
  const {
    filter: channelFilter,
    setFilter: setChannelFilter,
    channels,
    loading: channelsLoading,
    selectedChannels,
    clear: clearChannels,
  } = useChannelFilter();

  const [rawItems, setRawItems] = useState<ConvoItem[]>([]);
  const [filterLead, setFilterLead] = useState(false);
  const [openFilter, setOpenFilter] = useState<InboxFilterKey | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [statFilter, setStatFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const requestIdRef = useRef(0);
  const channelFilterRef = useRef<HTMLDivElement>(null);
  const conversationFilterRef = useRef<HTMLDivElement>(null);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const categoryFilterRef = useRef<HTMLDivElement>(null);

  useOutsideClick(channelFilterRef, () => setOpenFilter(null), openFilter === 'channel');
  useOutsideClick(conversationFilterRef, () => setOpenFilter(null), openFilter === 'conversation');
  useOutsideClick(dateFilterRef, () => setOpenFilter(null), openFilter === 'date');
  useOutsideClick(categoryFilterRef, () => setOpenFilter(null), openFilter === 'category');

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      const requestId = ++requestIdRef.current;
      if (!opts?.silent) setLoading(true);
      setErr(null);

      try {
        const params = new URLSearchParams();
        params.set('limit', '5000');
        params.set('offset', '0');

        if (dateRange?.from) params.set('from_ts', new Date(dateRange.from).toISOString());
        if (dateRange?.to) {
          const to = new Date(dateRange.to);
          to.setHours(23, 59, 59, 999);
          params.set('to_ts', to.toISOString());
        }

        const data = await apiFetch<ConversationsResponse>(
          `/admin/conversations?${params.toString()}`,
          { auth: true },
        );

        if (requestId !== requestIdRef.current) return;

        setRawItems(data?.items || []);
        setLastRefresh(new Date());
      } catch (error: unknown) {
        if (requestId !== requestIdRef.current) return;
        setErr(errorMessage(error, 'Failed to load conversations'));
        setRawItems([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [dateRange],
  );

  useEffect(() => {
    load();
  }, [load]);

  const channelCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const item of rawItems) {
      const itemPlatform = (item.channel || '').toLowerCase().trim();
      const itemDisplay = (item.display_name || '').toLowerCase().trim();

      for (const ch of channels) {
        const chPlatform = (ch.platform || (ch as any).channel || '').toLowerCase().trim();
        const chDisplay = (ch.display_name || '').toLowerCase().trim();

        if (
          (chPlatform && itemPlatform === chPlatform) ||
          (chDisplay && itemDisplay === chDisplay) ||
          (ch.id && item.channel_id === ch.id)
        ) {
          counts[ch.id] = (counts[ch.id] || 0) + 1;
        }
      }
    }
    return counts;
  }, [rawItems, channels]);

  const categoryCounts = useMemo(() => {
    const counts: Record<Exclude<Category, 'none'>, number> = { complaint: 0, feedback: 0, order: 0, enquiry: 0 };
    for (const item of rawItems) {
      if (conversationMatchesCategory(item.lead, 'complaint')) counts.complaint++;
      if (conversationMatchesCategory(item.lead, 'feedback')) counts.feedback++;
      if (conversationMatchesCategory(item.lead, 'order')) counts.order++;
      if (conversationMatchesCategory(item.lead, 'enquiry')) counts.enquiry++;
    }
    return counts;
  }, [rawItems]);

  const openCount = useMemo(() => rawItems.filter((i) => (i.status || '').toLowerCase() === 'open').length, [rawItems]);
  const handoffCount = useMemo(() => rawItems.filter((i) => (i.status || '').toLowerCase() === 'handoff').length, [rawItems]);
  const closedCount = useMemo(() => rawItems.filter((i) => (i.status || '').toLowerCase() === 'closed').length, [rawItems]);
  const leadCount = useMemo(() => rawItems.filter((i) => isRealLead(i.lead)).length, [rawItems]);

  const statValues: Record<string, number> = {
    all: rawItems.length,
    complaint: categoryCounts.complaint,
    feedback: categoryCounts.feedback,
    order: categoryCounts.order,
    enquiry: categoryCounts.enquiry,
    open: openCount,
    handoff: handoffCount,
    lead: leadCount,
  };

  const tabCounts: Record<string, number> = {
    all: rawItems.length,
    open: openCount,
    handoff: handoffCount,
    closed: closedCount,
  };

  const filteredItems = useMemo(() => {
    return rawItems.filter((item) => {
      if (q.trim()) {
        const query = q.trim().toLowerCase();
        const matchesName = (item.display_name || '').toLowerCase().includes(query);
        const matchesUid = (item.external_user_id || '').toLowerCase().includes(query);
        const matchesId = String(item.id).includes(query);
        if (!matchesName && !matchesUid && !matchesId) return false;
      }

      if (channelFilter.channel_ids && channelFilter.channel_ids.length > 0) {
        const selected = channels.filter((ch) => channelFilter.channel_ids.includes(ch.id));
        const matchesChannel = selected.some((ch) => {
          const chPlatform = (ch.platform || (ch as any).channel || '').toLowerCase().trim();
          const chDisplay = (ch.display_name || '').toLowerCase().trim();
          const itemPlatform = (item.channel || '').toLowerCase().trim();
          const itemDisplay = (item.display_name || '').toLowerCase().trim();

          return (
            (chPlatform && itemPlatform === chPlatform) ||
            (chDisplay && itemDisplay === chDisplay) ||
            (ch.id && item.channel_id === ch.id)
          );
        });

        if (!matchesChannel) return false;
      }

      if (status !== 'all' && (item.status || '').toLowerCase() !== status.toLowerCase()) {
        return false;
      }

      if (filterLead && !isRealLead(item.lead)) {
        return false;
      }

      if (statFilter === 'open' || statFilter === 'handoff') {
        if ((item.status || '').toLowerCase() !== statFilter) return false;
      } else if (statFilter === 'lead') {
        if (!isRealLead(item.lead)) return false;
      } else if (['complaint', 'feedback', 'order', 'enquiry'].includes(statFilter)) {
        if (!conversationMatchesCategory(item.lead, statFilter as Category)) return false;
      }

      return true;
    });
  }, [rawItems, q, channelFilter.channel_ids, channels, status, filterLead, statFilter]);

  const totalCount = filteredItems.length;
  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const handleSeeAll = useCallback(() => {
    setStatus('all');
    setQ('');
    setFilterLead(false);
    clearChannels();
    setStatFilter('all');
    setDateRange(null);
    setActivePreset(null);
    setOpenFilter(null);
    setPage(1);
  }, [clearChannels]);

  return (
    <RequireAuth>
      <div className='mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8'>
        <div className='rounded-[28px] border border-gray-200 bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-white/[0.03] sm:p-8'>
          <div className='flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between'>
            <div>
              <p className='type-small font-semibold uppercase tracking-[0.24em] text-gray-500 dark:text-gray-400'>
                Conversations
              </p>
              <h1 className='mt-2 text-title-sm font-semibold text-gray-800 dark:text-white/90'>
                Inbox management
              </h1>
            </div>

            <div className='flex items-center gap-3'>
              <button
                className='inline-flex h-10 items-center justify-center gap-2 rounded-[10px] border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300'
                onClick={() => load()}
              >
                <RefreshCw className='h-4 w-4' />
                Refresh
              </button>
              <div suppressHydrationWarning className='flex items-center gap-2 type-caption text-gray-500 dark:text-gray-400'>
                <Clock3 className='h-3.5 w-3.5' />
                Last refreshed {lastRefresh.toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className='mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4 3xl:grid-cols-8'>
            {STAT_FILTERS.map((stat) => (
              <button
                key={stat.key}
                type='button'
                onClick={() => {
                  setPage(1);
                  setStatFilter((current) => (current === stat.key ? 'all' : stat.key));
                }}
                className={cn(
                  'flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-3 text-left transition dark:bg-gray-900/60',
                  statFilter === stat.key
                    ? 'border-brand-500 ring-1 ring-brand-500/30 dark:border-brand-400'
                    : 'border-gray-200 hover:border-gray-300 dark:border-gray-800',
                )}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${STAT_TONE[stat.tone]}`}>
                  {stat.icon}
                </span>
                <div className='min-w-0'>
                  <div className='type-card-title font-bold text-gray-800 dark:text-white/90'>
                    {formatCompact(statValues[stat.key] || 0)}
                  </div>
                  <div className='truncate type-caption text-gray-500 dark:text-gray-400'>
                    {stat.label}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {err && (
          <div className='mt-6 rounded-xl border border-error-200 bg-error-50 px-4 py-3 type-small text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400'>
            {err}
          </div>
        )}

        <div className='mt-6 min-w-0 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]'>
          <div className='flex flex-col gap-4 border-b border-gray-100 px-5 py-4 dark:border-white/[0.05] sm:px-6 lg:flex-row lg:items-center lg:justify-between'>
            <h4 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
              Conversations ({totalCount})
            </h4>

            <div className='flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end'>
              <div className='relative w-full sm:w-[240px]'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500' />
                <input
                  type='search'
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder='Search username or ID'
                  className='h-10 w-full rounded-[10px] border border-gray-300 bg-white py-2 pl-10 pr-4 type-small text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
                />
              </div>

              {/* Channel Dropdown Filter */}
              <div ref={channelFilterRef} className='relative'>
                <Button
                  variant='outline'
                  onClick={() => setOpenFilter(openFilter === 'channel' ? null : 'channel')}
                >
                  <Radio size={14} />
                  <ChannelFilterValueLabel selected={selectedChannels} />
                </Button>
                {openFilter === 'channel' && (
                  <div className='absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                    <ChannelFilter
                      value={channelFilter}
                      onChange={(nextFilter) => {
                        setPage(1);
                        setChannelFilter(nextFilter);
                      }}
                      channels={channels}
                      loading={channelsLoading}
                      counts={channelCounts}
                      totalCount={rawItems.length}
                    />
                  </div>
                )}
              </div>

              {/* Status / Conversation Filter Dropdown */}
              <div ref={conversationFilterRef} className='relative'>
                <Button
                  variant='outline'
                  onClick={() => setOpenFilter(openFilter === 'conversation' ? null : 'conversation')}
                >
                  <SlidersHorizontal size={14} />
                  {status === 'all' ? 'Conversation' : `${INBOX_TABS.find((t) => t.key === status)?.label ?? ''} conversations`}
                </Button>
                {openFilter === 'conversation' && (
                  <div className='absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                    {INBOX_TABS.map((tab) => {
                      const isActive = status === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type='button'
                          onClick={() => {
                            setStatus(tab.key);
                            setPage(1);
                            setOpenFilter(null);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left type-small font-medium transition',
                            isActive
                              ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]',
                          )}
                        >
                          <span className='inline-flex items-center gap-2'>
                            {tab.icon}
                            {tab.label} conversations
                          </span>
                          <span className='type-caption text-gray-400 dark:text-gray-500'>
                            {tabCounts[tab.key] || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Inbox / Category Filter Dropdown */}
              <div ref={categoryFilterRef} className='relative'>
                <Button
                  variant='outline'
                  onClick={() => setOpenFilter(openFilter === 'category' ? null : 'category')}
                >
                  <List size={14} />
                  {statFilter === 'all' ? 'Inbox filter' : STAT_FILTERS.find((s) => s.key === statFilter)?.label}
                </Button>
                {openFilter === 'category' && (
                  <div className='absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                    {STAT_FILTERS.map((stat) => {
                      const isActive = statFilter === stat.key;
                      return (
                        <button
                          key={stat.key}
                          type='button'
                          onClick={() => {
                            setStatFilter(stat.key);
                            setPage(1);
                            setOpenFilter(null);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left type-small font-medium transition',
                            isActive
                              ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]',
                          )}
                        >
                          <span className='inline-flex items-center gap-2'>
                            <span className='[&>svg]:h-4 [&>svg]:w-4'>{stat.icon}</span>
                            {stat.label}
                          </span>
                          <span className='type-caption text-gray-400 dark:text-gray-500'>
                            {statValues[stat.key] || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Date Filter */}
              <div ref={dateFilterRef}>
                <DateFilter
                  dateRange={dateRange}
                  activePreset={activePreset}
                  setDateRange={(range) => {
                    setDateRange(range);
                    setPage(1);
                  }}
                  setActivePreset={setActivePreset}
                  open={openFilter === 'date'}
                  onToggle={() => setOpenFilter(openFilter === 'date' ? null : 'date')}
                  onClose={() => setOpenFilter(null)}
                />
              </div>

              {/* Leads Only */}
              <button
                type='button'
                onClick={() => {
                  setFilterLead((prev) => !prev);
                  setPage(1);
                }}
                className={cn(
                  'inline-flex h-10 shrink-0 items-center gap-2 rounded-[10px] px-4 type-small font-medium transition',
                  filterLead
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5',
                )}
              >
                <Users className='h-4 w-4' />
                Leads only
              </button>

              <Button variant='outline' onClick={handleSeeAll}>
                See all
              </Button>
            </div>
          </div>

          <div className='min-w-0 max-w-full overflow-x-auto'>
            <table className='w-full table-fixed min-h-80'>
              <colgroup>
                <col className='w-[30%]' />
                <col className='w-[140px]' />
                <col className='w-[120px]' />
                <col className='w-[120px]' />
                <col className='w-[112px]' />
                <col className='w-[112px]' />
                <col className='w-[160px]' />
              </colgroup>
              <thead className='border-b border-gray-100 dark:border-white/[0.05]'>
                <tr>
                  {['Customer', 'Channel', 'Intent', 'Status', 'Lead', 'Last seen', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'px-5 py-3.5 type-caption font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500',
                        h === 'Actions' ? 'text-right' : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100 dark:divide-white/[0.05]'>
                {loading && (
                  <tr>
                    <td colSpan={7} className='px-5 py-14 text-center type-small text-gray-500'>
                      Loading conversations...
                    </td>
                  </tr>
                )}
                {!loading && pageItems.length === 0 && (
                  <tr>
                    <td colSpan={7} className='px-5 py-14 text-center type-small text-gray-500'>
                      No conversations found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageItems.map((item) => {
                    const category = getCategory(item);
                    const name = displayName(item);
                    return (
                      <tr key={item.id} className='transition hover:bg-gray-50 dark:hover:bg-white/[0.02]'>
                        <td className='px-5 py-3'>
                          <Link href={`/conversations/${item.id}`} className='flex items-center gap-3'>
                            <ConversationAvatar conversation={item} size={34} />
                            <div className='min-w-0 flex-1'>
                              <span className='block truncate type-small font-semibold text-gray-800 dark:text-white/90'>
                                {name}
                              </span>
                              <span className='mt-1 block truncate type-caption text-gray-500 dark:text-gray-400'>
                                {item.preview || 'No messages yet'}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td className='px-5 py-3 type-small text-gray-500'>
                          <span className='inline-flex items-center gap-2'>
                            <Image
                              src={CHANNEL_LOGOS[item.channel?.toLowerCase()] || '/brand-logo/website.png'}
                              alt={platformLabel(item.channel)}
                              width={16}
                              height={16}
                              className='h-4 w-4 shrink-0 object-contain'
                            />
                            <span className='truncate font-medium text-gray-700 dark:text-gray-300'>
                              {platformLabel(item.channel)}
                            </span>
                          </span>
                        </td>
                        <td className='px-5 py-3'>
                          <span className='inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold capitalize text-brand-600 dark:bg-brand-500/15 dark:text-brand-400'>
                            {category || '—'}
                          </span>
                        </td>
                        <td className='px-5 py-3'>
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${badgeClass(item.status)}`}>
                            {item.status || '—'}
                          </span>
                        </td>
                        <td className='px-5 py-3'>
                          {item.lead ? (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${leadBadgeClass(item.lead.status)}`}>
                              {item.lead.status || 'new'}
                            </span>
                          ) : (
                            <span className='text-[11px] text-gray-400'>—</span>
                          )}
                        </td>
                        <td className='px-5 py-3 type-small font-medium text-gray-500'>
                          <span className='whitespace-nowrap'>{timeAgo(item.last_message_at)}</span>
                        </td>
                        <td className='px-5 py-3 text-right'>
                          <Link
                            href={`/conversations/${item.id}`}
                            className='inline-flex h-8 items-center justify-center gap-1 rounded-[9px] bg-brand-500 px-3 text-[13px] font-semibold text-white hover:bg-brand-600'
                          >
                            <Eye size={13} />
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <TablePagination
            page={page}
            totalItems={totalCount}
            onPageChange={setPage}
            pageSize={PAGE_SIZE}
          />
        </div>
      </div>
    </RequireAuth>
  );
}