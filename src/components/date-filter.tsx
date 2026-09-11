'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Calendar, X } from 'lucide-react';

export type DateRangeValue = { from: string; to: string } | null;

export function DateFilter({
  dateRange,
  activePreset,
  setDateRange,
  setActivePreset,
  open,
  onToggle,
  onClose,
}: {
  dateRange: DateRangeValue;
  activePreset: number | null;
  setDateRange: (range: DateRangeValue) => void;
  setActivePreset: (preset: number | null) => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const toDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return toDateStr(d);
  };

  const formatDate = (str: string) =>
    new Date(str + 'T00:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  return (
    <div className='relative min-w-0 max-w-full shrink-0'>
      <Button
        variant='outline'
        onClick={onToggle}
        className={cn(
          'max-w-full',
          dateRange &&
            'border-brand-300 bg-brand-50 text-brand-500 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-400',
        )}
      >
        <Calendar className='icon-small shrink-0' />
        {dateRange ? (
          <span className='truncate'>
            {formatDate(dateRange.from)} to {formatDate(dateRange.to)}
          </span>
        ) : (
          'Date'
        )}
      </Button>

      {open && (
        <div className='absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900'>
          <div className='mb-3 flex items-center justify-between'>
            <span className='type-small font-semibold text-gray-700 dark:text-gray-200'>
              Filter by date
            </span>
            <button
              type='button'
              aria-label='Close date filter'
              title='Close'
              onClick={onClose}
              className='inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus:border-brand-300 focus:ring-[3px] focus:ring-brand-500/10 dark:text-gray-400 dark:hover:bg-white/6 dark:hover:text-gray-200'
            >
              <X className='h-4 w-4' />
            </button>
          </div>

          <div className='grid grid-cols-3 gap-2'>
            {[
              { label: 'Today', days: 0 },
              { label: '7 days', days: 7 },
              { label: '30 days', days: 30 },
            ].map((preset) => (
              <button
                key={preset.label}
                type='button'
                onClick={() => {
                  if (activePreset === preset.days) {
                    setActivePreset(null);
                    setDateRange(null);
                    return;
                  }

                  setActivePreset(preset.days);
                  setDateRange({
                    from: daysAgo(preset.days),
                    to: toDateStr(new Date()),
                  });
                }}
                className={cn(
                  'rounded-(--radius-control) border px-2 py-2 type-caption font-medium transition',
                  activePreset === preset.days
                    ? 'border-brand-300 bg-brand-50 text-brand-500 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-400'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/3',
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className='mt-4 grid gap-3'>
            <label className='grid gap-1.5 type-caption font-medium text-gray-500 dark:text-gray-400'>
              From
              <input
                type='date'
                value={dateRange?.from ?? ''}
                onChange={(event) => {
                  setActivePreset(null);
                  setDateRange({
                    from: event.target.value,
                    to: dateRange?.to ?? toDateStr(new Date()),
                  });
                }}
                className='h-9 rounded-(--radius-control) border border-gray-300 bg-transparent px-3 type-small text-gray-700 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-gray-300'
              />
            </label>

            <label className='grid gap-1.5 type-caption font-medium text-gray-500 dark:text-gray-400'>
              To
              <input
                type='date'
                value={dateRange?.to ?? ''}
                onChange={(event) => {
                  setActivePreset(null);
                  setDateRange({
                    from: dateRange?.from ?? toDateStr(new Date()),
                    to: event.target.value,
                  });
                }}
                className='h-9 rounded-(--radius-control) border border-gray-300 bg-transparent px-3 type-small text-gray-700 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:text-gray-300'
              />
            </label>
          </div>

          {dateRange && (
            <Button
              variant='outline'
              size='sm'
              className='mt-4 w-full'
              onClick={() => {
                setActivePreset(null);
                setDateRange(null);
                onClose();
              }}
            >
              Clear date
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
