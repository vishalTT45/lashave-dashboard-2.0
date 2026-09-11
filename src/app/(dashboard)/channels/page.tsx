'use client';

import GoogleLocationModal from '@/components/GoogleLocationModal';
import { RequireAuth } from '@/components/require-auth';
import {
  ConversationLimitBanner,
  LockedAccountBanner,
} from '@/components/billing/FeatureGate';
import {
  getPageItems,
  TablePagination,
} from '@/components/ui/table-pagination';
import WebsiteWidgetModal from '@/components/Websitewidgetmodal ';
import { apiFetch } from '@/lib/api';
import { useBilling } from '@/lib/billing-context';
import { useTheme } from '@/lib/theme-context';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  Globe2,
  Loader2,
  MapPin,
  MoreVertical,
  PauseCircle,
  Plug,
  Power,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

const ChannelSettingsDrawer = dynamic(
  () =>
    import('@/components/ChannelSettingsDrawer').then(
      (m) => m.ChannelSettingsDrawer,
    ),
  { ssr: false },
);

type Overview = {
  total_conversations: number;
  open_conversations: number;
  total_messages: number;
  avg_latency_ms: number | null;
  total_leads: number;
  total_handoffs: number;
  total_errors: number;
};

type Channel = {
  id: number;
  platform: string;
  platform_account_id: string;
  display_name?: string;
  account_name?: string;
  username?: string;
  profile_picture_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  token_issued_at?: string;
  location_id?: string | null;
  location_name?: string | null;
};

type WebsiteWidgetResponse = {
  config?: Record<string, unknown>;
  embed_code?: string;
  script?: string;
  embedCode?: string;
  created?: boolean;
  widget_key?: string;
};

type VerifyResult = {
  ok: boolean;
  account_name?: string | null;
  error?: string | null;
};

const ALL_PLATFORMS = ['instagram', 'telegram', 'facebook', 'google reviews'];
const META_PLATFORMS = ['instagram', 'facebook'];
const TOKEN_LIFETIME_DAYS = 60;
const WARN_AFTER_DAYS = 50;

const PLATFORM_LABELS: Record<string, string> = {
  'instagram': 'Instagram',
  'telegram': 'Telegram',
  'facebook': 'Facebook',
  'google': 'Google Reviews',
  'google reviews': 'Google Reviews',
  'website': 'Website',
};

const PLATFORM_LOGOS: Record<string, string> = {
  'instagram': '/brand-logo/instagram.png',
  'telegram': '/brand-logo/telegram.png',
  'facebook': '/brand-logo/facebook.png',
  'google': '/brand-logo/google-map.png',
  'google reviews': '/brand-logo/google-map.png',
  'website': '/brand-logo/website.png',
  'whatsapp': '/brand-logo/whatsapp.png',
  'youtube': '/brand-logo/youtube.png',
  'meta': '/brand-logo/meta.png',
};

const CONNECT_STAGES = [
  'Review permissions and privacy terms',
  'Authorize with the channel provider',
  'Verify the connected account',
  'Start syncing customer conversations',
];

const DATA_ACCESS_NOTES = [
  'Customer messages, comments, reviews, and conversation metadata',
  'Profile identifiers needed to route replies and display conversations',
  'Channel account information required for setup, verification, and support',
];

const PROCESSING_NOTES = [
  'Data is used to power inbox management, AI-assisted replies, classifications, lead detection, analytics, and service workflows.',
  'Processing is handled under GDPR and DPDPA safeguards with access limited to authorized workspace users and required service operations.',
  'Your business remains responsible for having a lawful basis, notifying customers, and maintaining your own privacy notice.',
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function platformLabel(platform?: string) {
  if (!platform) return 'Channel';
  const key = platform.toLowerCase().trim();
  return (
    PLATFORM_LABELS[key] || platform.charAt(0).toUpperCase() + platform.slice(1)
  );
}

function platformLogo(platform?: string) {
  if (!platform) return '/brand-logo/website.png';
  const key = platform.toLowerCase().trim();
  return PLATFORM_LOGOS[key] || '/brand-logo/website.png';
}

function channelName(channel: Channel) {
  return (
    channel.account_name ||
    channel.display_name ||
    channel.username ||
    channel.platform_account_id ||
    platformLabel(channel.platform)
  );
}

function formatDate(value?: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  }).format(date);
}

function getTokenStatus(
  channel: Channel,
): { status: 'ok' | 'expiring' | 'expired'; daysLeft: number } | null {
  const platform = channel.platform?.toLowerCase();
  if (!platform || !META_PLATFORMS.includes(platform)) return null;
  const issued =
    channel.token_issued_at ?? channel.updated_at ?? channel.created_at;
  if (!issued) return null;
  const issuedMs = new Date(issued).getTime();
  if (Number.isNaN(issuedMs)) return null;
  const ageDays = (Date.now() - issuedMs) / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, Math.ceil(TOKEN_LIFETIME_DAYS - ageDays));
  if (ageDays >= TOKEN_LIFETIME_DAYS) return { status: 'expired', daysLeft: 0 };
  if (ageDays >= WARN_AFTER_DAYS) return { status: 'expiring', daysLeft };
  return { status: 'ok', daysLeft };
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

function ChartHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className='mb-6'>
      <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
        {title}
      </h3>
      <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
        {subtitle}
      </p>
    </div>
  );
}

function ConnectModal({
  platform,
  connecting,
  error,
  token,
  setToken,
  acknowledged,
  setAcknowledged,
  onCancel,
  onConfirm,
}: {
  platform: string;
  connecting: boolean;
  error: string;
  token: string;
  setToken: (value: string) => void;
  acknowledged: boolean;
  setAcknowledged: (value: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const isTelegram = platform === 'telegram';
  const connectDisabled =
    connecting || !acknowledged || (isTelegram && !token.trim());

  return (
    <div className='fixed inset-0 z-400 grid place-items-center bg-gray-900/50 p-6 backdrop-blur-sm'>
      <Card className='max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6 shadow-theme-xl'>
        <h2 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
          Connect {platformLabel(platform)}
        </h2>
        <p className='mt-2 type-small text-gray-500 dark:text-gray-400'>
          Review the setup process and data-processing terms before authorizing
          Lashvae to manage this channel.
        </p>

        <div className='mt-5 grid gap-4 lg:grid-cols-2'>
          <div className='rounded-xl border border-gray-200 p-4 dark:border-gray-800'>
            <h3 className='type-small font-semibold text-gray-800 dark:text-white/90'>
              Connection stages
            </h3>
            <ol className='mt-3 space-y-3'>
              {CONNECT_STAGES.map((stage, index) => (
                <li
                  key={stage}
                  className='flex gap-3 type-small text-gray-600 dark:text-gray-400'
                >
                  <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'>
                    {index + 1}
                  </span>
                  <span>{stage}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className='rounded-xl border border-gray-200 p-4 dark:border-gray-800'>
            <h3 className='type-small font-semibold text-gray-800 dark:text-white/90'>
              Data accessed
            </h3>
            <ul className='mt-3 space-y-2'>
              {DATA_ACCESS_NOTES.map((note) => (
                <li
                  key={note}
                  className='flex gap-2 type-small text-gray-600 dark:text-gray-400'
                >
                  <Check className='mt-0.5 h-4 w-4 shrink-0 text-success-500' />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className='mt-4 rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-500/20 dark:bg-success-500/10'>
          <h3 className='type-small font-semibold text-gray-800 dark:text-white/90'>
            Privacy and GDPR acknowledgement
          </h3>
          <div className='mt-3 space-y-2'>
            {PROCESSING_NOTES.map((note) => (
              <p
                key={note}
                className='type-small text-gray-600 dark:text-gray-400'
              >
                {note}
              </p>
            ))}
          </div>
        </div>

        {isTelegram && (
          <div className='mt-5'>
            <label className='type-small font-medium text-gray-700 dark:text-gray-300'>
              Telegram bot token
            </label>
            <input
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder='Telegram bot token'
              className='mt-2 h-10 w-full rounded-(--radius-control) border border-gray-200 bg-white px-3 type-small text-gray-700 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300'
            />
          </div>
        )}

        <label className='mt-5 flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-4 transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/3'>
          <input
            type='checkbox'
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className='mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500'
          />
          <span className='type-small text-gray-600 dark:text-gray-400'>
            I understand and acknowledge the data-processing and privacy terms,
            and confirm that I am authorized to connect this business channel.
          </span>
        </label>

        {error && (
          <p className='mt-4 rounded-(--radius-control) border border-error-200 bg-error-50 px-3 py-2 type-small text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500'>
            {error}
          </p>
        )}
        <div className='mt-6 flex justify-end gap-3'>
          <button
            type='button'
            onClick={onCancel}
            disabled={connecting}
            className='h-10 rounded-(--radius-control) border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={connectDisabled}
            className='inline-flex h-10 items-center gap-2 rounded-(--radius-control) bg-brand-500 px-4 type-small font-medium text-white disabled:opacity-60'
          >
            {connecting && <Loader2 className='h-4 w-4 animate-spin' />}
            Connect
          </button>
        </div>
      </Card>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  tone,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'warning' | 'error';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className='fixed inset-0 z-400 grid place-items-center bg-gray-900/50 p-6 backdrop-blur-sm'>
      <Card className='w-full max-w-md p-6 shadow-theme-xl'>
        <div
          className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${
            tone === 'error'
              ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
              : 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400'
          }`}
        >
          <AlertTriangle className='h-5 w-5' />
        </div>
        <h2 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
          {title}
        </h2>
        <p className='mt-2 type-small text-gray-500 dark:text-gray-400'>
          {description}
        </p>
        <div className='mt-6 flex justify-end gap-3'>
          <button
            type='button'
            onClick={onCancel}
            className='h-10 rounded-(--radius-control) border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onConfirm}
            className={`h-10 rounded-(--radius-control) px-4 type-small font-medium text-white ${
              tone === 'error' ? 'bg-error-500' : 'bg-warning-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </Card>
    </div>
  );
}

const logos: Record<string, string> = {
  facebook: '/brand-logo/facebook.png',
  google: '/brand-logo/google-map.png',
  google_maps: '/brand-logo/google-map.png',
  google_map: '/brand-logo/google-map.png',
  google_review: '/brand-logo/google-map.png',
  google_reviews: '/brand-logo/google-map.png',
  instagram: '/brand-logo/instagram.png',
  meta: '/brand-logo/meta.png',
  telegram: '/brand-logo/telegram.png',
  website: '/brand-logo/website.png',
  whatsapp: '/brand-logo/whatsapp.png',
  youtube: '/brand-logo/youtube.png',
};

function ChannelsInner() {
  const { isDark } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { canConnectChannel, isLocked, usage } = useBilling();
  const openedFromSettings = searchParams.get('from') === 'settings';
  const settingsReturnTo = searchParams.get('returnTo') || '/settings?section=channels';
  const settingsBackHref = settingsReturnTo.startsWith('/settings')
    ? settingsReturnTo
    : '/settings?section=channels';
  const [channels, setChannels] = useState<Channel[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  // Fetched but not yet surfaced in this page's UI — same pre-existing
  // gap as elsewhere; preserving the fetch for a future summary card
  // rather than deleting it.
  void overview;
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState('');
  const [connectPlatform, setConnectPlatform] = useState<string | null>(null);
  const [connectToken, setConnectToken] = useState('');
  const [connectAcknowledged, setConnectAcknowledged] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<Channel | null>(
    null,
  );
  const [pauseTarget, setPauseTarget] = useState<Channel | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<Channel | null>(null);
  const [locationTarget, setLocationTarget] = useState<Channel | null>(null);
  const [pendingLocationChannelId, setPendingLocationChannelId] = useState<
    number | null
  >(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [websiteModalOpen, setWebsiteModalOpen] = useState(false);
  const [websiteWidget, setWebsiteWidget] =
    useState<WebsiteWidgetResponse | null>(null);
  const [websiteLoading, setWebsiteLoading] = useState(false);
  const [websiteSaving, setWebsiteSaving] = useState(false);
  const [channelsPage, setChannelsPage] = useState(1);

  const load = useCallback(async () => {
    setErr('');
    try {
      const data = await apiFetch<{ items: Channel[] }>('/admin/channels', {
        auth: true,
      });
      setChannels(data.items || []);
    } catch (error: unknown) {
      setErr(errorMessage(error, 'Failed to load channels.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWebsiteWidget = useCallback(async () => {
    setWebsiteLoading(true);
    try {
      const data = await apiFetch<WebsiteWidgetResponse>('/admin/widget', {
        method: 'GET',
        auth: true,
      });
      setWebsiteWidget(data);
    } catch {
      setWebsiteWidget(null);
    } finally {
      setWebsiteLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
      void loadWebsiteWidget();
      void apiFetch<Overview>('/admin/stats/overview', { auth: true })
        .then(setOverview)
        .catch(() => undefined);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, loadWebsiteWidget]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const handlers = [
        ['ig_status', 'ig_username', 'Instagram'],
        ['fb_status', 'fb_page', 'Facebook'],
        ['yt_status', 'yt_channel', 'YouTube'],
      ] as const;
      for (const [statusKey, nameKey, label] of handlers) {
        const status = searchParams.get(statusKey);
        const name = searchParams.get(nameKey);
        const msg = searchParams.get(statusKey.replace('status', 'msg'));
        if (!status) continue;
        router.replace('/channels', { scroll: false });
        if (status === 'success') {
          setSuccess(
            name ? `${name} connected on ${label}.` : `${label} connected.`,
          );
          void load();
        } else {
          setErr(msg || `${label} connection failed.`);
        }
      }
      const googleStatus = searchParams.get('google_status');
      if (googleStatus) {
        router.replace('/channels', { scroll: false });
        if (googleStatus === 'success') {
          setSuccess(
            'Google connected. Select the business profile to manage.',
          );
          const channelId = searchParams.get('channel_id');
          if (channelId) setPendingLocationChannelId(Number(channelId));
          void load();
        } else {
          setErr(searchParams.get('google_msg') || 'Google connection failed.');
        }
      }

      const quotaStatus = searchParams.get('ig_status');
      if (quotaStatus === 'quota_exceeded') {
        router.replace('/channels', { scroll: false });
        const used = searchParams.get('used');
        const limit = searchParams.get('limit');
        setErr(
          used && limit
            ? `Channel limit reached. You are using ${used} of ${limit} available channels.`
            : 'Channel limit reached. Upgrade your plan to connect more channels.',
        );
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, router, searchParams]);

  useEffect(() => {
    if (pendingLocationChannelId == null) return;
    const target = channels.find(
      (channel) => channel.id === pendingLocationChannelId,
    );
    if (!target) return;
    const timer = window.setTimeout(() => {
      setLocationTarget(target);
      setPendingLocationChannelId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [channels, pendingLocationChannelId]);

  const pagedChannels = getPageItems(channels, channelsPage);
  const websiteChannel = channels.find(
    (channel) => channel.platform?.toLowerCase?.().trim() === 'website',
  );
  const websiteIsConnected = Boolean(websiteChannel);
  const taken = new Set(
    channels
      .map((channel) => channel.platform?.toLowerCase?.().trim())
      .filter(Boolean),
  );
  const available = ALL_PLATFORMS.filter((platform) => {
    const key = platform.toLowerCase().trim();
    if (key === 'google reviews') return !taken.has('google');
    return !taken.has(key);
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setChannelsPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [channels.length]);

  async function handleVerify(id: number): Promise<VerifyResult> {
    try {
      return await apiFetch<VerifyResult>(`/admin/channels/${id}/verify`, {
        method: 'POST',
        auth: true,
      });
    } catch (error: unknown) {
      return { ok: false, error: errorMessage(error, 'Verification failed.') };
    }
  }

  async function handleToggle(id: number, val: boolean) {
    try {
      const channel = channels.find((item) => item.id === id);
      if (channel?.platform === 'website') {
        await apiFetch(val ? '/admin/widget/enable' : '/admin/widget', {
          method: val ? 'POST' : 'DELETE',
          auth: true,
        });
        await loadWebsiteWidget();
      } else {
        await apiFetch(`/admin/channels/${id}`, {
          method: 'PUT',
          auth: true,
          body: { is_active: val },
        });
      }
      await load();
    } catch (error: unknown) {
      setErr(errorMessage(error, 'Failed to update channel.'));
    }
  }

  async function handleDisconnect(channel: Channel) {
    try {
      if (channel.platform === 'website') {
        await disableWebsiteWidget();
      } else {
        await apiFetch(`/admin/channels/${channel.id}`, {
          method: 'DELETE',
          auth: true,
        });
        setSuccess(`${platformLabel(channel.platform)} removed.`);
        await load();
      }
    } catch (error: unknown) {
      setErr(errorMessage(error, 'Failed to remove channel.'));
    } finally {
      setDisconnectTarget(null);
    }
  }

  async function handleConnect(platform: string, token?: string) {
    const fallbackPrivacyUrl = 'https://lashvae.com/legal/dpa';
    const commonAcceptance = {
      accepted: true,
      acknowledged: true,
      platform,
      channel: platform,
      source: 'channels',
      privacy_notice_url: fallbackPrivacyUrl,
      dpa_version: 1,
      accepted_version: 1,
    };

    if (platform === 'instagram') {
      const response = await apiFetch<{ auth_url: string }>(
        '/api/admin/channels/instagram/connect',
        {
          method: 'POST',
          auth: true,
          body: commonAcceptance,
        },
      );
      if (response.auth_url) window.location.assign(response.auth_url);
      return;
    }
    if (platform === 'facebook') {
      const response = await apiFetch<{ auth_url: string }>(
        '/api/admin/channels/facebook/connect',
        {
          method: 'POST',
          auth: true,
          body: commonAcceptance,
        },
      );
      if (response.auth_url) window.location.assign(response.auth_url);
      return;
    }
    if (platform === 'google reviews') {
      const response = await apiFetch<{ auth_url: string }>(
        '/api/admin/channels/google/connect',
        {
          method: 'POST',
          auth: true,
          body: commonAcceptance,
        },
      );
      if (response.auth_url) window.location.assign(response.auth_url);
      return;
    }
    if (platform === 'telegram') {
      const response = await apiFetch<{
        display_name?: string;
        username?: string;
      }>('/admin/channels/telegram/connect', {
        method: 'POST',
        auth: true,
        body: { token },
      });
      setSuccess(
        `${response.display_name || response.username || 'Telegram bot'} connected.`,
      );
      await load();
    }
  }

  async function recordProcessingAcknowledgement(platform: string) {
    const fallbackPrivacyUrl = 'https://lashvae.com/legal/dpa';
    try {
      await apiFetch('/api/admin/processing-acceptance', {
        method: 'POST',
        auth: true,
        body: {
          accepted: true,
          acknowledged: true,
          privacy_notice_url: fallbackPrivacyUrl,
          platform,
          channel: platform,
          source: 'channels',
          dpa_version: 1,
          accepted_version: 1,
        },
      });
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : '') || '';
      const ignore =
        /duplicate/i.test(msg) ||
        /already/i.test(msg) ||
        /exists/i.test(msg) ||
        /recorded/i.test(msg);
      if (!ignore) throw err;
    }
  }

  function openConnect(platform: string) {
    if (!canConnectChannel) {
      setErr(
        isLocked
          ? 'Your trial has ended. Upgrade to connect channels.'
          : `Channel limit reached (${usage?.channels.used ?? 0}/${usage?.channels.limit ?? 0}). Upgrade to connect more.`,
      );
      return;
    }

    setConnectToken('');
    setConnectError('');
    setConnectAcknowledged(false);
    setConnectPlatform(platform);
  }

  async function confirmConnect() {
    if (!connectPlatform) return;
    if (!connectAcknowledged) {
      setConnectError(
        'Please acknowledge the data-processing and privacy terms to continue.',
      );
      return;
    }
    setConnecting(true);
    setConnectError('');
    try {
      try {
        await recordProcessingAcknowledgement(connectPlatform);
      } catch (error: unknown) {
        throw new Error(
          `Could not record legal acceptance. ${errorMessage(error, '')}`.trim(),
        );
      }

      if (connectPlatform === 'website') {
        setConnectPlatform(null);
        setWebsiteModalOpen(true);
        await loadWebsiteWidget();
        return;
      }

      try {
        await handleConnect(connectPlatform, connectToken.trim() || undefined);
      } catch (error: unknown) {
        throw new Error(errorMessage(error, 'Failed to connect channel.'));
      }

      setConnectPlatform(null);
    } catch (error: unknown) {
      setConnectError(
        error instanceof Error ? error.message : 'Failed to connect channel.',
      );
    } finally {
      setConnecting(false);
    }
  }

  async function openWebsiteModal() {
    openConnect('website');
  }

  async function enableWebsiteWidget() {
    setWebsiteSaving(true);
    try {
      const data = await apiFetch<WebsiteWidgetResponse>(
        '/admin/widget/enable',
        {
          method: 'POST',
          auth: true,
        },
      );
      setWebsiteWidget(data);
      await loadWebsiteWidget();
      await load();
    } catch (error: unknown) {
      setErr(errorMessage(error, 'Failed to enable website widget.'));
    } finally {
      setWebsiteSaving(false);
    }
  }

  async function disableWebsiteWidget() {
    setWebsiteSaving(true);
    try {
      await apiFetch('/admin/widget', { method: 'DELETE', auth: true });
      await loadWebsiteWidget();
      await load();
    } catch (error: unknown) {
      setErr(errorMessage(error, 'Failed to disable website widget.'));
    } finally {
      setWebsiteSaving(false);
    }
  }

  async function copyWebsiteScript() {
    const config = websiteWidget?.config || websiteWidget;
    const widgetKey =
      config && typeof config === 'object' && 'widget_key' in config
        ? String(config.widget_key)
        : '';
    const script =
      websiteWidget?.embed_code ||
      websiteWidget?.script ||
      websiteWidget?.embedCode ||
      (widgetKey
        ? `<script src="${process.env.NEXT_PUBLIC_API_BASE}/widget/embed.js" data-widget-id="${widgetKey}" async></script>`
        : '');
    if (!script) {
      setErr('No script available. Enable the website widget first.');
      return;
    }
    await navigator.clipboard.writeText(script);
    setSuccess('Website script copied.');
  }

  const settingsCfgColor = '#465FFF';

  return (
    <>
      {disconnectTarget && (
        <ConfirmModal
          title={`Disconnect ${platformLabel(disconnectTarget.platform)}?`}
          description={`${channelName(disconnectTarget)} will be removed from this workspace.`}
          confirmLabel='Disconnect'
          tone='error'
          onCancel={() => setDisconnectTarget(null)}
          onConfirm={() => void handleDisconnect(disconnectTarget)}
        />
      )}

      {pauseTarget && (
        <ConfirmModal
          title={`Pause ${platformLabel(pauseTarget.platform)}?`}
          description='The AI assistant will stop replying on this channel until it is reactivated.'
          confirmLabel='Pause channel'
          tone='warning'
          onCancel={() => setPauseTarget(null)}
          onConfirm={() => {
            void handleToggle(pauseTarget.id, false);
            setPauseTarget(null);
          }}
        />
      )}

      {locationTarget && (
        <GoogleLocationModal
          channelId={locationTarget.id}
          isDark={isDark}
          currentLocationId={locationTarget.location_id ?? null}
          onClose={() => setLocationTarget(null)}
          onSaved={(loc) => {
            setSuccess(
              `Now managing reviews for ${loc.location_name || 'the selected location'}.`,
            );
            void load();
          }}
        />
      )}

      {connectPlatform && (
        <ConnectModal
          platform={connectPlatform}
          connecting={connecting}
          error={connectError}
          token={connectToken}
          setToken={setConnectToken}
          acknowledged={connectAcknowledged}
          setAcknowledged={setConnectAcknowledged}
          onCancel={() => setConnectPlatform(null)}
          onConfirm={() => void confirmConnect()}
        />
      )}

      {settingsTarget && (
        <ChannelSettingsDrawer
          channelId={settingsTarget.id}
          channelName={channelName(settingsTarget)}
          platformColor={settingsCfgColor}
          onClose={() => setSettingsTarget(null)}
          onBackToSettings={
            openedFromSettings
              ? () => router.push(settingsBackHref)
              : undefined
          }
        />
      )}

      {websiteModalOpen && (
        <WebsiteWidgetModal
          isDark={isDark}
          loading={websiteLoading}
          saving={websiteSaving}
          widget={websiteWidget}
          onClose={() => setWebsiteModalOpen(false)}
          onEnable={enableWebsiteWidget}
          onDisable={disableWebsiteWidget}
          onCopy={copyWebsiteScript}
        />
      )}

      <div className='py-6'>
        <LockedAccountBanner />
        <ConversationLimitBanner />
        <div className='mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
          <div>
            <p className='type-small font-medium text-brand-500 dark:text-brand-400'>
              Channels
            </p>
            <h1 className='mt-1 text-title-sm font-bold text-gray-800 dark:text-white/90'>
              Channel management
            </h1>
            <p className='mt-2 max-w-2xl type-small text-gray-500 dark:text-gray-400'>
              Connect, monitor, pause, and configure customer communication
              channels.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            {openedFromSettings && (
              <button
                type='button'
                onClick={() => router.push(settingsBackHref)}
                className='inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-control) border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/5'
              >
                <ChevronLeft className='h-4 w-4' />
                Back to Settings
              </button>
            )}
            <button
              type='button'
              onClick={() => void load()}
              className='inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-control) border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/5'
            >
              <RefreshCw className='h-4 w-4' />
              Refresh
            </button>
          </div>
        </div>

        {success && (
          <div className='mb-6 flex items-center gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3 type-small font-medium text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500'>
            <Check className='h-4 w-4' />
            <span className='flex-1'>{success}</span>
            <button type='button' onClick={() => setSuccess('')}>
              Close
            </button>
          </div>
        )}

        {err && (
          <div className='mb-6 flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 type-small font-medium text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
            <span className='flex-1'>{err}</span>
            <button type='button' onClick={() => setErr('')}>
              Close
            </button>
          </div>
        )}

        <Card className='mt-6 overflow-hidden'>
          <div className='flex flex-col gap-2 border-b border-gray-100 px-5 py-5 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6'>
            <div>
              <h3 className='type-body font-semibold text-gray-800 dark:text-white/90'>
                Connected Channels
              </h3>
              <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                Manage account status, verification, settings, and disconnect
                actions.
              </p>
            </div>
            <div className='type-small font-medium text-gray-500 dark:text-gray-400'>
              {channels.length} channels
            </div>
          </div>

          <div className='min-w-0 px-5 py-5 sm:px-6'>
            <div className='flex flex-col gap-4 rounded-t-xl border border-b-0 border-gray-200 bg-white px-5 py-4 dark:border-white/5 dark:bg-white/1 lg:flex-row lg:items-center lg:justify-between'>
              <h4 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                Connected channels
              </h4>
              <p className='type-small text-gray-500 dark:text-gray-400'>
                Verify, pause, configure, or update Google review locations.
              </p>
            </div>

            <div className='min-w-0 max-w-full overflow-hidden rounded-b-xl border border-gray-200 dark:border-white/5'>
              <div className='w-full overflow-x-auto'>
                <table className='lashvae-column-dividers min-w-305 table-fixed'>
                  <colgroup>
                    <col className='w-82.5' />
                    <col className='w-40' />
                    <col className='w-37.5' />
                    <col className='w-42.5' />
                    <col className='w-40' />
                    <col className='w-62.5' />
                  </colgroup>
                  <thead className='border-b border-gray-100 dark:border-white/5'>
                    <tr>
                      {[
                        'Channel',
                        'Platform',
                        'Status',
                        'Token',
                        'Updated',
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
                    {loading ? (
                      <tr>
                        <td
                          colSpan={6}
                          className='px-5 py-14 text-center type-small text-gray-500 dark:text-gray-400'
                        >
                          Loading channels
                        </td>
                      </tr>
                    ) : channels.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className='px-5 py-14 text-center type-small text-gray-500 dark:text-gray-400'
                        >
                          No channels connected yet
                        </td>
                      </tr>
                    ) : (
                      pagedChannels.map((channel) => {
                        const token = getTokenStatus(channel);
                        const isGoogle =
                          channel.platform?.toLowerCase().trim() === 'google';
                        const isWebsite =
                          channel.platform?.toLowerCase().trim() === 'website';
                        return (
                          <tr
                            key={channel.id}
                            className='transition hover:bg-gray-50 dark:hover:bg-white/2'
                          >
                            <td className='px-5 py-3 sm:px-6'>
                              <div className='flex items-center gap-3'>
                                <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 ring-1 ring-gray-200 dark:bg-gray-800 dark:ring-gray-700'>
                                  <Image
                                    src={platformLogo(channel.platform)}
                                    alt={platformLabel(channel.platform)}
                                    width={22}
                                    height={22}
                                    className='h-5.5 w-5.5 object-contain'
                                  />
                                </div>
                                <div className='min-w-0'>
                                  <p className='truncate type-small font-medium text-gray-800 dark:text-white/90'>
                                    {channelName(channel)}
                                  </p>
                                  {/* <p className='mt-1 truncate type-caption text-gray-500 dark:text-gray-400'>
                                    {channel.location_name ||
                                      channel.platform_account_id}
                                  </p> */}
                                </div>
                              </div>
                            </td>
                            <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
                              {platformLabel(channel.platform)}
                            </td>
                            <td className='px-6 py-3'>
                              <span
                                className={`inline-flex rounded-full px-3 py-1 type-caption font-medium ${
                                  channel.is_active
                                    ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
                                    : 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400'
                                }`}
                              >
                                {channel.is_active ? 'Active' : 'Offline'}
                              </span>
                            </td>
                            <td className='px-6 py-3'>
                              <span
                                className={`inline-flex rounded-full px-3 py-1 type-caption font-medium ${
                                  token?.status === 'expired'
                                    ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
                                    : token?.status === 'expiring'
                                      ? 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400'
                                      : 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80'
                                }`}
                              >
                                {token
                                  ? token.status === 'ok'
                                    ? `${token.daysLeft} days left`
                                    : token.status
                                  : 'Not applicable'}
                              </span>
                            </td>
                            <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
                              {formatDate(
                                channel.updated_at || channel.created_at,
                              )}
                            </td>
                            <td className='px-6 py-3'>
                              <div className='flex items-center gap-2 whitespace-nowrap'>
                                {/* VERIFY */}
                                <button
                                  type='button'
                                  title='Verify'
                                  aria-label='Verify channel'
                                  onClick={() => {
                                    void handleVerify(channel.id).then(
                                      (result) => {
                                        if (result.ok) {
                                          setErr('');
                                          setSuccess(
                                            result.account_name
                                              ? `Verified ${result.account_name}.`
                                              : 'Channel verified.',
                                          );
                                          return;
                                        }

                                        setSuccess('');
                                        setErr(
                                          result.error ||
                                            'Verification failed.',
                                        );
                                      },
                                    );
                                  }}
                                  className='flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-control)
        border border-brand-200 bg-brand-50 text-brand-500
        transition hover:border-brand-300 hover:bg-brand-100
        dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400
        dark:hover:border-brand-500/50 dark:hover:bg-brand-500/15'
                                >
                                  <ShieldCheck
                                    className='h-4.5 w-4.5'
                                    strokeWidth={2}
                                  />
                                </button>

                                {/* PAUSE */}
                                <button
                                  type='button'
                                  title={
                                    channel.is_active ? 'Pause' : 'Activate'
                                  }
                                  aria-label={
                                    channel.is_active
                                      ? 'Pause channel'
                                      : 'Activate channel'
                                  }
                                  onClick={() =>
                                    channel.is_active
                                      ? setPauseTarget(channel)
                                      : void handleToggle(channel.id, true)
                                  }
                                  className='flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-control)
        border border-brand-200 bg-brand-50 text-brand-500
        transition hover:border-brand-300 hover:bg-brand-100
        dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400
        dark:hover:border-brand-500/50 dark:hover:bg-brand-500/15'
                                >
                                  {channel.is_active ? (
                                    <PauseCircle
                                      className='h-4.5 w-4.5'
                                      strokeWidth={2}
                                    />
                                  ) : (
                                    <Power
                                      className='h-4.5 w-4.5'
                                      strokeWidth={2}
                                    />
                                  )}
                                </button>

                                {/* CUSTOMIZE AI */}
                                {!isGoogle && !isWebsite && (
                                  <button
                                    type='button'
                                    onClick={() => setSettingsTarget(channel)}
                                    className='inline-flex h-9 shrink-0 items-center justify-center gap-2
          whitespace-nowrap rounded-(--radius-control) bg-brand-500 px-3.5
          type-small font-medium text-white shadow-theme-xs
          transition hover:bg-brand-600'
                                  >
                                    <Sparkles
                                      className='h-4 w-4 shrink-0'
                                      strokeWidth={2}
                                    />
                                    <span className='whitespace-nowrap'>
                                      Customize AI
                                    </span>
                                  </button>
                                )}

                                {/* GOOGLE */}
                                {isGoogle && (
                                  <button
                                    type='button'
                                    onClick={() => setLocationTarget(channel)}
                                    className='inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap
          rounded-(--radius-control) bg-brand-500 px-3.5 type-small
          font-medium text-white shadow-theme-xs hover:bg-brand-600'
                                  >
                                    <MapPin className='h-4 w-4 shrink-0' />
                                    <span>Location</span>
                                  </button>
                                )}

                                {/* WEBSITE */}
                                {isWebsite && (
                                  <button
                                    type='button'
                                    onClick={() =>
                                      router.push('/customize-chat')
                                    }
                                    className='inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap
          rounded-(--radius-control) bg-brand-500 px-3.5 type-small
          font-medium text-white shadow-theme-xs hover:bg-brand-600'
                                  >
                                    <Settings className='h-4 w-4 shrink-0' />
                                    <span>Manage</span>
                                  </button>
                                )}

                                {/* MORE MENU */}
                                <div className='relative shrink-0'>
                                  <button
                                    type='button'
                                    onClick={() =>
                                      setOpenMenuId(
                                        openMenuId === channel.id
                                          ? null
                                          : channel.id,
                                      )
                                    }
                                    className='flex h-9 w-9 items-center justify-center rounded-(--radius-control)
          border border-gray-200 bg-white text-gray-500
          hover:border-brand-300 hover:bg-brand-50 hover:text-brand-500
          dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400
          dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10
          dark:hover:text-brand-400'
                                  >
                                    <MoreVertical className='h-4.5 w-4.5' />
                                  </button>

                                  {openMenuId === channel.id && (
                                    <div className='absolute right-0 top-[calc(100%+8px)] z-20 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900'>
                                      <button
                                        type='button'
                                        onClick={() => {
                                          setSettingsTarget(channel);
                                          setOpenMenuId(null);
                                        }}
                                        className='flex w-full items-center gap-2 rounded-(--radius-control) px-3 py-2 text-left type-small text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5'
                                      >
                                        <Settings className='h-4 w-4' />
                                        Settings
                                      </button>

                                      <button
                                        type='button'
                                        onClick={() => {
                                          setDisconnectTarget(channel);
                                          setOpenMenuId(null);
                                        }}
                                        className='flex w-full items-center gap-2 rounded-(--radius-control) px-3 py-2 text-left type-small text-error-600 hover:bg-error-50 dark:text-error-500 dark:hover:bg-error-500/10'
                                      >
                                        <Trash2 className='h-4 w-4' />
                                        Disconnect
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <TablePagination
              page={channelsPage}
              totalItems={channels.length}
              onPageChange={setChannelsPage}
            />
          </div>
        </Card>
        {(available.length > 0 || !websiteIsConnected) && (
          <Card className='mt-6 p-6 sm:p-6'>
            <ChartHeader
              title='Add Channel'
              subtitle='Connect another source using the approved channel setup flow'
            />
            <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
              {!websiteIsConnected && (
                <button
                  type='button'
                  onClick={() => void openWebsiteModal()}
                  className='rounded-xl border border-gray-200 p-6 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/3'
                >
                  <div className='mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'>
                    <Globe2 className='h-5 w-5' />
                  </div>
                  <h4 className='type-small font-semibold text-gray-800 dark:text-white/90'>
                    Website Chatbot
                  </h4>
                  <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                    Add AI chat to your website using one script tag.
                  </p>
                </button>
              )}
              {available.map((platform) => {
                const platformKey = platform
                  .toLowerCase()
                  .trim()
                  .replace(/[\s-]+/g, '_');
                const logo = logos[platformKey];

                return (
                  <button
                    key={platform}
                    type='button'
                    onClick={() => openConnect(platform)}
                    className='rounded-xl border border-gray-200 p-6 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/3'
                  >
                    <div className='mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 p-2 dark:bg-gray-800'>
                      {logo ? (
                        <Image
                          src={logo}
                          alt={`${platformLabel(platform)} logo`}
                          width={28}
                          height={28}
                          className='h-7 w-7 object-contain'
                        />
                      ) : (
                        <Plug className='h-5 w-5 text-gray-700 dark:text-gray-300' />
                      )}
                    </div>

                    <h4 className='type-small font-semibold text-gray-800 dark:text-white/90'>
                      {platformLabel(platform)}
                    </h4>

                    <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                      Connect and manage this channel from Lashvae.
                    </p>
                  </button>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

export default function ChannelsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <ChannelsInner />
      </Suspense>
    </RequireAuth>
  );
}