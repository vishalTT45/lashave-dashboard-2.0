'use client';

import { apiFetch } from '@/lib/api';
import {
  type BillingStatus,
  type UsageSummary,
  conversationUsagePercent,
  hasFeatureAccess,
  isAccountLocked,
  isChannelLimitReached,
  isConversationLimitReached,
  isTrialing,
  normalizeBillingStatus,
  normalizeUsage,
  type BillingFeature,
} from '@/lib/billing';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type BillingContextValue = {
  status: BillingStatus | null;
  usage: UsageSummary | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
  isTrialing: boolean;
  isLocked: boolean;
  trialDaysLeft: number | null;
  conversationPercent: number;
  conversationsAtLimit: boolean;
  channelsAtLimit: boolean;
  canUseFeature: (feature: BillingFeature) => boolean;
  canConnectChannel: boolean;
  canRunAiActions: boolean;
};

const BillingContext = createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      setError('');
      const [billingRaw, usageRaw] = await Promise.all([
        apiFetch<Record<string, unknown>>('/admin/billing/status', { auth: true }),
        apiFetch<Record<string, unknown>>('/admin/me/usage', { auth: true }),
      ]);

      setStatus(normalizeBillingStatus(billingRaw));
      setUsage(normalizeUsage(usageRaw));
    } catch (caughtError: unknown) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : 'Failed to load billing state';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const value = useMemo<BillingContextValue>(() => {
    const locked = isAccountLocked(status, usage);
    const trialing = isTrialing(status, usage);
    const conversationsAtLimit = isConversationLimitReached(usage);
    const channelsAtLimit = isChannelLimitReached(usage);

    return {
      status,
      usage,
      loading,
      error,
      refresh,
      isTrialing: trialing,
      isLocked: locked,
      trialDaysLeft: status?.trial_days_left ?? null,
      conversationPercent: conversationUsagePercent(usage),
      conversationsAtLimit,
      channelsAtLimit,
      canUseFeature: (feature: BillingFeature) =>
        hasFeatureAccess(feature, status, usage),
      canConnectChannel: !locked && !channelsAtLimit,
      canRunAiActions: !locked && !conversationsAtLimit,
    };
  }, [status, usage, loading, error, refresh]);

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) {
    throw new Error('useBilling must be used within BillingProvider');
  }
  return context;
}

export function useBillingOptional() {
  return useContext(BillingContext);
}
