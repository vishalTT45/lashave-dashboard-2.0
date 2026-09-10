'use client';

import { apiFetch } from '@/lib/api';
import { MessageSquare, Star } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Channel = { id: number; platform: string; is_active: boolean };
type ReviewRow = { google_review_id: string; status: string };

export function InboxReviewsSwitch({ openCount }: { openCount?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const onReviews = pathname?.startsWith('/conversations/reviews');
  const [hasGoogle, setHasGoogle] = useState(false);
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadReviewState() {
      try {
        const data = await apiFetch<{ items: Channel[] }>('/admin/channels', {
          auth: true,
        });
        const google = (data.items || []).find(
          (channel) =>
            ['google', 'google reviews'].includes(
              channel.platform?.toLowerCase?.() ?? '',
            ) && channel.is_active,
        );
        if (cancelled || !google) return;
        setHasGoogle(true);

        try {
          const reviews = await apiFetch<ReviewRow[]>(
            `/admin/channels/google/${google.id}/reviews`,
            { auth: true },
          );
          if (!cancelled) {
            setPending(
              (reviews || []).filter((review) => review.status !== 'replied')
                .length,
            );
          }
        } catch {
          setPending(null);
        }
      } catch {
        setHasGoogle(false);
      }
    }

    void loadReviewState();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasGoogle) return null;

  return (
    <div className='inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900'>
      <button
        type='button'
        onClick={() => onReviews && router.push('/conversations')}
        className={`inline-flex h-10 items-center gap-2 rounded-(--radius-control) px-3 type-small font-medium transition ${
          !onReviews
            ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-white/5 dark:text-brand-400'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white/90'
        }`}
      >
        <MessageSquare className='h-4 w-4' />
        Inbox
        {openCount != null && openCount > 0 && (
          <span className='rounded-full bg-gray-100 px-2 py-0.5 type-caption text-gray-700 dark:bg-white/5 dark:text-gray-300'>
            {openCount}
          </span>
        )}
      </button>
      <button
        type='button'
        onClick={() => !onReviews && router.push('/conversations/reviews')}
        className={`inline-flex h-10 items-center gap-2 rounded-(--radius-control) px-3 type-small font-medium transition ${
          onReviews
            ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-white/5 dark:text-brand-400'
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white/90'
        }`}
      >
        <Star className='h-4 w-4' />
        Reviews
        {pending != null && pending > 0 && (
          <span className='rounded-full bg-warning-50 px-2 py-0.5 type-caption text-warning-600 dark:bg-warning-500/15 dark:text-orange-400'>
            {pending}
          </span>
        )}
      </button>
    </div>
  );
}

export default InboxReviewsSwitch;
