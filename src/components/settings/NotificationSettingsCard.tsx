'use client';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export interface NotificationSettingsData {
  email_notifications_enabled: boolean;
  owner_email: string | null;
  notification_email: string | null;
  pending_notification_email: string | null;
  notification_email_status: 'verified' | 'pending' | 'none';
  effective_notification_email: string | null;
}

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

const NOTIFICATION_TYPES = [
  'Hot leads',
  'Contact shares',
  'Human handoff requests',
  'Booking confirmations',
];

export default function NotificationSettingsCard() {
  const [data, setData] = useState<NotificationSettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [savingEmail, setSavingEmail] = useState(false);
  const [togglingMaster, setTogglingMaster] = useState(false);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [removingEmail, setRemovingEmail] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    msg: string;
  } | null>(null);

  const showFeedback = useCallback(
    (type: 'success' | 'error' | 'info', msg: string) => {
      setFeedback({ type, msg });
      window.setTimeout(() => setFeedback(null), 6000);
    },
    [],
  );

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch<NotificationSettingsData>(
        '/admin/notification-settings',
        { auth: true },
      );
      setData(res);
      if (res.notification_email) {
        setEmailInput(res.notification_email);
      } else if (res.pending_notification_email) {
        setEmailInput(res.pending_notification_email);
      } else {
        setEmailInput('');
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load notification settings';
      showFeedback('error', message);
    } finally {
      setLoading(false);
    }
  }, [showFeedback]);

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchSettings();
  }, [fetchSettings]);

  async function handleToggleMaster() {
    if (!data || togglingMaster) return;

    const newStatus = !data.email_notifications_enabled;

    try {
      setTogglingMaster(true);
      const res = await apiFetch<{
        email_notifications_enabled: boolean;
        effective_notification_email: string | null;
      }>('/admin/notification-settings', {
        method: 'PATCH',
        auth: true,
        body: { email_notifications_enabled: newStatus },
      });

      setData((prev) =>
        prev
          ? {
              ...prev,
              email_notifications_enabled: res.email_notifications_enabled,
              effective_notification_email: res.effective_notification_email,
            }
          : null,
      );

      showFeedback(
        'success',
        res.email_notifications_enabled
          ? 'Email notifications enabled'
          : 'Email notifications disabled',
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update notification status';
      showFeedback('error', message);
    } finally {
      setTogglingMaster(false);
    }
  }

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);

    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailError('Please enter a valid email address');
      return;
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError('Invalid email address format');
      return;
    }

    try {
      setSavingEmail(true);
      const res = await apiFetch<{
        message: string;
        pending_notification_email?: string;
        notification_email?: string;
        notification_email_status: 'verified' | 'pending';
      }>('/admin/notification-settings/email', {
        method: 'PUT',
        auth: true,
        body: { notification_email: trimmed },
      });

      showFeedback('success', res.message || 'Verification email sent!');
      await fetchSettings();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to update notification email';
      showFeedback('error', message);
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleResendVerification() {
    if (resendingVerify) return;

    try {
      setResendingVerify(true);
      const res = await apiFetch<{ message: string }>(
        '/admin/notification-settings/email/resend-verification',
        {
          method: 'POST',
          auth: true,
        },
      );
      showFeedback('success', res.message || 'Verification email resent!');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to resend verification';
      showFeedback('error', message);
    } finally {
      setResendingVerify(false);
    }
  }

  async function handleSendTest() {
    if (sendingTest) return;

    try {
      setSendingTest(true);
      const res = await apiFetch<{ message: string; recipient: string }>(
        '/admin/notification-settings/email/test',
        {
          method: 'POST',
          auth: true,
        },
      );
      showFeedback('success', `Test email dispatched to ${res.recipient}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to send test email';
      showFeedback('error', message);
    } finally {
      setSendingTest(false);
    }
  }

  async function handleRemoveEmail() {
    if (removingEmail) return;

    if (
      !confirm(
        'Are you sure you want to remove your dedicated notification email? Alerts will revert to the tenant owner email address.',
      )
    ) {
      return;
    }

    try {
      setRemovingEmail(true);
      const res = await apiFetch<{
        message: string;
        effective_notification_email: string | null;
      }>('/admin/notification-settings/email', {
        method: 'DELETE',
        auth: true,
      });

      showFeedback('info', res.message);
      await fetchSettings();
      setEmailInput('');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to remove notification email';
      showFeedback('error', message);
    } finally {
      setRemovingEmail(false);
    }
  }

  if (loading) {
    return (
      <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 sm:p-6'>
        <div className='flex items-center justify-center gap-3 py-8 text-gray-500 dark:text-gray-400'>
          <Loader2 className='h-5 w-5 animate-spin' />
          <span className='type-small'>Loading notification settings…</span>
        </div>
      </div>
    );
  }

  const status = data?.notification_email_status || 'none';
  const masterEnabled = data?.email_notifications_enabled ?? true;

  return (
    <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 sm:p-6'>
      <div className='mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5 dark:border-gray-800'>
        <div className='flex items-start gap-4'>
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
              masterEnabled
                ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                : 'bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400',
            )}
          >
            <Bell className='h-5 w-5' />
          </div>

          <div>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                Email Notifications
              </h2>
              {masterEnabled && (
                <Badge color='success'>
                  Active
                </Badge>
              )}
            </div>
            <p className='mt-1 max-w-2xl type-small leading-6 text-gray-500 dark:text-gray-400'>
              Get instant email alerts for hot leads, contact shares, human
              handoff requests, and booking confirmations.
            </p>
            <div className='mt-3 flex flex-wrap gap-2'>
              {NOTIFICATION_TYPES.map((type) => (
                <span
                  key={type}
                  className='rounded-full bg-gray-100 px-2.5 py-1 type-caption font-medium text-gray-600 dark:bg-white/5 dark:text-gray-300'
                >
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className='flex items-center gap-3'>
          <span className='type-small font-medium text-gray-500 dark:text-gray-400'>
            {masterEnabled ? 'Notifications On' : 'Notifications Paused'}
          </span>
          <Switch
            checked={masterEnabled}
            disabled={togglingMaster}
            onChange={handleToggleMaster}
            aria-label='Toggle email notifications'
          />
        </div>
      </div>

      {feedback && (
        <div className='mb-5'>
          <Alert
            variant={
              feedback.type === 'success'
                ? 'success'
                : feedback.type === 'error'
                  ? 'error'
                  : 'info'
            }
            title={
              feedback.type === 'success'
                ? 'Success'
                : feedback.type === 'error'
                  ? 'Error'
                  : 'Notice'
            }
            message={feedback.msg}
          />
        </div>
      )}

      <div className='mb-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/2'>
        <div className='flex items-center gap-3'>
          <ShieldCheck className='h-5 w-5 shrink-0 text-brand-500 dark:text-brand-400' />
          <div>
            <p className='type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
              Active Routing Address
            </p>
            <p className='mt-1 type-small font-semibold text-gray-800 dark:text-white/90'>
              {data?.effective_notification_email ? (
                <span className='font-mono'>
                  {data.effective_notification_email}
                </span>
              ) : (
                <span className='text-warning-600 dark:text-warning-400'>
                  No email destination configured
                </span>
              )}
            </p>
          </div>
        </div>

        {status === 'verified' && (
          <Badge color='success' startIcon={<CheckCircle2 className='h-3.5 w-3.5' />}>
            Verified Operational Email
          </Badge>
        )}
        {status === 'pending' && (
          <Badge color='warning' startIcon={<Clock className='h-3.5 w-3.5' />}>
            Pending Verification
          </Badge>
        )}
        {status === 'none' && (
          <Badge color='light'>Fallback to Account Owner</Badge>
        )}
      </div>

      {status === 'pending' && data?.pending_notification_email && (
        <div className='mb-5 rounded-xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-500/30 dark:bg-warning-500/10'>
          <div className='flex flex-wrap items-start justify-between gap-4'>
            <div>
              <p className='flex items-center gap-2 type-small font-semibold text-warning-700 dark:text-warning-400'>
                <Clock className='h-4 w-4' />
                Verification Required for {data.pending_notification_email}
              </p>
              <p className='mt-2 type-small leading-6 text-warning-800 dark:text-warning-300/90'>
                A 24-hour verification link was sent to{' '}
                <strong>{data.pending_notification_email}</strong>. Until
                verified, alerts continue delivering to{' '}
                <strong>{data.owner_email}</strong>.
              </p>
            </div>

            <Button
              type='button'
              size='sm'
              onClick={handleResendVerification}
              disabled={resendingVerify}
            >
              {resendingVerify ? (
                <>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Sending…
                </>
              ) : (
                <>
                  <Send className='h-4 w-4' />
                  Resend Link
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveEmail} className='mb-5'>
        <Label htmlFor='notification-email' className='mb-2 block'>
          Notification Email Address
        </Label>
        <div className='flex flex-wrap gap-3'>
          <div className='relative min-w-65 flex-1'>
            <Mail className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400' />
            <Input
              id='notification-email'
              type='email'
              placeholder='e.g. alerts@yourcompany.com'
              value={emailInput}
              onChange={(e) => {
                setEmailInput(e.target.value);
                if (emailError) setEmailError(null);
              }}
              className={cn('pl-10', emailError && 'border-error-500')}
            />
          </div>

          <Button type='submit' disabled={savingEmail}>
            {savingEmail ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                Sending Link…
              </>
            ) : (
              <>
                <Sparkles className='h-4 w-4' />
                Save & Verify
              </>
            )}
          </Button>
        </div>

        {emailError && (
          <p className='mt-2 type-small font-medium text-error-500'>
            {emailError}
          </p>
        )}
      </form>

      <div className='flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-5 dark:border-gray-800'>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleSendTest}
          disabled={sendingTest || !masterEnabled}
          title={
            !masterEnabled
              ? 'Enable notifications to send test email'
              : 'Send test email to active routing recipient'
          }
        >
          {sendingTest ? (
            <>
              <Loader2 className='h-4 w-4 animate-spin' />
              Sending…
            </>
          ) : (
            <>
              <Send className='h-4 w-4' />
              Send Test Notification
            </>
          )}
        </Button>

        {data?.notification_email && (
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={handleRemoveEmail}
            disabled={removingEmail}
            className='border-error-200 text-error-600 hover:bg-error-50 hover:text-error-700 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10'
          >
            {removingEmail ? (
              <>
                <Loader2 className='h-4 w-4 animate-spin' />
                Removing…
              </>
            ) : (
              <>
                <Trash2 className='h-4 w-4' />
                Remove Dedicated Email
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
