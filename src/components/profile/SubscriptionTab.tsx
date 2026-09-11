'use client';

import { apiFetch } from '@/lib/api';
import { daysUntil } from '@/lib/billing';
import { useBilling } from '@/lib/billing-context';
import { useTheme } from '@/lib/theme-context';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type CurrencyCode = 'INR' | 'GBP' | 'USD';
type BillingCycle = 'monthly' | 'annual';
type PaidPlanId = 'starter' | 'pro' | 'business';

/* Loosely-shaped account/tenant info passed in as `me` — several
   possible field names for the same concept (country, business name)
   depending on which endpoint populated it. The index signature keeps
   this compatible with whatever shape the caller's `me` state actually
   has (e.g. profile/page.tsx's MeResp, which doesn't declare these
   flat fields at all — they may come from a different/older endpoint
   shape), while still giving the fields this file actually reads
   named, typed access instead of `any`. */
type SubscriptionAccountInfo = {
  country_code?: string;
  countryCode?: string;
  billing_country?: string;
  country?: string;
  business_name?: string;
  tenant_name?: string;
  [key: string]: unknown;
};

type PlanDisplay = {
  id: 'trial' | PaidPlanId;
  backendPlanId: PaidPlanId | null;
  name: string;
  tagline: string;
  conversations: string;
  channels: string;
  knowledgeDocs: string;
  priceMonthly: Record<CurrencyCode, number | null>;
  priceAnnual: Record<CurrencyCode, number | null>;
  features: string[];
  highlighted?: boolean;
};

const PLANS: PlanDisplay[] = [
  {
    id: 'trial',
    backendPlanId: null,
    name: 'Free Trial',
    tagline: 'Explore Lashvae AI for 14 days',
    conversations: '150 conversations',
    channels: 'Connect all available channels',
    knowledgeDocs: 'Unlimited knowledge documents',
    priceMonthly: { INR: 0, GBP: 0, USD: 0 },
    priceAnnual: { INR: 0, GBP: 0, USD: 0 },
    features: [
      '14-day free trial',
      '150 conversations',
      'Connect all available channels',
      'Unlimited knowledge documents',
      'AI website chat widget',
      'Auto appointment booking',
      'Conversation analytics',
      'AI chat summaries',
      'Mood detection',
      'Smart conversation categorization',
      'Lead detection',
    ],
  },
  {
    id: 'starter',
    backendPlanId: 'starter',
    name: 'Basic',
    tagline: 'For small businesses',
    conversations: '300 conversations / month',
    channels: 'Connect all available channels',
    knowledgeDocs: 'Unlimited knowledge documents',
    priceMonthly: { INR: 999, GBP: 49, USD: 49 },
    priceAnnual: { INR: 9990, GBP: 490, USD: 490 },
    features: [
      '300 conversations / month',
      'Connect all available channels',
      'Unlimited knowledge documents',
      'AI website chat widget',
      'Auto appointment booking',
      'Conversation analytics',
      'AI chat summaries',
      'Mood detection',
      'Smart conversation categorization',
      'Lead detection',
    ],
  },
  {
    id: 'pro',
    backendPlanId: 'pro',
    name: 'Growth',
    tagline: 'For growing businesses',
    conversations: '1,500 conversations / month',
    channels: 'Connect all available channels',
    knowledgeDocs: 'Unlimited knowledge documents',
    priceMonthly: { INR: 1999, GBP: 149, USD: 149 },
    priceAnnual: { INR: 19990, GBP: 1490, USD: 1490 },
    highlighted: true,
    features: [
      '1,500 conversations / month',
      'Connect all available channels',
      'Unlimited knowledge documents',
      'Everything in Basic',
      'Content ideas from customer conversations',
      'Competitor analysis',
      'Industry watch',
      'Growth reports and AI consultant',
    ],
  },
  {
    id: 'business',
    backendPlanId: 'business',
    name: 'Enterprise',
    tagline: 'For large teams and enterprises',
    conversations: 'Custom conversation volume',
    channels: 'Connect all available channels',
    knowledgeDocs: 'Unlimited knowledge documents',
    priceMonthly: { INR: null, GBP: null, USD: null },
    priceAnnual: { INR: null, GBP: null, USD: null },
    features: [
      'Custom conversation volume',
      'Connect all available channels',
      'Unlimited knowledge documents',
      'Everything in Growth',
      'Priority support',
      'Custom AI workflows',
      'Custom integrations',
      'Dedicated account manager',
    ],
  },
];

const PLAN_NAMES: Record<string, string> = {
  starter: 'Basic',
  basic: 'Basic',
  pro: 'Growth',
  growth: 'Growth',
  business: 'Enterprise',
  enterprise: 'Enterprise',
};

function planDisplayName(planId: string | null | undefined, fallback?: string | null) {
  if (!planId) return fallback ?? 'Plan';
  return PLAN_NAMES[planId.toLowerCase()] ?? fallback ?? planId;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';

  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function pct(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function normalizeCountryCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function detectCurrency(me: SubscriptionAccountInfo): CurrencyCode {
  const countryCode = normalizeCountryCode(
    me?.country_code ?? me?.countryCode ?? me?.billing_country ?? me?.country,
  );

  if (
    countryCode === 'IN' ||
    countryCode === 'IND' ||
    countryCode === 'INDIA'
  ) {
    return 'INR';
  }

  if (
    countryCode === 'GB' ||
    countryCode === 'GBR' ||
    countryCode === 'UK' ||
    countryCode === 'UNITED KINGDOM'
  ) {
    return 'GBP';
  }

  if (typeof window !== 'undefined') {
    const locale = navigator.language?.toLowerCase() ?? '';
    const timezone =
      Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase() ?? '';

    if (
      locale.endsWith('-in') ||
      timezone.includes('kolkata') ||
      timezone.includes('calcutta')
    ) {
      return 'INR';
    }

    if (
      locale.endsWith('-gb') ||
      timezone.includes('london') ||
      timezone.includes('belfast')
    ) {
      return 'GBP';
    }
  }

  return 'USD';
}

function formatPrice(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function SubscriptionTab({ me }: { me: SubscriptionAccountInfo }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isDark } = useTheme();
  const {
    status,
    usage,
    loading,
    error: billingError,
    refresh,
  } = useBilling();

  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState<'checkout' | 'portal' | 'trial' | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [currency, setCurrency] = useState<CurrencyCode>('USD');

  const error = actionError || billingError;

  useEffect(() => {
    // Clamps/adjusts local state in response to a changing dependency
    // (e.g. pagination bounds, active tab) — reviewed; not a
    // derive-state-from-render antipattern in this context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrency(detectCurrency(me));
  }, [me]);

  useEffect(() => {
    if (status?.billing_cycle) {
      // Clamps/adjusts local state in response to a changing dependency
      // (e.g. pagination bounds, active tab) — reviewed; not a
      // derive-state-from-render antipattern in this context.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCycle(status.billing_cycle);
    }
  }, [status?.billing_cycle]);

  useEffect(() => {
    const redirectStatus = searchParams.get('status');

    if (redirectStatus === 'success') {
      // Resets local UI-only state (a flag, warning, or preview value)
      // when the relevant prop/dependency changes — not deriving render
      // output from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast('Payment successful — updating your plan…');

      let attempts = 0;
      const poll = window.setInterval(async () => {
        attempts += 1;
        await refresh();

        if (attempts >= 10) {
          window.clearInterval(poll);
          setToast('');
          router.replace('/profile?activeNav=subscription');
        }
      }, 1000);

      return () => window.clearInterval(poll);
    }

    if (redirectStatus === 'cancelled') {
      setToast('Checkout cancelled — no charge was made.');

      const timeout = window.setTimeout(() => {
        setToast('');
        router.replace('/profile?activeNav=subscription');
      }, 4000);

      return () => window.clearTimeout(timeout);
    }

    return undefined;
  }, [searchParams, refresh, router]);

  async function startCheckout(planId: PaidPlanId, billingCycle: BillingCycle) {
    setBusy('checkout');
    setActionError('');

    try {
      const { url } = await apiFetch<{ url: string; session_id: string }>(
        '/admin/billing/checkout',
        {
          auth: true,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan_id: planId,
            billing_cycle: billingCycle,
            currency: currency.toLowerCase(),
          }),
        },
      );

      window.location.assign(url);
    } catch (caughtError: unknown) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Failed to start checkout');
      setBusy(null);
    }
  }

  async function startTrial() {
    setBusy('trial');
    setActionError('');

    try {
      await apiFetch('/admin/billing/start-trial', {
        auth: true,
        method: 'POST',
      });
      setToast('Free trial started — enjoy 14 days on us!');
      await refresh();
      window.setTimeout(() => setToast(''), 4000);
    } catch (caughtError: unknown) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Could not start trial');
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    setActionError('');

    try {
      const { url } = await apiFetch<{ url: string }>('/admin/billing/portal', {
        auth: true,
        method: 'POST',
      });

      window.location.assign(url);
    } catch (caughtError: unknown) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Failed to open billing portal');
      setBusy(null);
    }
  }

  function contactSales() {
    const subject = encodeURIComponent('Lashvae Enterprise plan enquiry');
    const body = encodeURIComponent(
      `Hello,\n\nI would like to discuss a custom Enterprise plan for ${me?.business_name ?? me?.tenant_name ?? 'my business'}.\n`,
    );

    window.location.href = `mailto:sales@lashvae.com?subject=${subject}&body=${body}`;
  }

  const isLocked = Boolean(status?.locked || usage?.locked);
  const isTrialing = status?.subscription_status === 'trialing' && !isLocked;
  const isPastDue = status?.subscription_status === 'past_due';
  const isCanceled = status?.subscription_status === 'canceled';
  const isNoSubscription =
    status?.subscription_status === 'none' ||
    (!status?.has_active_subscription && !isTrialing);

  const trialDaysLeft =
    status?.trial_days_left ?? daysUntil(status?.trial_ends_at ?? null);
  const currentPlanId = usage?.plan_id ?? status?.plan_id ?? null;
  const currentPlanName = isTrialing
    ? 'Free Trial'
    : planDisplayName(currentPlanId, usage?.plan_name);

  const conversationUsage = usage?.conversations ?? {
    used: 0,
    limit: 0,
    remaining: 0,
    topup_remaining: 0,
  };
  const channels = usage?.channels ?? {
    used: 0,
    limit: 0,
    remaining: 0,
    topup_remaining: 0,
  };
  const knowledgeDocs = usage?.knowledge_docs ?? {
    used: 0,
    limit: 0,
    remaining: 0,
    topup_remaining: 0,
  };

  const complimentaryCredits = status?.complimentary_credits ?? 0;
  const periodStart = status?.current_period_start ?? null;
  const periodEnd =
    status?.current_period_end ??
    usage?.current_period_end ??
    (isTrialing ? status?.trial_ends_at ?? null : null);

  const showUsageSummary = Boolean(
    usage &&
      (conversationUsage.limit > 0 ||
        isTrialing ||
        status?.has_active_subscription ||
        isLocked),
  );

  function matchesCurrentPlan(planId: 'trial' | PaidPlanId) {
    if (planId === 'trial') return isTrialing;
    if (!currentPlanId || isTrialing) return false;

    const normalized = currentPlanId.toLowerCase();
    if (planId === 'starter') {
      return normalized === 'starter' || normalized === 'basic';
    }
    if (planId === 'pro') {
      return normalized === 'pro' || normalized === 'growth';
    }
    return normalized === 'business' || normalized === 'enterprise';
  }

  if (loading) {
    return (
      <>
        <div className='panel-head'>
          <div>
            <div className='panel-title'>Subscription</div>
            <div className='panel-sub'>Loading your plan…</div>
          </div>
        </div>

        <div className='panel-body'>
          <div style={{ opacity: 0.4, padding: 24, textAlign: 'center' }}>
            Loading…
          </div>
        </div>
      </>
    );
  }

  if (error && !status) {
    return (
      <>
        <div className='panel-head'>
          <div>
            <div className='panel-title'>Subscription</div>
            <div className='panel-sub'>Something went wrong</div>
          </div>
        </div>

        <div className='panel-body'>
          <div className='form-error'>{error}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className='panel-head'>
        <div>
          <div className='panel-title'>Subscription</div>
          <div className='panel-sub'>
            {isLocked
              ? 'Trial ended'
              : isTrialing
                ? `14-day free trial · ${trialDaysLeft ?? 0} days remaining`
                : isNoSubscription
                  ? 'Choose a plan to unlock full access'
                  : `${currentPlanName} · ${status?.billing_cycle ?? 'monthly'}`}
          </div>
        </div>

        <div className='sub-location-price'>Pricing shown in {currency}</div>
      </div>

      <div className='panel-body'>
        {toast && <div className='sub-toast'>{toast}</div>}
        {error && status && <div className='form-error'>{error}</div>}

        {isLocked && (
          <div className='sub-banner sub-banner-error'>
            <div className='sub-banner-title'>Your free trial has ended</div>
            <div className='sub-banner-body'>
              Your AI has paused on all channels. Choose a plan below to switch
              it back on — your channels, knowledge and settings are all still
              here, waiting.
            </div>
          </div>
        )}

        {isPastDue && (
          <div className='sub-banner sub-banner-error'>
            <div className='sub-banner-title'>Payment failed</div>
            <div className='sub-banner-body'>
              We could not charge your card. Update your payment method to keep
              your subscription active.
            </div>
            <button
              className='sub-btn-primary'
              onClick={openPortal}
              disabled={busy !== null}
            >
              {busy === 'portal' ? 'Opening…' : 'Update payment method'}
            </button>
          </div>
        )}

        {isTrialing && trialDaysLeft !== null && trialDaysLeft <= 3 && (
          <div className='sub-banner sub-banner-warning'>
            <div className='sub-banner-title'>
              Trial ends in {trialDaysLeft} day{trialDaysLeft === 1 ? '' : 's'}
            </div>
            <div className='sub-banner-body'>
              Select Basic, Growth, or Enterprise to continue after the trial.
            </div>
          </div>
        )}

        {showUsageSummary && (
          <div className='sub-current-card'>
            <div className='sub-current-head'>
              <div>
                <div className='sub-current-plan-name'>
                  {currentPlanName}
                  {isTrialing && (
                    <span className='sub-badge'>14-day trial</span>
                  )}
                  {isPastDue && (
                    <span className='sub-badge sub-badge-error'>Past due</span>
                  )}
                  {isCanceled && (
                    <span className='sub-badge sub-badge-muted'>Canceled</span>
                  )}
                  {isLocked && (
                    <span className='sub-badge sub-badge-error'>Trial ended</span>
                  )}
                </div>

                <div className='sub-current-tagline'>
                  {isTrialing
                    ? `${conversationUsage.limit.toLocaleString()} conversations included during your trial`
                    : usage?.plan_name
                      ? `${usage.plan_name} plan`
                      : PLANS.find((plan) => matchesCurrentPlan(plan.id as PaidPlanId))
                          ?.tagline}
                </div>
              </div>

              {status?.has_stripe_customer && (
                <Button
                  type='button'
                  variant='default'
                  size='sm'
                  className='shrink-0'
                  onClick={openPortal}
                  disabled={busy !== null}
                >
                  {busy === 'portal' ? (
                    <>
                      <Loader2 className='h-4 w-4 animate-spin' />
                      Opening…
                    </>
                  ) : (
                    'Manage Billing'
                  )}
                </Button>
              )}
            </div>

            {(periodStart || periodEnd) && (
              <div className='sub-billing-period'>
                {periodStart && (
                  <span>Billing period: {fmtDate(periodStart)}</span>
                )}
                {periodStart && periodEnd && <span> → </span>}
                {periodEnd && (
                  <span>
                    {isTrialing
                      ? `Trial ends ${fmtDate(periodEnd)}`
                      : isCanceled
                        ? `Access ends ${fmtDate(periodEnd)}`
                        : `Renews ${fmtDate(periodEnd)}`}
                  </span>
                )}
              </div>
            )}

            <div className='sub-usage-summary'>
              <div className='sub-usage-summary-head'>
                <span>
                  {isTrialing
                    ? 'Trial conversations'
                    : 'Conversations this period'}
                </span>
                <span
                  className={
                    conversationUsage.used >= conversationUsage.limit
                      ? 'sub-over'
                      : ''
                  }
                >
                  <strong>{conversationUsage.used.toLocaleString()}</strong> /{' '}
                  {conversationUsage.limit.toLocaleString()} used
                </span>
              </div>

              <div className='sub-progress-track'>
                <div
                  className='sub-progress-fill'
                  style={{
                    width: `${pct(conversationUsage.used, conversationUsage.limit)}%`,
                    background:
                      conversationUsage.used >= conversationUsage.limit
                        ? '#ef4444'
                        : '#465fff',
                  }}
                />
              </div>

              <div className='sub-usage-legend'>
                {conversationUsage.remaining > 0 ? (
                  <>
                    <strong>{conversationUsage.remaining.toLocaleString()}</strong>{' '}
                    conversations remaining in your current allowance.
                  </>
                ) : conversationUsage.used >= conversationUsage.limit ? (
                  <>
                    You have used all plan conversations this period.
                    {conversationUsage.topup_remaining > 0
                      ? ' Additional replies are using top-up credits.'
                      : ''}
                  </>
                ) : (
                  <>Track your conversation usage for this billing period.</>
                )}
                {periodEnd && <> Resets {fmtDate(periodEnd)}.</>}
              </div>
            </div>

            <div className='sub-credit-grid'>
              <div className='sub-credit-card'>
                <span className='sub-credit-label'>Total allowance</span>
                <span className='sub-credit-value'>
                  {conversationUsage.limit.toLocaleString()}
                </span>
              </div>
              <div className='sub-credit-card'>
                <span className='sub-credit-label'>Used</span>
                <span className='sub-credit-value'>
                  {conversationUsage.used.toLocaleString()}
                </span>
              </div>
              <div className='sub-credit-card'>
                <span className='sub-credit-label'>Remaining</span>
                <span className='sub-credit-value'>
                  {conversationUsage.remaining.toLocaleString()}
                </span>
              </div>
              <div className='sub-credit-card'>
                <span className='sub-credit-label'>Top-up credits</span>
                <span className='sub-credit-value'>
                  {conversationUsage.topup_remaining.toLocaleString()}
                </span>
              </div>
              {complimentaryCredits > 0 && (
                <div className='sub-credit-card sub-credit-card-highlight'>
                  <span className='sub-credit-label'>Complimentary credits</span>
                  <span className='sub-credit-value'>
                    {complimentaryCredits.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {complimentaryCredits > 0 && (
              <div className='sub-credit-note'>
                Complimentary credits are used after your monthly plan allowance
                runs out.
              </div>
            )}

            <div className='sub-usage-grid'>
              <UsageBar
                label='Connected channels'
                used={channels.used}
                limit={channels.limit}
              />
              <UsageBar
                label='Knowledge documents'
                used={knowledgeDocs.used}
                limit={knowledgeDocs.limit}
              />
            </div>
          </div>
        )}

        <div className='sub-plans-head'>
          <div>
            <div className='sub-section-title'>Choose your plan</div>
            <div className='sub-section-sub'>
              Prices are selected automatically using your country.
            </div>
          </div>

          <div className='sub-cycle-toggle'>
            <button
              className={cycle === 'monthly' ? 'active' : ''}
              onClick={() => setCycle('monthly')}
            >
              Monthly
            </button>
            <button
              className={cycle === 'annual' ? 'active' : ''}
              onClick={() => setCycle('annual')}
            >
              Annual
            </button>
          </div>
        </div>

        <div className='sub-plans-grid'>
          {PLANS.map((plan) => {
            const amount =
              cycle === 'monthly'
                ? plan.priceMonthly[currency]
                : plan.priceAnnual[currency];

            const isCurrent =
              plan.id !== 'trial' &&
              matchesCurrentPlan(plan.id) &&
              !isNoSubscription &&
              !isCanceled;

            const trialIsCurrent = plan.id === 'trial' && isTrialing;
            const isEnterprise = plan.id === 'business';
            const annualMonthlyEquivalent =
              amount !== null && cycle === 'annual'
                ? Math.round(amount / 12)
                : null;

            return (
              <div
                key={plan.id}
                className={[
                  'sub-plan-card',
                  plan.highlighted ? 'sub-plan-highlight' : '',
                  isCurrent || trialIsCurrent ? 'sub-plan-current' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {plan.highlighted && (
                  <div className='sub-plan-tag'>Most popular</div>
                )}

                <div className='sub-plan-name'>{plan.name}</div>
                <div className='sub-plan-tagline'>{plan.tagline}</div>

                <div className='sub-plan-price'>
                  {plan.id === 'trial' ? (
                    <>
                      <span className='sub-plan-price-num'>Free</span>
                      <span className='sub-plan-price-per'>for 14 days</span>
                    </>
                  ) : isEnterprise ? (
                    <span className='sub-plan-price-num sub-plan-price-custom'>
                      Custom
                    </span>
                  ) : (
                    <>
                      <span className='sub-plan-price-num'>
                        {formatPrice(amount ?? 0, currency)}
                      </span>
                      <span className='sub-plan-price-per'>
                        /{cycle === 'monthly' ? 'month' : 'year'}
                      </span>
                    </>
                  )}
                </div>

                {annualMonthlyEquivalent !== null &&
                  plan.id !== 'trial' &&
                  !isEnterprise && (
                    <div className='sub-plan-annual-hint'>
                      {formatPrice(annualMonthlyEquivalent, currency)}/month,
                      billed annually
                    </div>
                  )}

                <ul className='sub-plan-features'>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <span className='sub-plan-check'>✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {plan.id === 'trial' ? (
                  <button
                    className={
                      trialIsCurrent || !status?.trial_eligible
                        ? 'sub-btn-ghost'
                        : 'sub-btn-primary'
                    }
                    disabled={
                      trialIsCurrent ||
                      !status?.trial_eligible ||
                      busy !== null
                    }
                    onClick={() => void startTrial()}
                  >
                    {trialIsCurrent
                      ? 'Current plan'
                      : busy === 'trial'
                        ? 'Starting trial…'
                        : status?.trial_eligible
                          ? 'Start 14-day free trial'
                          : 'Included for new accounts'}
                  </button>
                ) : isEnterprise ? (
                  <button
                    className={isCurrent ? 'sub-btn-ghost' : 'sub-btn-primary'}
                    disabled={isCurrent || busy !== null}
                    onClick={contactSales}
                  >
                    {isCurrent ? 'Current plan' : 'Contact sales'}
                  </button>
                ) : (
                  <button
                    className={isCurrent ? 'sub-btn-ghost' : 'sub-btn-primary'}
                    disabled={isCurrent || busy !== null}
                    onClick={() =>
                      void startCheckout(plan.backendPlanId!, cycle)
                    }
                  >
                    {isCurrent
                      ? 'Current plan'
                      : busy === 'checkout'
                        ? 'Opening checkout…'
                        : status?.has_active_subscription
                          ? `Switch to ${plan.name}`
                          : `Subscribe to ${plan.name}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .sub-location-price {
          font-size: 12px;
          font-weight: 600;
          color: ${isDark ? 'rgba(248,250,252,0.58)' : 'rgba(15,23,42,0.58)'};
        }

        .sub-toast {
          padding: 10px 14px;
          background: rgba(245, 158, 11, 0.14);
          border: 1px solid rgba(245, 158, 11, 0.32);
          color: #fbbf24;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          margin-bottom: 16px;
        }

        .sub-banner {
          padding: 16px 18px;
          border-radius: 12px;
          margin-bottom: 20px;
          border: 1px solid;
        }

        .sub-banner-error {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.32);
          color: ${isDark ? '#fecaca' : '#7f1d1d'};
        }

        .sub-banner-warning {
          background: rgba(245, 158, 11, 0.08);
          border-color: rgba(245, 158, 11, 0.32);
          color: ${isDark ? '#fbbf24' : '#78350f'};
        }

        .sub-banner-title {
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 4px;
        }

        .sub-banner-body {
          font-size: 13px;
          opacity: 0.85;
          margin-bottom: 12px;
        }

        .sub-current-card {
          padding: 20px 22px;
          border-radius: 14px;
          background: ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'};
          border: 1px solid
            ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
          margin-bottom: 28px;
        }

        .sub-current-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 6px;
        }

        .sub-current-plan-name {
          font-size: 18px;
          font-weight: 700;
          color: ${isDark ? '#f8fafc' : '#0f172a'};
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .sub-current-tagline {
          font-size: 13px;
          color: ${isDark ? 'rgba(248,250,252,0.55)' : 'rgba(15,23,42,0.55)'};
          margin-top: 2px;
        }

        .sub-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(245, 158, 11, 0.18);
          color: #fbbf24;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sub-badge-error {
          background: rgba(239, 68, 68, 0.18);
          color: #fca5a5;
        }

        .sub-badge-muted {
          background: rgba(148, 163, 184, 0.18);
          color: #94a3b8;
        }

        .sub-renewal {
          font-size: 12px;
          color: ${isDark ? 'rgba(248,250,252,0.55)' : 'rgba(15,23,42,0.55)'};
          margin-bottom: 20px;
        }

        .sub-billing-period {
          font-size: 12px;
          color: ${isDark ? 'rgba(248,250,252,0.55)' : 'rgba(15,23,42,0.55)'};
          margin: 8px 0 18px;
        }

        .sub-usage-summary {
          margin-bottom: 18px;
        }

        .sub-usage-summary-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 13px;
          color: ${isDark ? 'rgba(248,250,252,0.72)' : 'rgba(15,23,42,0.72)'};
          margin-bottom: 8px;
        }

        .sub-over {
          color: #ef4444;
        }

        .sub-progress-track {
          height: 10px;
          border-radius: 999px;
          background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'};
          overflow: hidden;
        }

        .sub-progress-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease;
        }

        .sub-usage-legend {
          margin-top: 8px;
          font-size: 12px;
          line-height: 1.5;
          color: ${isDark ? 'rgba(248,250,252,0.55)' : 'rgba(15,23,42,0.55)'};
        }

        .sub-credit-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 12px;
        }

        .sub-credit-card {
          padding: 14px;
          border-radius: 12px;
          border: 1px solid
            ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'};
          background: ${isDark ? 'rgba(255,255,255,0.02)' : '#fff'};
        }

        .sub-credit-card-highlight {
          border-color: rgba(70, 95, 255, 0.28);
          background: rgba(70, 95, 255, 0.08);
        }

        .sub-credit-label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: ${isDark ? 'rgba(248,250,252,0.48)' : 'rgba(15,23,42,0.48)'};
          margin-bottom: 6px;
        }

        .sub-credit-value {
          display: block;
          font-size: 20px;
          font-weight: 700;
          color: ${isDark ? '#f8fafc' : '#0f172a'};
        }

        .sub-credit-note {
          margin-bottom: 18px;
          font-size: 12px;
          color: ${isDark ? 'rgba(248,250,252,0.55)' : 'rgba(15,23,42,0.55)'};
        }

        .sub-usage-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
        }

        .sub-plans-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 20px;
        }

        .sub-section-title {
          font-size: 16px;
          font-weight: 700;
          color: var(--app-primary);
        }

        .sub-section-sub {
          font-size: 13px;
          color: ${isDark ? 'rgba(248,250,252,0.55)' : 'rgba(15,23,42,0.55)'};
          margin-top: 2px;
        }

        .sub-cycle-toggle {
          display: inline-flex;
          padding: 4px;
          background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'};
          border-radius: 10px;
          gap: 2px;
        }

        .sub-cycle-toggle button {
          padding: 6px 14px;
          border: none;
          background: transparent;
          color: ${isDark ? 'rgba(248,250,252,0.62)' : 'rgba(15,23,42,0.62)'};
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sub-cycle-toggle button.active {
          background: ${isDark
            ? 'color-mix(in oklab, var(--app-primary) 18%, transparent)'
            : '#fff'};
          color: var(--app-primary);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        }

        .sub-plans-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .sub-plan-card {
          position: relative;
          padding: 22px 18px;
          border-radius: 14px;
          background: ${isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.015)'};
          border: 1px solid
            ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .sub-plan-highlight {
          border-color: color-mix(
            in oklab,
            var(--app-primary) 50%,
            transparent
          );
          box-shadow: 0 0 0 3px
            color-mix(in oklab, var(--app-primary) 12%, transparent);
        }

        .sub-plan-current {
          border-color: rgba(34, 197, 94, 0.4);
        }

        .sub-plan-tag {
          position: absolute;
          top: -10px;
          right: 16px;
          padding: 3px 10px;
          background: linear-gradient(
            135deg,
            var(--app-primary),
            var(--app-primary-hover)
          );
          color: white;
          font-size: 10px;
          font-weight: 700;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .sub-plan-name {
          font-size: 16px;
          font-weight: 700;
          color: ${isDark ? '#f8fafc' : '#0f172a'};
        }

        .sub-plan-tagline {
          min-height: 34px;
          font-size: 12px;
          color: ${isDark ? 'rgba(248,250,252,0.55)' : 'rgba(15,23,42,0.55)'};
          margin-top: 4px;
          margin-bottom: 16px;
        }

        .sub-plan-price {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 4px;
          min-height: 46px;
          margin-bottom: 4px;
        }

        .sub-plan-price-num {
          font-size: 30px;
          font-weight: 800;
          color: ${isDark ? '#f8fafc' : '#0f172a'};
        }

        .sub-plan-price-custom {
          font-size: 27px;
        }

        .sub-plan-price-per {
          font-size: 13px;
          color: ${isDark ? 'rgba(248,250,252,0.55)' : 'rgba(15,23,42,0.55)'};
        }

        .sub-plan-annual-hint {
          min-height: 16px;
          font-size: 11px;
          color: ${isDark ? 'rgba(248,250,252,0.42)' : 'rgba(15,23,42,0.42)'};
          margin-bottom: 8px;
        }

        .sub-plan-features {
          list-style: none;
          padding: 0;
          margin: 12px 0 22px;
          flex: 1;
        }

        .sub-plan-features li {
          font-size: 12.5px;
          color: ${isDark ? 'rgba(248,250,252,0.75)' : 'rgba(15,23,42,0.75)'};
          padding: 5px 0;
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }

        .sub-plan-check {
          color: #10b981;
          font-weight: 700;
        }

        .sub-btn-primary,
        .sub-btn-ghost {
          width: 100%;
          padding: 10px 16px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }

        .sub-btn-primary {
          border: none;
          background: linear-gradient(
            135deg,
            var(--app-primary),
            var(--app-primary-hover)
          );
          color: white;
          box-shadow: 0 2px 8px
            color-mix(in oklab, var(--app-primary) 28%, transparent);
        }

        .sub-btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px
            color-mix(in oklab, var(--app-primary) 40%, transparent);
        }

        .sub-btn-ghost {
          border: 1px solid
            ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.14)'};
          background: transparent;
          color: ${isDark ? 'rgba(248,250,252,0.85)' : 'rgba(15,23,42,0.85)'};
        }

        .sub-btn-ghost:hover:not(:disabled) {
          background: ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'};
        }

        .sub-btn-primary:disabled,
        .sub-btn-ghost:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 1250px) {
          .sub-plans-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .sub-plans-head,
          .sub-current-head {
            flex-direction: column;
          }

          .sub-cycle-toggle {
            width: 100%;
          }

          .sub-cycle-toggle button {
            flex: 1;
          }

          .sub-plans-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  );
}

function UsageBar({
  label,
  used,
  limit,
}: {
  label: string;
  used?: number | null;
  limit?: number | null;
}) {
  const { isDark } = useTheme();

  const safeUsed =
    typeof used === 'number' && Number.isFinite(used) ? Math.max(0, used) : 0;

  const safeLimit =
    typeof limit === 'number' && Number.isFinite(limit) && limit > 0
      ? limit
      : 0;

  const percentage =
    safeLimit > 0 ? Math.min(100, Math.round((safeUsed / safeLimit) * 100)) : 0;

  const isOver = safeLimit > 0 && safeUsed >= safeLimit;
  const isNear = percentage >= 80 && !isOver;

  const barColor = isOver ? '#ef4444' : isNear ? '#10b981' : '#38bdf8';

  const size = 96;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percentage / 100) * circumference;

  const trackColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
        }}
      >
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill='none'
            stroke={barColor}
            strokeWidth={strokeWidth}
            strokeLinecap='round'
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: 'stroke-dashoffset 0.4s ease, stroke 0.2s',
            }}
          />
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: isOver ? '#ef4444' : isDark ? '#f8fafc' : '#0f172a',
              lineHeight: 1,
            }}
          >
            {percentage}%
          </span>

          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              marginTop: 2,
              color: isDark ? 'rgba(248,250,252,0.6)' : 'rgba(15,23,42,0.6)',
            }}
          >
            {safeUsed.toLocaleString()}/
            {safeLimit > 0 ? safeLimit.toLocaleString() : 'Custom'}
          </span>
        </div>
      </div>

      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: isDark ? 'rgba(248,250,252,0.72)' : 'rgba(15,23,42,0.72)',
          textAlign: 'center',
        }}
      >
        {label}
      </span>
    </div>
  );
}
