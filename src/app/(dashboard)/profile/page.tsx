'use client';

import SubscriptionTab from '@/components/profile/SubscriptionTab';
import { RequireAuth } from '@/components/require-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, clearToken } from '@/lib/api';
import type { ApexOptions } from 'apexcharts';
import emailjs from '@emailjs/browser';
import {
  ArrowLeft,
  BadgeCheck,
  Camera,
  CheckCircle2,
  CreditCard,
  ChevronRight,
  Headphones,
  Loader2,
  LockKeyhole,
  Mail,
  Menu,
  Pencil,
  Save,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const ReactApexChart = dynamic(() => import('react-apexcharts'), {
  ssr: false,
});


type FormFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
   disabled?: boolean; 
};

type MeResp = {
  user: {
    id: number;
    email: string;
    role: string;
    tenant_id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    location: string | null;
    avatar_url: string | null;
  };
  tenant: {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    address: string | null;
  } | null;
};

type NavId = 'overview' | 'details' | 'security' | 'subscription' | 'support';

const NAV: { id: NavId; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'Overview', icon: <User className='h-4 w-4' /> },
  { id: 'details', label: 'Details', icon: <Pencil className='h-4 w-4' /> },
  { id: 'security', label: 'Security', icon: <ShieldCheck className='h-4 w-4' /> },
  { id: 'subscription', label: 'Subscription', icon: <CreditCard className='h-4 w-4' /> },
  { id: 'support', label: 'Support', icon: <Headphones className='h-4 w-4' /> },
];

const SUPPORT_SUBJECTS = [
  'General Inquiry',
  'Technical Support',
  'Billing & Payments',
  'Partnership',
  'Feedback',
  'Other',
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function nameFromEmail(email: string) {
  return email
    .split('@')[0]
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayName(me: MeResp) {
  const name = [me.user.first_name, me.user.last_name].filter(Boolean).join(' ').trim();
  return name || nameFromEmail(me.user.email);
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function fieldValue(value?: string | null) {
  return value?.trim() || 'Not set';
}

function formatRole(role: string) {
  return role === 'super_admin'
    ? 'SUPER ADMIN'
    : role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function profileScore(me: MeResp) {
  const values = [
    me.user.email,
    me.user.first_name,
    me.user.last_name,
    me.user.phone,
    me.user.location,
    me.user.avatar_url,
    me.tenant?.name,
    me.tenant?.industry,
    me.tenant?.website,
    me.tenant?.address,
  ];
  const complete = values.filter((value) => Boolean(value?.trim())).length;
  return Math.round((complete / values.length) * 100);
}

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className='mb-5'>
      <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>{title}</h3>
      <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>{subtitle}</p>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  required,
  error,
}: FormFieldProps) {
  return (
    <label className='block'>
      <span className='mb-1.5 block type-small font-medium text-gray-700 dark:text-gray-400'>
        {label}
        {required && <span className='text-error-500'> *</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className={cn(
          'h-10 w-full rounded-(--radius-control) border bg-transparent px-4 py-2 type-small text-gray-800 shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90',
          error
            ? 'border-error-500 focus:border-error-500 focus:ring-error-500/10'
            : 'border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700',
        )}
      />
      {error && <p className='mt-1.5 type-caption text-error-500'>{error}</p>}
    </label>
  );
}
function AlertBox({
  children,
  tone = 'error',
}: {
  children: React.ReactNode;
  tone?: 'error' | 'success' | 'info';
}) {
  const classes =
    tone === 'success'
      ? 'border-success-500/20 bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-500'
      : tone === 'info'
        ? 'border-brand-500/20 bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400'
        : 'border-error-500/20 bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500';

  return <div className={`rounded-xl border px-4 py-3 type-small ${classes}`}>{children}</div>;
}

function SaveButton({
  loading,
  saved,
  onClick,
}: {
  loading: boolean;
  saved: boolean;
  onClick: () => void;
}) {
  return (
    <Button type='button' onClick={onClick} disabled={loading} className='h-10 px-5'>
      {loading ? (
        <>
          <Loader2 className='h-4 w-4 animate-spin' />
          Saving
        </>
      ) : saved ? (
        <>
          <CheckCircle2 className='h-4 w-4' />
          Saved
        </>
      ) : (
        <>
          <Save className='h-4 w-4' />
          Save Changes
        </>
      )}
    </Button>
  );
}

function AvatarUploader({
  me,
  photoUrl,
  onUploaded,
}: {
  me: MeResp;
  photoUrl: string | null;
  onUploaded: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const name = displayName(me);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setErr('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const response = await apiFetch<{ url: string }>('/admin/profile/avatar', {
        auth: true,
        method: 'POST',
        body: form,
      });
      onUploaded(response.url);
      window.dispatchEvent(new Event('avatar-updated'));
    } catch (error) {
      setErr(errorMessage(error, 'Upload failed. Try again.'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  return (
    <div className='flex flex-col items-center gap-3'>
      <button
        type='button'
        onClick={() => fileRef.current?.click()}
        className='group relative h-24 w-24 overflow-hidden rounded-full border border-gray-200 bg-gray-100 type-h4 font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300'
        aria-label='Change profile photo'
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className='h-full w-full object-cover' />
        ) : (
          initials(name)
        )}
        <span className='absolute inset-0 flex items-center justify-center bg-gray-900/50 text-white opacity-0 transition group-hover:opacity-100'>
          {uploading ? <Loader2 className='h-5 w-5 animate-spin' /> : <Camera className='h-5 w-5' />}
        </span>
      </button>
      <input ref={fileRef} type='file' accept='image/*' className='hidden' onChange={handleFile} />
      {err && <p className='type-caption text-error-500'>{err}</p>}
    </div>
  );
}

function CompletionChart({ score }: { score: number }) {
  const options: ApexOptions = {
    chart: { sparkline: { enabled: true }, fontFamily: 'Outfit, sans-serif' },
    colors: ['#465FFF'],
    plotOptions: {
      radialBar: {
        hollow: { size: '72%' },
        track: { background: '#E5E7EB' },
        dataLabels: {
          name: { show: false },
          value: {
            formatter: (value) => `${Math.round(value)}%`,
            color: '#1D2939',
            fontSize: '24px',
            fontWeight: 700,
          },
        },
      },
    },
    stroke: { lineCap: 'round' },
  };

  return (
    <Card className='p-6'>
      <SectionHeader title='Profile Completion' subtitle='Completed account and workspace fields' />
      <div className='mx-auto max-w-80'>
        <ReactApexChart options={options} series={[score]} type='radialBar' height={290} />
      </div>
      <p className='text-center type-small text-gray-500 dark:text-gray-400'>
        Keep profile and company information current for better account management.
      </p>
    </Card>
  );
}

function MetaCard({
  me,
  photoUrl,
  setPhotoUrl,
}: {
  me: MeResp;
  photoUrl: string | null;
  setPhotoUrl: (url: string | null) => void;
}) {
  const name = displayName(me);

  return (
    <Card className='p-6 lg:p-6'>
      <div className='flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex flex-col items-center gap-6 text-center lg:flex-row lg:text-left'>
          <AvatarUploader me={me} photoUrl={photoUrl} onUploaded={setPhotoUrl} />
          <div>
            <h2 className='type-h4 font-semibold text-gray-800 dark:text-white/90'>{name}</h2>
            <div className='mt-2 flex flex-col items-center gap-2 type-small text-gray-500 dark:text-gray-400 lg:flex-row'>
              <span>{me.user.email}</span>
              <span className='hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 lg:block' />
              <span>{fieldValue(me.user.location)}</span>
            </div>
          </div>
        </div>
        <span className='inline-flex items-center justify-center gap-2 rounded-full bg-brand-50 px-3 py-1 type-small font-medium text-brand-500 dark:bg-brand-500/12 dark:text-brand-400'>
          <BadgeCheck className='h-4 w-4' />
          {formatRole(me.user.role)}
        </span>
      </div>
    </Card>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className='mb-2 type-caption text-gray-500 dark:text-gray-400'>{label}</p>
      <p className='wrap-break-word type-small font-medium text-gray-800 dark:text-white/90'>{value}</p>
    </div>
  );
}

function OverviewTab({ me }: { me: MeResp }) {
  return (
    <div className='grid grid-cols-1 gap-6 lg:grid-cols-12'>
      <div className='space-y-6 lg:col-span-8'>
        <Card className='p-6 lg:p-6'>
          <SectionHeader title='Personal Information' subtitle='Primary account profile fields' />
          <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
            <InfoItem label='First Name' value={fieldValue(me.user.first_name)} />
            <InfoItem label='Last Name' value={fieldValue(me.user.last_name)} />
            <InfoItem label='Email Address' value={me.user.email} />
            <InfoItem label='Phone' value={fieldValue(me.user.phone)} />
            <InfoItem label='Location' value={fieldValue(me.user.location)} />
            <InfoItem label='Role' value={formatRole(me.user.role)} />
          </div>
        </Card>

        <Card className='p-6 lg:p-6'>
          <SectionHeader title='Company Information' subtitle='Workspace details attached to this account' />
          <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
            <InfoItem label='Company Name' value={fieldValue(me.tenant?.name)} />
            <InfoItem label='Industry' value={fieldValue(me.tenant?.industry)} />
            <InfoItem label='Website' value={fieldValue(me.tenant?.website)} />
            <InfoItem label='Address' value={fieldValue(me.tenant?.address)} />
          </div>
        </Card>
      </div>
      <div className='lg:col-span-4'>
        <CompletionChart score={profileScore(me)} />
      </div>
    </div>
  );
}

function DetailsTab({ me }: { me: MeResp }) {
  const nameParts = (
    me.user.first_name ? `${me.user.first_name} ${me.user.last_name ?? ''}`.trim() : nameFromEmail(me.user.email)
  ).split(' ');
  const [mode, setMode] = useState<'personal' | 'company'>('personal');
  const [firstName, setFirstName] = useState(nameParts[0] ?? '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') ?? '');
  const [email, setEmail] = useState(me.user.email);
  const [phone, setPhone] = useState(me.user.phone ?? '');
  const [location, setLocation] = useState(me.user.location ?? '');
  const [companyName, setCompanyName] = useState(me.tenant?.name ?? '');
  const [industry, setIndustry] = useState(me.tenant?.industry ?? '');
  const [website, setWebsite] = useState(me.tenant?.website ?? '');
  const [address, setAddress] = useState(me.tenant?.address ?? '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiErr, setApiErr] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpInfo, setOtpInfo] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!resendAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  const resendSeconds = resendAt ? Math.max(0, Math.ceil((resendAt - now) / 1000)) : 0;

  async function handleSendEmailOtp() {
    if (!email.trim()) {
      setOtpError('Please enter an email address first.');
      return;
    }

    setOtpError('');
    setOtpBusy(true);
    try {
      await apiFetch('/admin/profile/send-email-otp', {
        auth: true,
        method: 'POST',
        body: { email: email.trim() },
      });
      setOtpCode('');
      setShowOtp(true);
      setResendAt(Date.now() + 59000);
      setOtpInfo('Verification code sent to your email.');
    } catch (error) {
      setOtpError(errorMessage(error, 'Failed to send verification code.'));
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleVerifyEmailOtp() {
    const code = otpCode.replace(/\s/g, '');
    if (code.length < 6) {
      setOtpError('Please enter the full 6-digit code.');
      return;
    }

    setOtpError('');
    setOtpBusy(true);
    try {
      await apiFetch('/admin/profile/verify-email-otp', {
        auth: true,
        method: 'POST',
        body: { email: email.trim(), code },
      });
      setOtpCode('');
      setShowOtp(false);
      setEmailVerified(true);
      setOtpInfo('Email verified.');
    } catch (error) {
      setOtpError(errorMessage(error, 'Invalid or expired code.'));
    } finally {
      setOtpBusy(false);
    }
  }

  async function handleSave() {
    setApiErr('');
    setLoading(true);
    try {
      if (mode === 'personal') {
        await apiFetch('/admin/profile/personal', {
          auth: true,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ first_name: firstName, last_name: lastName, email, phone, location }),
        });
      } else {
        await apiFetch('/admin/profile/company', {
          auth: true,
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ company_name: companyName, industry, website, address }),
        });
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setApiErr(errorMessage(error, 'Failed to save. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className='p-6 lg:p-6'>
      <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <SectionHeader title='Details' subtitle='Update your personal or company information' />
        <SaveButton loading={loading} saved={saved} onClick={() => void handleSave()} />
      </div>

      {apiErr && <div className='mb-5'><AlertBox>{apiErr}</AlertBox></div>}

      <div className='mb-6 inline-flex rounded-(--radius-control) border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900'>
        {(['personal', 'company'] as const).map((item) => (
          <button
            key={item}
            type='button'
            onClick={() => setMode(item)}
            className={`rounded-(--radius-control) px-4 py-2 type-small font-medium capitalize transition ${
              mode === item
                ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-white/5 dark:text-brand-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white/90'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {mode === 'personal' ? (
        <div className='space-y-5'>
          <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
            <FormField label='First Name' value={firstName} onChange={setFirstName} />
            <FormField label='Last Name' value={lastName} onChange={setLastName} />
          </div>
          <div>
            <FormField
              label='Email Address'
              value={email}
              onChange={(value) => {
                setEmail(value);
                setOtpCode('');
                setOtpError('');
                setOtpInfo('');
                setShowOtp(false);
                setEmailVerified(false);
              }}
              type='email'
              placeholder='name@company.com'
            />
            <div className='mt-3 flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex items-start gap-3'>
                <Mail className='mt-0.5 h-4 w-4 text-gray-500 dark:text-gray-400' />
                <div>
                  <p className='type-small font-medium text-gray-800 dark:text-white/90'>
                    {emailVerified ? 'Email verified' : 'Email verification'}
                  </p>
                  <p className='mt-1 type-caption text-gray-500 dark:text-gray-400'>
                    Verify this address before saving sensitive account changes.
                  </p>
                </div>
              </div>
              <Button
                type='button'
                variant={emailVerified ? 'outline' : 'default'}
                size='sm'
                disabled={otpBusy || !email.trim()}
                onClick={() => {
                  if (!emailVerified) void handleSendEmailOtp();
                }}
              >
                {otpBusy ? <Loader2 className='h-4 w-4 animate-spin' /> : emailVerified ? <CheckCircle2 className='h-4 w-4' /> : <Mail className='h-4 w-4' />}
                {showOtp ? 'Resend Code' : emailVerified ? 'Verified' : 'Verify Email'}
              </Button>
            </div>
            {showOtp && (
              <div className='mt-3 rounded-xl border border-brand-500/20 bg-brand-50 p-4 dark:bg-brand-500/10'>
                <p className='type-small font-semibold text-gray-800 dark:text-white/90'>Enter verification code</p>
                <p className='mt-1 type-caption text-gray-500 dark:text-gray-400'>We sent a 6-digit code to {email.trim()}.</p>
                <Input
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder='000000'
                  className='mt-4 h-10 max-w-45 rounded-(--radius-control) border-gray-300 text-center type-card-title tracking-[0.35em] shadow-theme-xs focus-visible:border-brand-300 focus-visible:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900'
                />
                <div className='mt-4 flex flex-wrap items-center gap-3'>
                  <Button type='button' size='sm' onClick={() => void handleVerifyEmailOtp()} disabled={otpBusy}>
                    {otpBusy && <Loader2 className='h-4 w-4 animate-spin' />}
                    Verify Code
                  </Button>
                  <Button
                    type='button'
                    size='sm'
                    variant='outline'
                    disabled={otpBusy || resendSeconds > 0}
                    onClick={() => void handleSendEmailOtp()}
                  >
                    {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend Code'}
                  </Button>
                  <Button type='button' size='sm' variant='ghost' onClick={() => setShowOtp(false)}>
                    Cancel
                  </Button>
                </div>
                {otpError && <div className='mt-3'><AlertBox>{otpError}</AlertBox></div>}
                {otpInfo && <div className='mt-3'><AlertBox tone='success'>{otpInfo}</AlertBox></div>}
              </div>
            )}
          </div>
          <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
            <FormField label='Phone Number' value={phone} onChange={setPhone} type='tel' placeholder='+1 555 000 0000' />
            <FormField label='Location' value={location} onChange={setLocation} placeholder='City, Country' />
          </div>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
          <FormField label='Company Name' value={companyName} onChange={setCompanyName} />
          <FormField label='Industry' value={industry} onChange={setIndustry} placeholder='e.g. SaaS, Healthcare' />
          <FormField label='Website' value={website} onChange={setWebsite} placeholder='https://yourcompany.com' />
          <FormField label='Address' value={address} onChange={setAddress} placeholder='123 Main St, City' />
        </div>
      )}
    </Card>
  );
}

function DeleteAccountSection() {
  const [showModal, setShowModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [err, setErr] = useState('');
  const router = useRouter();

  async function handleDelete() {
    if (confirmText !== 'DELETE') return;
    setErr('');
    setDeleting(true);

    try {
      await apiFetch('/admin/auth/delete-account', {
        auth: true,
        method: 'DELETE',
      });
      clearToken();
      router.push('/login');
    } catch (error) {
      setErr(errorMessage(error, 'Failed to delete account. Please try again.'));
      setDeleting(false);
    }
  }

  return (
    <>
      <Card className='border-error-500/20 bg-error-50 p-6 dark:bg-error-500/10'>
        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex items-start gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-error-500/10 text-error-500'>
              <Trash2 className='h-5 w-5' />
            </div>
            <div>
              <h3 className='type-small font-semibold text-error-600 dark:text-error-500'>Delete Account</h3>
              <p className='mt-1 type-small text-error-600/80 dark:text-error-500/80'>
                Permanently delete your account and associated workspace data.
              </p>
            </div>
          </div>
          <Button type='button' variant='destructive' onClick={() => setShowModal(true)}>
            Delete Account
          </Button>
        </div>
      </Card>

      {showModal && (
        <div className='fixed inset-0 z-10000 flex items-center justify-center bg-gray-400/50 p-4 backdrop-blur-md'>
          <div className='w-full max-w-110 rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900'>
            <div className='mb-5 flex items-start justify-between gap-4'>
              <div>
                <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>Delete your account?</h3>
                <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                  This action cannot be undone. Type DELETE to confirm.
                </p>
              </div>
              <button type='button' onClick={() => setShowModal(false)} disabled={deleting} className='text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white/90'>
                <X className='h-5 w-5' />
              </button>
            </div>
            {err && <div className='mb-4'><AlertBox>{err}</AlertBox></div>}
            <FormField label='Confirmation' value={confirmText} onChange={setConfirmText} placeholder='DELETE' disabled={deleting} />
            <div className='mt-6 flex justify-end gap-3'>
              <Button type='button' variant='outline' onClick={() => setShowModal(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type='button' variant='destructive' disabled={confirmText !== 'DELETE' || deleting} onClick={() => void handleDelete()}>
                {deleting && <Loader2 className='h-4 w-4 animate-spin' />}
                Permanently Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SecurityTab() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [apiErr, setApiErr] = useState('');

  const strength = next.length >= 12 ? 'Strong' : next.length >= 8 ? 'Medium' : next ? 'Weak' : 'Not set';
  const strengthPct = next.length >= 12 ? 100 : next.length >= 8 ? 66 : next ? 33 : 0;

  async function handleSave() {
    setFormErr('');
    setApiErr('');

    if (!current || !next || !confirm) {
      setFormErr('All fields are required.');
      return;
    }
    if (next.length < 8) {
      setFormErr('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setFormErr('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/admin/profile/password', {
        auth: true,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: current, new_password: next }),
      });
      setCurrent('');
      setNext('');
      setConfirm('');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setApiErr(errorMessage(error, 'Failed to update password. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='space-y-6'>
      <Card className='p-6 lg:p-6'>
        <div className='mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
          <SectionHeader title='Security' subtitle='Manage your password and account access' />
          <SaveButton loading={loading} saved={saved} onClick={() => void handleSave()} />
        </div>
        <div className='mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900'>
          <div className='flex items-start gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/12 dark:text-brand-400'>
              <LockKeyhole className='h-5 w-5' />
            </div>
            <div>
              <p className='type-small font-semibold text-gray-800 dark:text-white/90'>Password strength: {strength}</p>
              <div className='mt-3 h-2 w-full max-w-80 rounded-full bg-gray-200 dark:bg-gray-800'>
                <div className='h-2 rounded-full bg-brand-500 transition-all' style={{ width: `${strengthPct}%` }} />
              </div>
            </div>
          </div>
        </div>
        {(formErr || apiErr) && <div className='mb-5'><AlertBox>{formErr || apiErr}</AlertBox></div>}
        <div className='grid grid-cols-1 gap-5'>
          <FormField label='Current Password' value={current} onChange={setCurrent} type={show ? 'text' : 'password'} />
          <FormField label='New Password' value={next} onChange={setNext} type={show ? 'text' : 'password'} />
          <FormField label='Confirm New Password' value={confirm} onChange={setConfirm} type={show ? 'text' : 'password'} />
          <label className='inline-flex items-center gap-2 type-small text-gray-600 dark:text-gray-400'>
            <input type='checkbox' checked={show} onChange={(event) => setShow(event.target.checked)} className='h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20' />
            Show password fields
          </label>
        </div>
      </Card>
      <DeleteAccountSection />
    </div>
  );
}

function SupportPanel() {
  const [fullname, setFullname] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<'success' | 'error' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [dsarType, setDsarType] = useState('');
  const [dsarChannel, setDsarChannel] = useState('');
  const [identifierType, setIdentifierType] = useState('');
  const [identifierValue, setIdentifierValue] = useState('');
  const [dsarNotes, setDsarNotes] = useState('');
  const [dsarConfirmed, setDsarConfirmed] = useState(false);
  const [dsarSending, setDsarSending] = useState(false);
  const [dsarStatus, setDsarStatus] = useState<'success' | 'error' | null>(
    null,
  );

  const validators = {
    fullname: (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) return 'Full name is required.';
      if (trimmed.length < 2) return 'Name must be at least 2 characters.';
      if (!/^[A-Za-z\s.'-]+$/.test(trimmed)) {
        return "Name can only contain letters, spaces, and . ' -";
      }

      return '';
    },

    email: (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) return 'Email is required.';
      if (!trimmed.includes('@')) return 'Email must contain an @ symbol.';
      if (!trimmed.includes('.')) {
        return 'Email must contain a domain (e.g. .com).';
      }

      if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(trimmed)) {
        return 'Please enter a valid email (e.g. name@example.com).';
      }

      return '';
    },

    phone: (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) return '';

      const digitsOnly = trimmed.replace(/[\s\-()+]/g, '');

      if (!/^\d+$/.test(digitsOnly)) {
        return 'Phone can only contain digits, spaces, +, -, (, ).';
      }

      if (digitsOnly.length < 7) return 'Phone must be at least 7 digits.';
      if (digitsOnly.length > 15) return 'Phone must be at most 15 digits.';

      return '';
    },

    subject: (value: string) => {
      if (!value) return 'Please select a subject.';
      return '';
    },

    message: (value: string) => {
      const trimmed = value.trim();

      if (!trimmed) return 'Message is required.';
      if (trimmed.length < 10) {
        return 'Message must be at least 10 characters.';
      }

      return '';
    },
  };

  const validateField = (name: keyof typeof validators, value: string) => {
    const error = validators[name](value);

    setErrors((prev) => ({
      ...prev,
      [name]: error,
    }));

    return error;
  };

  const validateAll = () => {
    const newErrors: Record<string, string> = {
      fullname: validators.fullname(fullname),
      email: validators.email(email),
      phone: validators.phone(phone),
      subject: validators.subject(subject),
      message: validators.message(message),
    };

    setErrors(newErrors);

    setTouched({
      fullname: true,
      email: true,
      phone: true,
      subject: true,
      message: true,
    });

    return Object.values(newErrors).every((error) => !error);
  };

  const handleBlur = (name: keyof typeof validators, value: string) => {
    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    validateField(name, value);
  };

  const handleChange = (
    name: keyof typeof validators,
    value: string,
    setter: (value: string) => void,
  ) => {
    setter(value);

    setTouched((prev) => ({
      ...prev,
      [name]: true,
    }));

    validateField(name, value);
  };

  const canSubmit = agreed && !sending;

  async function handleSubmit() {
    setStatus(null);

    if (!validateAll()) return;
    if (!agreed) return;

    setSending(true);

    try {
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        {
          fullname: fullname.trim(),
          email: email.trim(),
          phone: phone.trim(),
          subject,
          message: message.trim(),
          to_email: 'dpo@lashvae.com',
        },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!,
      );

      setStatus('success');

      setFullname('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
      setAgreed(false);
      setErrors({});
      setTouched({});
    } catch (error) {
      console.error('EMAILJS_ERROR:', error);
      setStatus('error');
    } finally {
      setSending(false);
    }
  }

  const canSubmitDsar = Boolean(
    dsarType &&
    dsarChannel &&
    identifierType &&
    identifierValue.trim() &&
    dsarConfirmed &&
    !dsarSending,
  );

  async function handleDsarSubmit() {
    if (!canSubmitDsar) return;

    setDsarSending(true);
    setDsarStatus(null);

    try {
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        {
          fullname: 'Customer Data Request',
          email: 'dpo@lashvae.com',
          phone: '',

          subject: `DSAR - ${dsarType.toUpperCase()} request`,

          message: `
Request Type: ${dsarType}
Channel: ${dsarChannel}
Identifier Type: ${identifierType}
Identifier Value: ${identifierValue.trim()}

Additional Notes:
${dsarNotes.trim() || 'None'}

Identity verified by controller: Yes
Customer requested action: Yes
          `.trim(),

          to_email: 'dpo@lashvae.com',
        },
        process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!,
      );

      setDsarStatus('success');

      setDsarType('');
      setDsarChannel('');
      setIdentifierType('');
      setIdentifierValue('');
      setDsarNotes('');
      setDsarConfirmed(false);
    } catch (error) {
      console.error('DSAR_REQUEST_ERROR:', error);
      setDsarStatus('error');
    } finally {
      setDsarSending(false);
    }
  }

  return (
    <Card className='p-6 lg:p-6'>
      <SectionHeader
        title='Support'
        subtitle='Send a message to the Lashvae team'
      />

      <div className='space-y-5'>
        {status === 'success' && (
          <AlertBox tone='success'>Your message has been sent.</AlertBox>
        )}

        {status === 'error' && (
          <AlertBox>Unable to send your message. Please try again.</AlertBox>
        )}

        <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
          <FormField
            label='Full Name'
            value={fullname}
            onChange={(value) => handleChange('fullname', value, setFullname)}
            onBlur={() => handleBlur('fullname', fullname)}
            placeholder='Enter your full name'
            required
            error={touched.fullname ? errors.fullname : ''}
          />

          <FormField
            label='Email Address'
            value={email}
            onChange={(value) => handleChange('email', value, setEmail)}
            onBlur={() => handleBlur('email', email)}
            type='email'
            placeholder='Enter your email address'
            required
            error={touched.email ? errors.email : ''}
          />

          <FormField
            label='Phone Number'
            value={phone}
            onChange={(value) => handleChange('phone', value, setPhone)}
            onBlur={() => handleBlur('phone', phone)}
            type='tel'
            placeholder='Enter your phone number'
            error={touched.phone ? errors.phone : ''}
          />

          <label className='block'>
            <span className='mb-1.5 block type-small font-medium text-gray-700 dark:text-gray-400'>
              Subject <span className='text-error-500'>*</span>
            </span>

            <select
              value={subject}
              onChange={(event) =>
                handleChange('subject', event.target.value, setSubject)
              }
              onBlur={() => handleBlur('subject', subject)}
              className={cn(
                'h-10 w-full rounded-(--radius-control) border bg-transparent px-4 py-2 type-small text-gray-800 shadow-theme-xs focus:outline-hidden focus:ring-3 dark:bg-gray-900 dark:text-white/90',
                touched.subject && errors.subject
                  ? 'border-error-500 focus:border-error-500 focus:ring-error-500/10'
                  : 'border-gray-300 focus:border-brand-300 focus:ring-brand-500/10 dark:border-gray-700',
              )}
            >
              <option value='' disabled>
                Select a topic
              </option>

              {SUPPORT_SUBJECTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            {touched.subject && errors.subject && (
              <p className='mt-1.5 type-caption text-error-500'>
                {errors.subject}
              </p>
            )}
          </label>
        </div>

        <label className='block'>
          <span className='mb-1.5 block type-small font-medium text-gray-700 dark:text-gray-400'>
            Your Message <span className='text-error-500'>*</span>
          </span>

          <Textarea
            value={message}
            onChange={(event) =>
              handleChange('message', event.target.value, setMessage)
            }
            onBlur={() => handleBlur('message', message)}
            placeholder='Tell us about your question or request.'
            className={cn(
              'min-h-37.5 rounded-(--radius-control) shadow-theme-xs dark:bg-gray-900',
              touched.message && errors.message
                ? 'border-error-500 focus-visible:border-error-500 focus-visible:ring-error-500/10'
                : 'border-gray-300 focus-visible:border-brand-300 focus-visible:ring-brand-500/10 dark:border-gray-700',
            )}
          />

          {touched.message && errors.message && (
            <p className='mt-1.5 type-caption text-error-500'>
              {errors.message}
            </p>
          )}
        </label>

        <label className='flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 type-small text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400'>
          <input
            type='checkbox'
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            className='mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20'
          />

          <span>
            I agree to the Privacy Policy and consent to being contacted
            regarding my inquiry.
          </span>
        </label>

        <div className='flex justify-end'>
          <Button
            type='button'
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            className='h-10 px-5'
          >
            {sending && <Loader2 className='h-4 w-4 animate-spin' />}
            Send Message
          </Button>
        </div>

        <div className='my-7 border-t border-gray-200 dark:border-gray-800' />

        <div>
          <SectionHeader
            title='Customer Data Request'
            subtitle="Export or delete an end-customer's data on their behalf"
          />

          <div className='rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-900'>
            <div className='grid grid-cols-1 gap-5 md:grid-cols-2'>
              <label className='block'>
                <span className='mb-1.5 block type-small font-medium text-gray-700 dark:text-gray-400'>
                  Request Type <span className='text-error-500'>*</span>
                </span>

                <select
                  value={dsarType}
                  onChange={(event) => setDsarType(event.target.value)}
                  className='h-10 w-full rounded-(--radius-control) border border-gray-300 bg-transparent px-4 py-2 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
                >
                  <option value='' disabled>
                    Select request type
                  </option>

                  <option value='export'>Export customer data</option>

                  <option value='delete'>Delete customer data</option>
                </select>
              </label>

              <label className='block'>
                <span className='mb-1.5 block type-small font-medium text-gray-700 dark:text-gray-400'>
                  Channel <span className='text-error-500'>*</span>
                </span>

                <select
                  value={dsarChannel}
                  onChange={(event) => setDsarChannel(event.target.value)}
                  className='h-10 w-full rounded-(--radius-control) border border-gray-300 bg-transparent px-4 py-2 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
                >
                  <option value='' disabled>
                    Select channel
                  </option>

                  <option value='instagram'>Instagram</option>
                  <option value='facebook'>Facebook</option>
                  <option value='telegram'>Telegram</option>
                  <option value='website'>Website Widget</option>
                  <option value='youtube'>YouTube</option>
                </select>
              </label>

              <label className='block'>
                <span className='mb-1.5 block type-small font-medium text-gray-700 dark:text-gray-400'>
                  Identifier Type <span className='text-error-500'>*</span>
                </span>

                <select
                  value={identifierType}
                  onChange={(event) => setIdentifierType(event.target.value)}
                  className='h-10 w-full rounded-(--radius-control) border border-gray-300 bg-transparent px-4 py-2 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
                >
                  <option value='' disabled>
                    Select identifier type
                  </option>

                  <option value='email'>Email</option>
                  <option value='username'>Username</option>
                  <option value='phone'>Phone number</option>
                  <option value='external_user_id'>External user ID</option>
                </select>
              </label>

              <FormField
                label='Identifier Value'
                value={identifierValue}
                onChange={setIdentifierValue}
                placeholder='e.g. user@example.com'
                required
              />
            </div>

            <label className='mt-5 block'>
              <span className='mb-1.5 block type-small font-medium text-gray-700 dark:text-gray-400'>
                Additional Notes
              </span>

              <Textarea
                value={dsarNotes}
                onChange={(event) => setDsarNotes(event.target.value)}
                placeholder='Any extra context for our team (optional)'
                className='min-h-27.5 rounded-(--radius-control) border-gray-300 shadow-theme-xs focus-visible:border-brand-300 focus-visible:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900'
              />
            </label>

            <label className='mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3'>
              <input
                type='checkbox'
                checked={dsarConfirmed}
                onChange={(event) => setDsarConfirmed(event.target.checked)}
                className='mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500/20'
              />

              <span className='type-small leading-5 text-gray-600 dark:text-gray-400'>
                I confirm that the customer requested this action, we verified
                the customer&apos;s identity, and we authorise Lashvae to{' '}
                {dsarType === 'delete'
                  ? 'delete'
                  : dsarType === 'export'
                    ? 'export'
                    : 'process'}{' '}
                the identified data.
              </span>
            </label>

            <div className='mt-4 rounded-xl border border-brand-500/20 bg-brand-50 p-4 type-small text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'>
              As processor, Lashvae acts only on documented instructions from
              you as the controller and will assist with data-subject requests
              accordingly.
            </div>

            {dsarStatus === 'success' && (
              <div className='mt-4'>
                <AlertBox tone='success'>
                  Customer data request submitted successfully.
                </AlertBox>
              </div>
            )}

            {dsarStatus === 'error' && (
              <div className='mt-4'>
                <AlertBox>
                  Unable to submit the customer data request. Please try again.
                </AlertBox>
              </div>
            )}

            <div className='mt-5 flex justify-end'>
              <Button
                type='button'
                disabled={!canSubmitDsar}
                onClick={() => void handleDsarSubmit()}
                className='h-10 px-5'
              >
                {dsarSending && <Loader2 className='h-4 w-4 animate-spin' />}
                Submit Data Request
                {!dsarSending && <ChevronRight className='h-4 w-4' />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}


function LoadingProfile() {
  return (
    <div className='mx-auto max-w-screen-2xl p-4 md:p-6'>
      <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 lg:p-6'>
        <div className='mb-5 h-6 w-24 animate-pulse rounded-(--radius-control) bg-gray-100 dark:bg-white/5 lg:mb-7' />
        <div className='space-y-6'>
          <div className='h-37 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5' />
          <div className='h-105 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5' />
        </div>
      </div>
    </div>
  );
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const billingRequested = searchParams.get('billing') === 'True' || searchParams.get('billing') === 'true';
  const requestedNav = searchParams.get('activeNav') as NavId | null;
  const initialNav =
    requestedNav && NAV.some((item) => item.id === requestedNav)
      ? requestedNav
      : billingRequested
        ? 'subscription'
        : 'overview';
  const [activeNav, setActiveNav] = useState<NavId>(initialNav);
  const [me, setMe] = useState<MeResp | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [fetchErr, setFetchErr] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);




  const loadProfile = useCallback(async () => {
    setFetchErr('');
    try {
      const data = await apiFetch<MeResp>('/admin/profile/me', { auth: true });
      setMe(data);
      setPhotoUrl(data.user.avatar_url);
    } catch (error) {
      setFetchErr(errorMessage(error, 'Failed to load profile.'));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadProfile();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadProfile]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);

    check();
    window.addEventListener('resize', check);

    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div className='mx-auto max-w-screen-2xl p-4 md:p-6'>
      <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3 lg:p-6'>
        <div className='mb-5 flex items-center gap-3 lg:mb-7'>
          <button
            type='button'
            onClick={() => router.push('/settings')}
            className='flex h-9 w-9 items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400 dark:hover:bg-white/5'
            aria-label='Back to settings'
          >
            <ArrowLeft className='h-4.5 w-4.5' />
          </button>
          <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
            Profile
          </h3>
        </div>

        {fetchErr && (
          <div className='mb-6'>
            <AlertBox>{fetchErr}</AlertBox>
          </div>
        )}

        {!me && !fetchErr ? (
          <div className='space-y-6'>
            <div className='h-37 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5' />
            <div className='h-105 animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5' />
          </div>
        ) : me ? (
          <div className='space-y-6'>
            <MetaCard me={me} photoUrl={photoUrl} setPhotoUrl={setPhotoUrl} />

            <div className='grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr] lg:items-start'>
              <div>
                {isMobile && (
                  <button
                    type='button'
                    onClick={() => setProfileMenuOpen((p) => !p)}
                    className='mb-3 flex h-10 w-full items-center justify-between rounded-(--radius-control) border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400 dark:hover:bg-white/3'
                  >
                    <span>Profile Menu</span>
                    <Menu size={18} />
                  </button>
                )}

                {(!isMobile || profileMenuOpen) && (
                  <div className='rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3'>
                    <div className='border-b border-gray-100 px-5 py-4 dark:border-gray-800'>
                      <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                        Profile
                      </h3>
                      <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                        Manage account preferences
                      </p>
                    </div>

                    <div className='flex flex-col gap-1 p-3'>
                      {NAV.map((item) => {
                        const active = activeNav === item.id;

                        return (
                          <button
                            key={item.id}
                            type='button'
                            onClick={() => {
                              setActiveNav(item.id);
                              setProfileMenuOpen(false);
                            }}
                            className={cn(
                              'flex w-full items-center justify-between gap-3 rounded-(--radius-control) px-3 py-3 text-left transition',
                              active
                                ? 'bg-brand-50 dark:bg-brand-500/12'
                                : 'hover:bg-gray-50 dark:hover:bg-white/3',
                            )}
                          >
                            <span className='flex items-center gap-3'>
                              <span
                                className={cn(
                                  'flex h-9 w-9 items-center justify-center rounded-(--radius-control)',
                                  active
                                    ? 'bg-white text-brand-500 shadow-theme-xs dark:bg-white/10 dark:text-brand-400'
                                    : 'text-gray-500 dark:text-gray-400',
                                )}
                              >
                                {item.icon}
                              </span>

                              <span
                                className={cn(
                                  'block type-small font-semibold',
                                  active
                                    ? 'text-brand-500 dark:text-brand-400'
                                    : 'text-gray-700 dark:text-gray-300',
                                )}
                              >
                                {item.label}
                              </span>
                            </span>

                            <ChevronRight
                              size={16}
                              className={cn(
                                'shrink-0',
                                active
                                  ? 'text-brand-400'
                                  : 'text-gray-300 dark:text-gray-600',
                              )}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className='min-w-0'>
                {activeNav === 'overview' && <OverviewTab me={me} />}
                {activeNav === 'details' && <DetailsTab me={me} />}
                {activeNav === 'security' && <SecurityTab />}
                {activeNav === 'subscription' && <SubscriptionTab me={me} />}
                {activeNav === 'support' && <SupportPanel />}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<LoadingProfile />}>
        <ProfileContent />
      </Suspense>
    </RequireAuth>
  );
}
