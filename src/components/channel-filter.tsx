'use client';

import { useEffect, useState, useCallback } from 'react';
import { Radio, Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
export type ChannelFilterValue = {
  channel_ids: number[];
};

export type ChannelItem = {
  id: number;
  platform: string;
  platform_account_id: string;
  display_name: string;
  is_active: boolean;
};

// ── Platform config ────────────────────────────────────────────────────────────
const PLATFORM_CFG: Record<string, { logoSrc: string; label: string }> = {
  instagram: { logoSrc: '/brand-logo/instagram.png', label: 'Instagram' },
  youtube: { logoSrc: '/brand-logo/youtube.png', label: 'YouTube' },
  whatsapp: { logoSrc: '/brand-logo/whatsapp.png', label: 'WhatsApp' },
  telegram: { logoSrc: '/brand-logo/telegram.png', label: 'Telegram' },
  facebook: { logoSrc: '/brand-logo/facebook.png', label: 'Facebook' },
  website: { logoSrc: '/brand-logo/website.png', label: 'Website' },
  meta: { logoSrc: '/brand-logo/meta.png', label: 'Meta' },
  google: { logoSrc: '/brand-logo/google-map.png', label: 'Google' },
};

const DEFAULT_CFG = { logoSrc: null as string | null, label: 'Channel' };

export function getPlatformCfg(platform: string) {
  return (
    PLATFORM_CFG[platform?.toLowerCase()] ?? {
      ...DEFAULT_CFG,
      label: platform || 'Channel',
    }
  );
}

export function channelLabel(c: ChannelItem): string {
  if (c.display_name && c.display_name.trim()) return c.display_name.trim();
  return getPlatformCfg(c.platform).label;
}

// ── Trigger label (use inside your filter button) ───────────────────────────────
export function ChannelFilterValueLabel({
  selected,
}: {
  selected: ChannelItem[];
}) {
  if (selected.length === 0) return <>Channel</>;

  if (selected.length === 1) {
    const c = selected[0];
    const cfg = getPlatformCfg(c.platform);
    return (
      <span className='inline-flex min-w-0 items-center gap-1.5'>
        {cfg.logoSrc && (
          <img
            src={cfg.logoSrc}
            alt=''
            className='h-3.5 w-3.5 shrink-0 rounded-sm object-contain'
          />
        )}
        <span className='max-w-30 truncate'>{channelLabel(c)}</span>
      </span>
    );
  }

  return (
    <span className='inline-flex items-center gap-1.5'>
      <span className='flex -space-x-1'>
        {selected.slice(0, 3).map((c) => {
          const cfg = getPlatformCfg(c.platform);
          return cfg.logoSrc ? (
            <img
              key={c.id}
              src={cfg.logoSrc}
              alt=''
              className='h-3.5 w-3.5 rounded-sm object-contain ring-1 ring-white dark:ring-gray-900'
            />
          ) : null;
        })}
      </span>
      {selected.length} channels
    </span>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────
export function ChannelFilter({
  value,
  onChange,
  channels: channelsProp,
  loading: loadingProp,
  counts,
  totalCount,
  className,
}: {
  value: ChannelFilterValue;
  onChange: (v: ChannelFilterValue) => void;
  channels?: ChannelItem[];
  loading?: boolean;
  counts?: Record<number, number>;
  totalCount?: number;
  className?: string;
}) {
  // Self-load only when the parent doesn't pass channels in.
  const selfLoad = channelsProp === undefined;
  const [channelsState, setChannelsState] = useState<ChannelItem[]>([]);
  const [loadingState, setLoadingState] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: ChannelItem[] }>('/admin/channels', {
        auth: true,
      });
      const items = (data.items || [])
        .filter((item) => item.platform?.toLowerCase() !== 'google')
        .filter((c) => c.is_active);
      setChannelsState(items);
    } catch {
      // silently fail
    } finally {
      setLoadingState(false);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selfLoad) load();
  }, [selfLoad, load]);

  const channels = channelsProp ?? channelsState;
  const loading = loadingProp ?? loadingState;

  if (!loading && channels.length === 0) return null;

  const isAll = value.channel_ids.length === 0;

  const toggle = (c: ChannelItem) => {
    const selected = value.channel_ids.includes(c.id);
    onChange({
      channel_ids: selected
        ? value.channel_ids.filter((id) => id !== c.id)
        : [...value.channel_ids, c.id],
    });
  };

  const rowClass = (active: boolean) =>
    cn(
      'flex w-full items-center justify-between rounded-(--radius-control) px-3 py-2 text-left type-small font-medium transition',
      active
        ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
        : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/4',
    );

  return (
    <div className={cn('flex w-full flex-col gap-0.5', className)}>
      <button
        type='button'
        onClick={() => onChange({ channel_ids: [] })}
        className={rowClass(isAll)}
      >
        <span className='inline-flex items-center gap-2'>
          <Radio className='h-4 w-4' />
          All channels
        </span>
        {totalCount != null && (
          <span className='type-caption text-gray-400 dark:text-gray-500'>
            {totalCount}
          </span>
        )}
      </button>

      {loading
        ? Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className='mx-3 my-1 h-4 animate-pulse rounded bg-gray-100 dark:bg-white/6'
            />
          ))
        : channels.map((c) => {
            const cfg = getPlatformCfg(c.platform);
            const active = value.channel_ids.includes(c.id);
            const label = channelLabel(c);
            const count = counts?.[c.id] ?? 0;

            return (
              <button
                key={c.id}
                type='button'
                onClick={() => toggle(c)}
                title={`${cfg.label} · ${c.platform_account_id}`}
                className={rowClass(active)}
              >
                <span className='inline-flex min-w-0 items-center gap-2'>
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
                      active
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-gray-300 dark:border-gray-600',
                    )}
                  >
                    {active && <Check className='h-3 w-3' strokeWidth={3} />}
                  </span>
                  {cfg.logoSrc ? (
                    <img
                      src={cfg.logoSrc}
                      alt={cfg.label}
                      className='h-4 w-4 shrink-0 rounded-sm object-contain'
                    />
                  ) : (
                    <Radio className='h-4 w-4 shrink-0' />
                  )}
                  <span className='truncate'>{label}</span>
                </span>
                <span className='type-caption text-gray-400 dark:text-gray-500'>
                  {count}
                </span>
              </button>
            );
          })}
    </div>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────
export function useChannelFilter() {
  const [filter, setFilter] = useState<ChannelFilterValue>({ channel_ids: [] });
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ items: ChannelItem[] }>(
          '/admin/channels',
          { auth: true },
        );
        const items = (data.items || [])
          .filter((item) => item.platform?.toLowerCase() !== 'google')
          .filter((c) => c.is_active);
        if (!cancelled) setChannels(items);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const queryParams = useCallback((): string => {
    if (!filter.channel_ids.length) return '';
    return filter.channel_ids.map((id) => `&channel_id=${id}`).join('');
  }, [filter]);

  const selectedChannels = channels.filter((c) =>
    filter.channel_ids.includes(c.id),
  );

  const clear = useCallback(() => setFilter({ channel_ids: [] }), []);

  return {
    filter,
    setFilter,
    queryParams,
    channels,
    loading,
    selectedChannels,
    clear,
  };
}
