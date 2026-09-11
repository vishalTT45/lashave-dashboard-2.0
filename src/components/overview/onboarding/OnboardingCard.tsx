'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Circle,
  PlugZap,
  Sparkles,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';

type OnboardingCardProps = {
  hasFaqs: boolean;
  hasChannels: boolean;
  onTrainAI: () => void;
  onConnectChannel: () => void;
  t: Theme;
  isDark: boolean;
  tenantId?: string;
};

type Step = {
  id: 'account' | 'training' | 'channel';
  title: string;
  description: string;
  done: boolean;
  active: boolean;
};

export function OnboardingCard({
  hasFaqs,
  hasChannels,
  onTrainAI,
  onConnectChannel,
}: OnboardingCardProps) {
  const [dismissed, setDismissed] = useState(false);

  const allDone = hasFaqs && hasChannels;

  useEffect(() => {
    if (!allDone || dismissed) return;
    const timer = setTimeout(() => setDismissed(true), 1200);
    return () => clearTimeout(timer);
  }, [allDone, dismissed]);

  const steps = useMemo<Step[]>(
    () => [
      {
        id: 'account',
        title: 'Create account',
        description: 'Workspace is ready',
        done: true,
        active: false,
      },
      {
        id: 'training',
        title: 'Train your AI',
        description: 'Add business knowledge',
        done: hasFaqs,
        active: !hasFaqs,
      },
      {
        id: 'channel',
        title: 'Connect a channel',
        description: 'Go live with customers',
        done: hasChannels,
        active: hasFaqs && !hasChannels,
      },
    ],
    [hasChannels, hasFaqs],
  );

  if (dismissed) return null;

  const activeStepIdx = steps.findIndex((step) => step.active);
  const activeStep = activeStepIdx >= 0 ? steps[activeStepIdx] : null;
  const progress = steps.filter((step) => step.done).length;
  const progressPercent = Math.round((progress / steps.length) * 100);

  const headline = allDone
    ? 'Your AI is live'
    : activeStep?.id === 'channel'
      ? 'Connect your first channel'
      : 'Train your AI on your business';

  const body = allDone
    ? "Your AI is trained and connected to a channel. It's ready to reply to customers."
    : activeStep?.id === 'channel'
      ? 'Your AI is ready. Connect Instagram, Telegram or Facebook to start handling conversations.'
      : 'Pick your business type and answer a few quick questions. Takes about two minutes.';

  const actionLabel =
    activeStep?.id === 'channel' ? 'Connect channel' : 'Start training';

  const handleAction =
    activeStep?.id === 'channel' ? onConnectChannel : onTrainAI;

  const CurrentIcon = allDone
    ? CheckCircle2
    : activeStep?.id === 'channel'
      ? PlugZap
      : Bot;

  return (
    <section className='mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/3'>
      <div className='flex flex-col gap-4 border-b border-gray-200 px-4 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between sm:px-5'>
        <div className='flex items-start gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-control) bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
            <Sparkles className='h-5 w-5' />
          </div>
          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='type-body font-semibold text-gray-800 dark:text-white/90'>
                Getting started
              </h2>
              <Badge color={allDone ? 'success' : 'primary'}>
                {allDone ? 'Complete' : `Step ${Math.min(activeStepIdx + 1, 3)} of 3`}
              </Badge>
            </div>
            <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
              {progress} of {steps.length} setup steps complete
            </p>
          </div>
        </div>

        <button
          type='button'
          onClick={() => setDismissed(true)}
          aria-label='Dismiss onboarding'
          className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-(--radius-control) text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300'
        >
          <X className='h-4 w-4' />
        </button>
      </div>

      <div className='px-4 py-5 sm:px-5'>
        <div className='mb-5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800'>
          <div
            className='h-full rounded-full bg-brand-500 transition-all duration-500'
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]'>
          <div className='flex gap-4'>
            <div
              className={cn(
                'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                allDone
                  ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
                  : 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400',
              )}
            >
              <CurrentIcon className='h-6 w-6' />
            </div>

            <div className='min-w-0'>
              <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                {headline}
              </h3>
              <p className='mt-1 max-w-2xl type-small leading-6 text-gray-500 dark:text-gray-400'>
                {body}
              </p>

              {!allDone && (
                <Button
                  type='button'
                  onClick={handleAction}
                  className='mt-5'
                >
                  {actionLabel}
                  <ArrowRight className='h-4 w-4' />
                </Button>
              )}
            </div>
          </div>

          <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-1'>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3 transition',
                  step.active
                    ? 'border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/2',
                )}
              >
                <div
                  className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border type-caption font-semibold',
                    step.done
                      ? 'border-success-200 bg-success-50 text-success-600 dark:border-success-500/20 dark:bg-success-500/15 dark:text-success-500'
                      : step.active
                        ? 'border-brand-200 bg-white text-brand-500 dark:border-brand-500/20 dark:bg-white/4 dark:text-brand-400'
                        : 'border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500',
                  )}
                >
                  {step.done ? (
                    <Check className='h-3.5 w-3.5' />
                  ) : step.active ? (
                    <Circle className='h-3 w-3 fill-current' />
                  ) : (
                    index + 1
                  )}
                </div>

                <div className='min-w-0'>
                  <p className='type-small font-medium text-gray-800 dark:text-white/90'>
                    {step.title}
                  </p>
                  <p className='mt-0.5 type-caption text-gray-500 dark:text-gray-400'>
                    {step.done
                      ? 'Done'
                      : step.active
                        ? 'In progress'
                        : step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
