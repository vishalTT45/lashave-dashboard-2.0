'use client';

import { RequireAuth } from '@/components/require-auth';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/roles';
import { useEffect, useRef, useState } from 'react';

type Override = {
  conversations_per_month: number | null;
  growth_reports_enabled: boolean | null;
  custom_price_lookup_key: string | null;
  custom_price_amount: number | null; // minor units (pence/cents/paise)
  custom_price_currency: string | null; // usd|gbp|inr
  custom_billing_cycle: string | null; // monthly|annual
  stripe_price_id: string | null;
  stripe_payment_link_url: string | null;
  notes: string | null;
  is_active: boolean;
  updated_at?: string;
};

type EffectiveLimits = {
  name: string;
  conversations_per_month: number;
  growth_reports_enabled: boolean;
  booking_enabled: boolean;
  widget_enabled: boolean;
};

type PricingResp = {
  tenant_id: string;
  plan_id: string;
  subscription_status: string;
  effective_limits: EffectiveLimits;
  override: Override | null;
};

type UpsertResp = {
  tenant_id: string;
  override: Override;
  effective_limits: EffectiveLimits;
};

type SearchResult = {
  tenant_id: string;
  name: string;
  status: string;
  plan_id: string;
  email: string | null;
};

type PriceCurrency = '' | 'usd' | 'gbp' | 'inr';
type BillingCycle = '' | 'monthly' | 'annual';

const EMPTY_FORM = {
  conversations_per_month: '' as string | number,
  growth_reports_enabled: '' as '' | 'true' | 'false',
  custom_price_lookup_key: '',
  // Price is entered in MAJOR units (e.g. 2000 = £2,000); converted to minor on save.
  custom_price_amount: '' as string | number,
  custom_price_currency: '' as PriceCurrency,
  custom_billing_cycle: '' as BillingCycle,
  notes: '',
  is_active: true,
};

// ---------------------------------------------------------------------------
// Small shared helpers (mirrors the tenant page's Field component)
// ---------------------------------------------------------------------------

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className='mb-1.5 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
        {label}
      </label>
      {children}
      {hint && (
        <p className='mt-1 type-caption text-gray-400 dark:text-gray-500'>
          {hint}
        </p>
      )}
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className='col-span-full type-caption font-semibold uppercase tracking-wide text-gray-400'>
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-white/10 dark:bg-white/3'>
      <div className='type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
        {label}
      </div>
      <div className='mt-1 text-lg font-bold capitalize text-gray-900 dark:text-white/90'>
        {value}
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  trialing: 'primary',
  active: 'success',
  expired: 'error',
  canceled: 'error',
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

function PricingForm() {
  const { me } = useAuth();

  const [tenantId, setTenantId] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<PricingResp | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [creditForm, setCreditForm] = useState({
    credits: '',
    validity_days: '182',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  }

  function hydrateForm(ov: Override | null) {
    if (!ov) {
      setForm({ ...EMPTY_FORM });
      return;
    }
    setForm({
      conversations_per_month: ov.conversations_per_month ?? '',
      growth_reports_enabled:
        ov.growth_reports_enabled === null
          ? ''
          : ov.growth_reports_enabled
            ? 'true'
            : 'false',
      custom_price_lookup_key: ov.custom_price_lookup_key ?? '',
      custom_price_amount:
        ov.custom_price_amount != null ? ov.custom_price_amount / 100 : '',
      custom_price_currency: (ov.custom_price_currency as PriceCurrency | null) ?? '',
      custom_billing_cycle: (ov.custom_billing_cycle as BillingCycle | null) ?? '',
      notes: ov.notes ?? '',
      is_active: ov.is_active,
    });
  }

  async function loadTenant(e?: React.FormEvent) {
    e?.preventDefault();
    const id = tenantId.trim();
    if (!id) return;
    await loadById(id);
  }

  async function loadById(id: string) {
    setLoading(true);
    setError('');
    setData(null);
    setShowResults(false);
    try {
      const resp = await apiFetch<PricingResp>(
        `/admin/super/tenants/${encodeURIComponent(id)}/pricing`,
        { auth: true },
      );
      setData(resp);
      setTenantId(id);
      hydrateForm(resp.override);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load tenant');
    } finally {
      setLoading(false);
    }
  }

  // Debounced search by email / name / id.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      // Resets local UI-only state (a flag, warning, or preview value)
      // when the relevant prop/dependency changes — not deriving render
      // output from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await apiFetch<{ results: SearchResult[] }>(
          `/admin/super/tenants/search?q=${encodeURIComponent(q)}`,
          { auth: true },
        );
        setResults(r.results || []);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close results on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  async function saveOverride() {
    if (!data) return;
    setBusy('save');
    setError('');
    try {
      // Only send fields that are set; blanks mean "no override for this field".
      const body: {
        is_active: boolean;
        conversations_per_month?: number | null;
        growth_reports_enabled?: boolean | null;
        custom_price_lookup_key?: string | null;
        custom_price_amount?: number | null;
        custom_price_currency?: PriceCurrency | null;
        custom_billing_cycle?: BillingCycle | null;
        notes?: string | null;
      } = { is_active: form.is_active };
      body.conversations_per_month =
        form.conversations_per_month === ''
          ? null
          : Number(form.conversations_per_month);
      body.growth_reports_enabled =
        form.growth_reports_enabled === ''
          ? null
          : form.growth_reports_enabled === 'true';
      body.custom_price_lookup_key =
        form.custom_price_lookup_key.trim() || null;
      // Price entered in major units → store minor (×100). Blank = clear.
      body.custom_price_amount =
        form.custom_price_amount === ''
          ? null
          : Math.round(Number(form.custom_price_amount) * 100);
      body.custom_price_currency = form.custom_price_currency || null;
      body.custom_billing_cycle = form.custom_billing_cycle || null;
      body.notes = form.notes.trim() || null;

      const resp = await apiFetch<UpsertResp>(
        `/admin/super/tenants/${encodeURIComponent(data.tenant_id)}/pricing`,
        { auth: true, method: 'PUT', body },
      );
      setData({
        ...data,
        override: resp.override,
        effective_limits: resp.effective_limits,
      });
      hydrateForm(resp.override);
      flash('Deal saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save deal');
    } finally {
      setBusy(null);
    }
  }

  // Create the Stripe price + payment link for the negotiated deal, using the
  // amount/currency/cycle currently in the form (so it works before/after save).
  async function generateLink() {
    if (!data) return;
    const amountMajor = Number(form.custom_price_amount);
    if (
      !form.custom_price_amount ||
      !Number.isFinite(amountMajor) ||
      amountMajor <= 0
    ) {
      setError('Enter a price amount before generating a payment link.');
      return;
    }
    if (!form.custom_price_currency) {
      setError('Pick a currency for the deal.');
      return;
    }
    if (!form.custom_billing_cycle) {
      setError('Pick a billing cycle (monthly or annual).');
      return;
    }
    setBusy('deal-link');
    setError('');
    try {
      const resp = await apiFetch<{ payment_link_url: string }>(
        `/admin/super/tenants/${encodeURIComponent(data.tenant_id)}/deal-link`,
        {
          auth: true,
          method: 'POST',
          body: {
            amount: Math.round(amountMajor * 100),
            currency: form.custom_price_currency,
            billing_cycle: form.custom_billing_cycle,
          },
        },
      );
      // Reload so the stored link shows in the "current deal" section.
      await loadById(data.tenant_id);
      flash('Payment link created.');
      // Surface it immediately too.
      if (resp?.payment_link_url) {
        try {
          await navigator.clipboard?.writeText(resp.payment_link_url);
        } catch {}
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create payment link');
    } finally {
      setBusy(null);
    }
  }

  async function removeOverride() {
    if (!data) return;
    if (!confirm('Remove the negotiated override for this tenant?')) return;
    setBusy('delete');
    setError('');
    try {
      await apiFetch(
        `/admin/super/tenants/${encodeURIComponent(data.tenant_id)}/pricing`,
        {
          auth: true,
          method: 'DELETE',
        },
      );
      flash('Override removed.');
      await loadTenant();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove override');
    } finally {
      setBusy(null);
    }
  }

  async function grantCredits() {
    if (!data) return;
    const credits = Number(creditForm.credits);
    if (!credits || credits <= 0) {
      setError('Enter a positive number of credits.');
      return;
    }
    setBusy('credits');
    setError('');
    try {
      const body: { credits: number; validity_days?: number; notes?: string } = { credits };
      if (creditForm.validity_days)
        body.validity_days = Number(creditForm.validity_days);
      if (creditForm.notes.trim()) body.notes = creditForm.notes.trim();

      const resp = await apiFetch<{ granted: number; expires_at: string }>(
        `/admin/super/tenants/${encodeURIComponent(data.tenant_id)}/credits`,
        { auth: true, method: 'POST', body },
      );
      flash(
        `Granted ${resp.granted.toLocaleString()} credits (expires ${new Date(
          resp.expires_at,
        ).toLocaleDateString()}).`,
      );
      setCreditForm({ credits: '', validity_days: '182', notes: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to grant credits');
    } finally {
      setBusy(null);
    }
  }

  if (!me) return null;
  if (!isSuperAdmin(me.user.role)) {
    return (
      <div className='mx-auto max-w-lg py-16'>
        <Alert
          variant='error'
          title='Access denied'
          message="You don't have permission to view this page."
        />
      </div>
    );
  }

  const el = data?.effective_limits;

  return (
    <div className='mx-auto max-w-3xl'>
      <div className='mb-6'>
        <Badge variant='light' color='primary' className='mb-2'>
          Super Admin
        </Badge>
        <h1 className='text-title-sm font-bold text-gray-900 dark:text-white/90'>
          Enterprise &amp; custom deals
        </h1>
        <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
          Set what a customer gets — their conversation limit, features, and any
          free credits — and record which Stripe price you agreed for the deal.
        </p>
      </div>

      {/* How this works */}
      <div className='mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 type-small leading-relaxed text-gray-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-gray-300'>
        <strong className='font-semibold text-blue-700 dark:text-blue-300'>
          How this works:
        </strong>{' '}
        this page controls a customer&rsquo;s <em>limits</em>. The actual amount
        they&rsquo;re charged is set up in Stripe. You create the custom price
        in the Stripe dashboard, then paste its name here so the deal is linked
        to this customer. Anything you set here beats their normal plan and
        trial.
      </div>

      {toast && <Alert variant='success' title='Done' message={toast} />}
      {error && (
        <Alert variant='error' title='Error' message={error} />
      )}

      {/* Tenant lookup — search by email / name, or load by exact ID */}
      <div className='relative mb-3' ref={searchRef}>
        <label className='mb-1.5 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400'>
          Find a customer
        </label>
        <Input
          placeholder='Type an email, business name, or ID and pick from the list…'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length && setShowResults(true)}
        />
        {searching && (
          <div className='absolute right-3 top-9 type-caption text-gray-400 dark:text-gray-500'>
            Searching…
          </div>
        )}

        {showResults && results.length > 0 && (
          <div className='absolute left-0 right-0 z-20 mt-1 max-h-85 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-gray-900'>
            {results.map((r) => (
              <button
                key={r.tenant_id}
                type='button'
                className='block w-full border-b border-gray-100 px-3.5 py-2.5 text-left last:border-b-0 hover:bg-gray-50 dark:border-white/5 dark:hover:bg-white/5'
                onClick={() => {
                  setQuery('');
                  loadById(r.tenant_id);
                }}
              >
                <div className='flex items-center gap-2'>
                  <span className='type-small font-bold text-gray-900 dark:text-white/90'>
                    {r.name || r.tenant_id}
                  </span>
                  <Badge
                    variant='light'
                    // color={STATUS_COLOR[r.status] ?? 'gray'}
                  >
                    {r.status}
                  </Badge>
                </div>
                <div className='mt-0.5 type-caption text-gray-500 dark:text-gray-400'>
                  {r.email || '—'} · {r.plan_id || 'no plan'} · {r.tenant_id}
                </div>
              </button>
            ))}
          </div>
        )}

        {showResults &&
          !searching &&
          results.length === 0 &&
          query.trim().length >= 2 && (
            <div className='absolute left-0 right-0 z-20 mt-1 rounded-xl border border-gray-200 bg-white p-3.5 type-small text-gray-500 shadow-2xl dark:border-white/10 dark:bg-gray-900 dark:text-gray-400'>
              No tenants match &ldquo;{query}&rdquo;
            </div>
          )}
      </div>

      {/* Exact-ID lookup */}
      <details className='mb-6'>
        <summary className='cursor-pointer select-none py-1 type-caption font-semibold text-gray-500 hover:text-primary dark:text-gray-400'>
          Know the exact ID? Open it directly
        </summary>
        <form onSubmit={loadTenant} className='mt-2.5 flex gap-2.5'>
          <Input
            placeholder='Paste an exact tenant ID'
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          />
          <Button type='submit' disabled={loading || !tenantId.trim()}>
            {loading ? 'Loading…' : 'Open'}
          </Button>
        </form>
      </details>

      {data && el && (
        <div className='space-y-5'>
          {/* Current effective state */}
          <Card>
            <CardContent className='space-y-4 pt-0'>
              <p className='type-caption font-semibold uppercase tracking-wide text-gray-400'>
                What this customer gets right now
              </p>
              <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
                <Stat label='Plan' value={data.plan_id} />
                <Stat label='Status' value={data.subscription_status} />
                <Stat
                  label='Conversations / mo'
                  value={el.conversations_per_month.toLocaleString()}
                />
                <Stat
                  label='Growth reports'
                  value={el.growth_reports_enabled ? 'On' : 'Off'}
                />
              </div>
              <p className='type-caption text-gray-500 dark:text-gray-400'>
                {data.override
                  ? data.override.is_active
                    ? `Custom deal applied${
                        data.override.updated_at
                          ? ` · updated ${new Date(data.override.updated_at).toLocaleString()}`
                          : ''
                      }`
                    : 'A custom deal is saved but switched off'
                  : 'No custom deal — using their standard plan'}
              </p>
            </CardContent>
          </Card>

          {/* Custom deal editor */}
          <Card>
            <CardContent className='space-y-4 pt-0'>
              <div>
                <p className='type-caption font-semibold uppercase tracking-wide text-gray-400'>
                  Set up the deal
                </p>
                <p className='mt-1 type-caption text-gray-400 dark:text-gray-500'>
                  Fill in only what&rsquo;s different from their normal plan.
                  Blank fields keep the plan default.
                </p>
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <GroupLabel>Limits &amp; features</GroupLabel>
                <Field
                  label='Conversations per month'
                  hint="How many conversations they get each month. Leave blank to use their plan's normal amount."
                >
                  <Input
                    type='number'
                    min={0}
                    placeholder='e.g. 25000'
                    value={form.conversations_per_month ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        conversations_per_month: e.target.value,
                      })
                    }
                  />
                </Field>

                <Field
                  label='Growth reports / AI consultant'
                  hint='Force this feature on or off regardless of their plan.'
                >
                  <select
                    className='flex h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 type-small text-gray-900 focus:border-primary focus:outline-none dark:border-white/10 dark:text-white/90'
                    value={form.growth_reports_enabled ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        growth_reports_enabled: e.target.value as
                          | ''
                          | 'true'
                          | 'false',
                      })
                    }
                  >
                    <option value=''>Use plan default</option>
                    <option value='true'>Turn on</option>
                    <option value='false'>Turn off</option>
                  </select>
                </Field>

                <GroupLabel>Negotiated price</GroupLabel>
                <Field
                  label='Price'
                  hint='The whole amount they pay each billing period (not per conversation). E.g. 2000 = £2,000 / mo.'
                >
                  <Input
                    type='number'
                    min={0}
                    step='0.01'
                    placeholder='e.g. 2000'
                    value={form.custom_price_amount ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, custom_price_amount: e.target.value })
                    }
                  />
                </Field>

                <Field
                  label='Currency'
                  hint="If they've paid before, this must match their locked currency."
                >
                  <select
                    className='flex h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 type-small text-gray-900 focus:border-primary focus:outline-none dark:border-white/10 dark:text-white/90'
                    value={form.custom_price_currency ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        custom_price_currency: e.target.value as PriceCurrency,
                      })
                    }
                  >
                    <option value=''>Choose…</option>
                    <option value='gbp'>GBP (£)</option>
                    <option value='usd'>USD ($)</option>
                    <option value='inr'>INR (₹)</option>
                  </select>
                </Field>

                <Field label='Billing cycle' hint="How often they're charged.">
                  <select
                    className='flex h-10 w-full rounded-lg border border-gray-200 bg-transparent px-3 type-small text-gray-900 focus:border-primary focus:outline-none dark:border-white/10 dark:text-white/90'
                    value={form.custom_billing_cycle ?? ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        custom_billing_cycle: e.target.value as BillingCycle,
                      })
                    }
                  >
                    <option value=''>Choose…</option>
                    <option value='monthly'>Monthly</option>
                    <option value='annual'>Annual</option>
                  </select>
                </Field>

                <GroupLabel>Deal settings</GroupLabel>
                <label className='col-span-full flex items-center gap-2 py-1'>
                  <input
                    type='checkbox'
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                  />
                  <span className='type-small font-semibold text-gray-700 dark:text-gray-300'>
                    Apply this deal now
                  </span>
                </label>

                <Field
                  label='Internal notes'
                  hint='Only your team sees this.'
                  className='col-span-full'
                >
                  <Textarea
                    rows={2}
                    placeholder='Who approved it, contract reference, anything future-you will want…'
                    value={form.notes ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                  />
                </Field>
              </div>

              <div className='flex flex-wrap gap-2.5'>
                <Button onClick={saveOverride} disabled={busy !== null}>
                  {busy === 'save' ? 'Saving…' : 'Save deal'}
                </Button>
                <Button
                  variant='outline'
                  onClick={generateLink}
                  disabled={busy !== null}
                  title='Creates the Stripe price and a payable link to send the customer'
                >
                  {busy === 'deal-link' ? 'Creating…' : 'Create payment link'}
                </Button>
                {data.override && (
                  <Button
                    variant='destructive'
                    onClick={removeOverride}
                    disabled={busy !== null}
                  >
                    {busy === 'delete' ? 'Removing…' : 'Remove deal'}
                  </Button>
                )}
              </div>

              {data.override?.stripe_payment_link_url && (
                <div className='rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3.5 dark:border-emerald-500/30 dark:bg-emerald-500/10'>
                  <p className='mb-2 type-caption font-semibold text-emerald-700 dark:text-emerald-300'>
                    Payment link — send this to the customer
                  </p>
                  <div className='flex items-stretch gap-2'>
                    <Input
                      readOnly
                      value={data.override.stripe_payment_link_url ?? ''}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <Button
                      variant='outline'
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          data.override!.stripe_payment_link_url!,
                        );
                        flash('Link copied.');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className='mt-1 type-caption text-gray-400 dark:text-gray-500'>
                    When they pay, their plan activates automatically and the
                    conversation limit above applies. Creating a new link
                    replaces this one.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grant credits */}
          <Card>
            <CardContent className='space-y-4 pt-0'>
              <div>
                <p className='type-caption font-semibold uppercase tracking-wide text-gray-400'>
                  Give free conversation credits
                </p>
                <p className='mt-1 type-caption text-gray-400 dark:text-gray-500'>
                  Hand out extra conversations for free — e.g. onboarding
                  goodwill or a comp. They&rsquo;re used only after the monthly
                  plan runs out, and they expire on the date below.
                </p>
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <Field label='Credits'>
                  <Input
                    type='number'
                    min={1}
                    placeholder='e.g. 5000'
                    value={creditForm.credits ?? ''}
                    onChange={(e) =>
                      setCreditForm({ ...creditForm, credits: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label='Validity (days)'
                  hint='How long until they expire. 182 ≈ 6 months.'
                >
                  <Input
                    type='number'
                    min={1}
                    value={creditForm.validity_days ?? ''}
                    onChange={(e) =>
                      setCreditForm({
                        ...creditForm,
                        validity_days: e.target.value,
                      })
                    }
                  />
                </Field>
                <Field label='Notes (internal)' className='col-span-full'>
                  <Input
                    placeholder='Reason for comp…'
                    value={creditForm.notes ?? ''}
                    onChange={(e) =>
                      setCreditForm({ ...creditForm, notes: e.target.value })
                    }
                  />
                </Field>
              </div>

              <div className='flex gap-2.5'>
                <Button
                  variant='outline'
                  onClick={grantCredits}
                  disabled={busy !== null}
                >
                  {busy === 'credits' ? 'Granting…' : 'Grant credits'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminPricingPage() {
  return (
    <RequireAuth>
      <PricingForm />
    </RequireAuth>
  );
}
