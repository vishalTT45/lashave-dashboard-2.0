'use client';

import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      // Fetch on mount / dependency change — the correct place for a
      // loading/data flag on an async fetch, not a derive-state-from-render
      // antipattern.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      setErrorMessage('Verification token is missing from the link.');
      return;
    }

    const doVerify = async () => {
      try {
        setLoading(true);
        const res = await apiFetch<{
          status: string;
          message: string;
          notification_email: string;
        }>(
          `/public/notification-email/verify?token=${encodeURIComponent(token)}`,
        );

        if (res && res.status === 'success') {
          setSuccess(true);
          setVerifiedEmail(res.notification_email);
        } else {
          setSuccess(false);
          setErrorMessage(res?.message || 'Verification failed.');
        }
      } catch (err: unknown) {
        setSuccess(false);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Verification token is invalid or has expired.',
        );
      } finally {
        setLoading(false);
      }
    };

    void doVerify();
  }, [token]);

  return (
    <div className='flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-950'>
      <div className='w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-theme-sm dark:border-gray-800 dark:bg-gray-900'>
        <div className='mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
          {loading && <Loader2 className='h-8 w-8 animate-spin' />}
          {!loading && success && (
            <CheckCircle2 className='h-8 w-8 text-success-500' />
          )}
          {!loading && !success && <XCircle className='h-8 w-8 text-error-500' />}
        </div>

        {loading && (
          <>
            <h1 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
              Verifying Email…
            </h1>
            <p className='mt-2 type-small text-gray-500 dark:text-gray-400'>
              Please wait while we confirm your operational notification email.
            </p>
          </>
        )}

        {!loading && success && (
          <>
            <span className='mb-4 inline-flex items-center gap-2 rounded-full bg-success-50 px-3 py-1 type-caption font-semibold text-success-600 dark:bg-success-500/15 dark:text-success-500'>
              <ShieldCheck className='h-3.5 w-3.5' />
              Verified Successfully
            </span>

            <h1 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
              Email Address Confirmed!
            </h1>
            <p className='mt-2 type-small leading-6 text-gray-500 dark:text-gray-400'>
              Operational alerts and notifications for your workspace will now be
              routed directly to:
            </p>

            <div className='mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono type-small font-semibold text-brand-600 dark:border-gray-800 dark:bg-white/3 dark:text-brand-400'>
              {verifiedEmail}
            </div>

            <Button
              type='button'
              className='mt-6 w-full'
              onClick={() => router.push('/settings?section=ai')}
            >
              Return to Settings
            </Button>
          </>
        )}

        {!loading && !success && (
          <>
            <span className='mb-4 inline-flex items-center gap-2 rounded-full bg-error-50 px-3 py-1 type-caption font-semibold text-error-600 dark:bg-error-500/15 dark:text-error-500'>
              Verification Link Invalid
            </span>

            <h1 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
              Unable to Verify Email
            </h1>
            <p className='mt-2 type-small leading-6 text-gray-500 dark:text-gray-400'>
              {errorMessage ||
                'This link may have expired (links are valid for 24 hours) or has already been used.'}
            </p>

            <Button
              type='button'
              variant='outline'
              className='mt-6 w-full'
              onClick={() => router.push('/settings?section=ai')}
            >
              <ArrowLeft className='h-4 w-4' />
              Go to Settings to Resend Link
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function PublicVerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className='flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950'>
          <Loader2 className='h-8 w-8 animate-spin text-brand-500' />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
