'use client';

import {
  ChannelFilter,
  ChannelFilterValue,
  ChannelFilterValueLabel,
  ChannelItem,
  useChannelFilter,
} from '@/components/channel-filter';
import { DateFilter } from '@/components/date-filter';
import { Grid, Split } from '@/components/layout/primitives';
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

type ConvoItem = {
  id: number;
  channel: string;
  channel_id?: number | null;
  external_user_id: string;
  display_name?: string | null;
  status: string;
  last_message_at: string | null;
  preview: string;
  profile_pic_url?: string | null;
  is_verified_user?: boolean | null;
  unread_count?: number;
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
      instagram_profile?: {
        profile_pic_url?: string | null;
      };
    };
  } | null;
};

const PAGE_SIZE = 8;

type ConversationsResponse = {
  items: ConvoItem[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
};

type ConversationStatsResponse = {
  total: number;
  statuses: Record<string, number>;
  categories: Record<string, number>;
  with_lead: number;
  channels: Record<string, number>;
};

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function formatDate(str: string) {
  return new Date(str + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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
  return (
    map[channel.toLowerCase()] ||
    channel.charAt(0).toUpperCase() + channel.slice(1)
  );
}

function displayName(c: ConvoItem) {
  const name = c.display_name?.trim();
  if (name) return c.channel === 'website' ? name : `@${name}`;

  const uid = c.external_user_id || '';
  if (c.channel === 'website') return `Website Visitor #${c.id}`;
  if (/^\d{10,}$/.test(uid)) return `User ${uid.slice(-8)}`;
  return uid || `${platformLabel(c.channel)} User #${c.id}`;
}

function getCategory(item: ConvoItem): Category | null {
  const lead = item.lead;
  if (!lead) return null;

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

const STAT_FILTERS: {
  key: string;
  label: string;
  tone: keyof typeof STAT_TONE;
  icon: React.ReactNode;
}[] = [
    {
      key: 'all',
      label: 'Total',
      tone: 'gray',
      icon: <List className='h-4 w-4' />,
    },
    {
      key: 'complaint',
      label: 'Complaint',
      tone: 'error',
      icon: <AlertTriangle className='h-4 w-4' />,
    },
    {
      key: 'feedback',
      label: 'Feedback',
      tone: 'brand',
      icon: <MessageCircle className='h-4 w-4' />,
    },
    {
      key: 'order',
      label: 'Order',
      tone: 'warning',
      icon: <Package className='h-4 w-4' />,
    },
    {
      key: 'enquiry',
      label: 'Enquiry',
      tone: 'brand',
      icon: <HelpCircle className='h-4 w-4' />,
    },
    {
      key: 'open',
      label: 'Open',
      tone: 'success',
      icon: <CheckCircle2 className='h-4 w-4' />,
    },
    {
      key: 'handoff',
      label: 'Handoff',
      tone: 'warning',
      icon: <ArrowRightLeft className='h-4 w-4' />,
    },
    {
      key: 'lead',
      label: 'With lead',
      tone: 'success',
      icon: <Target className='h-4 w-4' />,
    },
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
  warning:
    'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400',
  success:
    'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  gray: 'bg-gray-100 text-gray-700 dark:bg-white/6 dark:text-gray-300',
};
function StatTile({
  label,
  value,
  icon,
  tone = 'gray',
  onClick,
  active = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: keyof typeof STAT_TONE;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-xl border bg-white px-2.5 py-2 text-left transition dark:bg-gray-900/60 sm:gap-2.5',
        active
          ? 'border-brand-500 ring-1 ring-brand-500/30 dark:border-brand-400'
          : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700',
      )}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${STAT_TONE[tone]}`}
      >
        {icon}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='type-body font-bold leading-tight text-gray-800 dark:text-white/90'>
          {formatCompact(value)}
        </div>
        <div className='truncate type-micro leading-tight text-gray-500 dark:text-gray-400'>
          {label}
        </div>
      </div>
    </button>
  );
}

function ConversationAvatar({
  conversation,
  size = 40,
}: {
  conversation: ConvoItem;
  size?: number;
}) {
  const name = displayName(conversation);
  const rawImage =
    conversation.profile_pic_url ||
    conversation.lead?.meta?.instagram_profile?.profile_pic_url;
  const [broken, setBroken] = useState(false);

  const image = broken ? undefined : rawImage;

  useEffect(() => {
    // Resets local UI-only state (a flag, warning, or preview value)
    // when the relevant prop/dependency changes — not deriving render
    // output from state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBroken(false);
  }, [rawImage]);

  if (image) {
    return (
      <span
        style={{ height: size, width: size }}
        className='inline-flex shrink-0 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800'
      >
        <img
          src={image}
          alt={name}
          loading='lazy'
          onError={() => setBroken(true)}
          style={{ height: size, width: size }}
          className='h-full w-full object-cover'
        />
      </span>
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

// ── Table ────────────────────────────────────────────────────────────────────────
function ConversationTable({
  items,
  loading,
  page,
  setPage,
  totalItems,
  status,
  setStatus,
  tabCounts,
  openFilter,
  setOpenFilter,
  q,
  setQ,
  onSearchSubmit,
  onSeeAll,
  channelFilter,
  setChannelFilter,
  channels,
  channelsLoading,
  selectedChannels,
  channelCounts,
  channelTotal,
  dateRange,
  setDateRange,
  activePreset,
  setActivePreset,
  filterLead,
  setFilterLead,
  statFilter,
  setStatFilter,
  statCounts,
}: {
  items: ConvoItem[];
  loading: boolean;
  page: number;
  setPage: (page: number) => void;
  totalItems: number;
  status: string;
  setStatus: (status: string) => void;
  tabCounts: Record<string, number>;
  openFilter: InboxFilterKey | null;
  setOpenFilter: (filter: InboxFilterKey | null) => void;
  q: string;
  setQ: (value: string) => void;
  onSearchSubmit: () => void;
  onSeeAll: () => void;
  channelFilter: ChannelFilterValue;
  setChannelFilter: (value: ChannelFilterValue) => void;
  channels: ChannelItem[];
  channelsLoading: boolean;
  selectedChannels: ChannelItem[];
  channelCounts: Record<number, number>;
  channelTotal: number;
  dateRange: { from: string; to: string } | null;
  setDateRange: (range: { from: string; to: string } | null) => void;
  activePreset: number | null;
  setActivePreset: (preset: number | null) => void;
  filterLead: boolean;
  setFilterLead: (updater: (value: boolean) => boolean) => void;
  statFilter: string;
  setStatFilter: (value: string) => void;
  statCounts: Record<string, number>;
}) {
  // `items` already contains exactly one server-side page.
  const pageItems = items;

  const channelFilterRef = useRef<HTMLDivElement>(null);
  const conversationFilterRef = useRef<HTMLDivElement>(null);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  const categoryFilterRef = useRef<HTMLDivElement>(null);

  useOutsideClick(
    channelFilterRef,
    () => setOpenFilter(null),
    openFilter === 'channel',
  );
  useOutsideClick(
    conversationFilterRef,
    () => setOpenFilter(null),
    openFilter === 'conversation',
  );
  useOutsideClick(
    dateFilterRef,
    () => setOpenFilter(null),
    openFilter === 'date',
  );
  useOutsideClick(
    categoryFilterRef,
    () => setOpenFilter(null),
    openFilter === 'category',
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [status, q, dateRange, activePreset, statFilter, channelFilter]);

  const activeTab =
    INBOX_TABS.find((tab) => tab.key === status) ?? INBOX_TABS[0];

  return (
    <div className='min-w-0 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3'>
      <div className='flex flex-col gap-1.5 border-b border-gray-100 px-4 py-3 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-5 '>
        <h3 className='type-small font-semibold text-gray-800 dark:text-white/90'>
          Inbox
        </h3>
        <div className='type-micro font-medium text-gray-500 dark:text-gray-400'>
          {totalItems} conversations
        </div>
      </div>

      <div className='min-w-0 py-4'>
        <div className='flex flex-col gap-3 rounded-t-xl border border-b-0 border-gray-200 bg-white px-4 py-3 dark:border-white/5 dark:bg-white/1 sm:px-5 lg:flex-row lg:items-center lg:justify-between '>
          <h4 className='type-body font-semibold text-gray-800 dark:text-white/90'>
            {activeTab.label} conversations
          </h4>
          <div className='flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end '>
            <div className='relative w-full sm:w-(--control-width-search)'>
              <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400' />
              <input
                type='search'
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                placeholder='Search by username or ID'
                className='h-9 w-full rounded-(--radius-control) border border-gray-300 bg-white py-2 pl-10 pr-4 type-small text-gray-800 shadow-theme-xs outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500'
              />
            </div>

            {/* Channel filter */}
            <div ref={channelFilterRef} className='relative'>
              <Button
                variant='outline'
                onClick={() =>
                  setOpenFilter(openFilter === 'channel' ? null : 'channel')
                }
              >
                <Radio size={14} />
                <ChannelFilterValueLabel selected={selectedChannels} />
              </Button>
              {openFilter === 'channel' && (
                <div className='absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                  <ChannelFilter
                    value={channelFilter}
                    onChange={setChannelFilter}
                    channels={channels}
                    loading={channelsLoading}
                    counts={channelCounts}
                    totalCount={channelTotal}
                  />
                </div>
              )}
            </div>

            {/* Conversation (status) filter */}
            <div ref={conversationFilterRef} className='relative'>
              <Button
                variant='outline'
                onClick={() =>
                  setOpenFilter(
                    openFilter === 'conversation' ? null : 'conversation',
                  )
                }
              >
                <SlidersHorizontal size={14} />
                {status === 'all'
                  ? 'Conversation'
                  : `${INBOX_TABS.find((t) => t.key === status)?.label ?? ''} conversations`}
              </Button>
              {openFilter === 'conversation' && (
                <div className='absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                  {INBOX_TABS.map((tab) => {
                    const isActive = status === tab.key;
                    const count = tabCounts[tab.key] || 0;
                    return (
                      <button
                        key={tab.key}
                        type='button'
                        onClick={() => {
                          setStatus(tab.key);
                          setOpenFilter(null);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-(--radius-control) px-3 py-2 text-left type-small font-medium transition',
                          isActive
                            ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/4',
                        )}
                      >
                        <span className='inline-flex items-center gap-2'>
                          {tab.icon}
                          {tab.label} conversations
                        </span>
                        <span className='type-caption text-gray-400 dark:text-gray-500'>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Inbox stats filter */}
            <div ref={categoryFilterRef} className='relative'>
              <Button
                variant='outline'
                onClick={() =>
                  setOpenFilter(openFilter === 'category' ? null : 'category')
                }
              >
                <List size={14} />
                {statFilter === 'all'
                  ? 'Inbox filter'
                  : STAT_FILTERS.find((s) => s.key === statFilter)?.label}
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
                          setOpenFilter(null);
                        }}
                        className={cn(
                          'flex w-full items-center justify-between rounded-(--radius-control) px-3 py-2 text-left type-small font-medium transition',
                          isActive
                            ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                            : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/4',
                        )}
                      >
                        <span className='inline-flex items-center gap-2'>
                          <span className='[&>svg]:h-4 [&>svg]:w-4'>
                            {stat.icon}
                          </span>
                          {stat.label}
                        </span>
                        <span className='type-caption text-gray-400 dark:text-gray-500'>
                          {statCounts[stat.key] || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Date filter */}
            <div ref={dateFilterRef}>
              <DateFilter
                dateRange={dateRange}
                activePreset={activePreset}
                setDateRange={setDateRange}
                setActivePreset={setActivePreset}
                open={openFilter === 'date'}
                onToggle={() =>
                  setOpenFilter(openFilter === 'date' ? null : 'date')
                }
                onClose={() => setOpenFilter(null)}
              />
            </div>

            <button
              type='button'
              onClick={() => setFilterLead((value) => !value)}
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-2 rounded-(--radius-control) px-3.5 type-small font-medium transition',
                filterLead
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5',
              )}
            >
              <Users className='h-3.5 w-3.5' />
              Leads only
            </button>

            <Button variant='outline' onClick={onSeeAll}>
              See all
            </Button>
          </div>
        </div>

        {/* Table structure stays fixed on desktop (flexible customer
            column + controlled metadata/action columns). On
            tablet/mobile the row scrolls horizontally instead of
            columns randomly collapsing or getting clipped. */}
        <div className='min-w-0 max-w-full overflow-hidden rounded-b-xl border border-gray-200 dark:border-white/5'>
          <div className='w-full overflow-x-auto'>
          <table className='lashvae-column-dividers w-full min-w-180 table-fixed min-h-80'>
            <colgroup>
              {/* Customer — flexible */}
              <col className='w-(--table-conversations-customer-width)' />
              {/* Channel */}
              <col className='w-(--table-conversations-channel-width)' />
              {/* Intent */}
              <col className='w-(--table-conversations-intent-width)' />
              {/* Status */}
              <col className='w-(--table-conversations-status-width)' />
              {/* Lead */}
              <col className='w-(--table-conversations-lead-width)' />
              {/* Actions */}
              <col className='w-(--table-conversations-actions-width)' />
            </colgroup>

            <thead className='border-b border-gray-100 dark:border-white/5'>
              <tr>
                {[
                  'Customer',
                  'Channel',
                  'Intent',
                  'Status',
                  'Lead',
                  'Actions',
                ].map((header) => (
                  <th
                    key={header}
                    className={cn(
                      'px-3 py-2.5 type-caption font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 sm:px-4',
                      header === 'Actions' ? 'text-right' : 'text-left',
                    )}
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
                    colSpan={6}
                    className='px-3 py-12 text-center type-small text-gray-500 dark:text-gray-400 sm:px-4'
                  >
                    Loading conversations
                  </td>
                </tr>
              )}

              {!loading && items.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className='px-3 py-12 text-center type-small text-gray-500 dark:text-gray-400 sm:px-4'
                  >
                    {q.trim()
                      ? 'No conversations match this search'
                      : 'No conversations found'}
                  </td>
                </tr>
              )}

              {!loading &&
                pageItems.map((item) => {
                  const selectedCategory =
                    statFilter === 'complaint' ||
                      statFilter === 'feedback' ||
                      statFilter === 'order' ||
                      statFilter === 'enquiry'
                      ? (statFilter as Category)
                      : null;

                  const category = selectedCategory ?? getCategory(item);

                  const preview =
                    item.lead?.meta?.text_preview ||
                    item.preview ||
                    'No preview available';

                  const name = displayName(item);

                  return (
                    <tr
                      key={item.id}
                      className='transition hover:bg-gray-50 dark:hover:bg-white/2'
                    >
                      {/* Customer */}
                      <td className='px-3 py-2.5 sm:px-4'>
                        <Link
                          href={`/conversations/${item.id}`}
                          className='flex items-center gap-2.5'
                        >
                          <div className='relative shrink-0'>
                            <ConversationAvatar
                              conversation={item}
                              size={30}
                            />
                          </div>

                          <div className='min-w-0 flex-1'>
                            <div className='flex items-center gap-1.5'>
                              <span className='group relative block min-w-0 flex-1 type-small font-semibold text-gray-800 dark:text-white/90'>
                                <span className='block truncate'>{name}</span>

                                <span className='pointer-events-none absolute left-0 top-full z-50 mt-1 hidden max-w-70 group-hover:block'>
                                  <span className='absolute -top-1 left-3 h-2 w-2 rotate-45 rounded-xs bg-gray-900' />

                                  <span className='relative block rounded-(--radius-control) bg-gray-900 px-3 py-1.5 type-caption font-medium text-white shadow-lg'>
                                    {name}
                                  </span>
                                </span>
                              </span>

                              <span className='shrink-0 truncate type-micro text-gray-500 dark:text-gray-400'>
                                <span className='font-medium text-gray-700 dark:text-gray-300'>
                                  {timeAgo(item.last_message_at)}
                                </span>
                              </span>

                              {item.unread_count != null &&
                                item.unread_count > 0 && (
                                  <span className='shrink-0 rounded-full bg-brand-500 px-1.5 py-0 text-[10px] font-bold text-white'>
                                    {item.unread_count}
                                  </span>
                                )}
                            </div>

                            <span className='mt-1 block truncate type-micro text-gray-500 dark:text-gray-400'>
                              {preview}
                            </span>
                          </div>
                        </Link>
                      </td>

                      {/* Channel */}
                      <td className='px-3 py-2.5 type-small text-gray-500 dark:text-gray-400 sm:px-4'>
                        <span className='inline-flex items-center gap-1.5'>
                          <span className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gray-50 dark:bg-white/5'>
                            <Image
                              src={
                                CHANNEL_LOGOS[
                                (item.channel || '').toLowerCase()
                                ] || '/brand-logo/website.png'
                              }
                              alt={platformLabel(item.channel)}
                              width={14}
                              height={14}
                              className='h-3.5 w-3.5 shrink-0 object-contain'
                            />
                          </span>
                          <span className='truncate type-micro font-medium text-gray-700 dark:text-gray-300'>
                            {platformLabel(item.channel)}
                          </span>
                        </span>
                      </td>

                      {/* Intent */}
                      <td className='px-3 py-2.5 sm:px-4'>
                        <span
                          title={category || 'Unclassified'}
                          className='inline-flex items-center rounded-full bg-brand-50 px-2 py-0.5 type-micro font-semibold capitalize text-brand-600 truncate dark:bg-brand-500/15 dark:text-brand-400'
                        >
                          {category || '—'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className='px-3 py-2.5 sm:px-4'>
                        <span
                          title={item.status || 'unknown'}
                          className={`inline-flex items-center rounded-full px-2 py-0.5 type-micro font-semibold capitalize truncate ${badgeClass(
                            item.status,
                          )}`}
                        >
                          {item.status || '—'}
                        </span>
                      </td>

                      {/* Lead */}
                      <td className='px-3 py-2.5 sm:px-4'>
                        {item.lead ? (
                          <span
                            title={item.lead.status || 'new'}
                            className={`inline-flex items-center rounded-full px-2 py-0.5 type-micro font-semibold capitalize truncate ${leadBadgeClass(
                              item.lead.status,
                            )}`}
                          >
                            {item.lead.status || 'new'}
                          </span>
                        ) : (
                          <span className='type-micro font-medium text-gray-400 dark:text-gray-500'>
                            —
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className='px-3 py-2.5 text-right sm:px-4'>
                        <Link
                          href={`/conversations/${item.id}`}
                          title='View conversation'
                          className='inline-flex h-7 items-center justify-center gap-1 whitespace-nowrap rounded-lg bg-brand-500 px-2.5 type-micro font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500/30'
                        >
                          <Eye size={12} />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          </div>
        </div>
        <TablePagination
          page={page}
          totalItems={totalItems}
          onPageChange={setPage}
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────────
export default function ConversationsPage() {
  const {
    filter: channelFilter,
    setFilter: setChannelFilter,
    channels,
    loading: channelsLoading,
    selectedChannels,
    clear: clearChannels,
  } = useChannelFilter();

  const [items, setItems] = useState<ConvoItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<ConversationStatsResponse>({
    total: 0,
    statuses: {},
    categories: {},
    with_lead: 0,
    channels: {},
  });
  const [filterLead, setFilterLead] = useState(false);
  const [openFilter, setOpenFilter] = useState<InboxFilterKey | null>(null);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState('all');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [dateRange, setDateRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [activePreset, setActivePreset] = useState<number | null>(null);
  const [statFilter, setStatFilter] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [q]);

  // useChannelFilter may return a new selectedChannels array on every render.
  // A primitive string remains referentially stable and prevents the loading
  // effect from firing again after every setItems/setLoading update.
  const selectedPlatformKey = Array.from(
    new Set(
      selectedChannels
        .map((channel) => channel.platform?.trim().toLowerCase())
        .filter((platform): platform is string => Boolean(platform)),
    ),
  )
    .sort()
    .join(',');

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set('q', debouncedQ);

    // The status stat cards and the conversation-status dropdown share the
    // same backend field. A selected stat card takes precedence.
    const effectiveStatus =
      statFilter === 'open' || statFilter === 'handoff'
        ? statFilter
        : status;
    if (effectiveStatus !== 'all') params.set('status', effectiveStatus);

    // Filter by stable platform name, not TenantChannel.id. Reconnecting a
    // platform creates a new channel row/id, but historical conversations keep
    // their original id.
    if (selectedPlatformKey) {
      selectedPlatformKey.split(',').forEach((platform) => {
        params.append('channels', platform);
      });
    }
    if (
      statFilter === 'complaint' ||
      statFilter === 'feedback' ||
      statFilter === 'order' ||
      statFilter === 'enquiry'
    ) {
      params.set('categories', statFilter);
    }
    if (filterLead || statFilter === 'lead') {
      params.set('has_lead', 'true');
    }
    if (dateRange?.from) {
      params.set('from_ts', new Date(dateRange.from).toISOString());
    }
    if (dateRange?.to) {
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      params.set('to_ts', to.toISOString());
    }
    return params;
  }, [
    dateRange,
    debouncedQ,
    filterLead,
    selectedPlatformKey,
    statFilter,
    status,
  ]);

  const loadConversations = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setErr(null);
      try {
        const params = buildFilterParams();
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String((page - 1) * PAGE_SIZE));

        const data = await apiFetch<ConversationsResponse>(
          `/admin/conversations?${params.toString()}`,
          { auth: true },
        );
        setItems(data.items || []);
        setTotalCount(data.total || 0);
        setLastRefresh(new Date());

        // A deletion or incoming filter change can leave the UI beyond the
        // final page. Move back once and let the effect fetch that page.
        if (page > 1 && (data.items || []).length === 0 && data.total > 0) {
          setPage(Math.max(1, Math.ceil(data.total / PAGE_SIZE)));
        }
      } catch (error: unknown) {
        setErr(errorMessage(error, 'Failed to load conversations'));
        setItems([]);
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [buildFilterParams, page],
  );

  const loadStats = useCallback(async () => {
    try {
      const data = await apiFetch<ConversationStatsResponse>(
        '/admin/conversations/stats',
        { auth: true },
      );
      setStats({
        total: data.total || 0,
        statuses: data.statuses || {},
        categories: data.categories || {},
        with_lead: data.with_lead || 0,
        channels: data.channels || {},
      });
    } catch (error: unknown) {
      setErr(errorMessage(error, 'Failed to load conversation counts'));
    }
  }, []);

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStats();
  }, [loadStats]);

  // Refresh only the current server page, and do nothing for hidden tabs.
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadConversations({ silent: true });
      }
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [loadConversations]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadStats();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadStats]);

  // ChannelFilter renders current connection rows and expects id-keyed counts.
  // The API returns stable platform-keyed counts, so map each current row to
  // the complete historical count for its platform.
  const channelCounts = useMemo<Record<number, number>>(
    () =>
      Object.fromEntries(
        channels.map((channel) => [
          channel.id,
          stats.channels[channel.platform.trim().toLowerCase()] || 0,
        ]),
      ),
    [channels, stats.channels],
  );
  const channelTotal = useMemo(
    () =>
      Object.values(stats.channels).reduce((sum, count) => sum + count, 0),
    [stats.channels],
  );

  const tabCounts = useMemo(
    () => ({
      all: stats.total,
      open: stats.statuses.open || 0,
      handoff: stats.statuses.handoff || 0,
      closed: stats.statuses.closed || 0,
    }),
    [stats],
  );

  const statValues: Record<string, number> = {
    all: stats.total,
    complaint: stats.categories.complaint || 0,
    feedback: stats.categories.feedback || 0,
    order: stats.categories.order || 0,
    enquiry: stats.categories.enquiry || 0,
    open: stats.statuses.open || 0,
    handoff: stats.statuses.handoff || 0,
    lead: stats.with_lead,
  };

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
      <div className='py-5'>
        <div className='rounded-2xl border border-gray-200 bg-white p-4.5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] dark:border-gray-800 dark:bg-white/3 sm:p-5'>
          <Split at='xl'>
            <div>
              <p className='type-small font-semibold uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400'>
                Conversations
              </p>
              <h1 className='mt-1 text-title-sm font-semibold text-gray-800 dark:text-white/90'>
                Inbox management
              </h1>
              <p className='mt-1 max-w-2xl type-small text-gray-500 dark:text-gray-400'>
                Review customer conversations, lead quality, channel source, and
                intent signals from a single workspace.
              </p>
            </div>

            <div className='flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3'>
              <button
                className='inline-flex h-8 items-center justify-center gap-2 rounded-(--radius-control) border border-gray-200 bg-white px-3.5 type-small font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/5'
                onClick={() => {
                  void Promise.all([loadConversations(), loadStats()]);
                }}
              >
                <RefreshCw className='h-3.5 w-3.5' />
                Refresh
              </button>
              <div className='flex items-center gap-1.5 type-micro text-gray-500 dark:text-gray-400'>
                <Clock3 className='h-3 w-3' />
                Last refreshed {lastRefresh.toLocaleTimeString()}
              </div>
            </div>
          </Split>

          {/* Stable desktop composition: 2 cols on mobile, 4 on tablet,
              8 on desktop (1024px+) — the column count no longer changes
              at an ultra-wide breakpoint or with browser zoom. */}
          <Grid className='mt-5' columns={{ mobile: 2, tablet: 4, desktop: 8 }} gap='xs'>
            {STAT_FILTERS.map((stat) => (
              <StatTile
                key={stat.key}
                label={stat.label}
                value={statValues[stat.key] || 0}
                icon={stat.icon}
                tone={stat.tone}
                active={statFilter === stat.key}
                onClick={() =>
                  setStatFilter(statFilter === stat.key ? 'all' : stat.key)
                }
              />
            ))}
          </Grid>
        </div>

        {err && (
          <div className='mt-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 type-small text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400'>
            {err}
          </div>
        )}

        <div className='mt-4'>
          <ConversationTable
            items={items}
            loading={loading}
            page={page}
            setPage={setPage}
            totalItems={totalCount}
            status={status}
            setStatus={(next) => {
              setStatus(next);
              setPage(1);
            }}
            tabCounts={tabCounts}
            openFilter={openFilter}
            setOpenFilter={setOpenFilter}
            q={q}
            setQ={(next) => {
              setQ(next);
              if (!next.trim()) setPage(1);
            }}
            onSearchSubmit={() => {
              setPage(1);
              setDebouncedQ(q.trim());
            }}
            onSeeAll={handleSeeAll}
            channelFilter={channelFilter}
            setChannelFilter={setChannelFilter}
            channels={channels}
            channelsLoading={channelsLoading}
            selectedChannels={selectedChannels}
            channelCounts={channelCounts}
            channelTotal={channelTotal}
            dateRange={dateRange}
            setDateRange={(next) => {
              setDateRange(next);
              setPage(1);
            }}
            activePreset={activePreset}
            setActivePreset={setActivePreset}
            filterLead={filterLead}
            setFilterLead={(updater) => {
              setFilterLead(updater);
              setPage(1);
            }}
            statFilter={statFilter}
            setStatFilter={(next) => {
              setStatFilter(next);
              setPage(1);
            }}
            statCounts={statValues}
          />

          {dateRange && (
            <p className='mt-3 type-caption text-gray-500 dark:text-gray-400'>
              Filtered from {formatDate(dateRange.from)} to{' '}
              {formatDate(dateRange.to)}
            </p>
          )}
        </div>
      </div>
    </RequireAuth>
  );
}