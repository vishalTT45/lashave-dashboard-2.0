'use client';

import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BadgeCheck, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';

const BLOCKED_DOMAINS = new Set([
  'yopmail.com',
  'yopmail.fr',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.de',
  'guerrillamail.info',
  'grr.la',
  'guerrillamailblock.com',
  'spam4.me',
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'trashmail.at',
  'trashmail.io',
  'trashmail.org',
  'trashmail.xyz',
  'dispostable.com',
  'tempmail.com',
  'tempmail.net',
  'tempmail.org',
  'temp-mail.org',
  'temp-mail.ru',
  'throwam.com',
  'throwam.net',
  'sharklasers.com',
  'spam.la',
  'crap.la',
  'discard.email',
  'mailnull.com',
  'spamgourmet.com',
  'spamgourmet.net',
  'mailnesia.com',
  'maildrop.cc',
  'spamfree24.org',
  'getairmail.com',
  'fakeinbox.com',
  'filzmail.com',
  'getnada.com',
  'inboxbear.com',
  'mailnew.com',
  'owlpic.com',
  'spamherelots.com',
  'tempr.email',
  'tempinbox.com',
  'sofimail.com',
  'spambox.us',
]);

type Screen =
  | 'login'
  | 'signup'
  | 'signup-otp'
  | 'forgot'
  | 'forgot-otp'
  | 'new-pass'
  | 'success';

function isDisposableEmail(email: string) {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 && BLOCKED_DOMAINS.has(parts[1]);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function useCountdown(initial = 59) {
  const [secs, setSecs] = useState(0);
  const start = useCallback(() => setSecs(initial), [initial]);

  useEffect(() => {
    if (secs <= 0) return;
    const timer = window.setTimeout(() => setSecs((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secs]);

  return { secs, start, done: secs === 0 };
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';

  return (
    <div>
      <label className='mb-1.5 block type-small font-medium text-gray-700 dark:text-gray-400'>
        {label} <span className='text-error-500'>*</span>
      </label>
      <div className='relative'>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={isPassword && visible ? 'text' : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className='h-10 w-full rounded-[10px] border border-gray-300 bg-transparent px-4 py-2 type-small text-gray-800 shadow-theme-xs outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-3 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-blue-400'
        />
        {isPassword && (
          <button
            type='button'
            onClick={() => setVisible((current) => !current)}
            className='absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400'
            aria-label={visible ? 'Hide password' : 'Show password'}
          >
            {visible ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
        )}
      </div>
    </div>
  );
}

function Alert({
  message,
  type = 'error',
}: {
  message: string;
  type?: 'error' | 'success';
}) {
  if (!message) return null;

  return (
    <div
      className={`rounded-[10px] border px-4 py-3 type-small ${type === 'success'
        ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/25 dark:bg-success-500/10 dark:text-success-400'
        : 'border-error-200 bg-error-50 text-error-600 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-400'
        }`}
    >
      {message}
    </div>
  );
}

function SubmitButton({
  children,
  loading,
  disabled,
}: {
  children: React.ReactNode;
  loading: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type='submit'
      disabled={loading || disabled}
      className='flex w-full items-center justify-center rounded-[10px] bg-blue-600 px-4 py-3 type-small font-medium text-white shadow-theme-xs transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus:ring-offset-gray-900'
    >
      {loading ? 'Please wait...' : children}
    </button>
  );
}

function OtpInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) =>
        onChange(event.target.value.replace(/\D/g, '').slice(0, 6))
      }
      inputMode='numeric'
      autoComplete='one-time-code'
      placeholder='000000'
      className='h-12 w-full rounded-[10px] border border-gray-300 bg-transparent px-4 text-center type-card-title font-semibold tracking-[0.35em] text-gray-800 shadow-theme-xs outline-none placeholder:text-gray-300 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800'
    />
  );
}

function AuthPageInner() {
  const { login, token, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const startsOnSignup = searchParams.get('signup') === 'true';

  const [screen, setScreen] = useState<Screen>(
    startsOnSignup ? 'signup' : 'login',
  );
  const [tab, setTab] = useState<'login' | 'signup'>(
    startsOnSignup ? 'signup' : 'login',
  );
  const [lEmail, setLEmail] = useState('');
  const [lPass, setLPass] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sPass, setSPass] = useState('');
  const [sConfirm, setSConfirm] = useState('');
  const [sFname, setSFname] = useState('');
  const [sLname, setSLname] = useState('');
  const [signupOTP, setSignupOTP] = useState('');
  const [forgotOTP, setForgotOTP] = useState('');
  const [fEmail, setFEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const signupTimer = useCountdown(59);
  const forgotTimer = useCountdown(59);

  useEffect(() => {
    if (!authLoading && token) router.replace('/');
  }, [authLoading, router, token]);

  const go = (next: Screen) => {
    setErr('');
    setInfo('');
    setScreen(next);
  };

  const doLogin = async () => {
    setErr('');
    if (!lEmail || !lPass) {
      setErr('Please fill in all fields.');
      return;
    }
    if (isDisposableEmail(lEmail)) {
      setErr('Disposable email addresses are not allowed.');
      return;
    }
    setBusy(true);
    try {
      await login(lEmail, lPass);
      router.replace('/');
    } catch (error) {
      setErr(getErrorMessage(error, 'Invalid email or password.'));
    } finally {
      setBusy(false);
    }
  };

  const doSignup = async () => {
    setErr('');
    if (!sEmail || !sPass || !sConfirm || !sFname || !sLname) {
      setErr('Please fill in all required fields.');
      return;
    }
    if (isDisposableEmail(sEmail)) {
      setErr('Disposable email addresses are not allowed.');
      return;
    }
    if (sPass.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (sPass !== sConfirm) {
      setErr('Passwords do not match.');
      return;
    }
    if (!agreeTerms) {
      setErr(
        'Please agree to the Terms and Conditions, Privacy Policy, and Data Processing Agreement.',
      );
      return;
    }

    setBusy(true);
    try {
      await apiFetch('/admin/auth/register', {
        method: 'POST',
        body: {
          email: sEmail,
          password: sPass,
          workspace_name: '',
          first_name: sFname,
          last_name: sLname,
        },
      });
      setSignupOTP('');
      go('signup-otp');
      signupTimer.start();
    } catch (error) {
      setErr(getErrorMessage(error, 'Registration failed.'));
    } finally {
      setBusy(false);
    }
  };

  const doVerifySignupOTP = async () => {
    setErr('');
    const code = signupOTP.replace(/\s/g, '');
    if (code.length < 6) {
      setErr('Please enter the full 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/admin/auth/verify-otp', {
        method: 'POST',
        body: { email: sEmail, code },
      });
      await login(sEmail, sPass);
      router.replace('/');
    } catch (error) {
      setErr(getErrorMessage(error, 'Invalid or expired code.'));
    } finally {
      setBusy(false);
    }
  };

  const resendSignupOTP = async () => {
    if (!signupTimer.done) return;
    try {
      await apiFetch('/admin/auth/resend-otp', {
        method: 'POST',
        body: { email: sEmail },
      });
      signupTimer.start();
      setInfo('Code resent.');
    } catch (error) {
      setErr(getErrorMessage(error, 'Failed to resend.'));
    }
  };

  const doForgot = async () => {
    setErr('');
    if (!fEmail) {
      setErr('Please enter your email.');
      return;
    }
    if (isDisposableEmail(fEmail)) {
      setErr('Disposable email addresses are not allowed.');
      return;
    }
    setBusy(true);
    try {
      const res = await apiFetch<{ exists: boolean }>(
        '/admin/auth/check-email',
        { method: 'POST', body: { email: fEmail } },
      );
      if (!res.exists) {
        setErr('No account found with that email address.');
        return;
      }
      await apiFetch('/admin/auth/forgot-password', {
        method: 'POST',
        body: { email: fEmail },
      });
      setForgotOTP('');
      go('forgot-otp');
      forgotTimer.start();
    } catch (error) {
      setErr(getErrorMessage(error, 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  };

  const doVerifyForgotOTP = async () => {
    setErr('');
    const code = forgotOTP.replace(/\s/g, '');
    if (code.length < 6) {
      setErr('Please enter the full 6-digit code.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/admin/auth/verify-reset-otp', {
        method: 'POST',
        body: { email: fEmail, code },
      });
      go('new-pass');
    } catch (error) {
      setErr(getErrorMessage(error, 'Invalid or expired code.'));
    } finally {
      setBusy(false);
    }
  };

  const resendForgotOTP = async () => {
    if (!forgotTimer.done) return;
    try {
      await apiFetch('/admin/auth/forgot-password', {
        method: 'POST',
        body: { email: fEmail },
      });
      forgotTimer.start();
      setInfo('Code resent.');
    } catch (error) {
      setErr(getErrorMessage(error, 'Failed to resend.'));
    }
  };

  const doResetPassword = async () => {
    setErr('');
    if (!newPass || newPass.length < 8) {
      setErr('Password must be at least 8 characters.');
      return;
    }
    if (newPass !== newPassConfirm) {
      setErr('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/admin/auth/reset-password', {
        method: 'POST',
        body: { email: fEmail, new_password: newPass },
      });
      go('success');
    } catch (error) {
      setErr(getErrorMessage(error, 'Failed to reset password.'));
    } finally {
      setBusy(false);
    }
  };

  if (authLoading) return null;

  const showTabs = screen === 'login' || screen === 'signup';
  const title =
    screen === 'signup'
      ? 'Sign Up'
      : screen === 'forgot'
        ? 'Reset Password'
        : screen === 'forgot-otp'
          ? 'Enter Reset Code'
          : screen === 'new-pass'
            ? 'Set New Password'
            : screen === 'success'
              ? 'Password Updated'
              : screen === 'signup-otp'
                ? 'Verify Account'
                : 'Sign In';
  const subtitle =
    screen === 'signup'
      ? 'Enter your details to create your account.'
      : screen === 'forgot'
        ? 'Enter your email and we will send a reset code.'
        : screen === 'forgot-otp'
          ? `We sent a 6-digit code to ${fEmail}.`
          : screen === 'new-pass'
            ? 'Choose a new password for your account.'
            : screen === 'success'
              ? 'You can now sign in with your new password.'
              : screen === 'signup-otp'
                ? `We sent a 6-digit code to ${sEmail}.`
                : 'Enter your email and password to sign in.';

  const submit = (handler: () => Promise<void>) => (event: FormEvent) => {
    event.preventDefault();
    void handler();
  };

  return (
    <main className='min-h-screen bg-white dark:bg-gray-900'>
      <div className='flex min-h-screen flex-col lg:flex-row-reverse'>
        <section className='flex w-full flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:w-1/2 lg:px-10'>
          <div className='w-full max-w-md'>
            <div className='mb-8 text-center sm:text-left'>
              <h1 className='mb-2 text-title-sm font-semibold text-gray-800 dark:text-white/90 sm:text-title-md'>
                {title}
              </h1>
              <p className='type-small text-gray-500 dark:text-gray-400'>
                {subtitle}
              </p>
            </div>

            {showTabs && (
              <div className='mb-6 grid grid-cols-2 gap-2 rounded-[10px] bg-gray-100 p-1 dark:bg-white/[0.05]'>
                {(['login', 'signup'] as const).map((item) => (
                  <button
                    key={item}
                    type='button'
                    onClick={() => {
                      setTab(item);
                      go(item);
                    }}
                    className={`rounded-[10px] px-3 py-2 type-small font-medium transition ${tab === item
                      ? 'bg-white text-blue-600 shadow-theme-xs dark:bg-gray-900 dark:text-blue-400'
                      : 'text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
                      }`}
                  >
                    {item === 'login' ? 'Sign In' : 'Sign Up'}
                  </button>
                ))}
              </div>
            )}

            <div className='space-y-5'>
              <Alert message={err} />
              <Alert message={info} type='success' />

              {screen === 'login' && (
                <form className='space-y-6' onSubmit={submit(doLogin)}>
                  <Field
                    label='Email'
                    type='email'
                    value={lEmail}
                    onChange={setLEmail}
                    placeholder='Enter your email'
                    autoComplete='email'
                  />
                  <Field
                    label='Password'
                    type='password'
                    value={lPass}
                    onChange={setLPass}
                    placeholder='Enter your password'
                    autoComplete='current-password'
                  />
                  <div className='flex justify-end'>
                    <button
                      type='button'
                      onClick={() => go('forgot')}
                      className='type-small font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                    >
                      Forgot password?
                    </button>
                  </div>

                  <SubmitButton loading={busy}>Sign In</SubmitButton>
                  <div className='flex flex-wrap items-center justify-center gap-x-5 gap-y-2 type-small text-blue-600 dark:text-blue-400'>
                    <span className='flex items-center gap-1.5'>
                      <LockKeyhole size={16} strokeWidth={2} />
                      SSL Secured
                    </span>

                    <span className='flex items-center gap-1.5'>
                      <BadgeCheck size={16} strokeWidth={2} />
                      Meta Integration
                    </span>

                    <span className='flex items-center gap-1.5'>
                      <ShieldCheck size={16} strokeWidth={2} />
                      GDPR Safe
                    </span>
                  </div>
                </form>
              )}

              {screen === 'signup' && (
                <form className='space-y-5' onSubmit={submit(doSignup)}>
                  <div className='grid grid-cols-1 gap-5 sm:grid-cols-2'>
                    <Field
                      label='First Name'
                      value={sFname}
                      onChange={setSFname}
                      placeholder='Enter first name'
                    />
                    <Field
                      label='Last Name'
                      value={sLname}
                      onChange={setSLname}
                      placeholder='Enter last name'
                    />
                  </div>
                  <Field
                    label='Email'
                    type='email'
                    value={sEmail}
                    onChange={setSEmail}
                    placeholder='Enter your email'
                    autoComplete='email'
                  />
                  <Field
                    label='Password'
                    type='password'
                    value={sPass}
                    onChange={setSPass}
                    placeholder='Enter your password'
                    autoComplete='new-password'
                  />
                  <Field
                    label='Confirm Password'
                    type='password'
                    value={sConfirm}
                    onChange={setSConfirm}
                    placeholder='Confirm your password'
                    autoComplete='new-password'
                  />
                  <label className='flex items-start gap-3 type-small text-gray-500 dark:text-gray-400'>
                    <input
                      type='checkbox'
                      checked={agreeTerms}
                      onChange={(event) => setAgreeTerms(event.target.checked)}
                      className='mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                    <span>
                      I agree to the{' '}
                      <a
                        href='https://lashvae.com/legal/terms'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                      >
                        Terms and Conditions
                      </a>{' '}
                      ,{' '}
                      <a
                        href='https://lashvae.com/legal/privacy'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                      >
                        Privacy Policy
                      </a>
                      , and{' '}
                      <a
                        href='https://lashvae.com/legal/dpa'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                      >
                        Data Processing Agreement
                      </a>
                      .
                    </span>
                  </label>
                  <SubmitButton loading={busy} disabled={!agreeTerms}>
                    Sign Up
                  </SubmitButton>
                  <div className='flex flex-wrap items-center justify-center gap-x-5 gap-y-2 type-small text-blue-600 dark:text-blue-400'>
                    <span className='flex items-center gap-1.5'>
                      <LockKeyhole size={16} strokeWidth={2} />
                      SSL Secured
                    </span>

                    <span className='flex items-center gap-1.5'>
                      <BadgeCheck size={16} strokeWidth={2} />
                      Meta Integration
                    </span>

                    <span className='flex items-center gap-1.5'>
                      <ShieldCheck size={16} strokeWidth={2} />
                      GDPR Safe
                    </span>
                  </div>
                </form>
              )}

              {screen === 'signup-otp' && (
                <form
                  className='space-y-5'
                  onSubmit={submit(doVerifySignupOTP)}
                >
                  <OtpInput value={signupOTP} onChange={setSignupOTP} />
                  <div className='text-center type-small text-gray-500 dark:text-gray-400'>
                    {signupTimer.done ? (
                      <button
                        type='button'
                        onClick={() => void resendSignupOTP()}
                        className='font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300'
                      >
                        Resend code
                      </button>
                    ) : (
                      <>
                        Resend in 0:{String(signupTimer.secs).padStart(2, '0')}
                      </>
                    )}
                  </div>
                  <SubmitButton loading={busy}>Verify Account</SubmitButton>
                </form>
              )}

              {screen === 'forgot' && (
                <form className='space-y-6' onSubmit={submit(doForgot)}>
                  <Field
                    label='Email'
                    type='email'
                    value={fEmail}
                    onChange={setFEmail}
                    placeholder='Enter your email'
                    autoComplete='email'
                  />
                  <SubmitButton loading={busy}>Send Reset Code</SubmitButton>
                </form>
              )}

              {screen === 'forgot-otp' && (
                <form
                  className='space-y-5'
                  onSubmit={submit(doVerifyForgotOTP)}
                >
                  <OtpInput value={forgotOTP} onChange={setForgotOTP} />
                  <div className='text-center type-small text-gray-500 dark:text-gray-400'>
                    {forgotTimer.done ? (
                      <button
                        type='button'
                        onClick={() => void resendForgotOTP()}
                        className='font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400'
                      >
                        Resend code
                      </button>
                    ) : (
                      <>
                        Resend in 0:{String(forgotTimer.secs).padStart(2, '0')}
                      </>
                    )}
                  </div>
                  <SubmitButton loading={busy}>Verify Code</SubmitButton>
                </form>
              )}

              {screen === 'new-pass' && (
                <form className='space-y-6' onSubmit={submit(doResetPassword)}>
                  <Field
                    label='New Password'
                    type='password'
                    value={newPass}
                    onChange={setNewPass}
                    placeholder='Enter new password'
                    autoComplete='new-password'
                  />
                  <Field
                    label='Confirm New Password'
                    type='password'
                    value={newPassConfirm}
                    onChange={setNewPassConfirm}
                    placeholder='Confirm new password'
                    autoComplete='new-password'
                  />
                  <SubmitButton loading={busy}>Update Password</SubmitButton>
                </form>
              )}

              {screen === 'success' && (
                <button
                  type='button'
                  onClick={() => {
                    setTab('login');
                    go('login');
                  }}
                  className='flex w-full items-center justify-center rounded-[10px] bg-brand-500 px-4 py-3 type-small font-medium text-white shadow-theme-xs transition hover:bg-brand-600'
                >
                  Back to Sign In
                </button>
              )}
            </div>

            {screen !== 'login' && (
              <button
                type='button'
                onClick={() => {
                  setTab('login');
                  go('login');
                }}
                className='mt-6 text-center type-small font-medium text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              >
                Back to Sign In
              </button>
            )}
          </div>
        </section>

        <section className='relative hidden w-full flex-1 items-center justify-center overflow-hidden bg-[#4249C6] px-10 lg:flex lg:w-1/2'>
          <div className='absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[size:200px_200px] opacity-70' />
          <div className='relative flex w-full max-w-md flex-col items-center text-center'>
            <div className='relative z-10 flex flex-col items-center'>
              <div className='mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2.5 shadow-theme-lg'>
                <Image
                  src='/lashvaelogo.png'
                  width={60}
                  height={60}
                  alt='Lashvae'
                  style={{ width: 'auto', height: 'auto' }}
                  className='h-[60px] w-[60px] object-contain'
                  priority
                />
              </div>
              <h2 className='text-title-md font-semibold text-white sm:text-title-lg'>
                Lashvae
              </h2>
              <p className='mt-4 max-w-sm type-body leading-7 text-gray-300'>
                AI-powered messaging dashboard for your business.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}
