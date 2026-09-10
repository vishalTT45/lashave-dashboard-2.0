'use client';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  type BillingFeature,
  SUBSCRIPTION_HREF,
  fmtBillingDate,
} from '@/lib/billing';
import { useBilling } from '@/lib/billing-context';
import { LockKeyhole } from 'lucide-react';
import Link from 'next/link';

const FEATURE_COPY: Record<
  BillingFeature,
  { title: string; description: string; requiredPlan: string }
> = {
  growth_reports: {
    title: 'Growth reports are locked',
    description:
      'Upgrade to Growth to unlock AI consultant reports, competitor analysis, and content ideas from customer conversations.',
    requiredPlan: 'Growth plan',
  },
  booking: {
    title: 'Smart Booking is locked',
    description:
      'Upgrade your plan to let customers book appointments directly from chat channels.',
    requiredPlan: 'Paid plan',
  },
  widget: {
    title: 'Website widget is locked',
    description:
      'Upgrade your plan to install and customize the AI chat widget on your website.',
    requiredPlan: 'Paid plan',
  },
};

type FeatureGateProps = {
  feature: BillingFeature;
  children: React.ReactNode;
  title?: string;
  description?: string;
  mode?: 'replace' | 'overlay';
};

export function FeatureGate({
  feature,
  children,
  title,
  description,
  mode = 'replace',
}: FeatureGateProps) {
  const { loading, canUseFeature, isLocked } = useBilling();

  if (loading) {
    return (
      <div className='rounded-2xl border border-gray-200 bg-white p-8 text-center type-small text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400'>
        Checking plan access…
      </div>
    );
  }

  if (canUseFeature(feature)) {
    return <>{children}</>;
  }

  const copy = FEATURE_COPY[feature];
  const lockTitle =
    title ??
    (isLocked ? 'Your trial has ended' : copy.title);
  const lockDescription =
    description ??
    (isLocked
      ? 'Your AI is paused on all channels. Choose a plan to switch it back on — your channels, knowledge, and settings are still here.'
      : copy.description);

  if (mode === 'overlay') {
    return (
      <div className='relative'>
        <div className='pointer-events-none select-none opacity-40 blur-[1px]'>
          {children}
        </div>
        <div className='absolute inset-0 flex items-center justify-center p-4'>
          <FeatureLockCard
            title={lockTitle}
            description={lockDescription}
            badge={isLocked ? 'Trial expired' : copy.requiredPlan}
          />
        </div>
      </div>
    );
  }

  return (
    <FeatureLockCard
      title={lockTitle}
      description={lockDescription}
      badge={isLocked ? 'Trial expired' : copy.requiredPlan}
    />
  );
}

export function FeatureLockCard({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: string;
}) {
  return (
    <Card className='mx-auto max-w-2xl border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3'>
      <CardHeader className='items-center text-center'>
        <div className='mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
          <LockKeyhole className='h-6 w-6' />
        </div>
        <CardTitle>{title}</CardTitle>
        <CardDescription className='max-w-lg'>{description}</CardDescription>
      </CardHeader>
      <CardContent className='flex flex-col items-center gap-3 pb-8'>
        <span className='rounded-full border border-gray-200 bg-gray-50 px-3 py-1 type-caption font-medium text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400'>
          Requires {badge}
        </span>
        <Button asChild>
          <Link href={SUBSCRIPTION_HREF}>View plans & upgrade</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function LockedAccountBanner() {
  const { loading, isLocked, status } = useBilling();

  if (loading || !isLocked) return null;

  return (
    <Alert
      variant='error'
      title='Your free trial has ended'
      message={`AI replies are paused on all channels. Upgrade to restore automation. Trial ended ${fmtBillingDate(status?.trial_ends_at ?? null)}.`}
      showLink
      linkHref={SUBSCRIPTION_HREF}
      linkText='Choose a plan'
    />
  );
}

export function ConversationLimitBanner() {
  const { loading, usage, conversationsAtLimit, isLocked } = useBilling();

  if (loading || isLocked || !usage) return null;

  const { used, limit, remaining } = usage.conversations;
  const nearlyFull = !conversationsAtLimit && remaining <= Math.max(10, limit * 0.1);

  if (!conversationsAtLimit && !nearlyFull) return null;

  return (
    <Alert
      variant={conversationsAtLimit ? 'error' : 'warning'}
      title={
        conversationsAtLimit
          ? 'Conversation limit reached'
          : 'You are almost out of conversations'
      }
      message={
        conversationsAtLimit
          ? `You have used all ${limit} conversations in your current plan. Upgrade or add credits to keep AI replies running.`
          : `${remaining} of ${limit} conversations remaining this period.`
      }
      showLink
      linkHref={SUBSCRIPTION_HREF}
      linkText={conversationsAtLimit ? 'Upgrade now' : 'View usage'}
    />
  );
}

//test featureGate file

export function TrialEndingBanner() {
  const { loading, isTrialing, trialDaysLeft, status } = useBilling();

  if (
    loading ||
    !isTrialing ||
    trialDaysLeft === null ||
    trialDaysLeft > 3 ||
    trialDaysLeft <= 0
  ) {
    return null;
  }

  return (
    <Alert
      variant='warning'
      title={`Trial ends in ${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'}`}
      message={`Pick a plan before ${fmtBillingDate(status?.trial_ends_at ?? null)} to keep AI replies running.`}
      showLink
      linkHref={SUBSCRIPTION_HREF}
      linkText='Upgrade'
    />
  );
}
