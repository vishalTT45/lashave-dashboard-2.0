'use client';

import { apiFetch } from '@/lib/api';
import { CalendarDays, ChevronLeft, Info, Plus, Power, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type ReservationDateRange = { start_date: string; end_date: string };
export type ReservationSettings = {
  booking_type: 'reservation';
  booking_enabled: boolean;
  booking_timezone: string;
  booking_completion_mode: 'manual' | 'automatic';
  reservation_min_nights: number;
  reservation_max_nights: number | null;
  reservation_available_ranges: ReservationDateRange[];
};

type BlockedRange = ReservationDateRange & { id: number; reason: string | null };
type DraftRange = ReservationDateRange & { key: string };
type DraftBlock = DraftRange & { id?: number; reason: string | null };
type FormState = {
  enabled: boolean;
  timezone: string;
  completion: 'manual' | 'automatic';
  minNights: string;
  maxNights: string;
  available: DraftRange[];
};

type Props = {
  initialSettings: ReservationSettings;
  isDark: boolean;
  onClose: () => void;
  onBack: () => void;
  onSaved: (settings: ReservationSettings) => void;
  onBusyChange: (busy: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
};

const BLOCKS_URL = '/admin/booking/reservation/blocked-ranges';
const SETTINGS_URL = '/admin/booking/settings';
const TIMEZONES = ['Asia/Kolkata', 'Europe/London', 'Asia/Dubai', 'Asia/Singapore', 'America/New_York', 'UTC'];

function makeForm(settings: ReservationSettings): FormState {
  return {
    enabled: settings.booking_enabled,
    timezone: settings.booking_timezone || 'Asia/Kolkata',
    completion: settings.booking_completion_mode,
    minNights: String(settings.reservation_min_nights),
    maxNights: settings.reservation_max_nights === null ? '' : String(settings.reservation_max_nights),
    available: settings.reservation_available_ranges.map((range, i) => ({ ...range, key: `saved-${i}` })),
  };
}

function blockDrafts(items: BlockedRange[]): DraftBlock[] {
  return items.map((item) => ({ ...item, reason: item.reason || null, key: `block-${item.id}` }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request failed. Please try again.';
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validateRanges(ranges: ReservationDateRange[], label: string) {
  for (const [index, range] of ranges.entries()) {
    if (!validDate(range.start_date) || !validDate(range.end_date)) {
      throw new Error(`${label} ${index + 1}: select both dates, or remove the empty row.`);
    }
    if (range.end_date <= range.start_date) {
      throw new Error(`${label} ${index + 1}: end date must be after start date.`);
    }
  }
}

function toPayload(form: FormState): ReservationSettings {
  const minimum = Number(form.minNights);
  const maximum = form.maxNights.trim() === '' ? null : Number(form.maxNights);
  if (!form.minNights.trim() || !Number.isSafeInteger(minimum) || minimum < 1) {
    throw new Error('Minimum nights must be a whole number of at least 1.');
  }
  if (maximum !== null && (!Number.isSafeInteger(maximum) || maximum < minimum)) {
    throw new Error('Maximum nights must be a whole number at least equal to minimum nights.');
  }
  try { new Intl.DateTimeFormat('en', { timeZone: form.timezone }); }
  catch { throw new Error('Select a valid timezone.'); }
  validateRanges(form.available, 'Available range');
  return {
    booking_type: 'reservation',
    booking_enabled: form.enabled,
    booking_timezone: form.timezone,
    booking_completion_mode: form.completion,
    reservation_min_nights: minimum,
    reservation_max_nights: maximum,
    reservation_available_ranges: form.available.map(({ start_date, end_date }) => ({ start_date, end_date })),
  };
}

export default function ReservationBookingCard({ initialSettings, isDark, onClose, onBack, onSaved, onBusyChange, onDirtyChange }: Props) {
  const [form, setForm] = useState(() => makeForm(initialSettings));
  const [blocks, setBlocks] = useState<DraftBlock[]>([]);
  const [blockStatus, setBlockStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [retryLoad, setRetryLoad] = useState(0);
  const [busy, setBusy] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const savedForm = useRef(JSON.stringify(makeForm(initialSettings)));
  const savedBlocks = useRef<BlockedRange[]>([]);
  const nextKey = useRef(0);
  const inFlight = useRef(false);
  const dirty = JSON.stringify(form) !== savedForm.current ||
    JSON.stringify(blocks) !== JSON.stringify(blockDrafts(savedBlocks.current));

  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => {
    let cancelled = false;
    setBlockStatus('loading');
    setError('');
    apiFetch<{ items: BlockedRange[] }>(BLOCKS_URL, { auth: true })
      .then((response) => {
        if (cancelled) return;
        if (!Array.isArray(response.items)) throw new Error('Invalid blocked-range response.');
        savedBlocks.current = response.items;
        setBlocks(blockDrafts(response.items));
        setBlockStatus('ready');
      })
      .catch((failure: unknown) => {
        if (!cancelled) { setError(`Could not load blocked ranges. ${errorMessage(failure)}`); setBlockStatus('error'); }
      });
    return () => { cancelled = true; };
  }, [retryLoad]);

  async function reloadSaved() {
    const [settings, response] = await Promise.all([
      apiFetch<ReservationSettings>(SETTINGS_URL, { auth: true }),
      apiFetch<{ items: BlockedRange[] }>(BLOCKS_URL, { auth: true }),
    ]);
    if (settings.booking_type !== 'reservation') throw new Error('Booking type changed. Close and reopen General Settings.');
    if (!Array.isArray(settings.reservation_available_ranges) || !Array.isArray(response.items)) {
      throw new Error('The server did not return the reservation range fields. Check the deployed API.');
    }
    const next = makeForm(settings);
    savedForm.current = JSON.stringify(next);
    savedBlocks.current = response.items;
    setForm(next);
    setBlocks(blockDrafts(response.items));
    setBlockStatus('ready');
    setNeedsReload(false);
    onSaved(settings);
  }

  async function save() {
    if (inFlight.current || needsReload || blockStatus !== 'ready') return;
    setError('');
    setMessage('');
    let payload: ReservationSettings;
    try { payload = toPayload(form); validateRanges(blocks, 'Blocked range'); }
    catch (failure) { setError(errorMessage(failure)); return; }

    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    let writeAttempted = false;
    try {
      // Block endpoints are independent transactions. Add new/replacement blocks
      // before opening dates, and delete removed blocks only after settings save.
      // Never assume a failed multi-request save was rolled back by the server.
      const keptIds = new Set<number>();
      for (const item of blocks) {
        const previous = savedBlocks.current.find((old) => old.id === item.id);
        if (previous && previous.start_date === item.start_date && previous.end_date === item.end_date &&
            (previous.reason || null) === (item.reason || null)) {
          keptIds.add(previous.id);
          continue;
        }
        writeAttempted = true;
        const created = await apiFetch<BlockedRange>(BLOCKS_URL, {
          method: 'POST', auth: true,
          body: { start_date: item.start_date, end_date: item.end_date, reason: item.reason || null },
        });
        if (!Number.isInteger(created.id)) throw new Error('The server did not return a blocked-range ID.');
        keptIds.add(created.id);
      }
      writeAttempted = true;
      await apiFetch(SETTINGS_URL, { method: 'PUT', auth: true, body: payload });
      for (const previous of savedBlocks.current) {
        if (!keptIds.has(previous.id)) {
          await apiFetch(`${BLOCKS_URL}/${previous.id}`, { method: 'DELETE', auth: true });
        }
      }
      // Read canonical open ranges back: the API merges overlapping/adjacent rows.
      await reloadSaved();
      setMessage('Booking settings saved.');
    } catch (failure) {
      setNeedsReload(writeAttempted);
      setError(`${errorMessage(failure)}${writeAttempted ? ' Some changes may already be saved. Reload saved values before trying again.' : ''}`);
    } finally {
      inFlight.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function recover() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    onBusyChange(true);
    try {
      await reloadSaved();
      setError('');
      setMessage('Saved values reloaded. Review them before saving any remaining changes.');
    } catch (failure) { setError(errorMessage(failure)); }
    finally { inFlight.current = false; setBusy(false); onBusyChange(false); }
  }

  const locked = busy || needsReload;
  const variables = {
    '--r-bg': isDark ? '#171e39' : '#ffffff',
    '--r-panel': isDark ? 'rgba(255,255,255,.045)' : '#f8fafc',
    '--r-input': isDark ? '#11162d' : '#ffffff',
    '--r-border': isDark ? 'rgba(151,163,218,.22)' : '#dbe1ea',
    '--r-text': isDark ? '#f8fafc' : '#0f172a',
    '--r-sub': isDark ? '#adb4c7' : '#64748b',
    '--r-accent': isDark ? '#ff7918' : '#ea580c',
    colorScheme: isDark ? 'dark' : 'light',
  } as CSSProperties;

  return (
    <section className='reservation-settings' style={variables} aria-label='Reservation booking settings'>
      <style>{`
        .reservation-settings { background:var(--r-bg); color:var(--r-text); border:1px solid var(--r-border); border-radius:20px; padding:24px; }
        .reservation-settings * { box-sizing:border-box; }
        .reservation-settings .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
        .reservation-settings button,.reservation-settings input,.reservation-settings select { font:inherit; }
        .reservation-settings button { cursor:pointer; }
        .reservation-settings button:disabled { cursor:not-allowed; opacity:.55; }
        .reservation-settings :is(button,input,select):focus-visible { outline:2px solid var(--r-accent); outline-offset:3px; }
        .reservation-settings .r-head,.reservation-settings .r-section-head,.reservation-settings .r-footer { display:flex; justify-content:space-between; gap:16px; align-items:center; flex-wrap:wrap; }
        .reservation-settings .r-head { align-items:flex-start; }
        .reservation-settings .r-badge { display:inline-flex; gap:8px; align-items:center; color:var(--r-accent); font-size:12px; font-weight:700; border:1px solid #f973164d; border-radius:10px; padding:7px 10px; margin-bottom:12px; }
        .reservation-settings h3 { margin:0 0 8px; font-size:26px; letter-spacing:-.03em; }
        .reservation-settings h4 { display:flex; align-items:center; gap:10px; margin:0; font-size:16px; }
        .reservation-settings p { color:var(--r-sub); font-size:13px; line-height:1.6; margin:0; }
        .reservation-settings .r-icon,.reservation-settings .r-secondary,.reservation-settings .r-primary,.reservation-settings .r-enabled { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:42px; border-radius:11px; padding:9px 13px; font-weight:700; border:1px solid var(--r-border); background:var(--r-panel); color:var(--r-text); }
        .reservation-settings .r-primary,.reservation-settings .r-enabled[aria-checked=true] { background:linear-gradient(135deg,#ff7918,#ed5900); border-color:transparent; color:white; }
        .reservation-settings .r-enabled { border-radius:999px; }
        .reservation-settings .r-secondary { color:var(--r-accent); border-color:#f9731680; font-size:13px; }
        .reservation-settings .r-icon { padding:9px; }
        .reservation-settings .r-link { display:inline-flex; gap:5px; align-items:center; border:0; padding:0; background:none; color:var(--r-sub); font-size:12px; margin:12px 0 4px; }
        .reservation-settings fieldset { border:0; margin:0; padding:0; min-width:0; }
        .reservation-settings .r-section { margin-top:18px; background:var(--r-panel); border:1px solid var(--r-border); border-radius:16px; padding:18px; }
        .reservation-settings .r-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) 38px; gap:14px; align-items:end; margin-top:16px; }
        .reservation-settings label { display:flex; flex-direction:column; gap:8px; color:var(--r-sub); font-size:13px; min-width:0; }
        .reservation-settings input,.reservation-settings select { width:100%; min-width:0; min-height:44px; padding:10px 12px; color:var(--r-text); background:var(--r-input); border:1px solid var(--r-border); border-radius:10px; }
        .reservation-settings .r-limits { display:grid; grid-template-columns:1fr 1fr 1.3fr; gap:16px; margin:22px 0; }
        .reservation-settings .r-hint { display:flex; gap:8px; margin-top:14px; font-size:12px; }
        .reservation-settings .r-hint svg { flex-shrink:0; margin-top:2px; }
        .reservation-settings .r-modes { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:13px; }
        .reservation-settings .r-mode { text-align:left; padding:16px; min-height:90px; border:1px solid var(--r-border); border-radius:14px; background:var(--r-panel); color:var(--r-text); }
        .reservation-settings .r-mode[aria-pressed=true] { border-color:var(--r-accent); background:#f9731614; }
        .reservation-settings .r-mode strong { display:block; margin-bottom:7px; font-size:14px; }
        .reservation-settings .r-footer { border-top:1px solid var(--r-border); padding-top:18px; margin-top:22px; }
        .reservation-settings .r-alert { border:1px solid #f8717170; background:#ef444414; border-radius:10px; padding:12px; margin-top:14px; color:var(--r-text); font-size:13px; line-height:1.6; }
        .reservation-settings .r-success { margin-top:14px; color:var(--r-text); font-size:13px; }
        @media(max-width:620px) { .reservation-settings { padding:16px; } .reservation-settings .r-limits,.reservation-settings .r-modes { grid-template-columns:1fr; } .reservation-settings .r-row { grid-template-columns:minmax(0,1fr) 38px; } .reservation-settings .r-row label:first-child { grid-column:1 / -1; } .reservation-settings .r-section { padding:14px; } .reservation-settings h3 { font-size:23px; } }
      `}</style>

      <div className='r-head'>
        <div>
          <span className='r-badge'><CalendarDays size={14} /> Smart Booking</span>
          <h3>Reservation booking</h3>
          <p>Manage open dates, blocked periods and stay limits.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type='button' className='r-enabled' role='switch' aria-label='Enable reservation booking' aria-checked={form.enabled} disabled={locked}
            onClick={() => setForm((previous) => ({ ...previous, enabled: !previous.enabled }))}>
            <Power size={16} /> {form.enabled ? 'Enabled' : 'Disabled'}
          </button>
          <button type='button' className='r-icon' aria-label='Close reservation settings' disabled={busy} onClick={onClose}><X size={18} /></button>
        </div>
      </div>
      <button type='button' className='r-link' disabled={busy} onClick={onBack}><ChevronLeft size={14} /> Change booking type</button>
      {error && <div className='r-alert' role='alert'>{error}</div>}
      {message && <div className='r-success' role='status'>{message}</div>}

      <fieldset disabled={locked}>
        <legend className='sr-only'>Reservation settings</legend>
        <div className='r-section'>
          <div className='r-section-head'>
            <h4><CalendarDays size={21} color='var(--r-accent)' /> Available date ranges</h4>
            <button type='button' className='r-secondary' onClick={() => setForm((previous) => ({ ...previous, available: [...previous.available, { key: `new-${++nextKey.current}`, start_date: '', end_date: '' }] }))}><Plus size={16} /> Add range</button>
          </div>
          {form.available.length === 0 && <p style={{ marginTop: 14 }}>No open dates. Customers cannot reserve until you add and save a range.</p>}
          {form.available.map((range, index) => (
            <div className='r-row' key={range.key}>
              <label>Start date<input type='date' aria-label={`Available range ${index + 1} start date`} value={range.start_date}
                onChange={(event) => setForm((previous) => ({ ...previous, available: previous.available.map((row) => row.key === range.key ? { ...row, start_date: event.target.value } : row) }))} /></label>
              <label>End date (exclusive)<input type='date' aria-label={`Available range ${index + 1} end date`} value={range.end_date} min={range.start_date || undefined}
                onChange={(event) => setForm((previous) => ({ ...previous, available: previous.available.map((row) => row.key === range.key ? { ...row, end_date: event.target.value } : row) }))} /></label>
              <button type='button' className='r-icon' aria-label={`Remove available range ${index + 1}`} onClick={() => setForm((previous) => ({ ...previous, available: previous.available.filter((row) => row.key !== range.key) }))}><Trash2 size={18} /></button>
            </div>
          ))}
        </div>

        <div className='r-section'>
          <div className='r-section-head'>
            <h4><CalendarDays size={21} color='var(--r-accent)' /> Blocked date ranges</h4>
            <button type='button' className='r-secondary' disabled={locked || blockStatus !== 'ready'} onClick={() => setBlocks((previous) => [...previous, { key: `new-block-${++nextKey.current}`, start_date: '', end_date: '', reason: null }])}><Plus size={16} /> Add blocked range</button>
          </div>
          {blockStatus === 'loading' && <p role='status' style={{ marginTop: 14 }}>Loading blocked ranges…</p>}
          {blockStatus === 'error' && <button type='button' className='r-secondary' style={{ marginTop: 14 }} onClick={() => setRetryLoad((previous) => previous + 1)}>Retry loading blocked ranges</button>}
          {blockStatus === 'ready' && blocks.length === 0 && <p style={{ marginTop: 14 }}>No blocked periods. Add dates you want to keep unavailable.</p>}
          {blocks.map((range, index) => (
            <div key={range.key}>
              <div className='r-row'>
                <label>Start date<input type='date' aria-label={`Blocked range ${index + 1} start date`} value={range.start_date}
                  onChange={(event) => setBlocks((previous) => previous.map((row) => row.key === range.key ? { ...row, start_date: event.target.value } : row))} /></label>
                <label>End date (exclusive)<input type='date' aria-label={`Blocked range ${index + 1} end date`} value={range.end_date} min={range.start_date || undefined}
                  onChange={(event) => setBlocks((previous) => previous.map((row) => row.key === range.key ? { ...row, end_date: event.target.value } : row))} /></label>
                <button type='button' className='r-icon' aria-label={`Remove blocked range ${index + 1}`} onClick={() => setBlocks((previous) => previous.filter((row) => row.key !== range.key))}><Trash2 size={18} /></button>
              </div>
              {range.reason && <p style={{ marginTop: 6 }}>Reason: {range.reason}</p>}
            </div>
          ))}
        </div>

        <p className='r-hint'><Info size={15} /> End dates are excluded: checkout may equal an available end date; a blocked end date can be a new check-in date.</p>
        <div className='r-limits'>
          <label>Minimum nights<input type='number' min={1} step={1} value={form.minNights} onChange={(event) => setForm((previous) => ({ ...previous, minNights: event.target.value }))} /></label>
          <label>Maximum nights<input type='number' min={1} step={1} placeholder='No maximum' value={form.maxNights} onChange={(event) => setForm((previous) => ({ ...previous, maxNights: event.target.value }))} /><span style={{ fontSize: 11 }}>Leave empty for no maximum.</span></label>
          <label>Timezone<select value={form.timezone} onChange={(event) => setForm((previous) => ({ ...previous, timezone: event.target.value }))}>
            {[...new Set([form.timezone, ...TIMEZONES])].filter(Boolean).map((zone) => <option key={zone} value={zone}>{zone}</option>)}
          </select></label>
        </div>
        <h4>Completion mode</h4>
        <div className='r-modes' role='group' aria-label='Completion mode'>
          <button type='button' className='r-mode' aria-pressed={form.completion === 'manual'} onClick={() => setForm((previous) => ({ ...previous, completion: 'manual' }))}><strong>Manual completion</strong><p>Mark reservations as completed yourself.</p></button>
          <button type='button' className='r-mode' aria-pressed={form.completion === 'automatic'} onClick={() => setForm((previous) => ({ ...previous, completion: 'automatic' }))}><strong>Automatic completion</strong><p>Use the automatic completion setting.</p></button>
        </div>
      </fieldset>

      <div className='r-footer'>
        <p>Changes to availability do not cancel existing reservations.</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type='button' className='r-icon' disabled={busy} onClick={onClose}>Cancel</button>
          {needsReload ? (
            <button type='button' className='r-primary' disabled={busy} onClick={recover}>{busy ? 'Reloading…' : 'Reload saved values'}</button>
          ) : (
            <button type='button' className='r-primary' disabled={busy || blockStatus !== 'ready'} onClick={save}>{busy ? 'Saving…' : 'Save booking settings'}</button>
          )}
        </div>
      </div>
    </section>
  );
}
