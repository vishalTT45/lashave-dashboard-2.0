'use client';

import { RequireAuth } from '@/components/require-auth';
import {
  ConversationLimitBanner,
  LockedAccountBanner,
} from '@/components/billing/FeatureGate';
import { apiFetch } from '@/lib/api';
import {
  analyzeKnowledgeWebsite,
  approveKnowledgeEntity,
  approveWebsiteKnowledgeEntry,
  bulkApproveKnowledgeEntities,
  bulkApproveWebsiteKnowledgeEntries,
  bulkRejectWebsiteKnowledgeEntries,
  editKnowledgeEntity,
  editWebsiteKnowledgeEntry,
  fetchKnowledgeDocumentPreview,
  getKnowledgeDocument,
  getKnowledgeJob,
  getKnowledgeWebsiteAnalysis,
  listKnowledgeDocuments,
  listKnowledgeEntities,
  listWebsiteKnowledgeEntries,
  rejectKnowledgeEntity,
  rejectWebsiteKnowledgeEntry,
  testKnowledgeRetrieval,
  uploadKnowledgeCatalogue,
  type KnowledgeDocumentDetail,
  type KnowledgeDocumentSummary,
  type KnowledgeEntityReviewItem,
  type WebsiteAnalysisStatus,
  type WebsiteEntryPatch,
  type WebsiteKnowledgeEntry,
} from '@/lib/knowledge-api';

// Some historical/legacy records may have a `url` field instead of the
// current `source_url` — WebsiteKnowledgeEntry only declares the
// current field, so this reads the fallback via a narrow, honest cast
// instead of casting the whole entry (or array of entries) to `any`.
function entrySourceUrl(entry: WebsiteKnowledgeEntry): string {
  return entry.source_url || (entry as { url?: string }).url || '';
}
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Edit3,
  ExternalLink,
  FileSearch,
  FileText,
  FlaskConical,
  Globe,
  Globe2,
  LayoutList,
  Loader2,
  MessageSquare,
  MessageSquareText,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import PageBreadcrumb from '@/components/common/PageBreadcrumb';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getPageItems,
  TablePagination,
} from '@/components/ui/table-pagination';

type FaqItem = {
  id: number;
  question: string;
  answer: string;
  tags: string;
  synonyms?: string;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type Filter = 'all' | 'active' | 'inactive';
type SortKey = 'updated' | 'created' | 'az';
type RagMode = 'catalogue' | 'webscraper' | null;
type EntryFilter = 'all' | 'draft' | 'approved' | 'rejected';
type KnowledgeView = 'catalogue' | 'website' | 'saved' | 'manual';
const ENTITY_PAGE_SIZE = 8;
type RagStatus = {
  kind: 'catalogue' | 'webscraper';
  title: string;
  detail: string;
  status: string;
  progress: number;
  pagesExplored?: number | null;
  entriesGenerated?: number | null;
  websiteType?: string | null;
};

const FAQ_LIGHT = {
  text: '#111827',
  textSub: '#64748B',
  textMuted: '#94A3B8',
  label: '#111827',

  accent: '#465FFF',
  accent2: '#0891B2',
  accentSoft: 'rgba(37,99,235,0.10)',
  accentBg: 'rgba(37,99,235,0.06)',
  accentBorder: 'rgba(37,99,235,0.20)',

  cardBg: '#ffffff',
  cardHovBg: '#ffffff',
  cardBorder: 'rgba(148,163,184,0.22)',
  cardBorderHov: 'rgba(37,99,235,0.24)',

  inputBg: '#ffffff',
  inputBorder: 'rgba(148,163,184,0.28)',

  gloss: 'rgba(255,255,255,0.95)',

  cardShadow: [
    '0 1px 0 rgba(255,255,255,0.95) inset',
    '0 1px 2px rgba(15,23,42,0.03)',
    '0 10px 24px rgba(15,23,42,0.04)',
  ].join(', '),

  cardShadowHov: [
    '0 1px 0 rgba(255,255,255,0.95) inset',
    '0 0 0 1px rgba(37,99,235,0.08)',
    '0 12px 26px rgba(15,23,42,0.08)',
  ].join(', '),
};

const FAQ_DARK = {
  text: '#F8FAFC',
  textSub: 'rgba(255,255,255,0.48)',
  textMuted: 'rgba(255,255,255,0.28)',
  label: 'rgba(226,232,240,0.86)',

  accent: '#7592FF',
  accent2: '#A8BFFF',
  accentSoft: 'rgba(141,166,255,0.16)',
  accentBg: 'rgba(141,166,255,0.12)',
  accentBorder: 'rgba(141,166,255,0.28)',

  cardBg: 'rgba(18,22,44,0.72)',
  cardHovBg: 'rgba(24,30,58,0.84)',
  cardBorder: 'rgba(141,166,255,0.14)',
  cardBorderHov: 'rgba(141,166,255,0.32)',

  inputBg: 'rgba(18,22,44,0.74)',
  inputBorder: 'rgba(141,166,255,0.18)',

  gloss: 'rgba(255,255,255,0.22)',

  cardShadow:
    '0 18px 48px rgba(0,0,0,0.36), inset 0 1px 0 rgba(255,255,255,0.06)',
  cardShadowHov:
    '0 24px 64px rgba(0,0,0,0.48), 0 0 0 1px rgba(141,166,255,0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
};

type FaqTheme = typeof FAQ_LIGHT;
type FieldFocusEvent = React.FocusEvent<
  HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
>;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Focus trap for modals: keeps Tab / Shift+Tab cycling inside the container,
 * and restores focus to whatever was focused before the modal opened when it
 * unmounts. Call from any modal component: pass a ref to the modal's outer div.
 */
function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!active) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = containerRef.current;
    if (!node) return;

    const focusableSelector =
      'a[href], area[href], input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), button:not([disabled]), iframe, object, embed, ' +
      '[tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

    const getFocusable = (): HTMLElement[] => {
      const list = node.querySelectorAll(focusableSelector);
      return (Array.from(list) as HTMLElement[]).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
    };

    // Give focus to the first focusable element inside the modal on open.
    const first = getFocusable()[0];
    if (first) first.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable: HTMLElement[] = getFocusable();
      if (focusable.length === 0) return;
      const currentIndex = focusable.indexOf(
        document.activeElement as HTMLElement,
      );
      if (e.shiftKey) {
        if (currentIndex <= 0) {
          e.preventDefault();
          const last: HTMLElement | undefined = focusable[focusable.length - 1];
          if (last) last.focus();
        }
      } else {
        if (currentIndex === focusable.length - 1 || currentIndex === -1) {
          e.preventDefault();
          const firstEl: HTMLElement | undefined = focusable[0];
          if (firstEl) firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus on close.
      if (previouslyFocused && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [active]);
  return containerRef;
}

function normalizeWebsiteUrl(value: string) {
  const raw = value.trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname.includes('.')
    )
      return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function documentEntityCount(
  detail: KnowledgeDocumentDetail | null | undefined,
) {
  return detail?.entities?.length ?? 0;
}

function parseFaqDate(iso?: string | null) {
  if (!iso) return null;

  const hasTimezone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const normalizedIso = hasTimezone ? iso : `${iso}Z`;

  const date = new Date(normalizedIso);

  return Number.isNaN(date.getTime()) ? null : date;
}

function timeAgo(iso?: string | null) {
  const date = parseFaqDate(iso);

  if (!date) return '—';

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);

  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);

  return `${days}d ago`;
}

function Hl({ text, q }: { text: string; q: string }) {
  if (!q || !text) return <>{text}</>;

  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, i)}
      <mark className='rounded bg-brand-100 px-0.75 text-brand-600 dark:bg-brand-500/35 dark:text-brand-200'>
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

function DelModal({
  item,
  ok,
  no,
}: {
  item: FaqItem;
  ok: () => void;
  no: () => void;
}) {
  const trapRef = useFocusTrap(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') no();
    };
    document.addEventListener('keydown', onKey);
    // Lock body scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [no]);
  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='del-modal-title'
      ref={trapRef}
      onClick={(e) => {
        // Close on backdrop click (but not clicks inside the inner card).
        if (e.target === e.currentTarget) no();
      }}
      className='fixed inset-0 z-100 flex items-center justify-center bg-gray-400/50 p-4 backdrop-blur-[10px] dark:bg-black/70'
    >
      <div className='w-full max-w-97.5 rounded-2xl border border-error-200 bg-white p-6 shadow-theme-xl dark:border-error-500/30 dark:bg-gray-900'>
        <div className='mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/15 dark:text-error-400'>
          <Trash2 size={20} />
        </div>
        <h3
          id='del-modal-title'
          className='mb-2 text-center type-body font-semibold text-gray-800 dark:text-white/90'
        >
          Delete this FAQ?
        </h3>
        <p className='mb-1.5 line-clamp-2 text-center type-small text-gray-500 dark:text-gray-400'>
          &ldquo;{item.question}&rdquo;
        </p>
        <p className='mb-5 text-center type-caption text-error-500'>
          Permanent — cannot be undone.
        </p>

        <div className='flex gap-3'>
          <Button variant='outline' className='flex-1' onClick={no}>
            Cancel
          </Button>
          <Button variant='destructive' className='flex-1' onClick={ok}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Generic confirmation modal for destructive actions. Used in place of
 * window.confirm() so the app never falls back to the browser's native
 * (and ugly) alert dialog.
 */
function ConfirmModal({
  title,
  detail,
  confirmLabel = 'Delete',
  danger = true,
  ok,
  no,
}: {
  title: string;
  detail?: string;
  confirmLabel?: string;
  danger?: boolean;
  ok: () => void;
  no: () => void;
}) {
  const trapRef = useFocusTrap(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') no();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [no]);
  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='confirm-modal-title'
      ref={trapRef}
      className='fixed inset-0 z-100 flex items-center justify-center bg-gray-400/50 p-4 backdrop-blur-[10px] dark:bg-black/70'
      onClick={no}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'w-full max-w-105 rounded-2xl border bg-white p-6 shadow-theme-xl dark:bg-gray-900',
          danger
            ? 'border-error-200 dark:border-error-500/30'
            : 'border-gray-200 dark:border-gray-800',
        )}
      >
        <div
          className={cn('flex items-start gap-3.5', detail ? 'mb-3.5' : 'mb-5')}
        >
          <span
            aria-hidden
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl type-card-title font-bold',
              danger
                ? 'bg-error-50 text-error-500 dark:bg-error-500/15 dark:text-error-400'
                : 'bg-gray-100 text-gray-700 dark:bg-white/6 dark:text-gray-300',
            )}
          >
            {danger ? '!' : '?'}
          </span>
          <div className='min-w-0 flex-1'>
            <h3
              id='confirm-modal-title'
              className='type-body font-semibold text-gray-800 dark:text-white/90'
            >
              {title}
            </h3>
            {detail && (
              <p className='mt-1 type-small leading-relaxed text-gray-500 dark:text-gray-400'>
                {detail}
              </p>
            )}
          </div>
        </div>
        <div className='flex justify-end gap-3'>
          <Button variant='outline' onClick={no}>
            Cancel
          </Button>
          <Button variant={danger ? 'destructive' : 'default'} onClick={ok}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

type RetrievalTopItem = { q: string; s: number; source?: string };

// Mirrors every shape actually assigned to this state below: a
// confident FAQ match, a RAG match, or a "nothing confident found"
// fallback that still surfaces the top local candidates.
type TestRetrievalResult =
  | {
      ok: true;
      source: 'faq' | 'rag';
      answer: string;
      question: string;
      score: number | null;
      routedTo?: string | null;
      latency?: number | null;
      top: RetrievalTopItem[];
    }
  | { ok: false; top: RetrievalTopItem[] };

function TestDrawer({
  items,
  onClose,
}: {
  items: FaqItem[];
  onClose: () => void;
}) {
  const [msg, setMsg] = useState('');
  const [res, setRes] = useState<TestRetrievalResult | null>(null);
  const [running, setRunning] = useState(false);

  function score(query: string, faq: FaqItem): number {
    const n = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const stop = new Set([
      'a',
      'an',
      'the',
      'is',
      'it',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'and',
      'or',
      'but',
      'do',
      'does',
      'can',
      'you',
      'i',
      'me',
      'my',
      'we',
      'be',
      'are',
      'was',
      'were',
      'this',
      'that',
      'what',
      'how',
      'why',
      'when',
      'where',
      'which',
      'have',
      'has',
      'will',
      'would',
      'could',
      'should',
      'please',
      'help',
      'about',
    ]);

    const tok = (s: string) =>
      n(s)
        .split(/\s+/)
        .filter((t) => t.length > 1 && !stop.has(t));
    const ng = (s: string, k = 3) => {
      const ns = n(s);
      const o = new Set<string>();
      for (let i = 0; i <= ns.length - k; i++) o.add(ns.slice(i, i + k));
      return o;
    };
    const jac = (a: Set<string>, b: Set<string>) => {
      if (!a.size || !b.size) return 0;
      let x = 0;
      a.forEach((v) => b.has(v) && x++);
      return x / (a.size + b.size - x);
    };

    const qn = n(query);
    const qt = tok(query);
    const qng = ng(query);
    const fn = n(faq.question);
    const ft = new Set(tok(faq.question));
    const fs = new Set(tok(faq.synonyms || ''));
    const fta = new Set(tok((faq.tags || '').replace(/,/g, ' ')));

    if (qn === fn) return 2;

    let raw = 0;
    qt.forEach((t) => {
      if (ft.has(t)) raw += 1;
      else if (fs.has(t)) raw += 1.6;
    });

    const tfidf = raw / Math.max(qt.length, 1);
    const ts = qt.filter((t) => fta.has(t)).length * 0.12;

    let ph = 0;
    if (qn.length >= 5) {
      if (fn.includes(qn)) ph = 0.3;
      else if (qn.includes(fn)) ph = 0.18;
    }

    const fng = new Set([...ng(faq.question), ...ng(faq.synonyms || '')]);
    return tfidf + ts + ph + jac(qng, fng) * 0.22;
  }

  async function run() {
    if (!msg.trim()) return;

    setRunning(true);
    setRes(null);

    // Run both the local FAQ match and the RAG query in parallel, then pick
    // the more confident result. Previously we only fell back to local FAQ
    // matching if RAG threw or returned zero results — which meant a weak
    // knowledge-doc match would always win over a strong manual FAQ.
    const scored = items
      .filter((i) => i.is_active)
      .map((f) => ({ f, s: score(msg, f) }))
      .sort((a, b) => b.s - a.s);
    const localTop = scored
      .slice(0, 3)
      .filter((x) => x.s > 0.08)
      .map((x) => ({ q: x.f.question, s: Math.round(x.s * 100) / 100 }));
    const localBest = scored[0];

    let ragResult: {
      ok: true;
      source: 'rag';
      answer: string;
      question: string;
      score: number | null;
      routedTo?: string | null;
      latency?: number | null;
      top: { q: string; s: number; source?: string }[];
    } | null = null;
    try {
      const rag = await testKnowledgeRetrieval(msg.trim(), 5);
      if ((rag.results?.length || 0) > 0 || rag.ai_preview || rag.answer) {
        ragResult = {
          ok: true,
          source: 'rag',
          answer:
            rag.ai_preview ||
            rag.answer ||
            rag.results[0]?.content ||
            'Knowledge was found, but no answer preview was returned.',
          question: rag.results[0]?.name || 'Approved knowledge',
          score:
            rag.results[0]?.score != null
              ? Math.round(rag.results[0].score * 100) / 100
              : null,
          routedTo: rag.routed_to,
          latency: rag.latency_ms,
          top: (rag.results || []).slice(0, 3).map((result) => ({
            q: result.name || (result.content || '').slice(0, 80),
            s: result.score != null ? Math.round(result.score * 100) / 100 : 0,
            source: result.source,
          })),
        };
      }
    } catch {
      // RAG endpoint down/unreachable — fall back to local FAQ result below.
    }

    // Prefer a strong local FAQ over a weak RAG match. Local scores >= 0.28 are
    // "confident" per the existing threshold; a decent RAG match is >= 0.4.
    const localIsStrong = localBest && localBest.s >= 0.28;
    const ragIsStrong =
      ragResult && (ragResult.score == null || ragResult.score >= 0.4);

    if (
      localIsStrong &&
      (!ragIsStrong ||
        (ragResult?.score != null && localBest!.s > ragResult.score))
    ) {
      setRes({
        ok: true,
        source: 'faq',
        answer: localBest!.f.answer,
        question: localBest!.f.question,
        score: Math.round(localBest!.s * 100) / 100,
        top: localTop,
      });
    } else if (ragResult) {
      setRes(ragResult);
    } else if (localBest && localBest.s >= 0.28) {
      // RAG unavailable but local has something
      setRes({
        ok: true,
        source: 'faq',
        answer: localBest.f.answer,
        question: localBest.f.question,
        score: Math.round(localBest.s * 100) / 100,
        top: localTop,
      });
    } else {
      setRes({ ok: false, top: localTop });
    }
    setRunning(false);
  }

  return (
    <div className='rounded-2xl border border-brand-200 bg-brand-50/40 p-6 dark:border-brand-500/25 dark:bg-brand-500/4'>
      <div className='mb-3 flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='flex h-8 w-8 items-center justify-center rounded-(--radius-control) bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
            <FlaskConical size={15} />
          </div>
          <div>
            <p className='type-small font-semibold text-gray-800 dark:text-white/90'>
              FAQ Match Tester
            </p>
            <p className='type-caption text-gray-400 dark:text-gray-500'>
              Simulate how a customer message would match
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className='rounded-(--radius-control) p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/6 dark:hover:text-gray-300'
        >
          <X size={16} />
        </button>
      </div>

      <div className='mb-3 flex gap-2'>
        <Input
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder='e.g. how much does it cost?'
          className='flex-1'
        />
        <Button onClick={run} disabled={running || !msg.trim()}>
          {running ? <Loader2 size={15} className='animate-spin' /> : 'Test'}
        </Button>
      </div>

      {res && (
        <div>
          {res.ok ? (
            <div className='rounded-xl border border-success-200 bg-success-50 p-4 dark:border-success-500/25 dark:bg-success-500/10'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='type-caption font-semibold tracking-wide text-success-700 dark:text-success-400'>
                  {res.source === 'rag' ? 'RAG ANSWER' : 'FAQ MATCH'}
                </span>
                <span className='font-mono type-caption text-gray-400 dark:text-gray-500'>
                  {res.score != null
                    ? `score ${res.score}`
                    : res.routedTo || 'retrieval'}
                  {res.latency ? ` · ${res.latency}ms` : ''}
                </span>
              </div>

              <p className='mb-1.5 type-caption text-gray-500 dark:text-gray-400'>
                → {res.question}
              </p>
              <p className='type-small leading-relaxed text-gray-700 dark:text-gray-200'>
                {res.answer}
              </p>
            </div>
          ) : (
            <div className='rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900'>
              <p
                className={cn(
                  'type-caption text-gray-500 dark:text-gray-400',
                  res.top?.length ? 'mb-2.5' : '',
                )}
              >
                No FAQ matched — the AI would handle this normally.
              </p>

              {res.top?.length > 0 && (
                <>
                  <p className='mb-1.5 type-caption font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                    Closest misses
                  </p>

                  {res.top.map((m: RetrievalTopItem, i: number) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center justify-between py-1.5',
                        i
                          ? 'border-t border-gray-100 dark:border-gray-800'
                          : '',
                      )}
                    >
                      <p className='mr-2 flex-1 truncate type-caption text-gray-500 dark:text-gray-400'>
                        {m.q}
                      </p>
                      <span className='shrink-0 font-mono type-caption text-gray-400 dark:text-gray-500'>
                        {m.s}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FaqCard({
  item,
  idx,
  sq,
  onUpdate,
  onDelete,
  onDup,
}: {
  item: FaqItem;
  idx: number;
  sq: string;
  onUpdate: (id: number, patch: Partial<FaqItem>) => Promise<void>;
  onDelete: (item: FaqItem) => void;
  onDup: (item: FaqItem) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(item.question);
  const [answer, setAnswer] = useState(item.answer);
  const [tags, setTags] = useState(item.tags);
  const [synonyms, setSynonyms] = useState(item.synonyms || '');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    // Preserve unsaved edits when the parent refetches items in the
    // background. Only re-sync from the item prop when the local copy is
    // clean, so mid-edit input isn't clobbered by an unrelated reload.
    if (dirtyRef.current) return;
    setQuestion(item.question);
    setAnswer(item.answer);
    setTags(item.tags);
    setSynonyms(item.synonyms || '');
    setDirty(false);
  }, [item]);

  useEffect(() => {
    if (taRef.current && open) {
      taRef.current.style.height = 'auto';
      taRef.current.style.height = `${taRef.current.scrollHeight}px`;
    }
  }, [answer, open]);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function save() {
    setSaving(true);
    await onUpdate(item.id, { question, answer, tags, synonyms });
    setDirty(false);
    setSaving(false);
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1600);
  }

  const isActive = item.is_active;
  const tagList = tags.split(/[,\s]+/).filter(Boolean);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:hover:bg-white/5',
        !isActive && 'opacity-60',
      )}
    >
      <div
        className='flex cursor-pointer items-center gap-3 px-4 py-3.5'
        onClick={() => setOpen((v) => !v)}
      >
        <p className='min-w-0 flex-1 truncate type-small font-semibold text-gray-800 dark:text-white/90'>
          <Hl text={item.question} q={sq} />
        </p>

        <Badge color={isActive ? 'success' : 'light'}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>

        {!open && (
          <p className='hidden max-w-55 truncate type-caption text-gray-500 dark:text-gray-400 lg:block'>
            {item.answer}
          </p>
        )}

        {tagList.length > 0 && (
          <div className='hidden shrink-0 items-center gap-1 lg:flex'>
            {tagList.slice(0, 2).map((t) => (
              <Badge key={t} color='primary'>
                {t}
              </Badge>
            ))}
            {tagList.length > 2 && (
              <span className='type-caption text-gray-400 dark:text-gray-500'>
                +{tagList.length - 2}
              </span>
            )}
          </div>
        )}

        <span className='hidden w-14 shrink-0 text-right type-caption text-gray-400 dark:text-gray-500 lg:block'>
          {timeAgo(item.updated_at)}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onUpdate(item.id, { is_active: !isActive });
          }}
          className={cn(
            'relative h-5 w-9 shrink-0 rounded-full transition',
            isActive ? 'bg-success-500' : 'bg-gray-200 dark:bg-white/10',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-theme-sm transition-transform',
              isActive ? 'translate-x-4.5' : 'translate-x-0.5',
            )}
          />
        </button>

        <ChevronDown
          size={15}
          className={cn(
            'shrink-0 text-gray-400 transition-transform dark:text-gray-500',
            open && 'rotate-180',
          )}
        />
      </div>

      {open && (
        <div className='flex flex-col gap-3.5 border-t border-gray-100 px-4 pb-4 pt-3.5 dark:border-gray-800'>
          <div>
            <label className='mb-1.5 block type-caption font-medium text-gray-500 dark:text-gray-400'>
              Question
            </label>
            <Input
              value={question}
              onChange={(e) => {
                setQuestion(e.target.value);
                setDirty(true);
              }}
            />
          </div>

          <div>
            <label className='mb-1.5 flex items-center justify-between type-caption font-medium text-gray-500 dark:text-gray-400'>
              <span>Answer</span>
              <span className='font-mono type-caption font-normal'>
                {answer.length} ch
              </span>
            </label>
            <textarea
              ref={taRef}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                setDirty(true);
              }}
              rows={3}
              className='min-h-20 w-full resize-none rounded-(--radius-control) border border-gray-300 bg-transparent px-3.5 py-2 type-small leading-relaxed text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800'
            />
          </div>

          <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
            <div>
              <label className='mb-1.5 block type-caption font-medium text-gray-500 dark:text-gray-400'>
                Tags
              </label>
              <Input
                value={tags}
                onChange={(e) => {
                  setTags(e.target.value);
                  setDirty(true);
                }}
                placeholder='pricing, bot...'
              />
            </div>

            <div>
              <label className='mb-1.5 block type-caption font-medium text-gray-500 dark:text-gray-400'>
                Synonyms
              </label>
              <Input
                value={synonyms}
                onChange={(e) => {
                  setSynonyms(e.target.value);
                  setDirty(true);
                }}
                placeholder='price cost fee...'
              />
            </div>
          </div>

          {synonyms && (
            <div className='flex flex-wrap gap-1.5'>
              {synonyms
                .split(/\s+/)
                .filter(Boolean)
                .map((s) => (
                  <Badge key={s} color='primary'>
                    {s}
                  </Badge>
                ))}
            </div>
          )}

          <div className='flex flex-wrap items-center gap-2 pt-1'>
            {dirty && (
              <Button
                size='sm'
                onClick={save}
                disabled={saving}
                className='h-9 min-w-29.5 rounded-(--radius-control) bg-brand-500 px-4 font-semibold text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-400 disabled:opacity-70'
              >
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save FAQ'}
              </Button>
            )}

            <Button
              size='sm'
              variant='outline'
              onClick={() => {
                setSynonyms((p) =>
                  `${p} amount pay payment bill billing subscription package fee`.trim(),
                );
                setDirty(true);
              }}
            >
              + Payment synonyms
            </Button>

            <div className='flex-1' />

            <Button size='sm' variant='outline' onClick={() => onDup(item)}>
              Duplicate
            </Button>

            <Button
              size='sm'
              variant='outline'
              className='border-warning-200 text-warning-700 hover:bg-warning-50 dark:border-warning-500/25 dark:text-orange-400 dark:hover:bg-warning-500/10'
              onClick={() => onUpdate(item.id, { is_active: !isActive })}
            >
              {isActive ? 'Disable' : 'Enable'}
            </Button>

            <Button
              size='sm'
              variant='outline'
              className='border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/25 dark:text-error-400 dark:hover:bg-error-500/10'
              onClick={() => onDelete(item)}
            >
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RagModalShell({
  title,
  icon,
  children,
  onClose,
  isDark,
  th,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  isDark: boolean;
  th: FaqTheme;
}) {
  const trapRef = useFocusTrap(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
  return (
    <div
      role='dialog'
      aria-modal='true'
      aria-labelledby='rag-modal-title'
      ref={trapRef}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '96px 16px 24px',
        overflowY: 'auto',
        background: isDark ? 'rgba(0,0,0,.72)' : 'rgba(15,23,42,.34)',
        backdropFilter: 'blur(12px)',
        animation: 'faq-fade .18s ease both',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          borderRadius: 22,
          border: `1px solid ${th.accentBorder}`,
          background: isDark ? 'rgba(18,22,44,0.96)' : '#ffffff',
          boxShadow: isDark ? '0 40px 90px rgba(0,0,0,.72)' : th.cardShadowHov,
          animation: 'faq-pop .28s cubic-bezier(.34,1.35,.64,1) both',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 18px',
            borderBottom: `1px solid ${th.cardBorder}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                display: 'grid',
                placeItems: 'center',
                borderRadius: 12,
                color: th.accent,
                background: th.accentBg,
                border: `1px solid ${th.accentBorder}`,
                flex: '0 0 auto',
              }}
            >
              {icon}
            </span>
            <h3
              id='rag-modal-title'
              style={{
                color: th.text,
                fontSize: 15,
                fontWeight: 600,
                margin: 0,
              }}
            >
              {title}
            </h3>
          </div>

          <button
            onClick={onClose}
            aria-label='Close'
            style={{
              width: 32,
              height: 32,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 10,
              border: `1px solid ${th.cardBorder}`,
              background: th.cardBg,
              color: th.textSub,
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function CatalogueUploadModal({
  onClose,
  onUpload,
  busy,
  isDark,
  th,
  inputStyle,
  onFocus,
  onBlur,
}: {
  onClose: () => void;
  onUpload: (file: File, label: string, docCategory?: string) => void;
  busy: boolean;
  isDark: boolean;
  th: FaqTheme;
  inputStyle: React.CSSProperties;
  onFocus: (e: FieldFocusEvent) => void;
  onBlur: (e: FieldFocusEvent) => void;
}) {
  // Server accepts up to this size. Bigger files are rejected client-side so
  // users don't wait for a long upload only to get a server-side error.
  const MAX_CATALOGUE_BYTES = 25 * 1024 * 1024; // 25 MB
  const MAX_CATALOGUE_LABEL = '25 MB';

  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState('');
  const [docCategory, setDocCategory] = useState('');
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState('');
  const [sensitiveConfirmed, setSensitiveConfirmed] = useState(false);

  const acceptFile = (next: File) => {
    if (next.size > MAX_CATALOGUE_BYTES) {
      setFileError(
        `"${next.name}" is ${compactFileSize(next.size)} — the limit is ${MAX_CATALOGUE_LABEL}. Please compress or split the file and try again.`,
      );
      setFile(null);
      return;
    }
    setFileError('');
    setFile(next);
  };

  // Object URLs must be created and revoked in an effect, not a useMemo — useMemo
  // is not guaranteed to be called exactly once per dep change, and in strict-mode
  // dev double-render it can leak the first URL. useEffect is the reliable pattern.
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    if (!file) {
      // Resets local UI-only state (a flag, warning, or preview value)
      // when the relevant prop/dependency changes — not deriving render
      // output from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const previewKind = file?.type.includes('pdf')
    ? 'pdf'
    : file?.type.startsWith('image/')
      ? 'image'
      : 'file';

  const submitUpload = () => {
    if (!file || !docCategory || !sensitiveConfirmed) return;

    onUpload(file, label, docCategory);
  };

  return (
    <RagModalShell
      title='Upload Catalogue'
      icon={<FileText style={{ width: 17, height: 17 }} />}
      onClose={onClose}
      isDark={isDark}
      th={th}
    >
      <div
        style={{
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const next = e.dataTransfer.files?.[0];
            if (next) acceptFile(next);
          }}
          style={{
            minHeight: 132,
            borderRadius: 14,
            border: `1px dashed ${dragging ? th.textMuted : th.cardBorder}`,
            background: dragging
              ? isDark
                ? 'rgba(255,255,255,.05)'
                : '#f8fafc'
              : th.cardBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            cursor: 'pointer',
            padding: 18,
            transition: 'border-color .18s, background .18s',
          }}
        >
          <input
            ref={fileRef}
            type='file'
            accept='.pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp'
            style={{ display: 'none' }}
            onChange={(e) => {
              const next = e.target.files?.[0];
              if (next) acceptFile(next);
            }}
          />
          <div>
            <Upload
              style={{
                width: 24,
                height: 24,
                color: th.textSub,
                margin: '0 auto 10px',
              }}
            />
            <div style={{ color: th.text, fontWeight: 500, fontSize: 14 }}>
              {file ? file.name : 'Select catalogue file'}
            </div>
            <div style={{ color: th.textMuted, fontSize: 12, marginTop: 5 }}>
              PDF, CSV, Excel, or product images
            </div>
            <div
              style={{
                color: th.textMuted,
                fontSize: 11,
                marginTop: 3,
                fontWeight: 600,
              }}
            >
              Max file size {MAX_CATALOGUE_LABEL}
              {file ? ` — this file is ${compactFileSize(file.size)}` : ''}
            </div>
          </div>
        </div>

        <div className='flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
          <ShieldAlert className='mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' />

          <p className='flex-1 type-small leading-5 text-left text-amber-700 dark:text-amber-300'>
            Uploaded files may be scanned for personal information (names,
            emails, or other identifying details) before they&apos;re added to
            your knowledge base.
          </p>
        </div>

        {fileError && (
          <div
            role='alert'
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid rgba(239,68,68,.35)',
              background: isDark
                ? 'rgba(239,68,68,.10)'
                : 'rgba(254,242,242,.98)',
              color: isDark ? '#fca5a5' : '#dc2626',
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#dc2626',
                color: 'white',
                display: 'grid',
                placeItems: 'center',
                fontSize: 11,
                fontWeight: 600,
                flex: '0 0 auto',
                lineHeight: 1,
              }}
            >
              !
            </span>
            <span>{fileError}</span>
          </div>
        )}

        {file && previewUrl && (
          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${th.cardBorder}`,
              overflow: 'hidden',
              background: isDark ? 'rgba(255,255,255,.04)' : '#f8fafc',
            }}
          >
            <div
              style={{
                padding: '9px 11px',
                borderBottom: `1px solid ${th.cardBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span
                style={{
                  color: th.textSub,
                  fontSize: 12,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                Preview - {compactFileSize(file.size)}
              </span>
              <a
                href={previewUrl}
                target='_blank'
                rel='noreferrer'
                style={{
                  color: th.text,
                  fontSize: 12,
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Open preview
              </a>
            </div>
            <div
              style={{
                height: previewKind === 'pdf' ? 160 : 110,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                padding: 8,
              }}
            >
              {previewKind === 'pdf' ? (
                <iframe
                  title='Catalogue preview'
                  src={previewUrl}
                  style={{
                    width: '100%',
                    height: 160,
                    border: 0,
                    borderRadius: 10,
                    background: '#fff',
                  }}
                />
              ) : previewKind === 'image' ? (
                <img
                  src={previewUrl}
                  alt={file.name}
                  style={{
                    maxWidth: '100%',
                    maxHeight: 90,
                    objectFit: 'contain',
                    borderRadius: 8,
                  }}
                />
              ) : (
                <div
                  style={{
                    color: th.textSub,
                    fontSize: 12,
                    textAlign: 'center',
                  }}
                >
                  This file will be previewed after upload.
                </div>
              )}
            </div>
          </div>
        )}

        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder='Label, e.g. Summer catalogue'
          style={inputStyle}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            color: th.textSub,
            fontSize: 12,
          }}
        >
          Document type
          <select
            value={docCategory}
            onChange={(e) => setDocCategory(e.target.value)}
            style={{ ...inputStyle, color: docCategory ? th.text : th.textSub }}
            onFocus={onFocus}
            onBlur={onBlur}
          >
            <option value=''>Auto detect</option>
            <option value='menu'>Menu</option>
            <option value='catalogue'>Catalogue</option>
            <option value='inventory'>Inventory</option>
            <option value='invoice'>Invoice</option>
            <option value='faq'>FAQ</option>
            <option value='policy'>Policy</option>
          </select>
        </label>
        <label className='flex cursor-pointer items-start gap-3 rounded-xl border border-gray-200 px-3.5 py-3 dark:border-gray-800'>
          <input
            type='checkbox'
            checked={sensitiveConfirmed}
            onChange={(e) => setSensitiveConfirmed(e.target.checked)}
            className='mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700'
          />

          <span className='flex-1 type-small leading-5 text-left text-gray-600 dark:text-gray-400'>
            I confirm this file does not contain unauthorized sensitive or
            confidential information and agree to upload.
          </span>
        </label>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '14px 18px',
          borderTop: `1px solid ${th.cardBorder}`,
        }}
      >
        <button
          onClick={onClose}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: `1px solid ${th.cardBorder}`,
            background: th.cardBg,
            color: th.textSub,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          type='button'
          onClick={submitUpload}
          disabled={!file || !docCategory || !sensitiveConfirmed || busy}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: `1px solid ${isDark ? 'rgba(255,255,255,.22)' : 'rgba(15,23,42,.18)'}`,
            background: isDark ? 'rgba(255,255,255,.10)' : '#111827',
            color: isDark ? th.text : '#fff',
            fontSize: 12,
            fontWeight: 500,
            cursor:
              file && docCategory && sensitiveConfirmed && !busy
                ? 'pointer'
                : 'not-allowed',

            opacity:
              file && docCategory && sensitiveConfirmed && !busy ? 1 : 0.55,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          {busy ? (
            <Loader2
              style={{
                width: 14,
                height: 14,
                animation: 'faq-spin .7s linear infinite',
              }}
            />
          ) : (
            <Upload style={{ width: 14, height: 14 }} />
          )}
          Upload
        </button>
      </div>
    </RagModalShell>
  );
}

// Backend still receives a page cap; we just don't expose it in the UI.
const DEFAULT_IMPORT_PAGE_LIMIT = 30;
// Maximum number of distinct sites a user is allowed to keep imported at once.
const MAX_IMPORTED_SITES_PER_USER = 2;

function WebscraperModal({
  onClose,
  onAnalyze,
  busy,
  isDark,
  th,
  inputStyle,
  onFocus,
  onBlur,
}: {
  onClose: () => void;
  onAnalyze: (url: string, maxPages: number) => void;
  busy: boolean;
  isDark: boolean;
  th: FaqTheme;
  inputStyle: React.CSSProperties;
  onFocus: (e: FieldFocusEvent) => void;
  onBlur: (e: FieldFocusEvent) => void;
}) {
  const [url, setUrl] = useState('');
  const normalizedUrl = normalizeWebsiteUrl(url);
  const showUrlError = Boolean(url.trim() && !normalizedUrl);
  const canStart = Boolean(normalizedUrl && !busy);

  return (
    <RagModalShell
      title='Import from a website'
      icon={<Globe2 style={{ width: 17, height: 17 }} />}
      onClose={onClose}
      isDark={isDark}
      th={th}
    >
      <div
        style={{
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder='https://example.com'
          style={inputStyle}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {showUrlError && (
          <div style={{ color: th.textMuted, fontSize: 11 }}>
            Enter a valid public http or https website URL.
          </div>
        )}
        <div style={{ color: th.textMuted, fontSize: 11, lineHeight: 1.5 }}>
          We&apos;ll read the site&apos;s public pages and turn them into draft
          answers you can review before they go live.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          padding: '14px 18px',
          borderTop: `1px solid ${th.cardBorder}`,
        }}
      >
        <button
          onClick={onClose}
          style={{
            padding: '10px 14px',
            borderRadius: 12,
            border: `1px solid ${th.cardBorder}`,
            background: th.cardBg,
            color: th.textSub,
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() =>
            normalizedUrl && onAnalyze(normalizedUrl, DEFAULT_IMPORT_PAGE_LIMIT)
          }
          disabled={!canStart}
          style={{
            padding: '10px 16px',
            borderRadius: 12,
            border: `1px solid ${th.cardBorder}`,
            background: isDark ? 'rgba(255,255,255,.05)' : '#111827',
            color: isDark ? th.text : '#fff',
            fontSize: 12,
            fontWeight: 500,
            cursor: canStart ? 'pointer' : 'not-allowed',
            opacity: canStart ? 1 : 0.55,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          {busy ? (
            <Loader2
              style={{
                width: 14,
                height: 14,
                animation: 'faq-spin .7s linear infinite',
              }}
            />
          ) : (
            <Globe2 style={{ width: 14, height: 14 }} />
          )}
          Start
        </button>
      </div>
    </RagModalShell>
  );
}

function RagStatusCard({
  state,
  isDark,
  th,
  onDismiss,
}: {
  state: RagStatus;
  isDark: boolean;
  th: FaqTheme;
  onDismiss?: () => void;
}) {
  const done = state.status === 'completed';
  const failed = state.status === 'failed';
  const color = failed ? '#991b1b' : th.textSub;
  // Only expose a dismiss control once the job is in a terminal state so
  // active work can't be silently hidden.
  const canDismiss = Boolean(onDismiss) && (done || failed);

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 12,
        alignItems: 'center',
        border: `1px solid ${failed ? 'rgba(153,27,27,.25)' : th.cardBorder}`,
        background: failed
          ? isDark
            ? 'rgba(153,27,27,.10)'
            : '#fff7f7'
          : th.cardBg,
        boxShadow: isDark ? 'none' : th.cardShadow,
        animation: 'faq-pop .25s ease both',
      }}
    >
      <span
        style={{
          width: 38,
          height: 38,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 14,
          color,
          background: isDark ? 'rgba(255,255,255,.05)' : '#fff',
          border: `1px solid ${failed ? 'rgba(153,27,27,.20)' : th.cardBorder}`,
        }}
      >
        {done ? (
          <CheckCircle2 style={{ width: 19, height: 19 }} />
        ) : (
          <Loader2
            style={{
              width: 19,
              height: 19,
              animation: failed ? 'none' : 'faq-spin .8s linear infinite',
            }}
          />
        )}
      </span>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '.06em',
              textTransform: 'uppercase',
              color,
              background: isDark ? 'rgba(255,255,255,.04)' : '#fff',
              border: `1px solid ${color}33`,
            }}
          >
            {!done && !failed && (
              <span
                aria-hidden
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color,
                  animation: 'faq-live-pulse 1.4s ease-in-out infinite',
                }}
              />
            )}
            {done ? 'Done' : failed ? 'Failed' : 'Working'}
          </span>
          <div
            style={{
              color: th.text,
              fontWeight: 600,
              fontSize: 13,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {state.title}
          </div>
        </div>
        <div
          style={{
            color: failed ? '#991b1b' : th.textSub,
            fontSize: 12,
            marginTop: 6,
          }}
        >
          {state.detail}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 12,
          }}
        >
          <div
            style={{
              flex: 1,
              height: 12,
              borderRadius: 999,
              background: isDark
                ? 'rgba(255,255,255,.08)'
                : 'rgba(15,23,42,.06)',
              overflow: 'hidden',
              border: `1px solid ${isDark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.04)'}`,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.max(5, Math.min(100, state.progress))}%`,
                borderRadius: 999,
                background:
                  done || failed
                    ? color
                    : `repeating-linear-gradient(45deg, ${color}, ${color} 10px, ${color}dd 10px, ${color}dd 20px)`,
                backgroundSize: !done && !failed ? '28px 28px' : undefined,
                animation:
                  !done && !failed
                    ? 'faq-progress-stripes 1s linear infinite'
                    : undefined,
                transition: 'width .35s ease',
                boxShadow: `0 0 8px ${color}55`,
              }}
            />
          </div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: failed ? '#991b1b' : th.text,
              minWidth: 42,
              textAlign: 'right',
              fontVariantNumeric: 'tabular-nums',
            }}
            aria-live='polite'
          >
            {failed ? '—' : `${Math.round(state.progress)}%`}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            borderRadius: 999,
            padding: '8px 10px',
            background: isDark ? 'rgba(255,255,255,.05)' : '#fff',
            border: `1px solid ${th.cardBorder}`,
            color,
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'capitalize',
            whiteSpace: 'nowrap',
          }}
        >
          {state.status}
        </span>
        {canDismiss && (
          <button
            onClick={onDismiss}
            aria-label='Dismiss'
            title='Dismiss'
            style={{
              width: 28,
              height: 28,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 999,
              border: `1px solid ${failed ? 'rgba(153,27,27,.20)' : th.cardBorder}`,
              background: isDark ? 'rgba(255,255,255,.05)' : '#fff',
              color: failed ? '#991b1b' : th.textSub,
              cursor: 'pointer',
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
    </div>
  );
}

// Playful rotating messages shown while a long-running job is in flight so
// users have something friendly to look at instead of a bare progress bar.
const IMPORT_LOADING_MESSAGES = [
  'Good things take time…',
  "This will be done before your coffee's ready.",
  "Reading the site so you don't have to.",
  'Turning pages into answers…',
  "Hang tight — we're getting the details right.",
  'Nearly there — just tidying things up.',
];

function useRotatingMessage(
  active: boolean,
  messages: string[],
  intervalMs = 3200,
) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active || messages.length <= 1) return;
    const id = window.setInterval(() => {
      setIdx((n) => (n + 1) % messages.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [active, messages, intervalMs]);
  return messages[idx] || messages[0] || '';
}

function WebsiteScrapeStatusPanel({
  state,
  entries,
  isDark,
  th,
  onDismiss,
}: {
  state: RagStatus | null;
  entries: WebsiteKnowledgeEntry[];
  isDark: boolean;
  th: FaqTheme;
  onDismiss?: () => void;
}) {
  const url = state?.title || '';
  let hostname = url;
  try {
    hostname = new URL(url.startsWith('http') ? url : `https://${url}`)
      .hostname;
  } catch {
    // keep raw url as hostname
  }

  const [meta, setMeta] = useState<{
    title: string;
    description: string;
    image: string;
    logo: string;
  } | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [log, setLog] = useState<
    Array<{ id: number; text: string; kind: 'action' | 'find' | 'done' }>
  >([]);
  const idRef = useRef(0);
  const prevRef = useRef({ pages: 0, gen: 0, status: '' });

  // Fetch site metadata from microlink whenever the target URL changes.
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // Resets local UI-only state (a flag, warning, or preview value)
    // when the relevant prop/dependency changes — not deriving render
    // output from state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeta(null);
    setMetaLoading(true);
    fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=true&palette=false&video=false`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.status === 'success' && json.data) {
          setMeta({
            title: json.data.title || hostname,
            description: json.data.description || '',
            image: json.data.screenshot?.url || json.data.image?.url || '',
            logo:
              json.data.logo?.url ||
              `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
          });
        }
      })
      .catch(() => {
        // metadata failure is non-fatal
      })
      .finally(() => {
        if (!cancelled) setMetaLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [url, hostname]);

  // Reset per-run trackers when the URL changes.
  useEffect(() => {
    // Resets local UI-only state (a flag, warning, or preview value)
    // when the relevant prop/dependency changes — not deriving render
    // output from state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLog([]);
    prevRef.current = { pages: 0, gen: 0, status: '' };
  }, [url]);

  // Turn polling deltas into a rolling activity feed.
  useEffect(() => {
    if (!state) return;
    const p = state.pagesExplored ?? 0;
    const g = state.entriesGenerated ?? 0;
    const prev = prevRef.current;
    const dp = p - prev.pages;
    const dg = g - prev.gen;
    const additions: Array<{
      id: number;
      text: string;
      kind: 'action' | 'find' | 'done';
    }> = [];

    if (
      prev.status === '' &&
      state.status !== 'completed' &&
      state.status !== 'failed'
    ) {
      idRef.current += 1;
      additions.push({
        id: idRef.current,
        text: `Opened ${hostname}`,
        kind: 'action',
      });
    }
    if (dp > 0) {
      idRef.current += 1;
      additions.push({
        id: idRef.current,
        text: `Read ${dp} page${dp === 1 ? '' : 's'}`,
        kind: 'done',
      });
    }
    if (dg > 0) {
      idRef.current += 1;
      additions.push({
        id: idRef.current,
        text: `Drafted ${dg} answer${dg === 1 ? '' : 's'}`,
        kind: 'find',
      });
    }
    if (prev.status !== state.status && state.status === 'completed') {
      idRef.current += 1;
      additions.push({ id: idRef.current, text: 'Done', kind: 'done' });
    }
    if (prev.status !== state.status && state.status === 'failed') {
      idRef.current += 1;
      additions.push({
        id: idRef.current,
        text: state.detail || 'Failed',
        kind: 'action',
      });
    }
    if (additions.length > 0) {
      // Clamps/adjusts local state in response to a changing dependency
      // (e.g. pagination bounds, active tab) — reviewed; not a
      // derive-state-from-render antipattern in this context.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLog((prevLog) => [...additions.reverse(), ...prevLog].slice(0, 8));
    }
    prevRef.current = { pages: p, gen: g, status: state.status };
  }, [
    state?.pagesExplored,
    state?.entriesGenerated,
    state?.status,
    state?.detail,
    hostname,
    state,
  ]);

  // `scanning` must be computed before the early return below so the
  // useRotatingMessage hook call always happens on every render — an
  // earlier version called it after `if (!state) return null`, which
  // is a Rules-of-Hooks violation (hooks can't be called conditionally
  // or after an early return).
  const scanningForMessage = !!state && state.status !== 'completed' && state.status !== 'failed';
  const funMessage = useRotatingMessage(scanningForMessage, IMPORT_LOADING_MESSAGES);

  if (!state) return null;

  const done = state.status === 'completed';
  const failed = state.status === 'failed';
  const scanning = !done && !failed;
  const progress = Math.max(0, Math.min(100, state.progress));
  const pages = state.pagesExplored ?? 0;
  const generated = state.entriesGenerated ?? entries.length;
  const statusDot = failed ? '#dc2626' : done ? '#059669' : th.accent;
  const canDismiss = Boolean(onDismiss) && (done || failed);

  return (
    <div
      style={{
        margin: 14,
        borderRadius: 14,
        border: `1px solid ${th.cardBorder}`,
        background: isDark ? 'rgba(255,255,255,.025)' : '#fff',
        padding: 14,
      }}
    >
      <style>{`
        @keyframes sp-scan {
          0% { transform: translateY(-10%); opacity: 0.9; }
          50% { opacity: 1; }
          100% { transform: translateY(110%); opacity: 0.9; }
        }
        @keyframes sp-hop-a {
          0%, 100% { left: 18%; top: 28%; }
          25% { left: 62%; top: 20%; }
          50% { left: 72%; top: 58%; }
          75% { left: 30%; top: 66%; }
        }
        @keyframes sp-hop-b {
          0%, 100% { left: 60%; top: 55%; }
          33% { left: 25%; top: 40%; }
          66% { left: 55%; top: 22%; }
        }
        @keyframes sp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(1.4); }
        }
        @keyframes sp-bracket {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @keyframes sp-fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>

      <div
        className='scraper-preview-grid'
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 260px',
          gap: 14,
        }}
      >
        {/* LEFT: preview canvas + metadata */}
        <div
          style={{
            borderRadius: 12,
            border: `1px solid ${th.cardBorder}`,
            overflow: 'hidden',
            background: isDark ? '#0a0f1c' : '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '16 / 9',
              background: isDark ? '#0a0f1c' : '#e2e8f0',
              overflow: 'hidden',
            }}
          >
            {meta?.image ? (
              <img
                src={meta.image}
                alt={hostname}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top',
                  display: 'block',
                  filter: scanning ? 'saturate(.75) brightness(.9)' : 'none',
                  transition: 'filter .4s',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  color: th.textMuted,
                  fontSize: 12,
                  letterSpacing: '.04em',
                }}
              >
                {metaLoading ? 'Capturing preview…' : hostname || 'Preview'}
              </div>
            )}

            {scanning && (
              <>
                {/* Viewfinder corner brackets */}
                {(
                  [
                    { top: 8, left: 8, borderTop: true, borderLeft: true },
                    { top: 8, right: 8, borderTop: true, borderRight: true },
                    {
                      bottom: 8,
                      left: 8,
                      borderBottom: true,
                      borderLeft: true,
                    },
                    {
                      bottom: 8,
                      right: 8,
                      borderBottom: true,
                      borderRight: true,
                    },
                  ] as Array<{
                    top?: number;
                    left?: number;
                    right?: number;
                    bottom?: number;
                    borderTop?: boolean;
                    borderBottom?: boolean;
                    borderLeft?: boolean;
                    borderRight?: boolean;
                  }>
                ).map((c, i) => (
                  <span
                    key={i}
                    style={{
                      position: 'absolute',
                      top: c.top,
                      left: c.left,
                      right: c.right,
                      bottom: c.bottom,
                      width: 18,
                      height: 18,
                      borderTop: c.borderTop
                        ? `2px solid ${th.accent}`
                        : 'none',
                      borderBottom: c.borderBottom
                        ? `2px solid ${th.accent}`
                        : 'none',
                      borderLeft: c.borderLeft
                        ? `2px solid ${th.accent}`
                        : 'none',
                      borderRight: c.borderRight
                        ? `2px solid ${th.accent}`
                        : 'none',
                      animation: 'sp-bracket 1.6s ease-in-out infinite',
                    }}
                  />
                ))}

                {/* Sweeping scan line */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: 2,
                    background: `linear-gradient(90deg, transparent, ${th.accent}, transparent)`,
                    boxShadow: `0 0 14px ${th.accent}, 0 0 4px ${th.accent}`,
                    animation: 'sp-scan 2.6s linear infinite',
                    pointerEvents: 'none',
                  }}
                />

                {/* Hopping cursor dots — feels like an agent clicking around */}
                <span
                  style={{
                    position: 'absolute',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: th.accent,
                    boxShadow: `0 0 10px ${th.accent}`,
                    animation: 'sp-hop-a 3.2s cubic-bezier(.7,0,.3,1) infinite',
                    pointerEvents: 'none',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#ffffff',
                    opacity: 0.75,
                    animation:
                      'sp-hop-b 2.4s cubic-bezier(.6,.1,.4,.9) infinite',
                    pointerEvents: 'none',
                  }}
                />

                {/* Subtle bottom vignette so the metadata strip below reads as attached */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.35) 100%)',
                    pointerEvents: 'none',
                  }}
                />
              </>
            )}
          </div>

          {/* Metadata strip */}
          <div
            style={{
              padding: 12,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
              borderTop: `1px solid ${th.cardBorder}`,
              background: isDark ? 'rgba(255,255,255,.02)' : '#fff',
            }}
          >
            <img
              src={
                meta?.logo ||
                `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`
              }
              alt=''
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                flexShrink: 0,
                marginTop: 2,
                objectFit: 'contain',
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.visibility =
                  'hidden';
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: th.text,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {meta?.title || hostname || 'Website'}
              </div>
              {meta?.description ? (
                <div
                  style={{
                    fontSize: 11,
                    color: th.textSub,
                    marginTop: 2,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {meta.description}
                </div>
              ) : (
                <div
                  style={{ fontSize: 11, color: th.textMuted, marginTop: 2 }}
                >
                  {hostname}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: status + activity + counters + progress */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            minWidth: 0,
          }}
        >
          {/* Live status line */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: statusDot,
                boxShadow: scanning ? `0 0 8px ${statusDot}` : 'none',
                animation: scanning
                  ? 'sp-pulse 1.1s ease-in-out infinite'
                  : 'none',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: th.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                minWidth: 0,
              }}
            >
              {failed
                ? 'Import failed'
                : done
                  ? 'Import complete'
                  : `Importing ${hostname || 'site'}`}
            </span>
            {canDismiss && (
              <button
                onClick={onDismiss}
                aria-label='Dismiss'
                title='Dismiss'
                style={{
                  width: 26,
                  height: 26,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 999,
                  border: `1px solid ${th.cardBorder}`,
                  background: isDark ? 'rgba(255,255,255,.05)' : '#fff',
                  color: failed ? '#991b1b' : th.textSub,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            )}
          </div>

          {/* Playful rotating message while the import is running */}
          {scanning && (
            <div
              key={funMessage}
              style={{
                fontSize: 12,
                color: th.textMuted,
                fontStyle: 'italic',
                animation: 'sp-fade-in .35s ease both',
              }}
            >
              {funMessage}
            </div>
          )}

          {/* Activity log */}
          <div
            style={{
              borderRadius: 10,
              border: `1px solid ${th.cardBorder}`,
              background: isDark ? 'rgba(255,255,255,.02)' : '#fafafa',
              padding: 10,
              minHeight: 140,
              maxHeight: 180,
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: 5,
              overflow: 'hidden',
            }}
          >
            {log.length === 0 ? (
              <div
                style={{
                  fontSize: 11,
                  color: th.textMuted,
                  fontStyle: 'italic',
                }}
              >
                {scanning
                  ? 'Starting up…'
                  : done
                    ? 'Nothing to report'
                    : 'Idle'}
              </div>
            ) : (
              log.map((line) => (
                <div
                  key={line.id}
                  style={{
                    fontSize: 11,
                    color: th.textSub,
                    animation: 'sp-fade-in .3s ease both',
                    display: 'flex',
                    gap: 6,
                    alignItems: 'flex-start',
                    lineHeight: 1.4,
                  }}
                >
                  <span
                    style={{
                      color:
                        line.kind === 'done'
                          ? '#059669'
                          : line.kind === 'find'
                            ? th.accent
                            : th.textMuted,
                      fontFamily: 'monospace',
                      flexShrink: 0,
                      width: 10,
                      textAlign: 'center',
                    }}
                  >
                    {line.kind === 'done'
                      ? '✓'
                      : line.kind === 'find'
                        ? '+'
                        : '›'}
                  </span>
                  <span style={{ minWidth: 0, wordBreak: 'break-word' }}>
                    {line.text}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Counters */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
          >
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                border: `1px solid ${th.cardBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: th.textMuted,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}
              >
                Pages
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: th.text,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 2,
                  lineHeight: 1,
                }}
              >
                {pages}
              </div>
            </div>
            <div
              style={{
                padding: 10,
                borderRadius: 10,
                border: `1px solid ${th.cardBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: th.textMuted,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}
              >
                Drafts
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: th.text,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 2,
                  lineHeight: 1,
                }}
              >
                {generated}
              </div>
            </div>
          </div>

          {/* Progress */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: th.textMuted,
                  fontWeight: 700,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                }}
              >
                Progress
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: failed ? '#991b1b' : th.text,
                  fontVariantNumeric: 'tabular-nums',
                  fontWeight: 600,
                }}
              >
                {failed ? '—' : `${Math.round(progress)}%`}
              </span>
            </div>
            <div
              style={{
                height: 12,
                borderRadius: 999,
                background: isDark ? 'rgba(255,255,255,.06)' : '#e5e7eb',
                overflow: 'hidden',
                border: `1px solid ${isDark ? 'rgba(255,255,255,.04)' : 'rgba(15,23,42,.04)'}`,
              }}
              role='progressbar'
              aria-valuenow={Math.round(progress)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  background:
                    failed || progress >= 100
                      ? statusDot
                      : `repeating-linear-gradient(45deg, ${statusDot}, ${statusDot} 10px, ${statusDot}dd 10px, ${statusDot}dd 20px)`,
                  backgroundSize:
                    !failed && progress < 100 ? '28px 28px' : undefined,
                  animation:
                    !failed && progress < 100
                      ? 'faq-progress-stripes 1s linear infinite'
                      : undefined,
                  transition: 'width .6s ease',
                  boxShadow: `0 0 8px ${statusDot}55`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function statusColor(status: WebsiteKnowledgeEntry['status']) {
  if (status === 'approved') return '#059669';
  if (status === 'rejected') return '#dc2626';
  return '#d97706';
}

function confidenceLabel(value: number | null) {
  if (value == null) return 'n/a';
  return `${Math.round(value * 100)}%`;
}

function confidencePct(value: number | null | undefined) {
  return Math.round((value ?? 0) * 100);
}

function entityConfidence(entity: KnowledgeEntityReviewItem) {
  return entity.confidence ?? entity.confidence_score ?? null;
}

function documentConfidence(doc: KnowledgeDocumentSummary | null | undefined) {
  return doc?.avg_confidence ?? null;
}

function compactFileSize(bytes?: number | null) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatMoney(value: unknown, currency?: unknown) {
  if (value == null || value === '') return '';
  const code =
    typeof currency === 'string' && currency.trim()
      ? currency.trim().toUpperCase()
      : '';
  const amount =
    typeof value === 'number'
      ? value
      : Number(String(value).replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(amount)) return String(value);
  try {
    return new Intl.NumberFormat(undefined, {
      style: code ? 'currency' : 'decimal',
      currency: code || 'USD',
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code ? `${code} ` : ''}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
  }
}

function entityPriceLabel(entity: KnowledgeEntityReviewItem) {
  const attrs = entity.attributes || {};
  const currency = attrs.currency;
  const variants = Array.isArray(attrs.variants) ? attrs.variants : [];
  const variantLabels = variants
    .filter(
      (variant): variant is Record<string, unknown> =>
        Boolean(variant) && typeof variant === 'object' && 'price' in variant,
    )
    .slice(0, 3)
    .map((variant) => {
      const label =
        typeof variant.name === 'string' && variant.name.trim()
          ? variant.name.trim()
          : 'Variant';
      const price = formatMoney(variant.price, variant.currency || currency);
      return price ? `${label}: ${price}` : '';
    })
    .filter(Boolean);

  if (variantLabels.length) {
    const suffix =
      variants.length > variantLabels.length
        ? ` +${variants.length - variantLabels.length} more`
        : '';
    return `${variantLabels.join(' | ')}${suffix}`;
  }

  return formatMoney(attrs.price, currency);
}

function documentClassLabel(doc?: KnowledgeDocumentSummary | null) {
  const raw = doc?.doc_class || doc?.label || doc?.doc_type || 'Document';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function sourceLabel(url: string | null, path: string | null) {
  if (!url) return '';
  try {
    return `${new URL(url).hostname.replace(/^www\./, '')}${path || ''}`;
  } catch {
    return `${url}${path || ''}`;
  }
}

function splitTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function SourcePreviewFrame({
  entry,
  th,
  isDark,
}: {
  entry: WebsiteKnowledgeEntry;
  th: FaqTheme;
  isDark: boolean;
}) {
  return (
    <div
      style={{
        borderRadius: 14,
        border: `1px solid ${th.cardBorder}`,
        background: isDark ? 'rgba(255,255,255,.04)' : '#f8fafc',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 10px',
          borderBottom: `1px solid ${th.cardBorder}`,
          background: isDark ? 'rgba(255,255,255,.03)' : '#fff',
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: th.textMuted,
          }}
        />
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: th.textMuted,
            opacity: 0.7,
          }}
        />
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: th.textMuted,
            opacity: 0.45,
          }}
        />
        <div
          style={{
            marginLeft: 4,
            minWidth: 0,
            flex: 1,
            borderRadius: 999,
            border: `1px solid ${th.cardBorder}`,
            color: th.textMuted,
            fontSize: 11,
            padding: '5px 9px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            background: isDark ? 'rgba(255,255,255,.04)' : '#f8fafc',
          }}
        >
          {sourceLabel(entry.source_url, entry.source_path) ||
            'extracted source'}
        </div>
      </div>
      <div style={{ padding: 14 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 10,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              color: th.textSub,
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {entry.status}
          </span>
          <span style={{ color: th.textMuted, fontSize: 11, fontWeight: 500 }}>
            {confidenceLabel(entry.confidence)}
          </span>
        </div>
        <div
          style={{
            color: th.text,
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          {entry.question}
        </div>
        <p
          style={{
            color: th.textSub,
            fontSize: 12,
            lineHeight: 1.65,
            margin: '8px 0 0',
          }}
        >
          {entry.answer}
        </p>
      </div>
    </div>
  );
}

function WebsiteEntryCard({
  entry,
  selected,
  busy,
  th,
  isDark,
  onToggle,
  onSave,
  onApprove,
  onReject,
}: {
  entry: WebsiteKnowledgeEntry;
  selected: boolean;
  busy: boolean;
  th: FaqTheme;
  isDark: boolean;
  onToggle: () => void;
  onSave: (id: number, patch: WebsiteEntryPatch) => void;
  onApprove: (id: number, patch?: WebsiteEntryPatch) => void;
  onReject: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState(entry.question);
  const [answer, setAnswer] = useState(entry.answer);
  const [title, setTitle] = useState(entry.display_title || '');
  const [category, setCategory] = useState(entry.category || '');
  const [tags, setTags] = useState((entry.tags || []).join(', '));

  // Track edit dirtiness so we don't overwrite unsaved changes when the parent
  // reloads the list. Same pattern used in FaqCard.
  const cardDirtyRef = useRef(false);
  useEffect(() => {
    if (cardDirtyRef.current || editing) return;
    setQuestion(entry.question);
    setAnswer(entry.answer);
    setTitle(entry.display_title || '');
    setCategory(entry.category || '');
    setTags((entry.tags || []).join(', '));
  }, [entry, editing]);
  const markDirty = () => {
    cardDirtyRef.current = true;
  };

  const status = entry.status;
  const color = statusColor(status);
  const sourceText = sourceLabel(entry.source_url, entry.source_path);
  const structuredKeys = entry.structured_data
    ? Object.keys(entry.structured_data).slice(0, 4)
    : [];
  const draftPatch: WebsiteEntryPatch = {
    question: question.trim(),
    answer: answer.trim(),
    display_title: title.trim() || undefined,
    category: category.trim() || undefined,
    tags: splitTags(tags),
  };

  return (
    <div
      style={{
        borderRadius: 18,
        padding: 16,
        border: `1px solid ${selected ? th.accentBorder : th.cardBorder}`,
        background: selected ? th.accentBg : th.cardBg,
        boxShadow: isDark ? 'none' : '0 10px 28px rgba(15,23,42,.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <button
          onClick={onToggle}
          aria-label={selected ? 'Deselect entry' : 'Select entry'}
          style={{
            width: 28,
            height: 28,
            borderRadius: 10,
            display: 'grid',
            placeItems: 'center',
            border: `1px solid ${selected ? th.accent : th.cardBorder}`,
            background: selected ? th.accent : th.cardBg,
            color: selected ? 'white' : th.textMuted,
            cursor: 'pointer',
            flex: '0 0 auto',
          }}
        >
          {selected && <Check style={{ width: 14, height: 14 }} />}
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                borderRadius: 999,
                padding: '5px 9px',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.05em',
                color,
                background: isDark ? 'rgba(255,255,255,.05)' : '#fff',
                border: `1px solid ${color}33`,
              }}
            >
              {status}
            </span>
            <span
              style={{ color: th.textMuted, fontSize: 11, fontWeight: 600 }}
            >
              Confidence {confidenceLabel(entry.confidence)}
            </span>
            {entry.category && (
              <span
                style={{ color: th.textMuted, fontSize: 11, fontWeight: 600 }}
              >
                {entry.category}
              </span>
            )}
            {entry.entry_type && (
              <span
                style={{ color: th.textMuted, fontSize: 11, fontWeight: 600 }}
              >
                {entry.entry_type}
              </span>
            )}
          </div>

          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input
                value={title}
                onChange={(e) => {
                  markDirty();
                  setTitle(e.target.value);
                }}
                placeholder='Display title'
                style={{
                  border: `1px solid ${th.inputBorder}`,
                  background: th.inputBg,
                  color: th.text,
                  borderRadius: 10,
                  padding: '10px 12px',
                  fontSize: 12,
                  outline: 'none',
                }}
              />
              <input
                value={question}
                onChange={(e) => {
                  markDirty();
                  setQuestion(e.target.value);
                }}
                placeholder='Question'
                style={{
                  border: `1px solid ${th.inputBorder}`,
                  background: th.inputBg,
                  color: th.text,
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
              <textarea
                value={answer}
                onChange={(e) => {
                  markDirty();
                  setAnswer(e.target.value);
                }}
                rows={4}
                placeholder='Answer'
                style={{
                  border: `1px solid ${th.inputBorder}`,
                  background: th.inputBg,
                  color: th.text,
                  borderRadius: 12,
                  padding: '10px 12px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  outline: 'none',
                  resize: 'vertical',
                }}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 1fr',
                  gap: 10,
                }}
              >
                <input
                  value={category}
                  onChange={(e) => {
                    markDirty();
                    setCategory(e.target.value);
                  }}
                  placeholder='Category'
                  style={{
                    border: `1px solid ${th.inputBorder}`,
                    background: th.inputBg,
                    color: th.text,
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
                <input
                  value={tags}
                  onChange={(e) => {
                    markDirty();
                    setTags(e.target.value);
                  }}
                  placeholder='Tags, comma separated'
                  style={{
                    border: `1px solid ${th.inputBorder}`,
                    background: th.inputBg,
                    color: th.text,
                    borderRadius: 12,
                    padding: '10px 12px',
                    fontSize: 12,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          ) : (
            <>
              <h3
                style={{
                  color: th.text,
                  fontSize: 15,
                  lineHeight: 1.35,
                  fontWeight: 700,
                  margin: 0,
                }}
              >
                {entry.display_title || entry.question}
              </h3>
              {entry.display_title && (
                <p
                  style={{
                    color: th.textSub,
                    margin: '4px 0 0',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {entry.question}
                </p>
              )}
              <p
                style={{
                  color: th.textSub,
                  margin: '8px 0 0',
                  fontSize: 13,
                  lineHeight: 1.65,
                }}
              >
                {entry.answer}
              </p>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {(editing ? splitTags(tags) : entry.tags || [])
          .slice(0, 6)
          .map((tag) => (
            <span
              key={tag}
              style={{
                color: th.textSub,
                background: isDark
                  ? 'rgba(255,255,255,.05)'
                  : 'rgba(248,250,252,.9)',
                border: `1px solid ${th.cardBorder}`,
                borderRadius: 999,
                padding: '5px 9px',
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {tag}
            </span>
          ))}
        {structuredKeys.map((key) => (
          <span
            key={key}
            style={{
              color: th.accent,
              background: th.accentBg,
              border: `1px solid ${th.accentBorder}`,
              borderRadius: 999,
              padding: '5px 9px',
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {key}
          </span>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          paddingTop: 10,
          borderTop: `1px solid ${th.cardBorder}`,
        }}
      >
        {entry.source_url && (
          <a
            href={entry.source_url}
            target='_blank'
            rel='noreferrer'
            style={{
              color: th.textMuted,
              fontSize: 11,
              fontWeight: 600,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              maxWidth: 260,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <ExternalLink style={{ width: 12, height: 12, flex: '0 0 auto' }} />
            {sourceText}
          </a>
        )}

        <div style={{ flex: 1 }} />

        {editing ? (
          <>
            <button
              onClick={() => {
                cardDirtyRef.current = false;
                setEditing(false);
                setQuestion(entry.question);
                setAnswer(entry.answer);
                setTitle(entry.display_title || '');
                setCategory(entry.category || '');
                setTags((entry.tags || []).join(', '));
              }}
              disabled={busy}
              style={reviewButtonStyle(th, isDark)}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(entry.id, draftPatch);
                cardDirtyRef.current = false;
                setEditing(false);
              }}
              disabled={busy || !question.trim() || !answer.trim()}
              style={reviewButtonStyle(th, isDark, th.accent)}
            >
              Save
            </button>
          </>
        ) : (
          <button
            onClick={() => {
              cardDirtyRef.current = false;
              setEditing(true);
            }}
            disabled={busy}
            style={reviewButtonStyle(th, isDark)}
          >
            <Edit3 style={{ width: 13, height: 13 }} />
            Edit
          </button>
        )}

        <button
          onClick={() => onReject(entry.id)}
          disabled={busy || status === 'rejected'}
          style={reviewButtonStyle(th, isDark, '#dc2626')}
        >
          <XCircle style={{ width: 13, height: 13 }} />
          {status === 'approved' ? 'Move to rejected' : 'Reject'}
        </button>
        <button
          onClick={() => onApprove(entry.id, editing ? draftPatch : undefined)}
          disabled={
            busy || status === 'approved' || !question.trim() || !answer.trim()
          }
          style={reviewButtonStyle(th, isDark, '#059669')}
        >
          <CheckCircle2 style={{ width: 13, height: 13 }} />
          {status === 'rejected' ? 'Bring back as FAQ' : 'Approve'}
        </button>
      </div>
    </div>
  );
}

function reviewButtonStyle(
  th: FaqTheme,
  isDark: boolean,
  color?: string,
): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: `1px solid ${color ? `${color}33` : th.cardBorder}`,
    background: color ? (isDark ? `${color}18` : '#fff') : th.cardBg,
    color: color || th.textSub,
    padding: '9px 12px',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: isDark ? 'none' : '0 2px 8px rgba(15,23,42,.04)',
  };
}

/** Compact icon-button style for inline row actions. */
function rowActionStyle(th: FaqTheme, isDark: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
    borderRadius: 8,
    border: `1px solid ${th.cardBorder}`,
    background: isDark ? 'rgba(255,255,255,.03)' : '#fff',
    color: th.textSub,
    padding: '6px 8px',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    boxShadow: isDark ? 'none' : '0 1px 3px rgba(15,23,42,.04)',
  };
}

function inspectorFieldStyle(th: FaqTheme): React.CSSProperties {
  return {
    width: '100%',
    borderRadius: 12,
    border: `1px solid ${th.inputBorder}`,
    background: th.inputBg,
    color: th.text,
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function WebsiteEntriesReview({
  entries,
  loading,
  filter,
  search,
  selectedIds,
  busyId,
  th,
  isDark,
  onFilter,
  onSearch,
  onToggle,
  onSelectAllDrafts,
  onRefresh,
  onSave,
  onApprove,
  onReject,
  onBulkApprove,
  onBulkReject,
}: {
  entries: WebsiteKnowledgeEntry[];
  loading: boolean;
  filter: EntryFilter;
  search: string;
  selectedIds: Set<number>;
  busyId: number | 'bulk' | null;
  th: FaqTheme;
  isDark: boolean;
  onFilter: (filter: EntryFilter) => void;
  onSearch: (search: string) => void;
  onToggle: (id: number) => void;
  onSelectAllDrafts: () => void;
  onRefresh: () => void;
  onSave: (id: number, patch: WebsiteEntryPatch) => void;
  onApprove: (id: number, patch?: WebsiteEntryPatch) => void;
  onReject: (id: number) => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');
  const [editAnswer, setEditAnswer] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTags, setEditTags] = useState('');

  const visible = entries.filter((entry) => {
    if (filter !== 'all' && entry.status !== filter) return false;
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return [
      entry.question,
      entry.answer,
      entry.display_title || '',
      entry.category || '',
      ...(entry.tags || []),
    ].some((value) => value.toLowerCase().includes(needle));
  });
  const approved = entries.filter((entry) => entry.status === 'approved');
  const counts = {
    all: entries.length,
    draft: entries.filter((entry) => entry.status === 'draft').length,
    approved: approved.length,
    rejected: entries.filter((entry) => entry.status === 'rejected').length,
  };
  const active =
    entries.find((entry) => entry.id === activeId) ||
    visible[0] ||
    entries[0] ||
    null;
  const selectedCount = selectedIds.size;

  const beginEdit = (entry: WebsiteKnowledgeEntry) => {
    setEditing(true);
    setEditQuestion(entry.question);
    setEditAnswer(entry.answer);
    setEditCategory(entry.category || '');
    setEditTags((entry.tags || []).join(', '));
  };

  const saveActive = () => {
    if (!active) return;
    onSave(active.id, {
      question: editQuestion.trim(),
      answer: editAnswer.trim(),
      category: editCategory.trim() || undefined,
      tags: splitTags(editTags),
    });
    setEditing(false);
  };

  const rowStyle = (entry: WebsiteKnowledgeEntry): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: '34px minmax(260px, 1.5fr) 110px 96px 92px',
    alignItems: 'center',
    gap: 12,
    padding: '11px 14px',
    borderBottom: `1px solid ${th.cardBorder}`,
    background: active?.id === entry.id ? th.accentBg : 'transparent',
    cursor: 'pointer',
  });

  return (
    <section
      className='knowledge-review-shell'
      style={{
        borderRadius: 18,
        border: `1px solid ${th.cardBorder}`,
        background: isDark ? 'rgba(18,22,44,.78)' : 'rgba(255,255,255,.96)',
        boxShadow: isDark ? 'none' : '0 18px 44px rgba(15,23,42,.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 20px',
          borderBottom: `1px solid ${th.cardBorder}`,
        }}
      >
        <div>
          <div style={{ color: th.text, fontSize: 18, fontWeight: 700 }}>
            Knowledge Review
          </div>
          <div style={{ color: th.textSub, fontSize: 12, marginTop: 4 }}>
            Review extracted website answers, approve what should be available
            to chat, and keep a clear saved ledger.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onRefresh}
            style={reviewButtonStyle(th, isDark, th.accent)}
          >
            {loading ? (
              <Loader2
                style={{
                  width: 13,
                  height: 13,
                  animation: 'faq-spin .7s linear infinite',
                }}
              />
            ) : null}
            Refresh
          </button>
          <button
            onClick={onSelectAllDrafts}
            disabled={!counts.draft}
            style={reviewButtonStyle(th, isDark)}
          >
            Select Drafts
          </button>
          <button
            onClick={onBulkReject}
            disabled={!selectedCount || busyId === 'bulk'}
            style={reviewButtonStyle(th, isDark, '#dc2626')}
          >
            Reject {selectedCount ? `(${selectedCount})` : ''}
          </button>
          <button
            onClick={onBulkApprove}
            disabled={!selectedCount || busyId === 'bulk'}
            style={reviewButtonStyle(th, isDark, '#059669')}
          >
            Approve {selectedCount ? `(${selectedCount})` : ''}
          </button>
        </div>
      </div>

      <div
        className='knowledge-review-grid'
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.35fr) minmax(360px, .65fr)',
          minHeight: 520,
        }}
      >
        <div style={{ borderRight: `1px solid ${th.cardBorder}`, minWidth: 0 }}>
          <div
            style={{
              padding: 14,
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {(
              [
                ['all', 'All', counts.all, th.accent],
                ['draft', 'Draft', counts.draft, '#d97706'],
                ['approved', 'Approved', counts.approved, '#059669'],
                ['rejected', 'Rejected', counts.rejected, '#dc2626'],
              ] as [EntryFilter, string, number, string][]
            ).map(([key, label, count, color]) => (
              <button
                key={key}
                onClick={() => onFilter(key)}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${filter === key ? `${color}55` : th.cardBorder}`,
                  background: filter === key ? `${color}10` : 'transparent',
                  padding: '10px 12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color, fontSize: 18, fontWeight: 700 }}>
                  {count}
                </div>
                <div
                  style={{
                    color: th.textMuted,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </div>
              </button>
            ))}
          </div>

          <div style={{ padding: '0 14px 14px', position: 'relative' }}>
            <Search
              style={{
                position: 'absolute',
                left: 27,
                top: 12,
                width: 14,
                height: 14,
                color: th.textMuted,
              }}
            />
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder='Search extracted knowledge...'
              style={{
                width: '100%',
                borderRadius: 12,
                border: `1px solid ${th.inputBorder}`,
                background: th.inputBg,
                color: th.text,
                padding: '10px 12px 10px 36px',
                outline: 'none',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 740 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    '34px minmax(260px, 1.5fr) 110px 96px 92px',
                  gap: 12,
                  padding: '9px 14px',
                  color: th.textMuted,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  borderTop: `1px solid ${th.cardBorder}`,
                  borderBottom: `1px solid ${th.cardBorder}`,
                }}
              >
                <span />
                <span>Knowledge</span>
                <span>Category</span>
                <span>Confidence</span>
                <span>Status</span>
              </div>
              <div style={{ maxHeight: 330, overflowY: 'auto' }}>
                {visible.map((entry) => (
                  <div
                    key={entry.id}
                    style={rowStyle(entry)}
                    onClick={() => {
                      setActiveId(entry.id);
                      setEditing(false);
                    }}
                  >
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        onToggle(entry.id);
                      }}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 8,
                        border: `1px solid ${selectedIds.has(entry.id) ? th.accent : th.cardBorder}`,
                        background: selectedIds.has(entry.id)
                          ? th.accent
                          : 'transparent',
                        color: selectedIds.has(entry.id)
                          ? 'white'
                          : th.textMuted,
                        display: 'grid',
                        placeItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {selectedIds.has(entry.id) && (
                        <Check style={{ width: 13, height: 13 }} />
                      )}
                    </button>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          color: th.text,
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {entry.display_title || entry.question}
                      </div>
                      <div
                        style={{
                          color: th.textMuted,
                          fontSize: 11,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 3,
                        }}
                      >
                        {entry.answer}
                      </div>
                    </div>
                    <span style={{ color: th.textSub, fontSize: 12 }}>
                      {entry.category || 'general'}
                    </span>
                    <span
                      style={{
                        color:
                          entry.confidence && entry.confidence >= 0.75
                            ? '#059669'
                            : '#d97706',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {confidenceLabel(entry.confidence)}
                    </span>
                    <span
                      style={{
                        color: statusColor(entry.status),
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: 'capitalize',
                      }}
                    >
                      {entry.status}
                    </span>
                  </div>
                ))}
                {!visible.length && (
                  <div
                    style={{
                      color: th.textSub,
                      padding: 28,
                      textAlign: 'center',
                      fontSize: 13,
                    }}
                  >
                    {loading
                      ? 'Loading extracted knowledge...'
                      : 'No entries match this view.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: 14, borderTop: `1px solid ${th.cardBorder}` }}>
            <div
              style={{
                color: th.text,
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 10,
              }}
            >
              Saved knowledge
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table
                className='lashvae-column-dividers'
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  minWidth: 620,
                }}
              >
                <thead>
                  <tr
                    style={{
                      color: th.textMuted,
                      fontSize: 10,
                      textTransform: 'uppercase',
                      textAlign: 'left',
                    }}
                  >
                    <th style={{ padding: '8px 6px' }}>Question</th>
                    <th style={{ padding: '8px 6px' }}>Category</th>
                    <th style={{ padding: '8px 6px' }}>Source</th>
                    <th style={{ padding: '8px 6px' }}>Embed</th>
                  </tr>
                </thead>
                <tbody>
                  {approved.slice(0, 8).map((entry) => (
                    <tr
                      key={entry.id}
                      style={{
                        borderTop: `1px solid ${th.cardBorder}`,
                        color: th.textSub,
                        fontSize: 12,
                      }}
                    >
                      <td
                        style={{
                          padding: '9px 6px',
                          color: th.text,
                          fontWeight: 600,
                        }}
                      >
                        {entry.question}
                      </td>
                      <td style={{ padding: '9px 6px' }}>
                        {entry.category || 'general'}
                      </td>
                      <td style={{ padding: '9px 6px' }}>
                        {sourceLabel(entry.source_url, entry.source_path)}
                      </td>
                      <td
                        style={{
                          padding: '9px 6px',
                          color:
                            entry.embed_status === 'embedded'
                              ? '#059669'
                              : '#d97706',
                        }}
                      >
                        {entry.embed_status}
                      </td>
                    </tr>
                  ))}
                  {!approved.length && (
                    <tr>
                      <td
                        colSpan={4}
                        style={{
                          padding: 18,
                          textAlign: 'center',
                          color: th.textMuted,
                          fontSize: 12,
                        }}
                      >
                        Approved knowledge will appear here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <aside style={{ padding: 18, minWidth: 0 }}>
          {active ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div
                    style={{
                      color: statusColor(active.status),
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {active.status}
                  </div>
                  <h3
                    style={{
                      color: th.text,
                      fontSize: 17,
                      lineHeight: 1.35,
                      margin: '6px 0 0',
                      fontWeight: 700,
                    }}
                  >
                    {active.display_title || active.question}
                  </h3>
                </div>
                <span
                  style={{ color: th.textMuted, fontSize: 12, fontWeight: 600 }}
                >
                  {confidenceLabel(active.confidence)}
                </span>
              </div>

              {editing ? (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <input
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    style={inspectorFieldStyle(th)}
                  />
                  <textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    rows={7}
                    style={{
                      ...inspectorFieldStyle(th),
                      resize: 'vertical',
                      lineHeight: 1.6,
                    }}
                  />
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder='Category'
                    style={inspectorFieldStyle(th)}
                  />
                  <input
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder='Tags, comma separated'
                    style={inspectorFieldStyle(th)}
                  />
                </div>
              ) : (
                <>
                  <SourcePreviewFrame entry={active} th={th} isDark={isDark} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {(active.tags || []).slice(0, 8).map((tag) => (
                      <span
                        key={tag}
                        style={{
                          borderRadius: 999,
                          border: `1px solid ${th.cardBorder}`,
                          padding: '5px 8px',
                          color: th.textSub,
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {active.source_url && (
                    <a
                      href={active.source_url}
                      target='_blank'
                      rel='noreferrer'
                      style={{
                        color: th.accent,
                        textDecoration: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                        display: 'inline-flex',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      <ExternalLink style={{ width: 13, height: 13 }} />
                      {sourceLabel(active.source_url, active.source_path)}
                    </a>
                  )}
                </>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  color: th.textSub,
                  fontSize: 12,
                }}
              >
                <div>
                  <b style={{ color: th.text }}>Category</b>
                  <br />
                  {active.category || 'general'}
                </div>
                <div>
                  <b style={{ color: th.text }}>Embedding</b>
                  <br />
                  {active.embed_status}
                </div>
                <div>
                  <b style={{ color: th.text }}>Type</b>
                  <br />
                  {active.entry_type || 'answer'}
                </div>
                <div>
                  <b style={{ color: th.text }}>Entry ID</b>
                  <br />#{active.id}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 8,
                  paddingTop: 8,
                  borderTop: `1px solid ${th.cardBorder}`,
                }}
              >
                {editing ? (
                  <>
                    <button
                      onClick={() => setEditing(false)}
                      style={reviewButtonStyle(th, isDark)}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveActive}
                      disabled={
                        !editQuestion.trim() ||
                        !editAnswer.trim() ||
                        busyId === active.id
                      }
                      style={reviewButtonStyle(th, isDark, th.accent)}
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => beginEdit(active)}
                    style={reviewButtonStyle(th, isDark)}
                  >
                    <Edit3 style={{ width: 13, height: 13 }} />
                    Edit
                  </button>
                )}
                <button
                  onClick={() => onReject(active.id)}
                  disabled={
                    active.status === 'rejected' || busyId === active.id
                  }
                  style={reviewButtonStyle(th, isDark, '#dc2626')}
                >
                  {active.status === 'approved' ? 'Move to rejected' : 'Reject'}
                </button>
                <button
                  onClick={() => onApprove(active.id)}
                  disabled={
                    active.status === 'approved' || busyId === active.id
                  }
                  style={reviewButtonStyle(th, isDark, '#059669')}
                >
                  {active.status === 'rejected'
                    ? 'Bring back as FAQ'
                    : 'Approve'}
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{ color: th.textSub, textAlign: 'center', padding: 40 }}
            >
              Select an entry to inspect it.
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function WorkbenchTab({
  active,
  icon,
  label,
  count,
  description,
  onClick,
  coach,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  count?: number;
  description: string;
  onClick: () => void;
  coach?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative flex min-h-33 flex-col items-start overflow-hidden rounded-xl border p-6 text-left shadow-theme-xs transition-all duration-200',
        active
          ? 'border-brand-300 bg-linear-to-br from-brand-50 via-white to-blue-50 shadow-sm dark:border-brand-500/30 dark:from-brand-500/15 dark:via-gray-900 dark:to-blue-500/10'
          : 'border-gray-200 bg-linear-to-br from-white via-white to-gray-50 hover:border-brand-200 hover:from-brand-50/60 hover:to-blue-50/60 hover:shadow-sm dark:border-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-white/3 dark:hover:border-brand-500/20 dark:hover:from-brand-500/10 dark:hover:to-blue-500/5',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl',
          active
            ? 'bg-brand-200/60 dark:bg-brand-500/20'
            : 'bg-blue-100/50 opacity-0 transition-opacity group-hover:opacity-100 dark:bg-blue-500/10',
        )}
      />

      {coach && !active && (
        <span className='absolute -right-1 -top-1 h-3 w-3 rounded-full bg-brand-500 ring-2 ring-white dark:ring-gray-900' />
      )}

      <div className='relative z-10 flex w-full items-start justify-between gap-3'>
        <span
          aria-hidden
          className={cn(
            'flex h-12 w-12 items-center justify-center rounded-xl border shadow-sm',
            active
              ? 'border-brand-200 bg-brand-100/70 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-400'
              : 'border-gray-200 bg-white/80 text-gray-500 dark:border-gray-800 dark:bg-white/4 dark:text-gray-400',
          )}
        >
          {icon}
        </span>

        {typeof count === 'number' && (
          <span
            className={cn(
              'rounded-full px-3 py-1.5 type-small font-semibold tabular-nums',
              active
                ? 'bg-brand-500 text-white shadow-sm'
                : 'bg-white/80 text-gray-700 ring-1 ring-gray-200 dark:bg-white/5 dark:text-white/80 dark:ring-white/10',
            )}
          >
            {count}
          </span>
        )}
      </div>

      <span className='relative z-10 mt-4 type-body font-semibold text-gray-800 dark:text-white/90'>
        {label}
      </span>

      <span className='relative z-10 mt-2 type-small leading-6 text-gray-500 dark:text-gray-400'>
        {description}
      </span>
    </button>
  );
}

function TabTeachingBanner({
  title,
  detail,
  primaryLabel,
  onPrimary,
  icon,
  th,
  isDark,
}: {
  title: string;
  detail: string;
  primaryLabel: string;
  onPrimary: () => void;
  icon: React.ReactNode;
  th: FaqTheme;
  isDark: boolean;
}) {
  void th;
  void isDark;

  return (
    <div className='flex flex-col gap-5 border-b border-gray-100 bg-gray-50 p-6 dark:border-gray-800 dark:bg-white/2 sm:flex-row sm:items-center'>
      <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300'>
        {icon}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='type-body font-semibold text-gray-800 dark:text-white/90'>
          {title}
        </div>
        <div className='mt-2 type-small leading-6 text-gray-500 dark:text-gray-400'>
          {detail}
        </div>
      </div>
      <Button onClick={onPrimary} size='sm' className='shrink-0'>
        {primaryLabel}
      </Button>
    </div>
  );
}

function KnowledgeWorkbench({
  view,
  onView,
  th,
  isDark,
  documents,
  documentsLoading,
  selectedDocumentId,
  documentDetail,
  documentLoading,
  documentBusyId,
  approvalThreshold,
  onApprovalThreshold,
  onRefreshDocuments,
  onSelectDocument,
  onApproveEntity,
  onRejectEntity,
  onSaveEntity,
  onApproveDocumentThreshold,
  websiteEntries,
  websiteLoading,
  websiteFilter,
  websiteSearch,
  selectedWebsiteIds,
  websiteBusyId,
  websiteApprovalThreshold,
  websiteScraperStatus,
  onWebsiteApprovalThreshold,
  onWebsiteFilter,
  onWebsiteSearch,
  onToggleWebsiteEntry,
  onSelectWebsiteDrafts,
  onRefreshWebsite,
  onSaveWebsiteEntry,
  onApproveWebsiteEntry,
  onRejectWebsiteEntry,
  onBulkApproveWebsite,
  onBulkRejectWebsite,
  onDeleteAllRejectedWebsite,
  onApproveWebsiteThreshold,
  onDismissWebsiteScraperStatus,
  onDeleteWebsiteSite,
  savedEntities,
  savedLoading,
  manualCount,
  manualContent,
  onOpenCatalogueUpload,
  onOpenWebscraper,
  coachTab,
  onCoachDismiss,
  onDeleteDocument,
  onDeleteApprovedEntity,
  onBulkDeleteApprovedEntities,
}: {
  view: KnowledgeView;
  onView: (view: KnowledgeView) => void;
  th: FaqTheme;
  isDark: boolean;
  documents: KnowledgeDocumentSummary[];
  documentsLoading: boolean;
  selectedDocumentId: number | null;
  documentDetail: KnowledgeDocumentDetail | null;
  documentLoading: boolean;
  documentBusyId: number | 'bulk' | null;
  approvalThreshold: number;
  onApprovalThreshold: (value: number) => void;
  onRefreshDocuments: () => void;
  onSelectDocument: (id: number) => void;
  onApproveEntity: (id: number) => void;
  onRejectEntity: (id: number) => void;
  onSaveEntity: (
    id: number,
    patch: {
      name?: string;
      description?: string;
      attributes?: Record<string, unknown>;
    },
  ) => void;
  onApproveDocumentThreshold: () => void;
  websiteEntries: WebsiteKnowledgeEntry[];
  websiteLoading: boolean;
  websiteFilter: EntryFilter;
  websiteSearch: string;
  selectedWebsiteIds: Set<number>;
  websiteBusyId: number | 'bulk' | null;
  websiteApprovalThreshold: number;
  websiteScraperStatus: RagStatus | null;
  onWebsiteApprovalThreshold: (value: number) => void;
  onWebsiteFilter: (filter: EntryFilter) => void;
  onWebsiteSearch: (search: string) => void;
  onToggleWebsiteEntry: (id: number) => void;
  onSelectWebsiteDrafts: () => void;
  onRefreshWebsite: () => void;
  onSaveWebsiteEntry: (id: number, patch: WebsiteEntryPatch) => void;
  onApproveWebsiteEntry: (id: number, patch?: WebsiteEntryPatch) => void;
  onRejectWebsiteEntry: (id: number) => void;
  onBulkApproveWebsite: () => void;
  onBulkRejectWebsite: () => void;
  onDeleteAllRejectedWebsite: () => void;
  onApproveWebsiteThreshold: () => void;
  onDismissWebsiteScraperStatus: () => void;
  onDeleteWebsiteSite: (host: string) => void;
  savedEntities: KnowledgeEntityReviewItem[];
  savedLoading: boolean;
  manualCount: number;
  manualContent?: React.ReactNode;
  onOpenCatalogueUpload: () => void;
  onOpenWebscraper: () => void;
  coachTab?: KnowledgeView | null;
  onCoachDismiss?: () => void;
  onDeleteDocument: (id: number, name?: string) => void;
  onDeleteApprovedEntity: (rowId: string) => void;
  onBulkDeleteApprovedEntities: (rowIds: string[]) => void;
}) {
  const approvedWebsites = websiteEntries.filter(
    (entry) => entry.status === 'approved',
  );
  const totalSaved = approvedWebsites.length + savedEntities.length;

  const handleTab = (v: KnowledgeView) => {
    if (coachTab === v && onCoachDismiss) onCoachDismiss();
    onView(v);
  };

  return (
    <section className='faq-workbench-readable overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3'>
      <div className='border-b border-gray-100 px-6 py-6 dark:border-gray-800'>
        <div className='mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <h2 className='type-h4 font-semibold text-gray-800 dark:text-white/90'>
              Knowledge sources
            </h2>
            <p className='mt-1 max-w-2xl type-small leading-6 text-gray-500 dark:text-gray-400'>
              Add, review, and manage the content your bot can use for customer
              answers.
            </p>
          </div>
          <span className='type-small font-medium text-gray-500 dark:text-gray-400'>
            {totalSaved} live items
          </span>
        </div>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4'>
          <WorkbenchTab
            active={view === 'manual'}
            icon={<LayoutList size={22} />}
            label='Write FAQs'
            description='Create and edit manual Q&A entries.'
            count={manualCount}
            onClick={() => handleTab('manual')}
            coach={coachTab === 'manual'}
          />
          <WorkbenchTab
            active={view === 'catalogue'}
            icon={<FileText size={22} />}
            label='Upload docs'
            description='Review knowledge extracted from files.'
            count={documents.length}
            onClick={() => handleTab('catalogue')}
            coach={coachTab === 'catalogue'}
          />
          <WorkbenchTab
            active={view === 'website'}
            icon={<Globe2 size={22} />}
            label='Import from site'
            description='Turn website pages into draft answers.'
            count={websiteEntries.length}
            onClick={() => handleTab('website')}
            coach={coachTab === 'website'}
          />
          <WorkbenchTab
            active={view === 'saved'}
            icon={<Database size={22} />}
            label='Live knowledge'
            description='Manage content currently used by the bot.'
            count={totalSaved}
            onClick={() => handleTab('saved')}
            coach={coachTab === 'saved'}
          />
        </div>
      </div>
      <div className='border-b border-gray-100 bg-gray-50 px-6 py-4 type-body leading-7 text-gray-500 dark:border-gray-800 dark:bg-white/2 dark:text-gray-400'>
        {view === 'manual' && (
          <>
            <strong className='font-semibold text-gray-800 dark:text-white/90'>
              Write:
            </strong>{' '}
            Add or edit FAQs one at a time. Best for a few known customer
            questions.
          </>
        )}
        {view === 'catalogue' && (
          <>
            <strong className='font-semibold text-gray-800 dark:text-white/90'>
              Upload docs:
            </strong>{' '}
            Drop in PDFs, spreadsheets, or Word files. We pull out Q&amp;A-style
            items and put them here for you to review before your bot uses them.
          </>
        )}
        {view === 'website' && (
          <>
            <strong className='font-semibold text-gray-800 dark:text-white/90'>
              Import from site:
            </strong>{' '}
            Give us a URL and we crawl it to find FAQ-worthy content. Review
            each item before it goes live.
          </>
        )}
        {view === 'saved' && (
          <>
            <strong className='font-semibold text-gray-800 dark:text-white/90'>
              Live knowledge:
            </strong>{' '}
            Everything your bot is currently answering from. Remove items here
            to stop the bot from using them.
          </>
        )}
      </div>

      {((view === 'catalogue' && documents.length > 0) ||
        (view === 'website' && websiteEntries.length > 0)) && (
        <div className='flex justify-end border-b border-gray-100 bg-gray-50 px-6 py-3 dark:border-gray-800 dark:bg-white/2'>
          {view === 'catalogue' && (
            <Button size='sm' onClick={onOpenCatalogueUpload}>
              <FileText size={14} />
              Upload catalogue
            </Button>
          )}
          {view === 'website' && (
            <Button size='sm' onClick={onOpenWebscraper}>
              <Globe2 size={14} />
              Import from site
            </Button>
          )}
        </div>
      )}

      {view === 'catalogue' && documents.length === 0 && documentsLoading && (
        <div
          style={{
            padding: '40px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Loader2
            style={{
              width: 26,
              height: 26,
              color: th.accent,
              animation: 'faq-spin .8s linear infinite',
            }}
          />
          <div style={{ fontSize: 13, color: th.textSub, fontWeight: 600 }}>
            Loading your uploaded documents…
          </div>
        </div>
      )}
      {view === 'catalogue' && documents.length === 0 && !documentsLoading && (
        <TabTeachingBanner
          title='Point us at a menu, price list, or brochure'
          detail='We read the document, extract each entry, and let you review before it goes live to the bot.'
          primaryLabel='Upload catalogue'
          onPrimary={onOpenCatalogueUpload}
          icon={<FileText style={{ width: 18, height: 18 }} />}
          th={th}
          isDark={isDark}
        />
      )}
      {view === 'website' &&
        websiteEntries.length === 0 &&
        websiteLoading &&
        !websiteScraperStatus && (
          <div
            style={{
              padding: '40px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Loader2
              style={{
                width: 26,
                height: 26,
                color: th.accent,
                animation: 'faq-spin .8s linear infinite',
              }}
            />
            <div style={{ fontSize: 13, color: th.textSub, fontWeight: 600 }}>
              Loading imported website content…
            </div>
          </div>
        )}
      {view === 'website' &&
        websiteEntries.length === 0 &&
        !websiteLoading &&
        !websiteScraperStatus && (
          <TabTeachingBanner
            title='Have a website? Let us read it for you'
            detail='Give us a URL and we visit the pages, pull the useful bits, and turn them into draft Q&As you can approve.'
            primaryLabel='Import from site'
            onPrimary={onOpenWebscraper}
            icon={<Globe2 style={{ width: 18, height: 18 }} />}
            th={th}
            isDark={isDark}
          />
        )}
      {view === 'saved' && totalSaved === 0 && savedLoading && (
        <div
          style={{
            padding: '40px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Loader2
            style={{
              width: 26,
              height: 26,
              color: th.accent,
              animation: 'faq-spin .8s linear infinite',
            }}
          />
          <div style={{ fontSize: 13, color: th.textSub, fontWeight: 600 }}>
            Loading your live knowledge…
          </div>
        </div>
      )}
      {view === 'saved' && totalSaved === 0 && !savedLoading && (
        <TabTeachingBanner
          title='This is where approved entries live'
          detail='Anything you approve from other tabs shows up here — this is what your bot answers from.'
          primaryLabel={
            documents.length > 0 || websiteEntries.length > 0
              ? 'Review pending drafts'
              : 'Add your first source'
          }
          onPrimary={() =>
            onView(
              documents.length > 0
                ? 'catalogue'
                : websiteEntries.length > 0
                  ? 'website'
                  : 'manual',
            )
          }
          icon={<Database style={{ width: 18, height: 18 }} />}
          th={th}
          isDark={isDark}
        />
      )}

      {view === 'catalogue' && (
        <CatalogueWorkspace
          documents={documents}
          loading={documentsLoading}
          selectedDocumentId={selectedDocumentId}
          detail={documentDetail}
          detailLoading={documentLoading}
          busyId={documentBusyId}
          threshold={approvalThreshold}
          onThreshold={onApprovalThreshold}
          onRefresh={onRefreshDocuments}
          onSelect={onSelectDocument}
          onApprove={onApproveEntity}
          onReject={onRejectEntity}
          onSave={onSaveEntity}
          onApproveThreshold={onApproveDocumentThreshold}
          onDeleteDocument={onDeleteDocument}
          th={th}
          isDark={isDark}
        />
      )}

      {view === 'website' && (
        <WebsiteReviewPane
          entries={websiteEntries}
          loading={websiteLoading}
          filter={websiteFilter}
          search={websiteSearch}
          selectedIds={selectedWebsiteIds}
          busyId={websiteBusyId}
          threshold={websiteApprovalThreshold}
          scraperStatus={websiteScraperStatus}
          onThreshold={onWebsiteApprovalThreshold}
          onFilter={onWebsiteFilter}
          onSearch={onWebsiteSearch}
          onToggle={onToggleWebsiteEntry}
          onSelectAllDrafts={onSelectWebsiteDrafts}
          onRefresh={onRefreshWebsite}
          onSave={onSaveWebsiteEntry}
          onApprove={onApproveWebsiteEntry}
          onReject={onRejectWebsiteEntry}
          onBulkApprove={onBulkApproveWebsite}
          onBulkReject={onBulkRejectWebsite}
          onDeleteAllRejected={onDeleteAllRejectedWebsite}
          onApproveThreshold={onApproveWebsiteThreshold}
          onDismissScraperStatus={onDismissWebsiteScraperStatus}
          onDeleteSite={onDeleteWebsiteSite}
          onOpenImport={onOpenWebscraper}
          th={th}
          isDark={isDark}
        />
      )}

      {view === 'saved' && (
        <SavedKnowledgeLedger
          websiteEntries={approvedWebsites}
          documentEntities={savedEntities}
          loading={savedLoading}
          onDelete={onDeleteApprovedEntity}
          onBulkDelete={onBulkDeleteApprovedEntities}
          th={th}
        />
      )}

      {view === 'manual' && manualContent}
    </section>
  );
}

function CatalogueWorkspace({
  documents,
  loading,
  selectedDocumentId,
  detail,
  detailLoading,
  busyId,
  threshold,
  onThreshold,
  onRefresh,
  onSelect,
  onApprove,
  onReject,
  onSave,
  onApproveThreshold,
  onDeleteDocument,
  th,
  isDark,
}: {
  documents: KnowledgeDocumentSummary[];
  loading: boolean;
  selectedDocumentId: number | null;
  detail: KnowledgeDocumentDetail | null;
  detailLoading: boolean;
  busyId: number | 'bulk' | null;
  threshold: number;
  onThreshold: (value: number) => void;
  onRefresh: () => void;
  onSelect: (id: number) => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onSave: (
    id: number,
    patch: {
      name?: string;
      description?: string;
      attributes?: Record<string, unknown>;
    },
  ) => void;
  onApproveThreshold: () => void;
  onDeleteDocument: (id: number, name?: string) => void;
  th: FaqTheme;
  isDark: boolean;
}) {
  const selectedDoc =
    documents.find((doc) => doc.document_id === selectedDocumentId) ||
    documents[0] ||
    null;
  const entities = detail?.entities || [];
  const pendingAbove = entities.filter((entity) => {
    const status = entity.approval_status;
    return (
      status !== 'approved' &&
      status !== 'rejected' &&
      confidencePct(entityConfidence(entity)) >= threshold
    );
  }).length;

  return (
    <div className='grid min-h-140 grid-cols-1 items-start lg:grid-cols-[minmax(300px,1fr)_minmax(420px,1.2fr)]'>
      {/* Documents column */}
      <div
        className='min-w-0 border-t first:border-t-0 lg:border-t-0 lg:border-r'
        style={{ borderColor: th.cardBorder }}
      >
        <div className='flex flex-wrap items-center justify-between gap-3 p-3.5'>
          <div>
            <div style={{ color: th.text, fontSize: 16, fontWeight: 600 }}>
              Uploaded documents
            </div>
            <div style={{ color: th.textMuted, fontSize: 12, marginTop: 2 }}>
              {loading ? 'Refreshing...' : `${documents.length} files`}
            </div>
          </div>
          <button
            onClick={onRefresh}
            style={{ ...reviewButtonStyle(th, isDark), fontWeight: 500 }}
          >
            <RefreshCw style={{ width: 15, height: 15 }} />
            Refresh
          </button>
        </div>

        <div
          className='max-h-80 overflow-y-auto border-t lg:max-h-123'
          style={{ borderColor: th.cardBorder }}
        >
          {documents.map((doc) => {
            const active = selectedDoc?.document_id === doc.document_id;
            return (
              <div
                key={doc.document_id}
                className='relative grid grid-cols-[1fr_auto] border-b'
                style={{
                  borderColor: th.cardBorder,
                  background: active
                    ? isDark
                      ? 'rgba(255,255,255,.04)'
                      : '#f8fafc'
                    : 'transparent',
                }}
              >
                <button
                  onClick={() => onSelect(doc.document_id)}
                  className='grid min-w-0 cursor-pointer grid-cols-[32px_1fr_auto] items-center gap-3 border-0 bg-transparent px-3.5 py-3.5 text-left'
                  style={{ color: th.text }}
                >
                  <span
                    className='grid h-7.5 w-7.5 place-items-center rounded-(--radius-control) border'
                    style={{
                      borderColor: th.cardBorder,
                      color: th.textMuted,
                      background: active ? th.cardBg : 'transparent',
                    }}
                  >
                    <FileText style={{ width: 16, height: 16 }} />
                  </span>
                  <span className='min-w-0'>
                    <span className='block overflow-hidden text-ellipsis whitespace-nowrap type-small font-medium'>
                      {doc.filename}
                    </span>
                    <span
                      className='mt-0.75 block type-caption'
                      style={{ color: th.textMuted }}
                    >
                      {documentClassLabel(doc)}
                      {doc.page_count ? ` - ${doc.page_count}p` : ''}
                      {doc.entity_count
                        ? ` - ${doc.entity_count} entities`
                        : ''}
                    </span>
                  </span>
                  <span
                    className='whitespace-nowrap rounded-full px-2 py-1.25 type-caption font-medium'
                    style={{
                      color: th.textSub,
                      background: isDark ? 'rgba(255,255,255,.04)' : '#f8fafc',
                    }}
                  >
                    {doc.ingestion_status}
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteDocument(doc.document_id, doc.filename);
                  }}
                  title='Delete document'
                  className='flex cursor-pointer items-center justify-center border-0 bg-transparent px-3'
                  style={{ color: th.textMuted }}
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>
            );
          })}

          {!documents.length && (
            <div
              className='p-7 text-center type-small'
              style={{ color: th.textSub }}
            >
              {loading
                ? 'Loading uploaded catalogues...'
                : 'Upload a catalogue to start extraction.'}
            </div>
          )}
        </div>
      </div>

      {/* Preview column */}
      <div
        className='min-w-0 border-t lg:border-t-0'
        style={{ borderColor: th.cardBorder }}
      >
        <DocumentPreviewPanel
          doc={selectedDoc}
          detail={detail}
          loading={detailLoading}
          th={th}
          isDark={isDark}
        />
      </div>

      {/* Review row (spans both columns, sits below Documents + Preview) */}
      <div
        className='min-w-0 border-t lg:col-span-2'
        style={{ borderColor: th.cardBorder }}
      >
        <div className='border-b p-4' style={{ borderColor: th.cardBorder }}>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='min-w-0 flex-1'>
              <div style={{ color: th.text, fontSize: 17, fontWeight: 700 }}>
                Review what we found
              </div>
              <div
                className='mt-0.75 type-small leading-relaxed'
                style={{ color: th.textSub }}
              >
                {detailLoading
                  ? 'Reading your document…'
                  : entities.length === 0
                    ? 'Nothing to review yet.'
                    : `We pulled out ${entities.length} item${entities.length === 1 ? '' : 's'} — approve each one to send it to your bot, or reject the ones that don't fit.`}
              </div>
            </div>
            <button
              onClick={onApproveThreshold}
              disabled={!pendingAbove || busyId === 'bulk'}
              className='whitespace-nowrap font-bold'
              style={{
                ...reviewButtonStyle(
                  th,
                  isDark,
                  pendingAbove ? '#059669' : undefined,
                ),
                opacity: pendingAbove ? 1 : 0.45,
              }}
              title={
                pendingAbove
                  ? `Approve ${pendingAbove} item${pendingAbove === 1 ? '' : 's'} we're at least ${threshold}% sure about`
                  : 'No items meet the confidence bar you set'
              }
            >
              {pendingAbove > 0
                ? `Approve ${pendingAbove} good match${pendingAbove === 1 ? '' : 'es'}`
                : 'No good matches yet'}
            </button>
          </div>

          <div
            className='mt-4 rounded-xl border p-3'
            style={{
              background: isDark
                ? 'rgba(255,255,255,.03)'
                : 'rgba(248,250,252,.7)',
              borderColor: th.cardBorder,
            }}
          >
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <div>
                <div style={{ color: th.text, fontSize: 14, fontWeight: 700 }}>
                  How picky should we be?
                </div>
                <div
                  className='mt-0.5 type-small'
                  style={{ color: th.textMuted }}
                >
                  Only auto-approve items we&apos;re at least this sure about.
                </div>
              </div>

              <div
                className='inline-flex shrink-0 items-center gap-2 rounded-(--radius-control) border p-1'
                style={{ borderColor: th.cardBorder }}
              >
                <button
                  type='button'
                  onClick={() => onThreshold(Math.max(50, threshold - 5))}
                  disabled={threshold <= 50}
                  aria-label='Lower the confidence bar'
                  style={{
                    ...previewIconButton(th, isDark),
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    opacity: threshold <= 50 ? 0.4 : 1,
                    cursor: threshold <= 50 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Minus size={16} />
                </button>
                <span
                  className='min-w-14.5 text-center type-card-title font-extrabold tabular-nums'
                  style={{ color: th.text }}
                >
                  {threshold}%
                </span>
                <button
                  type='button'
                  onClick={() => onThreshold(Math.min(100, threshold + 5))}
                  disabled={threshold >= 100}
                  aria-label='Raise the confidence bar'
                  style={{
                    ...previewIconButton(th, isDark),
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    opacity: threshold >= 100 ? 0.4 : 1,
                    cursor: threshold >= 100 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
            <div
              className='mt-2 flex flex-wrap justify-between gap-1 type-caption font-semibold'
              style={{ color: th.textMuted }}
            >
              <span>50% — more items, less careful</span>
              <span>100% — only the surest matches</span>
            </div>
            <div
              className='mt-2.5 type-small leading-relaxed'
              style={{ color: th.textMuted }}
            >
              Anything less confident stays as a draft below for you to check by
              hand.
            </div>
          </div>
        </div>

        <DocumentEntityReview
          entities={entities}
          loading={detailLoading}
          busyId={busyId}
          onApprove={onApprove}
          onReject={onReject}
          onSave={onSave}
          th={th}
          isDark={isDark}
        />
      </div>
    </div>
  );
}

function DocumentPreviewPanel({
  doc,
  detail,
  loading,
  th,
  isDark,
}: {
  doc: KnowledgeDocumentSummary | null;
  detail: KnowledgeDocumentDetail | null;
  loading: boolean;
  th: FaqTheme;
  isDark: boolean;
}) {
  const [zoom, setZoom] = useState(1);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewError, setPreviewError] = useState('');
  const filename = doc?.filename || '';
  const lower = filename.toLowerCase();
  const isPdf = lower.endsWith('.pdf') || doc?.doc_type === 'pdf';
  const isImage =
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename) || doc?.doc_type === 'image';
  const entities = detail?.entities || [];
  const approved = entities.filter(
    (entity) => entity.approval_status === 'approved',
  ).length;

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    // Resets local UI-only state (a flag, warning, or preview value)
    // when the relevant prop/dependency changes — not deriving render
    // output from state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewError('');
    setPreviewUrl('');

    if (!doc) return;

    fetchKnowledgeDocumentPreview(doc.document_id)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setPreviewError(errorMessage(error, 'Preview could not be loaded'));
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [doc?.document_id]);

  return (
    <div
      className='document-preview-panel'
      style={{
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignSelf: 'start',
        position: 'sticky',
        top: 12,
      }}
    >
      <div
        style={{
          padding: 14,
          display: 'flex',
          justifyContent: 'space-between',
          gap: 10,
          borderBottom: `1px solid ${th.cardBorder}`,
          alignItems: 'center',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              color: th.text,
              fontSize: 16,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {doc?.filename || 'Document preview'}
          </div>
          <div style={{ color: th.textMuted, fontSize: 12, marginTop: 2 }}>
            {doc
              ? `${documentClassLabel(doc)}${doc.page_count ? ` - ${doc.page_count} pages` : ''}${compactFileSize(doc.file_size_bytes) ? ` - ${compactFileSize(doc.file_size_bytes)}` : ''}`
              : 'Select a file to preview it'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}
            style={previewIconButton(th, isDark)}
          >
            <ZoomOut style={{ width: 17, height: 17 }} />
          </button>
          <button
            onClick={() => setZoom((value) => Math.min(1.8, value + 0.1))}
            style={previewIconButton(th, isDark)}
          >
            <ZoomIn style={{ width: 17, height: 17 }} />
          </button>
          {previewUrl && (
            <a
              href={previewUrl}
              target='_blank'
              rel='noreferrer'
              style={{
                ...previewIconButton(th, isDark),
                textDecoration: 'none',
              }}
            >
              <ExternalLink style={{ width: 17, height: 17 }} />
            </a>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 380,
          padding: 16,
          background: isDark ? 'rgba(255,255,255,.025)' : '#f8fafc',
          overflow: 'auto',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {doc && previewUrl ? (
          isPdf ? (
            <iframe
              title={doc.filename}
              src={previewUrl}
              style={{
                width: `${Math.round(100 * zoom)}%`,
                minWidth: 280,
                height: 430,
                border: `1px solid ${th.cardBorder}`,
                borderRadius: 12,
                background: '#fff',
              }}
            />
          ) : isImage ? (
            <img
              src={previewUrl}
              alt={doc.filename}
              style={{
                width: `${Math.round(86 * zoom)}%`,
                maxWidth: 620,
                borderRadius: 12,
                border: `1px solid ${th.cardBorder}`,
                boxShadow: isDark ? 'none' : '0 14px 28px rgba(15,23,42,.10)',
                objectFit: 'contain',
              }}
            />
          ) : (
            <div
              style={{ color: th.textSub, textAlign: 'center', fontSize: 13 }}
            >
              <FileSearch
                style={{
                  width: 32,
                  height: 32,
                  margin: '0 auto 10px',
                  color: th.textMuted,
                }}
              />
              Preview is not available for this file type.
            </div>
          )
        ) : previewError ? (
          <div style={{ color: th.textSub, textAlign: 'center', fontSize: 13 }}>
            <FileSearch
              style={{
                width: 32,
                height: 32,
                margin: '0 auto 10px',
                color: th.textMuted,
              }}
            />
            {previewError}
          </div>
        ) : (
          <div style={{ color: th.textSub, textAlign: 'center', fontSize: 13 }}>
            <FileSearch
              style={{
                width: 32,
                height: 32,
                margin: '0 auto 10px',
                color: th.textMuted,
              }}
            />
            {doc || loading ? 'Preparing preview...' : 'No catalogue selected.'}
          </div>
        )}
      </div>

      <div
        style={{
          padding: 14,
          borderTop: `1px solid ${th.cardBorder}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}
      >
        <MiniMetric
          label='Status'
          value={doc?.ingestion_status || '-'}
          color={th.textSub}
          th={th}
        />
        <MiniMetric
          label='Confidence'
          value={confidenceLabel(documentConfidence(doc))}
          color={th.textSub}
          th={th}
        />
        <MiniMetric
          label='Entities'
          value={String(doc?.entity_count ?? 0)}
          color={th.text}
          th={th}
        />
        <MiniMetric
          label='Approved'
          value={String(approved)}
          color={th.textSub}
          th={th}
        />
      </div>
    </div>
  );
}

function DocumentEntityReview({
  entities,
  loading,
  busyId,
  onApprove,
  onReject,
  onSave,
  th,
  isDark,
}: {
  entities: KnowledgeEntityReviewItem[];
  loading: boolean;
  busyId: number | 'bulk' | null;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onSave: (
    id: number,
    patch: {
      name?: string;
      description?: string;
      attributes?: Record<string, unknown>;
    },
  ) => void;
  th: FaqTheme;
  isDark: boolean;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('');
  const totalPages = Math.max(1, Math.ceil(entities.length / ENTITY_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * ENTITY_PAGE_SIZE;
  const pagedEntities = entities.slice(pageStart, pageStart + ENTITY_PAGE_SIZE);
  const entityPageKey = useMemo(
    () => entities.map((entity) => entity.entity_id).join(','),
    [entities],
  );
  const active =
    entities.find((entity) => entity.entity_id === activeId) ||
    entities[0] ||
    null;

  // Only reset paging/selection when the list of entities actually differs from
  // the current view. Reloads that return the same set of entities shouldn't
  // kick the user out of edit mode.
  const lastEntityKey = useRef(entityPageKey);
  useEffect(() => {
    if (lastEntityKey.current === entityPageKey) return;
    lastEntityKey.current = entityPageKey;
    setPage(1);
    // Preserve the current active entity if it's still in the list.
    if (activeId != null && !entities.some((e) => e.entity_id === activeId)) {
      // Resets local UI-only state (a flag, warning, or preview value)
      // when the relevant prop/dependency changes — not deriving render
      // output from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveId(null);
      setEditing(false);
    }
  }, [entityPageKey, activeId, entities]);

  useEffect(() => {
    // Clamps/adjusts local state in response to a changing dependency
    // (e.g. pagination bounds, active tab) — reviewed; not a
    // derive-state-from-render antipattern in this context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage((value) => Math.min(Math.max(1, value), totalPages));
  }, [totalPages]);

  const beginEdit = () => {
    if (!active) return;
    setName(active.name || '');
    // Catalogue entities usually keep their body in raw_text, not description,
    // so fall back to raw_text (matching the read-only view) instead of showing blank.
    setDescription(active.description || active.raw_text || '');
    const attrs = active.attributes || {};
    const rawPrice = attrs.price;
    setPrice(rawPrice == null || rawPrice === '' ? '' : String(rawPrice));
    setCurrency(typeof attrs.currency === 'string' ? attrs.currency : '');
    setEditing(true);
  };

  const save = () => {
    if (!active) return;
    const patch: {
      name?: string;
      description?: string;
      attributes?: Record<string, unknown>;
    } = {
      name: name.trim(),
      description: description.trim(),
    };
    const trimmedPrice = price.trim();
    const attributes: Record<string, unknown> = {};
    if (trimmedPrice === '') {
      attributes.price = null;
    } else {
      const numericPrice = Number(trimmedPrice.replace(/[^\d.-]/g, ''));
      attributes.price = Number.isFinite(numericPrice)
        ? numericPrice
        : trimmedPrice;
    }
    const trimmedCurrency = currency.trim();
    if (trimmedCurrency) attributes.currency = trimmedCurrency.toUpperCase();
    patch.attributes = attributes;
    onSave(active.entity_id, patch);
    setEditing(false);
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'minmax(220px, 1fr) auto',
        minHeight: 468,
      }}
    >
      <div style={{ overflowY: 'auto' }}>
        {pagedEntities.map((entity) => {
          const activeRow = active?.entity_id === entity.entity_id;
          const confidence = entityConfidence(entity);
          const priceLabel = entityPriceLabel(entity);
          return (
            <div
              key={entity.entity_id}
              onClick={() => {
                setActiveId(entity.entity_id);
                setEditing(false);
              }}
              style={{
                width: '100%',
                border: 0,
                borderBottom: `1px solid ${th.cardBorder}`,
                background: activeRow
                  ? isDark
                    ? 'rgba(255,255,255,.04)'
                    : '#f8fafc'
                  : 'transparent',
                color: th.text,
                padding: '12px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 86px 120px',
                gap: 10,
                alignItems: 'center',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 15,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {entity.name}
                </span>
                <span
                  style={{
                    display: 'block',
                    color: th.textMuted,
                    fontSize: 12,
                    marginTop: 3,
                  }}
                >
                  {[
                    entity.entity_type,
                    priceLabel,
                    entity.source_page ? `page ${entity.source_page}` : '',
                  ]
                    .filter(Boolean)
                    .join(' - ')}
                </span>
              </span>
              <span
                style={{ color: th.textSub, fontSize: 13, fontWeight: 500 }}
              >
                {confidenceLabel(confidence)}
              </span>
              <div
                className='flex items-center gap-1.5'
                onClick={(e) => e.stopPropagation()}
              >
                {entity.approval_status === 'approved' ||
                entity.approval_status === 'rejected' ? (
                  <span
                    style={{
                      color: th.textSub,
                      fontSize: 12,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                      marginLeft: 'auto',
                    }}
                  >
                    {entity.approval_status}
                  </span>
                ) : (
                  <>
                    <button
                      onClick={() => onReject(entity.entity_id)}
                      disabled={busyId === entity.entity_id}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        border: `1px solid ${th.cardBorder}`,
                        background: 'transparent',
                        color: th.textSub,
                        cursor: busyId === entity.entity_id ? 'default' : 'pointer',
                        opacity: busyId === entity.entity_id ? 0.5 : 1,
                      }}
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => onApprove(entity.entity_id)}
                      disabled={busyId === entity.entity_id}
                      style={{
                        padding: '4px 8px',
                        fontSize: 11,
                        fontWeight: 600,
                        borderRadius: 6,
                        background: '#059669',
                        color: '#fff',
                        border: 'none',
                        cursor: busyId === entity.entity_id ? 'default' : 'pointer',
                        opacity: busyId === entity.entity_id ? 0.5 : 1,
                      }}
                    >
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {!entities.length && (
          <div
            style={{
              padding: 28,
              color: th.textSub,
              textAlign: 'center',
              fontSize: 13,
            }}
          >
            {loading
              ? 'Loading extracted entities...'
              : 'No extracted entities for this document yet.'}
          </div>
        )}
      </div>

      {entities.length > ENTITY_PAGE_SIZE && (
        <div
          style={{
            borderTop: `1px solid ${th.cardBorder}`,
            padding: '9px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <button
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={currentPage <= 1}
            style={{
              ...reviewButtonStyle(th, isDark),
              fontWeight: 500,
              opacity: currentPage <= 1 ? 0.45 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ color: th.textSub, fontSize: 13, fontWeight: 500 }}>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={currentPage >= totalPages}
            style={{
              ...reviewButtonStyle(th, isDark),
              fontWeight: 500,
              opacity: currentPage >= totalPages ? 0.45 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}

      <div
        style={{
          borderTop: `1px solid ${th.cardBorder}`,
          padding: 14,
          background: isDark ? 'rgba(255,255,255,.02)' : '#fff',
        }}
      >
        {active ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span
                style={{
                  color: th.textSub,
                  fontSize: 12,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                }}
              >
                {active.approval_status}
              </span>
              <span style={{ color: th.textMuted, fontSize: 12 }}>
                {confidenceLabel(entityConfidence(active))}
              </span>
            </div>
            {editing ? (
              <>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder='Name'
                  style={inspectorFieldStyle(th)}
                />
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder='Description'
                  style={{
                    ...inspectorFieldStyle(th),
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 96px',
                    gap: 8,
                  }}
                >
                  <input
                    value={price}
                    onChange={(event) => setPrice(event.target.value)}
                    placeholder='Price'
                    inputMode='decimal'
                    style={inspectorFieldStyle(th)}
                  />
                  <input
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                    placeholder='Cur.'
                    style={inspectorFieldStyle(th)}
                  />
                </div>
              </>
            ) : (
              <>
                <div style={{ color: th.text, fontSize: 16, fontWeight: 600 }}>
                  {active.name}
                </div>
                {entityPriceLabel(active) && (
                  <div
                    style={{ color: th.text, fontSize: 14, fontWeight: 700 }}
                  >
                    {entityPriceLabel(active)}
                  </div>
                )}
                <div
                  style={{ color: th.textSub, fontSize: 14, lineHeight: 1.55 }}
                >
                  {active.description ||
                    active.raw_text ||
                    'No description captured.'}
                </div>
              </>
            )}
            <div
              style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}
            >
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    style={{
                      ...reviewButtonStyle(th, isDark),
                      fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={save}
                    disabled={busyId === active.entity_id}
                    style={{
                      ...reviewButtonStyle(th, isDark),
                      fontWeight: 500,
                    }}
                  >
                    Save
                  </button>
                </>
              ) : (
                <button
                  onClick={beginEdit}
                  style={{ ...reviewButtonStyle(th, isDark), fontWeight: 500 }}
                >
                  <Edit3 style={{ width: 15, height: 15 }} />
                  Edit
                </button>
              )}
              <button
                onClick={() => onReject(active.entity_id)}
                disabled={
                  active.approval_status === 'rejected' ||
                  busyId === active.entity_id
                }
                style={{ ...reviewButtonStyle(th, isDark), fontWeight: 500 }}
              >
                {active.approval_status === 'approved'
                  ? 'Move to rejected'
                  : 'Reject'}
              </button>
              <button
                onClick={() => onApprove(active.entity_id)}
                disabled={
                  active.approval_status === 'approved' ||
                  busyId === active.entity_id
                }
                style={{
                  ...reviewButtonStyle(
                    th,
                    isDark,
                    active.approval_status === 'rejected'
                      ? '#059669'
                      : undefined,
                  ),
                  fontWeight: active.approval_status === 'rejected' ? 700 : 500,
                }}
              >
                {active.approval_status === 'rejected'
                  ? 'Bring back as FAQ'
                  : 'Approve'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ color: th.textSub, textAlign: 'center', fontSize: 13 }}>
            Select an extracted item to review it.
          </div>
        )}
      </div>
    </div>
  );
}
function WebsiteImportLanding({
  entries,
  busyId,
  onDeleteSite,
  onOpenImport,
  onSelectSite,
  th,
  isDark,
}: {
  entries: WebsiteKnowledgeEntry[];
  busyId: number | 'bulk' | null;
  onDeleteSite: (host: string) => void;
  onOpenImport: () => void;
  onSelectSite: (host: string) => void;
  th: FaqTheme;
  isDark: boolean;
}) {
  const hostGroups = (() => {
    const map = new Map<
      string,
      { draft: number; approved: number; rejected: number; total: number }
    >();
    for (const entry of entries) {
      const raw = (entry.source_url || '').toLowerCase().trim();
      const host = raw
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split(/[/?#]/)[0];
      if (!host) continue;
      const existing = map.get(host) || {
        draft: 0,
        approved: 0,
        rejected: 0,
        total: 0,
      };
      existing.total += 1;
      if (entry.status === 'draft') existing.draft += 1;
      if (entry.status === 'approved') existing.approved += 1;
      if (entry.status === 'rejected') existing.rejected += 1;
      map.set(host, existing);
    }
    return [...map.entries()].map(([host, counts]) => ({ host, ...counts }));
  })();

  const activeSites = hostGroups.filter((g) => g.rejected < g.total).length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: hostGroups.length > 0 ? '1fr 1fr' : '1fr',
        minHeight: 480,
      }}
    >
      {hostGroups.length > 0 && (
        <div
          style={{
            borderRight: `1px solid ${th.cardBorder}`,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            background: isDark ? 'rgba(255,255,255,.015)' : '#fafbfc',
          }}
        >
          <div>
            <div
              style={{
                color: th.text,
                fontSize: 16,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              Past imports
            </div>
            <div style={{ color: th.textSub, fontSize: 12, lineHeight: 1.5 }}>
              {activeSites} of {MAX_IMPORTED_SITES_PER_USER} slots used. Click
              to review, or delete to free the slot.
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
            }}
          >
            {hostGroups.map(({ host, draft, approved, rejected, total }) => (
              <div
                key={host}
                onClick={() => onSelectSite(host)}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: `1px solid ${th.cardBorder}`,
                  background: isDark ? 'rgba(255,255,255,.03)' : '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  transition: 'all .15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = th.accentBorder;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = th.cardBorder;
                }}
              >
                <Button size='icon'>
                  <Globe2 size={14} />
                </Button>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      color: th.text,
                      fontSize: 14,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {host}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      marginTop: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span style={{ color: th.textSub, fontSize: 11 }}>
                      {total} {total === 1 ? 'entry' : 'entries'}
                    </span>
                    {draft > 0 && (
                      <span
                        style={{
                          color: '#d97706',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        · {draft} draft
                      </span>
                    )}
                    {approved > 0 && (
                      <span
                        style={{
                          color: '#059669',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        · {approved} live
                      </span>
                    )}
                    {rejected > 0 && (
                      <span
                        style={{
                          color: '#991b1b',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        · {rejected} rejected
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSite(host);
                  }}
                  disabled={busyId === 'bulk'}
                  title={`Delete all entries from ${host}`}
                  style={{
                    width: 34,
                    height: 34,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: 8,
                    cursor: busyId === 'bulk' ? 'not-allowed' : 'pointer',
                    opacity: busyId === 'bulk' ? 0.5 : 1,
                    flexShrink: 0,
                  }}
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              color: th.text,
              fontSize: 16,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            Import a new site
          </div>
          <div style={{ color: th.textSub, fontSize: 12, lineHeight: 1.5 }}>
            Give us a URL — we&apos;ll turn its pages into draft Q&amp;A
            answers.
          </div>
        </div>

        <Button size='lg' onClick={onOpenImport}>
          <Globe2 size={14} />
          Import from site
        </Button>

        <div
          style={{
            padding: 14,
            borderRadius: 10,
            background: isDark ? 'rgba(255,255,255,.03)' : '#f8fafc',
            border: `1px solid ${th.cardBorder}`,
          }}
        >
          <div
            style={{
              color: th.text,
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            How it works
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              color: th.textSub,
              fontSize: 12,
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                style={{ color: th.accent, fontWeight: 600, flexShrink: 0 }}
              >
                1.
              </span>
              We read your site&apos;s public pages.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                style={{ color: th.accent, fontWeight: 600, flexShrink: 0 }}
              >
                2.
              </span>
              We turn them into draft Q&amp;A answers.
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span
                style={{ color: th.accent, fontWeight: 600, flexShrink: 0 }}
              >
                3.
              </span>
              You review and approve what your bot uses.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            background: isDark ? 'rgba(234,179,8,.08)' : 'rgba(254,252,232,.9)',
            border: `1px solid ${isDark ? 'rgba(234,179,8,.25)' : 'rgba(234,179,8,.35)'}`,
            color: isDark ? '#fde68a' : '#854d0e',
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          Limit: {MAX_IMPORTED_SITES_PER_USER} sites at a time.
        </div>
      </div>
    </div>
  );
}

function WebsiteReviewPane({
  entries,
  loading,
  filter,
  search,
  selectedIds,
  busyId,
  threshold,
  scraperStatus,
  onThreshold,
  onFilter,
  onSearch,
  onToggle,
  onSelectAllDrafts,
  onRefresh,
  onSave,
  onApprove,
  onReject,
  onBulkApprove,
  onBulkReject,
  onDeleteAllRejected,
  onApproveThreshold,
  onDismissScraperStatus,
  onDeleteSite,
  onOpenImport,
  th,
  isDark,
}: {
  entries: WebsiteKnowledgeEntry[];
  loading: boolean;
  filter: EntryFilter;
  search: string;
  selectedIds: Set<number>;
  busyId: number | 'bulk' | null;
  threshold: number;
  scraperStatus: RagStatus | null;
  onThreshold: (value: number) => void;
  onFilter: (filter: EntryFilter) => void;
  onSearch: (search: string) => void;
  onToggle: (id: number) => void;
  onSelectAllDrafts: () => void;
  onRefresh: () => void;
  onSave: (id: number, patch: WebsiteEntryPatch) => void;
  onApprove: (id: number, patch?: WebsiteEntryPatch) => void;
  onReject: (id: number) => void;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onDeleteAllRejected: () => void;
  onApproveThreshold: () => void;
  onDismissScraperStatus: () => void;
  onDeleteSite: (host: string) => void;
  onOpenImport: () => void;
  th: FaqTheme;
  isDark: boolean;
}) {
  const [activeId, setActiveId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [selectedSiteHost, setSelectedSiteHost] = useState<string | null>(null);

  const detailPaneRef = useRef<HTMLElement | null>(null);
  const scrollToDetailPane = useCallback(() => {
    requestAnimationFrame(() => {
      const el = detailPaneRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      requestAnimationFrame(() => {
        const first = el.querySelector<HTMLElement>('input, textarea');
        if (first) first.focus({ preventScroll: true });
      });
    });
  }, []);

  const [confirmDeleteHost, setConfirmDeleteHost] = useState<{
    host: string;
    count: number;
  } | null>(null);

  const normalizeHostForFilter = (source: string) =>
    (source || '')
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split(/[/?#]/)[0];

  const visible = entries.filter((entry) => {
    if (selectedSiteHost) {
      const host = normalizeHostForFilter(entry.source_url || '');
      if (host !== selectedSiteHost) return false;
    }
    if (filter !== 'all' && entry.status !== filter) return false;
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return [
      entry.question,
      entry.answer,
      entry.category || '',
      entry.source_url || '',
      ...(entry.tags || []),
    ].some((value) => value.toLowerCase().includes(needle));
  });

  const hostGroups = (() => {
    const map = new Map<string, number>();
    for (const entry of entries) {
      if (entry.status === 'rejected') continue;
      const raw = entrySourceUrl(entry).toLowerCase().trim();
      const host = raw
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .split(/[/?#]/)[0];
      if (!host) continue;
      map.set(host, (map.get(host) || 0) + 1);
    }
    return [...map.entries()].map(([host, count]) => ({ host, count }));
  })();

  // Counts respect the selected site (so tabs show counts for that site only)
  const scopedEntries = selectedSiteHost
    ? entries.filter(
        (e) => normalizeHostForFilter(e.source_url || '') === selectedSiteHost,
      )
    : entries;

  const counts = {
    all: scopedEntries.length,
    draft: scopedEntries.filter((entry) => entry.status === 'draft').length,
    approved: scopedEntries.filter((entry) => entry.status === 'approved')
      .length,
    rejected: scopedEntries.filter((entry) => entry.status === 'rejected')
      .length,
  };
  const thresholdCount = scopedEntries.filter(
    (entry) =>
      entry.status === 'draft' && confidencePct(entry.confidence) >= threshold,
  ).length;
  const active =
    entries.find((entry) => entry.id === activeId) || visible[0] || null;
  const scraperRunning =
    scraperStatus?.kind === 'webscraper' &&
    scraperStatus.status !== 'completed' &&
    scraperStatus.status !== 'failed';
  const showScraperStatus =
    scraperStatus?.kind === 'webscraper' &&
    (scraperRunning ||
      scraperStatus.status === 'completed' ||
      scraperStatus.status === 'failed');
  const onlyScraperStatus = Boolean(scraperRunning && !entries.length);
  const showLanding = !showScraperStatus && !selectedSiteHost;

  const beginEdit = () => {
    if (!active) return;
    setQuestion(active.question);
    setAnswer(active.answer);
    setCategory(active.category || '');
    setTags((active.tags || []).join(', '));
    setEditing(true);
  };

  const save = () => {
    if (!active) return;
    onSave(active.id, {
      question: question.trim(),
      answer: answer.trim(),
      category: category.trim() || undefined,
      tags: splitTags(tags),
    });
    setEditing(false);
  };

  // LANDING VIEW — side-by-side past imports + start import panel
  if (showLanding) {
    return (
      <>
        <WebsiteImportLanding
          entries={entries}
          busyId={busyId}
          onDeleteSite={(host) => {
            const count =
              hostGroups.find((g) => g.host === host)?.count ||
              entries.filter(
                (e) => normalizeHostForFilter(e.source_url || '') === host,
              ).length;
            setConfirmDeleteHost({ host, count });
          }}
          onOpenImport={onOpenImport}
          onSelectSite={(host) => setSelectedSiteHost(host)}
          th={th}
          isDark={isDark}
        />
        {confirmDeleteHost && (
          <ConfirmModal
            title={`Delete all entries from ${confirmDeleteHost.host}?`}
            detail={`This removes ${confirmDeleteHost.count} imported ${confirmDeleteHost.count === 1 ? 'entry' : 'entries'} from ${confirmDeleteHost.host} and frees the slot so you can import another site. This can't be undone.`}
            confirmLabel='Delete site'
            ok={() => {
              const target = confirmDeleteHost.host;
              setConfirmDeleteHost(null);
              onDeleteSite(target);
            }}
            no={() => setConfirmDeleteHost(null)}
          />
        )}
      </>
    );
  }

  return (
    <div
      className='website-workspace'
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(520px, 1.35fr) minmax(380px, .65fr)',
        minHeight: 560,
      }}
    >
      <div style={{ minWidth: 0, borderRight: `1px solid ${th.cardBorder}` }}>
        {/* Back to all sites bar */}
        {selectedSiteHost && (
          <div
            style={{
              padding: '12px 14px',
              borderBottom: `1px solid ${th.cardBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: isDark ? 'rgba(255,255,255,.02)' : '#fafbfc',
            }}
          >
            <button
              onClick={() => {
                setSelectedSiteHost(null);
                setActiveId(null);
                setEditing(false);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 10px',
                borderRadius: 8,
                border: `1px solid ${th.cardBorder}`,
                background: isDark ? 'rgba(255,255,255,.03)' : '#fff',
                color: th.text,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <ChevronLeft style={{ width: 14, height: 14 }} />
              All sites
            </button>
            <span style={{ color: th.textSub, fontSize: 12 }}>
              Reviewing{' '}
              <strong style={{ color: th.text }}>{selectedSiteHost}</strong>
            </span>
          </div>
        )}

        {showScraperStatus && (
          <WebsiteScrapeStatusPanel
            state={scraperStatus}
            entries={entries}
            th={th}
            isDark={isDark}
            onDismiss={onDismissScraperStatus}
          />
        )}

        {!onlyScraperStatus && (
          <>
            <div
              style={{
                padding: 14,
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              {(
                [
                  ['all', 'All', counts.all],
                  ['draft', 'Draft', counts.draft],
                  ['approved', 'Approved', counts.approved],
                  ['rejected', 'Rejected', counts.rejected],
                ] as [EntryFilter, string, number][]
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  onClick={() => onFilter(key)}
                  style={{
                    borderRadius: 11,
                    border: `1px solid ${filter === key ? th.textMuted : th.cardBorder}`,
                    background:
                      filter === key
                        ? isDark
                          ? 'rgba(255,255,255,.05)'
                          : '#f8fafc'
                        : 'transparent',
                    color: th.text,
                    padding: '10px 12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{ color: th.text, fontSize: 18, fontWeight: 600 }}
                  >
                    {count}
                  </div>
                  <div
                    style={{
                      color: th.textMuted,
                      fontSize: 10,
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      marginTop: 2,
                    }}
                  >
                    {label}
                  </div>
                </button>
              ))}
            </div>

            <div
              style={{
                padding: '0 14px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <div style={{ position: 'relative' }}>
                <Search
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: 11,
                    width: 14,
                    height: 14,
                    color: th.textMuted,
                  }}
                />
                <input
                  value={search}
                  onChange={(event) => onSearch(event.target.value)}
                  placeholder='Search website knowledge...'
                  style={{
                    width: '100%',
                    borderRadius: 11,
                    border: `1px solid ${th.inputBorder}`,
                    background: th.inputBg,
                    color: th.text,
                    padding: '10px 12px 10px 34px',
                    outline: 'none',
                    fontSize: 13,
                  }}
                />
              </div>
              <button
                onClick={onRefresh}
                style={{ ...reviewButtonStyle(th, isDark), fontWeight: 500 }}
              >
                {loading ? (
                  <Loader2
                    style={{
                      width: 13,
                      height: 13,
                      animation: 'faq-spin .7s linear infinite',
                    }}
                  />
                ) : (
                  <RefreshCw style={{ width: 13, height: 13 }} />
                )}
                Refresh
              </button>
            </div>

            <div
              style={{
                padding: '0 14px 14px',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <div
                title="Only auto-approve items we're at least this sure about."
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  border: `1px solid ${th.cardBorder}`,
                  background: isDark
                    ? 'rgba(255,255,255,.03)'
                    : 'rgba(248,250,252,.7)',
                  borderRadius: 12,
                  padding: '8px 12px',
                  color: th.textSub,
                  fontSize: 12,
                }}
              >
                <SlidersHorizontal
                  style={{ width: 14, height: 14, color: th.textMuted }}
                />
                <span style={{ color: th.text, fontWeight: 600, fontSize: 12 }}>
                  How picky?
                </span>
                <button
                  type='button'
                  onClick={() => onThreshold(Math.max(50, threshold - 5))}
                  disabled={threshold <= 50}
                  aria-label='Lower the confidence bar'
                  style={{
                    ...previewIconButton(th, isDark),
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    opacity: threshold <= 50 ? 0.4 : 1,
                    cursor: threshold <= 50 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Minus size={12} />
                </button>
                <span
                  style={{
                    color: th.text,
                    fontWeight: 600,
                    fontVariantNumeric: 'tabular-nums',
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: th.accentBg,
                    border: `1px solid ${th.accentBorder}`,
                    fontSize: 12,
                    minWidth: 46,
                    textAlign: 'center',
                  }}
                >
                  {threshold}%
                </span>
                <button
                  type='button'
                  onClick={() => onThreshold(Math.min(100, threshold + 5))}
                  disabled={threshold >= 100}
                  aria-label='Raise the confidence bar'
                  style={{
                    ...previewIconButton(th, isDark),
                    width: 24,
                    height: 24,
                    borderRadius: 7,
                    opacity: threshold >= 100 ? 0.4 : 1,
                    cursor: threshold >= 100 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Plus size={12} />
                </button>
              </div>
              <span
                style={{ color: th.textMuted, fontSize: 12, fontWeight: 500 }}
              >
                Only auto-approve items we&apos;re at least this sure about
              </span>
              <button
                onClick={onApproveThreshold}
                disabled={!thresholdCount || busyId === 'bulk'}
                style={{
                  ...reviewButtonStyle(
                    th,
                    isDark,
                    thresholdCount ? '#059669' : undefined,
                  ),
                  opacity: thresholdCount ? 1 : 0.45,
                  fontWeight: 700,
                }}
              >
                {busyId === 'bulk'
                  ? 'Approving…'
                  : thresholdCount
                    ? `Approve ${thresholdCount} good match${thresholdCount === 1 ? '' : 'es'}`
                    : 'No good matches'}
              </button>
              <button
                onClick={onSelectAllDrafts}
                disabled={!counts.draft}
                style={{ ...reviewButtonStyle(th, isDark), fontWeight: 500 }}
              >
                Select drafts
              </button>
              <button
                onClick={onBulkReject}
                disabled={!selectedIds.size || busyId === 'bulk'}
                style={{ ...reviewButtonStyle(th, isDark), fontWeight: 500 }}
              >
                Reject ({selectedIds.size})
              </button>
              <button
                onClick={onBulkApprove}
                disabled={!selectedIds.size || busyId === 'bulk'}
                style={{ ...reviewButtonStyle(th, isDark), fontWeight: 500 }}
              >
                Approve ({selectedIds.size})
              </button>
              {counts.rejected > 0 && (
                <>
                  <span
                    aria-hidden
                    style={{
                      width: 1,
                      height: 24,
                      background: th.cardBorder,
                      margin: '0 4px',
                    }}
                  />
                  <button
                    onClick={onDeleteAllRejected}
                    disabled={busyId === 'bulk'}
                    title={`Permanently delete all ${counts.rejected} rejected item${counts.rejected === 1 ? '' : 's'}`}
                    style={{
                      ...reviewButtonStyle(th, isDark, '#dc2626'),
                      fontWeight: 700,
                      opacity: busyId === 'bulk' ? 0.5 : 1,
                    }}
                  >
                    <XCircle style={{ width: 13, height: 13 }} />
                    Delete all rejected ({counts.rejected})
                  </button>
                </>
              )}
            </div>

            <div
              style={{
                borderTop: `1px solid ${th.cardBorder}`,
                overflowX: 'auto',
              }}
            >
              <div style={{ minWidth: 820 }}>
                {counts.draft > 0 && (
                  <div
                    style={{
                      margin: '12px 14px 0',
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${isDark ? 'rgba(234,179,8,.25)' : 'rgba(234,179,8,.35)'}`,
                      background: isDark
                        ? 'rgba(234,179,8,.08)'
                        : 'rgba(254,252,232,.9)',
                      color: isDark ? '#fde68a' : '#854d0e',
                      fontSize: 12,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Drafts aren&apos;t live yet.</strong> Approve each
                    item to add it to your bot&apos;s answers — or use the
                    &quot;Approve good matches&quot; button above to accept
                    everything we&apos;re confident about. Reject the ones you
                    don&apos;t want.
                  </div>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      '38px minmax(280px, 1.5fr) 100px 80px 220px',
                    gap: 12,
                    padding: '10px 14px',
                    color: th.textMuted,
                    fontSize: 10,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    borderBottom: `1px solid ${th.cardBorder}`,
                  }}
                >
                  <span />
                  <span>Knowledge</span>
                  <span>Category</span>
                  <span>Status</span>
                  <span style={{ textAlign: 'right' }}>Actions</span>
                </div>
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {visible.map((entry) => {
                    const activeRow = active?.id === entry.id;
                    const rowBusy = busyId === entry.id;
                    const isApproved = entry.status === 'approved';
                    const isRejected = entry.status === 'rejected';
                    return (
                      <div
                        key={entry.id}
                        onClick={() => {
                          setActiveId(entry.id);
                          setEditing(false);
                          scrollToDetailPane();
                        }}
                        style={{
                          display: 'grid',
                          gridTemplateColumns:
                            '38px minmax(280px, 1.5fr) 100px 80px 220px',
                          gap: 12,
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderBottom: `1px solid ${th.cardBorder}`,
                          background: activeRow ? th.accentBg : 'transparent',
                          cursor: 'pointer',
                        }}
                      >
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggle(entry.id);
                          }}
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 7,
                            border: `1px solid ${selectedIds.has(entry.id) ? th.accent : th.cardBorder}`,
                            background: selectedIds.has(entry.id)
                              ? th.accent
                              : 'transparent',
                            color: selectedIds.has(entry.id)
                              ? 'white'
                              : th.textMuted,
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          {selectedIds.has(entry.id) && (
                            <Check style={{ width: 13, height: 13 }} />
                          )}
                        </button>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              color: th.text,
                              fontSize: 13,
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.display_title || entry.question}
                          </div>
                          <div
                            style={{
                              color: th.textMuted,
                              fontSize: 11,
                              marginTop: 3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {entry.answer}
                          </div>
                          <div
                            style={{
                              color: th.textMuted,
                              fontSize: 10,
                              marginTop: 3,
                            }}
                          >
                            Confidence {confidenceLabel(entry.confidence)}
                          </div>
                        </div>
                        <span style={{ color: th.textSub, fontSize: 12 }}>
                          {entry.category || 'general'}
                        </span>
                        <span
                          style={{
                            color: isApproved
                              ? '#059669'
                              : isRejected
                                ? '#991b1b'
                                : th.textSub,
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}
                        >
                          {entry.status}
                        </span>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 6,
                          }}
                        >
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveId(entry.id);
                              setQuestion(entry.question);
                              setAnswer(entry.answer);
                              setCategory(entry.category || '');
                              setTags((entry.tags || []).join(', '));
                              setEditing(true);
                              scrollToDetailPane();
                            }}
                            disabled={rowBusy}
                            title='Edit'
                            aria-label='Edit'
                            style={rowActionStyle(th, isDark)}
                          >
                            <Edit3 style={{ width: 12, height: 12 }} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onReject(entry.id);
                            }}
                            disabled={rowBusy || isRejected}
                            title='Reject'
                            aria-label='Reject'
                            style={{
                              ...rowActionStyle(th, isDark),
                              color: '#991b1b',
                              opacity: isRejected ? 0.4 : 1,
                            }}
                          >
                            <XCircle style={{ width: 12, height: 12 }} />
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              onApprove(entry.id);
                            }}
                            disabled={rowBusy || isApproved}
                            title='Approve'
                            aria-label='Approve'
                            style={{
                              ...rowActionStyle(th, isDark),
                              padding: '6px 10px',
                              background: isApproved
                                ? isDark
                                  ? 'rgba(5,150,105,.15)'
                                  : 'rgba(5,150,105,.10)'
                                : '#059669',
                              color: isApproved ? '#059669' : 'white',
                              border: `1px solid ${isApproved ? 'rgba(5,150,105,.30)' : '#059669'}`,
                              fontWeight: 600,
                              fontSize: 11,
                              opacity: rowBusy ? 0.55 : 1,
                            }}
                          >
                            {isApproved ? (
                              <>
                                <CheckCircle2
                                  style={{ width: 12, height: 12 }}
                                />
                                Approved
                              </>
                            ) : rowBusy ? (
                              <Loader2
                                style={{
                                  width: 12,
                                  height: 12,
                                  animation: 'faq-spin .7s linear infinite',
                                }}
                              />
                            ) : (
                              <>
                                <CheckCircle2
                                  style={{ width: 12, height: 12 }}
                                />
                                {isRejected ? 'Bring back as FAQ' : 'Approve'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {!visible.length && (
                    <div
                      style={{
                        color: th.textSub,
                        padding: 32,
                        textAlign: 'center',
                        fontSize: 12,
                      }}
                    >
                      {loading
                        ? 'Loading website entries...'
                        : 'No website entries match this view.'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <aside
        ref={detailPaneRef as React.RefObject<HTMLElement>}
        style={{
          padding: 16,
          minWidth: 0,
          background: isDark ? 'rgba(255,255,255,.015)' : '#fff',
        }}
      >
        {onlyScraperStatus ? (
          <div
            style={{
              color: th.textSub,
              fontSize: 12,
              lineHeight: 1.6,
              padding: 4,
            }}
          >
            <div
              style={{
                color: th.text,
                fontSize: 14,
                fontWeight: 600,
                marginBottom: 6,
              }}
            >
              Extraction preview
            </div>
            Useful pages will become short draft answers here once the scraper
            finishes. You will be able to edit, reject, or approve them before
            they are embedded.
          </div>
        ) : active ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 13,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span
                style={{
                  color: th.textSub,
                  fontSize: 11,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                }}
              >
                {active.status}
              </span>

              <span
                style={{
                  color: th.textMuted,
                  fontSize: 11,
                }}
              >
                {confidenceLabel(active.confidence)}
              </span>
            </div>

            {editing ? (
              <>
                <input
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  style={inspectorFieldStyle(th)}
                />

                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  rows={7}
                  style={{
                    ...inspectorFieldStyle(th),
                    resize: 'vertical',
                    lineHeight: 1.5,
                  }}
                />

                <input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder='Category'
                  style={inspectorFieldStyle(th)}
                />

                <input
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder='Tags'
                  style={inspectorFieldStyle(th)}
                />
              </>
            ) : (
              <>
                <SourcePreviewFrame entry={active} th={th} isDark={isDark} />

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 7,
                  }}
                >
                  {(active.tags || []).slice(0, 8).map((tag) => (
                    <span
                      key={tag}
                      style={{
                        borderRadius: 999,
                        border: `1px solid ${th.cardBorder}`,
                        padding: '5px 8px',
                        color: th.textSub,
                        fontSize: 11,
                        fontWeight: 650,
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {active.source_url && (
                  <a
                    href={active.source_url}
                    target='_blank'
                    rel='noopener noreferrer'
                    style={{
                      color: th.text,
                      textDecoration: 'none',
                      fontSize: 12,
                      fontWeight: 500,
                      display: 'inline-flex',
                      gap: 6,
                      alignItems: 'center',
                      width: 'fit-content',
                    }}
                  >
                    <ExternalLink style={{ width: 13, height: 13 }} />

                    {sourceLabel(active.source_url, active.source_path)}
                  </a>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    color: th.textSub,
                    fontSize: 12,
                  }}
                >
                  <MiniMetric
                    label='Category'
                    value={active.category || 'general'}
                    color={th.text}
                    th={th}
                  />

                  <MiniMetric
                    label='Embedding'
                    value={active.embed_status}
                    color={th.textSub}
                    th={th}
                  />

                  <MiniMetric
                    label='Type'
                    value={active.entry_type || 'answer'}
                    color={th.text}
                    th={th}
                  />

                  <MiniMetric
                    label='Entry'
                    value={`#${active.id}`}
                    color={th.text}
                    th={th}
                  />
                </div>
              </>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
                paddingTop: 8,
                borderTop: `1px solid ${th.cardBorder}`,
              }}
            >
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    style={{
                      ...reviewButtonStyle(th, isDark),
                      fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    onClick={save}
                    disabled={
                      !question.trim() || !answer.trim() || busyId === active.id
                    }
                    style={{
                      ...reviewButtonStyle(th, isDark),
                      fontWeight: 500,
                    }}
                  >
                    Save
                  </button>
                </>
              ) : (
                <button
                  onClick={beginEdit}
                  style={{
                    ...reviewButtonStyle(th, isDark),
                    fontWeight: 500,
                  }}
                >
                  <Edit3 style={{ width: 13, height: 13 }} />
                  Edit
                </button>
              )}

              <button
                onClick={() => onReject(active.id)}
                disabled={active.status === 'rejected' || busyId === active.id}
                style={{
                  ...reviewButtonStyle(th, isDark),
                  fontWeight: 500,
                }}
              >
                {active.status === 'approved' ? 'Move to rejected' : 'Reject'}
              </button>

              <button
                onClick={() => onApprove(active.id)}
                disabled={active.status === 'approved' || busyId === active.id}
                style={{
                  ...reviewButtonStyle(
                    th,
                    isDark,
                    active.status === 'rejected' ? '#059669' : undefined,
                  ),
                  fontWeight: active.status === 'rejected' ? 700 : 500,
                }}
              >
                {active.status === 'rejected' ? 'Bring back as FAQ' : 'Approve'}
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              color: th.textSub,
              textAlign: 'center',
              padding: 40,
              fontSize: 12,
            }}
          >
            Select a website entry to inspect it.
          </div>
        )}
      </aside>
      {confirmDeleteHost && (
        <ConfirmModal
          title={`Delete all entries from ${confirmDeleteHost.host}?`}
          detail={`This removes ${confirmDeleteHost.count} imported ${confirmDeleteHost.count === 1 ? 'entry' : 'entries'} from ${confirmDeleteHost.host} and frees the slot so you can import another site. This can't be undone.`}
          confirmLabel='Delete site'
          ok={() => {
            const target = confirmDeleteHost.host;
            setConfirmDeleteHost(null);
            onDeleteSite(target);
          }}
          no={() => setConfirmDeleteHost(null)}
        />
      )}
    </div>
  );
}

function SavedKnowledgeLedger({
  websiteEntries,
  documentEntities,
  loading,
  onDelete,
  onBulkDelete,
  th,
}: {
  websiteEntries: WebsiteKnowledgeEntry[];
  documentEntities: KnowledgeEntityReviewItem[];
  loading: boolean;
  onDelete: (rowId: string) => void;
  onBulkDelete: (rowIds: string[]) => void;
  th: FaqTheme;
}) {
  const rows = [
    ...documentEntities.map((entity) => ({
      id: `doc-${entity.entity_id}`,
      title: entity.name,
      detail: [
        entityPriceLabel(entity),
        entity.description || entity.raw_text || '',
      ]
        .filter(Boolean)
        .join(' - '),
      source: entity.document_id
        ? `Document #${entity.document_id}`
        : 'Document',
      category: entity.entity_type,
      confidence: entityConfidence(entity),
      embed: entity.embed_status || 'pending',
    })),
    ...websiteEntries.map((entry) => ({
      id: `web-${entry.id}`,
      title: entry.question,
      detail: entry.answer,
      source: sourceLabel(entry.source_url, entry.source_path) || 'Website',
      category: entry.category || 'general',
      confidence: entry.confidence,
      embed: entry.embed_status,
    })),
  ];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / 8));
  useEffect(() => {
    // Clamps/adjusts local state in response to a changing dependency
    // (e.g. pagination bounds, active tab) — reviewed; not a
    // derive-state-from-render antipattern in this context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage((value) => Math.min(Math.max(1, value), totalPages));
  }, [totalPages]);
  const pagedRows = getPageItems(rows, page, 8);

  return (
    <div style={{ padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'center',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ color: th.text, fontSize: 15, fontWeight: 760 }}>
            Embedded knowledge ledger
          </div>
          <div style={{ color: th.textSub, fontSize: 12, marginTop: 3 }}>
            A clean view of the items currently approved for retrieval.
          </div>
        </div>
        <span style={{ color: th.textSub, fontSize: 12 }}>
          {loading ? 'Refreshing...' : `${rows.length} saved items`}
        </span>
      </div>

      {selected.size > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            borderRadius: 10,
            border: `1px solid ${th.accentBorder}`,
            background: th.accentBg,
            marginBottom: 10,
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: th.accent }}>
            {selected.size} selected
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setSelected(new Set())}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              background: 'transparent',
              color: th.textSub,
              border: `1px solid ${th.cardBorder}`,
            }}
          >
            Clear
          </button>
          <button
            onClick={() => {
              const ids = Array.from(selected);
              setSelected(new Set());
              onBulkDelete(ids);
            }}
            style={{
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: '#dc2626',
              color: 'white',
              border: 'none',
            }}
          >
            Remove {selected.size}
          </button>
        </div>
      )}

      <div
        style={{
          overflowX: 'auto',
          border: `1px solid ${th.cardBorder}`,
          borderRadius: 12,
        }}
      >
        <table
          className='lashvae-column-dividers'
          style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}
        >
          <thead>
            <tr
              style={{
                color: th.textMuted,
                fontSize: 10,
                textTransform: 'uppercase',
                textAlign: 'left',
                background: th.accentBg,
              }}
            >
              <th style={{ padding: '11px 12px', width: 32 }}>
                <input
                  type='checkbox'
                  checked={allSelected}
                  onChange={() => {
                    if (allSelected) setSelected(new Set());
                    else setSelected(new Set(rows.map((r) => r.id)));
                  }}
                  style={{ cursor: 'pointer', accentColor: th.accent }}
                />
              </th>
              <th style={{ padding: '11px 12px' }}>Knowledge</th>
              <th style={{ padding: '11px 12px' }}>Category</th>
              <th style={{ padding: '11px 12px' }}>Source</th>
              <th style={{ padding: '11px 12px' }}>Confidence</th>
              <th style={{ padding: '11px 12px' }}>Embedding</th>
              <th style={{ padding: '11px 12px', width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {pagedRows.map((row) => (
              <tr
                key={row.id}
                style={{ borderTop: `1px solid ${th.cardBorder}` }}
              >
                <td style={{ padding: '12px' }}>
                  <input
                    type='checkbox'
                    checked={selected.has(row.id)}
                    onChange={() => {
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.id)) next.delete(row.id);
                        else next.add(row.id);
                        return next;
                      });
                    }}
                    style={{ cursor: 'pointer', accentColor: th.accent }}
                  />
                </td>
                <td
                  style={{
                    padding: '12px',
                    color: th.text,
                    fontSize: 13,
                    maxWidth: 420,
                  }}
                >
                  <div style={{ fontWeight: 720 }}>{row.title}</div>
                  <div
                    style={{
                      color: th.textMuted,
                      fontSize: 11,
                      marginTop: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.detail}
                  </div>
                </td>
                <td
                  style={{ padding: '12px', color: th.textSub, fontSize: 12 }}
                >
                  {row.category}
                </td>
                <td
                  style={{ padding: '12px', color: th.textSub, fontSize: 12 }}
                >
                  {row.source}
                </td>
                <td
                  style={{
                    padding: '12px',
                    color:
                      confidencePct(row.confidence) >= 80
                        ? '#059669'
                        : '#d97706',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {confidenceLabel(row.confidence)}
                </td>
                <td
                  style={{
                    padding: '12px',
                    color: row.embed === 'embedded' ? '#059669' : '#d97706',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {row.embed}
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <button
                    onClick={() => onDelete(row.id)}
                    title='Remove from live knowledge'
                    style={{
                      border: 0,
                      background: 'transparent',
                      color: th.textMuted,
                      cursor: 'pointer',
                      padding: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 36,
                    textAlign: 'center',
                    color: th.textSub,
                    fontSize: 12,
                  }}
                >
                  {loading
                    ? 'Loading saved knowledge...'
                    : 'Approved and embedded knowledge will appear here.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        page={page}
        totalItems={rows.length}
        onPageChange={setPage}
        pageSize={8}
      />
    </div>
  );
}

function MiniMetric({
  label,
  value,
  color,
  th,
}: {
  label: string;
  value: string;
  color: string;
  th: FaqTheme;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          color: th.textMuted,
          fontSize: 11,
          fontWeight: 500,
          textTransform: 'uppercase',
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontSize: 14,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function previewIconButton(th: FaqTheme, isDark: boolean): React.CSSProperties {
  return {
    width: 38,
    height: 38,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 10,
    border: `1px solid ${th.cardBorder}`,
    background: isDark ? 'rgba(255,255,255,.04)' : '#fff',
    color: th.textSub,
    cursor: 'pointer',
  };
}

function exportCsv(items: FaqItem[]) {
  // Neutralize CSV formula injection: cells starting with =, +, -, @, tab, or CR
  // are treated as formulas by Excel/Sheets. Prefix with a single-quote so the
  // spreadsheet renders them as text.
  const safe = (value: unknown) => {
    const raw = (value == null ? '' : String(value)).replace(/"/g, '""');
    return /^[=+\-@\t\r]/.test(raw) ? `"'${raw}"` : `"${raw}"`;
  };

  const rows = [
    ['question', 'answer', 'tags', 'synonyms', 'is_active'].map(safe),
    ...items.map((i) => [
      safe(i.question),
      safe(i.answer),
      safe(i.tags),
      safe(i.synonyms),
      safe(i.is_active),
    ]),
  ];

  const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], {
    type: 'text/csv',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `faq-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a tick to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function FAQPage() {
  const { isDark } = useTheme();
  const th = isDark ? FAQ_DARK : FAQ_LIGHT;
  const router = useRouter();
  const searchParams = useSearchParams();
  const openedFromSettings = searchParams.get('from') === 'settings';
  const settingsReturnTo = searchParams.get('returnTo') || '/settings';
  const settingsBackHref = settingsReturnTo.startsWith('/settings')
    ? settingsReturnTo
    : '/settings';

  const [rawQ, setRawQ] = useState('');
  const [dq, setDq] = useState('');
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('updated');
  const [showAdd, setShowAdd] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [delTarget, setDelTarget] = useState<FaqItem | null>(null);
  const [nQ, setNQ] = useState('');
  const [nA, setNA] = useState('');
  const [nT, setNT] = useState('');
  const [nS, setNS] = useState('');
  const [adding, setAdding] = useState(false);
  const [addFlash, setAddFlash] = useState(false);
  const [ragMode, setRagMode] = useState<RagMode>(null);
  const [ragBusy, setRagBusy] = useState(false);
  const [ragStatus, setRagStatus] = useState<RagStatus | null>(null);
  const [knowledgeView, setKnowledgeView] =
    useState<KnowledgeView>('catalogue');
  const [knowledgeDocuments, setKnowledgeDocuments] = useState<
    KnowledgeDocumentSummary[]
  >([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(
    null,
  );
  const [documentDetail, setDocumentDetail] =
    useState<KnowledgeDocumentDetail | null>(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentBusyId, setDocumentBusyId] = useState<number | 'bulk' | null>(
    null,
  );
  const [documentApprovalThreshold, setDocumentApprovalThreshold] =
    useState(80);
  const [savedEntities, setSavedEntities] = useState<
    KnowledgeEntityReviewItem[]
  >([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [websiteAnalysisId, setWebsiteAnalysisId] = useState<number | null>(
    null,
  );
  const [websiteEntries, setWebsiteEntries] = useState<WebsiteKnowledgeEntry[]>(
    [],
  );
  const [websiteEntriesLoading, setWebsiteEntriesLoading] = useState(false);
  const [entryFilter, setEntryFilter] = useState<EntryFilter>('all');
  const [entrySearch, setEntrySearch] = useState('');
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(
    new Set(),
  );
  const [entryBusyId, setEntryBusyId] = useState<number | 'bulk' | null>(null);
  const [websiteApprovalThreshold, setWebsiteApprovalThreshold] = useState(80);
  const [manualPage, setManualPage] = useState(1);
  const [manualPageSize] = useState(8);
  const [coachTab, setCoachTab] = useState<KnowledgeView | null>(null);
  const [selectedFaqIds, setSelectedFaqIds] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Confirmation modal for destructive bulk actions (replaces window.confirm).
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Track the latest in-flight FAQ load to avoid race conditions where a slow
  // response for an old query overwrites a fresh result set.
  const loadSeqRef = useRef(0);
  // Ref for the mounted-check used by long-running poll loops.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // Ref for the auto-dismiss timer on the status banner so successive messages
  // don't clear each other prematurely.
  const errTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const AUTO_DISMISS_MS = 5000;
  const flashErr = useCallback((message: string, autoDismissMs?: number) => {
    if (errTimerRef.current) {
      clearTimeout(errTimerRef.current);
      errTimerRef.current = null;
    }
    setErr(message);
    // `flashErr` still supports a custom duration for callers that want it;
    // any other setErr call is caught by the auto-dismiss effect below.
    if (autoDismissMs && message) {
      errTimerRef.current = setTimeout(() => {
        setErr('');
        errTimerRef.current = null;
      }, autoDismissMs);
    }
  }, []);

  // Universal auto-dismiss: any banner (whether set via setErr or flashErr
  // without a duration) disappears after AUTO_DISMISS_MS. Users can still
  // dismiss manually with the ×, and successive messages reset the timer.
  useEffect(() => {
    if (!err) return;
    // If flashErr already scheduled its own dismissal, don't stack a second one.
    if (errTimerRef.current) return;
    const t = setTimeout(() => {
      setErr('');
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [err]);

  useEffect(() => {
    return () => {
      if (errTimerRef.current) clearTimeout(errTimerRef.current);
      if (addFlashTimerRef.current) clearTimeout(addFlashTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const target = window.localStorage.getItem('faq_coach_target');
      if (
        target === 'manual' ||
        target === 'catalogue' ||
        target === 'website' ||
        target === 'saved'
      ) {
        // Clamps/adjusts local state in response to a changing dependency
        // (e.g. pagination bounds, active tab) — reviewed; not a
        // derive-state-from-render antipattern in this context.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCoachTab(target);
        setKnowledgeView(target);
        window.localStorage.removeItem('faq_coach_target');
      }
    } catch {
      // localStorage may be disabled — ignore
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDq(rawQ), 380);
    return () => clearTimeout(t);
  }, [rawQ]);

  useEffect(() => {
    // Resets local UI-only state (a flag, warning, or preview value)
    // when the relevant prop/dependency changes — not deriving render
    // output from state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManualPage(1);
  }, [filter, sort, dq]);

  async function load(q = dq) {
    setErr('');
    setLoading(true);
    const seq = ++loadSeqRef.current;

    try {
      const path = q.trim()
        ? `/admin/faq?q=${encodeURIComponent(q.trim())}`
        : '/admin/faq';
      const data = await apiFetch<{ items: FaqItem[] }>(path, { auth: true });
      // Ignore responses that were superseded by a newer query.
      if (seq !== loadSeqRef.current) return;
      setItems(data.items || []);
      setLoaded(true);
    } catch (e: unknown) {
      if (seq !== loadSeqRef.current) return;
      const message = e instanceof Error ? e.message : 'Failed to load';
      if (message === 'Not authenticated') {
        setItems([]);
        setLoaded(true);
        return;
      }
      setErr(message);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(dq);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  async function createFaq() {
    if (!nQ.trim() || !nA.trim()) {
      setErr('Question and answer required.');
      return;
    }

    setAdding(true);
    setErr('');

    try {
      await apiFetch<{ id: number }>('/admin/faq', {
        method: 'POST',
        auth: true,
        body: {
          question: nQ.trim(),
          answer: nA.trim(),
          tags: nT,
          synonyms: nS,
          is_active: true,
        },
      });

      setNQ('');
      setNA('');
      setNT('');
      setNS('');
      setShowAdd(false);
      setAddFlash(true);
      if (addFlashTimerRef.current) clearTimeout(addFlashTimerRef.current);
      addFlashTimerRef.current = setTimeout(() => {
        setAddFlash(false);
        addFlashTimerRef.current = null;
      }, 2000);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setAdding(false);
    }
  }

  async function updateFaq(id: number, patch: Partial<FaqItem>) {
    setErr('');

    try {
      await apiFetch(`/admin/faq/${id}`, {
        method: 'PUT',
        auth: true,
        body: patch,
      });

      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function deleteFaq(id: number) {
    setErr('');

    try {
      await apiFetch(`/admin/faq/${id}`, {
        method: 'DELETE',
        auth: true,
      });

      setDelTarget(null);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
      setDelTarget(null);
    }
  }

  async function dupFaq(item: FaqItem) {
    setErr('');

    try {
      await apiFetch<{ id: number }>('/admin/faq', {
        method: 'POST',
        auth: true,
        body: {
          question: `${item.question} (copy)`,
          answer: item.answer,
          tags: item.tags,
          synonyms: item.synonyms,
          is_active: false,
        },
      });

      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Dup failed');
    }
  }

  function toggleFaqSelected(id: number) {
    setSelectedFaqIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkDeleteFaqs() {
    if (selectedFaqIds.size === 0) return;
    const ids = Array.from(selectedFaqIds);
    setConfirm({
      title: `Delete ${ids.length} FAQ${ids.length === 1 ? '' : 's'}?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        setBulkDeleting(true);
        setErr('');
        // Run in parallel — sequential deletes are painful for large selections.
        const results = await Promise.allSettled(
          ids.map((id) =>
            apiFetch(`/admin/faq/${id}`, { method: 'DELETE', auth: true }),
          ),
        );
        const failed = results.filter((r) => r.status === 'rejected').length;
        setBulkDeleting(false);
        setSelectedFaqIds(new Set());
        await load();
        const succeeded = ids.length - failed;
        if (succeeded === 0) {
          flashErr(
            `Failed to delete ${failed} FAQ${failed === 1 ? '' : 's'}. Check your permissions or refresh.`,
            6000,
          );
        } else if (failed > 0) {
          flashErr(
            `Deleted ${succeeded} FAQ${succeeded === 1 ? '' : 's'}. ${failed} failed — refresh to retry.`,
            4000,
          );
        } else {
          flashErr(
            `Deleted ${ids.length} FAQ${ids.length === 1 ? '' : 's'}`,
            2500,
          );
        }
      },
    });
  }

  function deleteDocument(id: number, name?: string) {
    setConfirm({
      title: `Delete ${name || `document #${id}`}?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete',
      destructive: true,
      onConfirm: async () => {
        setErr('');
        try {
          await apiFetch(`/admin/knowledge/documents/${id}`, {
            method: 'DELETE',
            auth: true,
          });
          await loadKnowledgeDocuments();
          await loadSavedKnowledge();
          flashErr(`Deleted ${name || `document #${id}`}`, 2500);
        } catch (e: unknown) {
          flashErr(e instanceof Error ? e.message : 'Delete failed');
        }
      },
    });
  }

  function deleteApprovedEntity(rowId: string) {
    // rowId is prefixed: "doc-<entityId>" or "web-<entryId>"
    const dash = rowId.indexOf('-');
    if (dash < 0) return;
    const kind = rowId.slice(0, dash);
    const idStr = rowId.slice(dash + 1);
    const id = Number(idStr);
    if (!id || Number.isNaN(id)) return;
    setConfirm({
      title: 'Remove from live knowledge?',
      message: 'Your bot will stop answering from it.',
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: async () => {
        setErr('');
        try {
          if (kind === 'doc') {
            await apiFetch(`/admin/knowledge/entities/${id}`, {
              method: 'DELETE',
              auth: true,
            });
          } else if (kind === 'web') {
            await apiFetch(`/admin/knowledge/website/${id}`, {
              method: 'DELETE',
              auth: true,
            });
          }
          await loadSavedKnowledge();
          await loadWebsiteEntries();
          flashErr('Removed from live knowledge', 2500);
        } catch (e: unknown) {
          flashErr(e instanceof Error ? e.message : 'Remove failed');
        }
      },
    });
  }

  function bulkDeleteApprovedEntities(rowIds: string[]) {
    if (rowIds.length === 0) return;
    setConfirm({
      title: `Remove ${rowIds.length} item${rowIds.length === 1 ? '' : 's'} from live knowledge?`,
      message: `Your bot will stop answering from ${rowIds.length === 1 ? 'it' : 'them'}.`,
      confirmLabel: 'Remove',
      destructive: true,
      onConfirm: async () => {
        setErr('');
        const tasks = rowIds.map((rowId) => {
          const dash = rowId.indexOf('-');
          if (dash < 0) return Promise.reject(new Error('bad-id'));
          const kind = rowId.slice(0, dash);
          const idStr = rowId.slice(dash + 1);
          const id = Number(idStr);
          if (!id || Number.isNaN(id))
            return Promise.reject(new Error('bad-id'));
          if (kind === 'doc') {
            return apiFetch(`/admin/knowledge/entities/${id}`, {
              method: 'DELETE',
              auth: true,
            });
          }
          if (kind === 'web') {
            return apiFetch(`/admin/knowledge/website/${id}`, {
              method: 'DELETE',
              auth: true,
            });
          }
          return Promise.reject(new Error('bad-kind'));
        });
        const results = await Promise.allSettled(tasks);
        const failed = results.filter((r) => r.status === 'rejected').length;
        await loadSavedKnowledge();
        await loadWebsiteEntries();
        const succeeded = rowIds.length - failed;
        if (succeeded === 0) {
          flashErr(
            `Failed to remove ${failed} item${failed === 1 ? '' : 's'}. Check your permissions or refresh.`,
            6000,
          );
        } else if (failed > 0) {
          flashErr(
            `Removed ${succeeded} item${succeeded === 1 ? '' : 's'}. ${failed} failed — refresh to retry.`,
            4000,
          );
        } else {
          flashErr(
            `Removed ${rowIds.length} item${rowIds.length === 1 ? '' : 's'}`,
            2500,
          );
        }
      },
    });
  }

  async function loadKnowledgeDocumentDetail(documentId: number) {
    setDocumentLoading(true);
    try {
      const detail = await getKnowledgeDocument(documentId);
      setDocumentDetail(detail);
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to load document detail'));
    } finally {
      setDocumentLoading(false);
    }
  }

  async function loadKnowledgeDocuments(selectId?: number | null) {
    setDocumentsLoading(true);
    try {
      const docs = await listKnowledgeDocuments();
      setKnowledgeDocuments(docs);
      const nextId =
        selectId ?? selectedDocumentId ?? docs[0]?.document_id ?? null;
      setSelectedDocumentId(nextId);
      if (nextId) {
        await loadKnowledgeDocumentDetail(nextId);
      } else {
        setDocumentDetail(null);
      }
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to load knowledge documents'));
    } finally {
      setDocumentsLoading(false);
    }
  }

  async function loadSavedKnowledge() {
    setSavedLoading(true);
    try {
      const approved = await listKnowledgeEntities({
        approvalStatus: 'approved',
      });
      setSavedEntities(approved);
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to load saved knowledge'));
    } finally {
      setSavedLoading(false);
    }
  }

  async function selectKnowledgeDocument(documentId: number) {
    setSelectedDocumentId(documentId);
    await loadKnowledgeDocumentDetail(documentId);
  }

  async function approveDocumentEntity(entityId: number) {
    setDocumentBusyId(entityId);
    try {
      // Same story as approveWebsiteEntry — no working un-reject endpoint on
      // this backend. For rejected items, redirect to the bring-back flow.
      const currentEntity = documentDetail?.entities?.find(
        (e) => e.entity_id === entityId,
      );
      if (currentEntity?.approval_status === 'rejected') {
        bringBackAsFaq({
          question: currentEntity.name || '',
          answer: currentEntity.description || currentEntity.raw_text || '',
        });
        setDocumentBusyId(null);
        return;
      }
      await approveKnowledgeEntity(entityId);
      if (selectedDocumentId)
        await loadKnowledgeDocumentDetail(selectedDocumentId);
      await loadKnowledgeDocuments(selectedDocumentId);
      await loadSavedKnowledge();
      flashErr('Approved catalogue item.', 5000);
    } catch (e: unknown) {
      flashErr(errorMessage(e, 'Failed to approve catalogue item'), 5000);
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function rejectDocumentEntity(entityId: number) {
    setDocumentBusyId(entityId);
    try {
      await rejectKnowledgeEntity(entityId);
      if (selectedDocumentId)
        await loadKnowledgeDocumentDetail(selectedDocumentId);
      await loadKnowledgeDocuments(selectedDocumentId);
      flashErr('Rejected catalogue item.', 5000);
    } catch (e: unknown) {
      flashErr(errorMessage(e, 'Failed to reject catalogue item'), 5000);
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function saveDocumentEntity(
    entityId: number,
    patch: {
      name?: string;
      description?: string;
      attributes?: Record<string, unknown>;
    },
  ) {
    setDocumentBusyId(entityId);
    try {
      await editKnowledgeEntity(entityId, patch);
      if (selectedDocumentId)
        await loadKnowledgeDocumentDetail(selectedDocumentId);
      setErr('Updated catalogue item.');
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to update catalogue item'));
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function approveDocumentThreshold() {
    const ids = (documentDetail?.entities || [])
      .filter((entity) => {
        const status = entity.approval_status;
        return (
          status !== 'approved' &&
          status !== 'rejected' &&
          confidencePct(entityConfidence(entity)) >= documentApprovalThreshold
        );
      })
      .map((entity) => entity.entity_id);

    if (!ids.length) return;
    setDocumentBusyId('bulk');
    try {
      const result = await bulkApproveKnowledgeEntities(ids);
      if (selectedDocumentId)
        await loadKnowledgeDocumentDetail(selectedDocumentId);
      await loadKnowledgeDocuments(selectedDocumentId);
      await loadSavedKnowledge();
      setErr(`Approved ${result.approved} catalogue items.`);
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to approve catalogue items'));
    } finally {
      setDocumentBusyId(null);
    }
  }

  async function uploadCatalogue(
    file: File,
    label: string,
    docCategory?: string,
  ) {
    // Block duplicate uploads (case-insensitive filename match against loaded documents)
    const target = file.name.toLowerCase().trim();
    const dup = knowledgeDocuments.find(
      (d) =>
        (d.filename || '').toLowerCase().trim() === target ||
        ((d as { original_filename?: string }).original_filename || '').toLowerCase().trim() === target,
    );
    if (dup) {
      setErr(
        `"${file.name}" has already been uploaded. Delete the existing document first if you want to re-upload.`,
      );
      setRagMode(null);
      return;
    }
    setErr('');
    setRagBusy(true);
    setKnowledgeView('catalogue');
    setRagStatus({
      kind: 'catalogue',
      title: file.name,
      detail: 'Uploading catalogue to the knowledge pipeline',
      status: 'uploading',
      progress: 8,
    });

    try {
      const response = await uploadKnowledgeCatalogue(file, label, docCategory);
      setRagMode(null);
      setSelectedDocumentId(response.document_id);
      await loadKnowledgeDocuments(response.document_id);
      // Persist so a page refresh mid-upload resumes the poll.
      try {
        window.localStorage.setItem(
          'pending_upload',
          JSON.stringify({
            documentId: response.document_id,
            jobId: response.job_id ?? null,
            filename: response.filename,
          }),
        );
      } catch {
        // non-fatal
      }
      setRagStatus({
        kind: 'catalogue',
        title: response.filename,
        detail: response.message,
        status: response.ingestion_status,
        progress: response.job_id ? 18 : 100,
      });

      if (response.job_id) {
        let parseCompleted = false;
        for (let i = 0; i < 45; i += 1) {
          await wait(2000);
          if (!mountedRef.current) return;
          const job = await getKnowledgeJob(response.job_id);
          if (!mountedRef.current) return;
          setRagStatus({
            kind: 'catalogue',
            title: response.filename,
            detail: job.error_message || 'Reading your document…',
            status: job.status,
            progress:
              job.status === 'completed'
                ? 72
                : Math.max(18, Math.min(72, job.progress_pct || 18)),
          });

          if (job.status === 'completed') {
            parseCompleted = true;
            break;
          }
          if (job.status === 'failed') {
            throw new Error(
              job.error_message ||
                "We couldn't read that document. Try re-uploading or use a different file.",
            );
          }
        }

        if (!parseCompleted) {
          // Backend is still parsing; don't mark as failed.
          setRagStatus((prev) =>
            prev
              ? {
                  ...prev,
                  detail:
                    'Parsing is still running in the background — check back in a minute.',
                  status: 'in_progress',
                  progress: 70,
                }
              : null,
          );
          await loadKnowledgeDocuments(response.document_id);
          return;
        }

        let finalDetail: KnowledgeDocumentDetail | null = null;
        for (let i = 0; i < 60; i += 1) {
          await wait(i === 0 ? 400 : 2000);
          if (!mountedRef.current) return;
          const detail = await getKnowledgeDocument(response.document_id);
          if (!mountedRef.current) return;
          finalDetail = detail;
          const status = detail.document.ingestion_status;
          const count = documentEntityCount(detail);
          setDocumentDetail(detail);
          setRagStatus({
            kind: 'catalogue',
            title: response.filename,
            detail:
              status === 'completed'
                ? `${count} item${count === 1 ? '' : 's'} ready for review`
                : 'Organising what we found into questions and answers…',
            status,
            progress: status === 'completed' ? 100 : 76,
          });

          if (status === 'failed') {
            try {
              window.localStorage.removeItem('pending_upload');
            } catch {}
            throw new Error(
              "We couldn't organise the extracted items. Try uploading the file again.",
            );
          }
          if (status === 'completed') {
            break;
          }
        }

        if (finalDetail?.document.ingestion_status !== 'completed') {
          // The backend is still working; don't mark the whole upload as failed.
          // Leave pending_upload in localStorage so a refresh resumes tracking.
          setRagStatus((prev) =>
            prev
              ? {
                  ...prev,
                  detail:
                    'Still processing in the background — refresh in a minute to see the extracted items.',
                  status: 'in_progress',
                  progress: 90,
                }
              : null,
          );
          await loadKnowledgeDocuments(response.document_id);
          return;
        }

        try {
          window.localStorage.removeItem('pending_upload');
        } catch {}
        await loadKnowledgeDocuments(response.document_id);
        await loadSavedKnowledge();
        const extracted = documentEntityCount(finalDetail);
        setErr(
          extracted > 0
            ? `Uploaded catalogue and extracted ${extracted} item${extracted === 1 ? '' : 's'}.`
            : 'Catalogue processed, but no items were extracted. Try a clearer image/PDF or use the extraction retry tools.',
        );
      } else {
        await loadKnowledgeDocuments(response.document_id);
        setErr(
          'Uploaded catalogue. Extraction will start in the background — refresh to check progress.',
        );
      }
    } catch (e: unknown) {
      const message = errorMessage(e, 'Catalogue upload failed');
      try {
        window.localStorage.removeItem('pending_upload');
      } catch {}
      setErr(message);
      setRagStatus((prev) =>
        prev
          ? {
              ...prev,
              detail: message,
              status: 'failed',
              progress: 100,
            }
          : null,
      );
    } finally {
      setRagBusy(false);
    }
  }

  async function loadWebsiteEntries(
    analysisId: number | null = websiteAnalysisId,
  ) {
    setWebsiteEntriesLoading(true);
    try {
      const entries = await listWebsiteKnowledgeEntries({
        analysisId: analysisId || undefined,
        pageSize: 200,
      });
      setWebsiteEntries(entries);
      setSelectedEntryIds((prev) => {
        const valid = new Set(entries.map((entry) => entry.id));
        return new Set([...prev].filter((id) => valid.has(id)));
      });
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to load website entries'));
    } finally {
      setWebsiteEntriesLoading(false);
    }
  }

  useEffect(() => {
    loadKnowledgeDocuments(null);
    loadSavedKnowledge();
    loadWebsiteEntries(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleWebsiteEntry(id: number) {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectDraftEntries() {
    const draftIds = websiteEntries
      .filter((entry) => entry.status === 'draft')
      .map((entry) => entry.id);
    setSelectedEntryIds(new Set(draftIds));
  }

  async function saveWebsiteEntry(id: number, patch: WebsiteEntryPatch) {
    setEntryBusyId(id);
    try {
      const updated = await editWebsiteKnowledgeEntry(id, patch);
      setWebsiteEntries((prev) =>
        prev.map((entry) => (entry.id === id ? updated : entry)),
      );
      setErr('Updated website entry.');
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to update entry'));
    } finally {
      setEntryBusyId(null);
    }
  }

  /**
   * When a user wants to bring back a rejected item, the backend has no
   * un-reject endpoint (verified: /restore, /reset, /reactivate, /unreject,
   * /draft all 404, PATCH is 405). Instead of failing, we copy the content
   * into the Write tab's new-FAQ form so the user can save it as a fresh
   * FAQ with one more click. That preserves their intent without needing
   * a backend change.
   */
  function bringBackAsFaq({
    question,
    answer,
    tags,
    synonyms,
  }: {
    question: string;
    answer: string;
    tags?: string;
    synonyms?: string;
  }) {
    setNQ(question || '');
    setNA(answer || '');
    setNT(tags || '');
    setNS(synonyms || '');
    setShowAdd(true);
    setKnowledgeView('manual');
    // Give React a moment to switch tabs and open the form, then scroll.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el =
          typeof document !== 'undefined'
            ? document.getElementById('new-faq-form')
            : null;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          const first = el.querySelector<
            HTMLInputElement | HTMLTextAreaElement
          >('input, textarea');
          if (first) first.focus({ preventScroll: true });
        } else if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
    flashErr(
      `Copied to Write tab — press "Add" to save it as a new FAQ.`,
      6000,
    );
  }

  async function approveWebsiteEntry(id: number, patch?: WebsiteEntryPatch) {
    setEntryBusyId(id);
    try {
      // Rejected entries can't be moved back to draft on this backend — the
      // unreject endpoints don't exist. Redirect the user to the "bring back
      // as FAQ" flow so they can save the content as a fresh manual FAQ.
      const current = websiteEntries.find((entry) => entry.id === id);
      if (current?.status === 'rejected') {
        bringBackAsFaq({
          question: current.question,
          answer: current.answer,
          tags: (current.tags || []).join(', '),
        });
        setEntryBusyId(null);
        return;
      }
      const updated = await approveWebsiteKnowledgeEntry(id, patch);
      setWebsiteEntries((prev) =>
        prev.map((entry) => (entry.id === id ? updated : entry)),
      );
      setSelectedEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadSavedKnowledge();
      flashErr('Approved website entry.', 5000);
    } catch (e: unknown) {
      flashErr(errorMessage(e, 'Failed to approve entry'), 5000);
    } finally {
      setEntryBusyId(null);
    }
  }

  async function rejectWebsiteEntry(id: number) {
    setEntryBusyId(id);
    try {
      const updated = await rejectWebsiteKnowledgeEntry(id);
      setWebsiteEntries((prev) =>
        prev.map((entry) => (entry.id === id ? updated : entry)),
      );
      setSelectedEntryIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      await loadSavedKnowledge();
      setErr('Rejected website entry.');
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to reject entry'));
    } finally {
      setEntryBusyId(null);
    }
  }

  async function approveWebsiteEntryIds(
    ids: number[],
    successPrefix = 'Approved',
  ) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return;
    setEntryBusyId('bulk');
    try {
      let approved = 0;
      for (let i = 0; i < uniqueIds.length; i += 500) {
        const result = await bulkApproveWebsiteKnowledgeEntries(
          uniqueIds.slice(i, i + 500),
        );
        approved += result.approved;
      }
      await loadWebsiteEntries();
      await loadSavedKnowledge();
      setSelectedEntryIds(new Set());
      setErr(`${successPrefix} ${approved} website entries.`);
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to approve selected entries'));
    } finally {
      setEntryBusyId(null);
    }
  }

  async function bulkApproveWebsiteEntries() {
    await approveWebsiteEntryIds([...selectedEntryIds]);
  }

  async function approveWebsiteThresholdEntries() {
    const ids = websiteEntries
      .filter(
        (entry) =>
          entry.status === 'draft' &&
          confidencePct(entry.confidence) >= websiteApprovalThreshold,
      )
      .map((entry) => entry.id);
    await approveWebsiteEntryIds(ids, 'Approved');
  }

  async function bulkRejectWebsiteEntries() {
    const ids = [...new Set(selectedEntryIds)];
    if (!ids.length) return;
    setEntryBusyId('bulk');
    try {
      let rejected = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const result = await bulkRejectWebsiteKnowledgeEntries(
          ids.slice(i, i + 500),
        );
        rejected += result.rejected;
      }
      await loadWebsiteEntries();
      await loadSavedKnowledge();
      setSelectedEntryIds(new Set());
      setErr(`Rejected ${rejected} website entries.`);
    } catch (e: unknown) {
      setErr(errorMessage(e, 'Failed to reject selected entries'));
    } finally {
      setEntryBusyId(null);
    }
  }

  /**
   * Permanently delete every website entry currently in "rejected" status.
   * The user gets a shared ConfirmModal — no browser alert — with a count.
   * Uses the same batched delete endpoint as the per-site cleanup.
   */
  function deleteAllRejectedWebsiteEntries() {
    const ids = websiteEntries
      .filter((e) => e.status === 'rejected')
      .map((e) => e.id);
    if (!ids.length) return;
    setConfirm({
      title: `Delete all ${ids.length} rejected item${ids.length === 1 ? '' : 's'}?`,
      message:
        'These will be permanently removed from the review list. Approved and draft items are not affected.',
      confirmLabel: 'Delete all rejected',
      destructive: true,
      onConfirm: async () => {
        setEntryBusyId('bulk');
        try {
          const tasks = ids.map((id) =>
            apiFetch(`/admin/knowledge/website/entries/${id}`, {
              method: 'DELETE',
              auth: true,
            }),
          );
          const results = await Promise.allSettled(tasks);
          const failed = results.filter((r) => r.status === 'rejected').length;
          await loadWebsiteEntries();
          await loadSavedKnowledge();
          setSelectedEntryIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
          });
          const succeeded = ids.length - failed;
          if (succeeded === 0) {
            // All requests failed — render as error, not success.
            flashErr(
              `Failed to delete ${failed} rejected item${failed === 1 ? '' : 's'}. Check your permissions or refresh.`,
              6000,
            );
          } else if (failed > 0) {
            flashErr(
              `Deleted ${succeeded} rejected item${succeeded === 1 ? '' : 's'}. ${failed} failed — refresh to retry.`,
              5000,
            );
          } else {
            flashErr(
              `Deleted ${ids.length} rejected item${ids.length === 1 ? '' : 's'}.`,
              5000,
            );
          }
        } catch (e: unknown) {
          flashErr(errorMessage(e, 'Failed to delete rejected entries'), 5000);
        } finally {
          setEntryBusyId(null);
        }
      },
    });
  }

  /** Normalize any URL-ish string to a bare host: "https://www.acme.com/x" → "acme.com". */
  function normalizeHost(input: string): string {
    return (input || '')
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split(/[/?#]/)[0];
  }

  /**
   * Return the unique set of hosts currently represented in websiteEntries.
   * Rejected entries are excluded — once every entry from a host has been
   * rejected, the user has effectively "deleted" that site and it should
   * no longer count toward the per-user site cap.
   */
  function uniqueImportedHosts(): string[] {
    const set = new Set<string>();
    for (const entry of websiteEntries) {
      if (entry.status === 'rejected') continue;
      const host = normalizeHost(entrySourceUrl(entry));
      if (host) set.add(host);
    }
    return [...set];
  }

  /**
   * Bulk-remove every website entry whose source URL belongs to `host`.
   * "Remove" here means: reject the ones that aren't already rejected.
   * Confirmation is handled by the parent via a proper modal — do NOT call
   * window.confirm() from here (it fires a browser-native popup).
   */
  async function deleteWebsiteSite(host: string) {
    const normalized = normalizeHost(host);
    if (!normalized) return;
    const activeEntries = websiteEntries.filter(
      (entry) =>
        entry.status !== 'rejected' &&
        normalizeHost(entrySourceUrl(entry)) === normalized,
    );
    const ids = activeEntries.map((entry) => entry.id as number);
    if (!ids.length) {
      // Everything for this host is already rejected — just refresh
      // to make the chip disappear on the next render.
      await loadWebsiteEntries();
      setErr(`No active entries left for ${normalized}.`);
      return;
    }
    setEntryBusyId('bulk');
    try {
      let removed = 0;
      for (let i = 0; i < ids.length; i += 500) {
        const result = await bulkRejectWebsiteKnowledgeEntries(
          ids.slice(i, i + 500),
        );
        removed += result.rejected;
      }
      await loadWebsiteEntries();
      await loadSavedKnowledge();
      setSelectedEntryIds(new Set());
      setErr(`Removed ${removed} entries from ${normalized}.`);
    } catch (e: unknown) {
      setErr(errorMessage(e, `Failed to delete entries from ${normalized}`));
    } finally {
      setEntryBusyId(null);
    }
  }

  async function analyzeWebsite(url: string, maxPages: number) {
    // Block duplicate imports (host-level match against known entries)
    const host = normalizeHost(url);
    if (host) {
      const existingHosts = uniqueImportedHosts();
      const dup = existingHosts.includes(host);
      if (dup) {
        setErr(
          `This site has already been imported. Delete the existing entries from the Import from site tab first if you want to re-import.`,
        );
        setRagMode(null);
        return;
      }
      // Enforce per-user site cap. Users can keep at most
      // MAX_IMPORTED_SITES_PER_USER distinct sites imported at once.
      if (existingHosts.length >= MAX_IMPORTED_SITES_PER_USER) {
        setErr(
          `You can only keep ${MAX_IMPORTED_SITES_PER_USER} imported sites at a time (${existingHosts.join(', ')}). Delete one from the Import from site tab before adding another.`,
        );
        setRagMode(null);
        return;
      }
    }
    setErr('');
    setRagBusy(true);
    setKnowledgeView('website');
    setWebsiteEntries([]);
    setWebsiteAnalysisId(null);
    setSelectedEntryIds(new Set());
    // Close the modal immediately — regardless of whether the request
    // succeeds or fails, the user shouldn't stay stuck on the input dialog.
    // Any error will surface in the top banner and status card.
    setRagMode(null);
    setRagStatus({
      kind: 'webscraper',
      title: url.trim(),
      detail: 'Starting website analysis',
      status: 'pending',
      progress: 8,
      pagesExplored: 0,
      entriesGenerated: 0,
    });

    try {
      const started = await analyzeKnowledgeWebsite(url.trim(), maxPages);
      setWebsiteAnalysisId(started.analysis_id);
      // Persist so a page refresh mid-scrape resumes the poll instead of
      // dropping it. Cleared when the scrape completes or the user dismisses.
      try {
        window.localStorage.setItem(
          'pending_scrape',
          JSON.stringify({ analysisId: started.analysis_id, url: url.trim() }),
        );
      } catch {
        // localStorage may be full or disabled — non-fatal, scrape still runs.
      }

      const updateAnalysisStatus = (
        analysis: WebsiteAnalysisStatus,
        fallbackProgress: number,
      ) => {
        const done = analysis.status === 'completed';
        const failed = analysis.status === 'failed';
        setRagStatus({
          kind: 'webscraper',
          title: analysis.url,
          detail: failed
            ? analysis.error_message ||
              "We couldn't scan that website. Try again or check the URL."
            : `${analysis.pages_explored ?? 0} pages, ${analysis.total_entries_generated ?? 0} entries`,
          status: analysis.status,
          progress: done ? 100 : failed ? 100 : fallbackProgress,
          pagesExplored: analysis.pages_explored ?? 0,
          entriesGenerated: analysis.total_entries_generated ?? 0,
          websiteType: analysis.website_type,
        });
      };

      updateAnalysisStatus(started, 16);
      for (let i = 0; i < 60; i += 1) {
        await wait(2500);
        if (!mountedRef.current) return;
        const next = await getKnowledgeWebsiteAnalysis(started.analysis_id);
        if (!mountedRef.current) return;
        const progress = Math.min(92, 18 + i * 2);
        updateAnalysisStatus(next, progress);

        if (next.status === 'completed') {
          setErr(
            `Import completed: ${next.total_entries_generated ?? 0} entries generated.`,
          );
          try {
            window.localStorage.removeItem('pending_scrape');
          } catch {}
          await loadWebsiteEntries(started.analysis_id);
          await loadSavedKnowledge();
          break;
        }
        if (next.status === 'failed') {
          try {
            window.localStorage.removeItem('pending_scrape');
          } catch {}
          throw new Error(
            next.error_message ||
              "We couldn't scan that website. Try again or check the URL.",
          );
        }
      }
    } catch (e: unknown) {
      const message = errorMessage(e, 'Import failed');
      setErr(message);
      try {
        window.localStorage.removeItem('pending_scrape');
      } catch {}
      setRagStatus((prev) =>
        prev
          ? {
              ...prev,
              detail: message,
              status: 'failed',
              progress: 100,
            }
          : null,
      );
    } finally {
      setRagBusy(false);
    }
  }

  /** Poll an in-flight scrape started elsewhere (e.g. onboarding). */
  async function resumeAnalysis(analysisId: number, url: string) {
    setErr('');
    setRagBusy(true);
    setKnowledgeView('website');
    setWebsiteAnalysisId(analysisId);
    setRagStatus({
      kind: 'webscraper',
      title: url,
      detail: 'Picking up where we left off…',
      status: 'in_progress',
      progress: 12,
      pagesExplored: 0,
      entriesGenerated: 0,
    });

    const clearPending = () => {
      try {
        window.localStorage.removeItem('pending_scrape');
      } catch {}
    };

    try {
      // Poll for up to ~10 minutes. Complex sites can genuinely take that long.
      const MAX_ITERS = 240;
      for (let i = 0; i < MAX_ITERS; i += 1) {
        await wait(2500);
        if (!mountedRef.current) return;
        const next = await getKnowledgeWebsiteAnalysis(analysisId);
        if (!mountedRef.current) return;
        const done = next.status === 'completed';
        const failed = next.status === 'failed';
        const progress = done ? 100 : failed ? 100 : Math.min(92, 18 + i * 1.2);
        setRagStatus({
          kind: 'webscraper',
          title: next.url,
          detail: failed
            ? next.error_message ||
              "We couldn't scan that website. Try again or check the URL."
            : `${next.pages_explored ?? 0} pages, ${next.total_entries_generated ?? 0} entries`,
          status: next.status,
          progress,
          pagesExplored: next.pages_explored ?? 0,
          entriesGenerated: next.total_entries_generated ?? 0,
          websiteType: next.website_type,
        });
        if (done) {
          clearPending();
          setErr(
            `Import completed: ${next.total_entries_generated ?? 0} entries generated.`,
          );
          await loadWebsiteEntries(analysisId);
          await loadSavedKnowledge();
          return;
        }
        if (failed) {
          clearPending();
          throw new Error(
            next.error_message ||
              "We couldn't scan that website. Try again or check the URL.",
          );
        }
      }
      // If we exhausted iterations without seeing "completed", the job may
      // still be running server-side. Leave pending_scrape in localStorage
      // so a refresh will resume the poll — don't mark this as failed.
      setRagStatus((prev) =>
        prev
          ? {
              ...prev,
              detail:
                'Still working on it in the background — come back in a moment to see the results.',
              status: 'in_progress',
              progress: 92,
            }
          : null,
      );
    } catch (e: unknown) {
      const message = errorMessage(e, 'Import failed');
      setErr(message);
      setRagStatus((prev) =>
        prev
          ? { ...prev, detail: message, status: 'failed', progress: 100 }
          : null,
      );
    } finally {
      setRagBusy(false);
    }
  }

  /** Poll an in-flight catalogue upload started elsewhere. */
  async function resumeUpload(
    documentId: number,
    jobId: number | null,
    filename: string,
  ) {
    setErr('');
    setRagBusy(true);
    setKnowledgeView('catalogue');
    setSelectedDocumentId(documentId);
    await loadKnowledgeDocuments(documentId);
    setRagStatus({
      kind: 'catalogue',
      title: filename,
      detail: 'Picking up where we left off…',
      status: 'in_progress',
      progress: jobId ? 20 : 100,
    });

    const clearPending = () => {
      try {
        window.localStorage.removeItem('pending_upload');
      } catch {}
    };

    try {
      if (jobId) {
        let parseCompleted = false;
        // Poll parse phase (up to ~4 minutes)
        for (let i = 0; i < 120; i += 1) {
          await wait(2000);
          if (!mountedRef.current) return;
          const job = await getKnowledgeJob(jobId);
          if (!mountedRef.current) return;
          setRagStatus({
            kind: 'catalogue',
            title: filename,
            detail: job.error_message || 'Reading your document…',
            status: job.status,
            progress:
              job.status === 'completed'
                ? 72
                : Math.max(20, Math.min(72, job.progress_pct || 20)),
          });
          if (job.status === 'completed') {
            parseCompleted = true;
            break;
          }
          if (job.status === 'failed') {
            clearPending();
            throw new Error(
              job.error_message ||
                "We couldn't read that document. Try re-uploading or use a different file.",
            );
          }
        }
        if (!parseCompleted) {
          // Still parsing — leave key so a refresh resumes
          setRagStatus((prev) =>
            prev
              ? {
                  ...prev,
                  detail:
                    'Still reading — leave this tab or come back later to see the results.',
                  status: 'in_progress',
                  progress: 70,
                }
              : null,
          );
          return;
        }

        // Poll normalization phase (up to ~4 minutes)
        for (let i = 0; i < 120; i += 1) {
          await wait(i === 0 ? 400 : 2000);
          if (!mountedRef.current) return;
          const detail = await getKnowledgeDocument(documentId);
          if (!mountedRef.current) return;
          const status = detail.document.ingestion_status;
          const count = documentEntityCount(detail);
          setDocumentDetail(detail);
          setRagStatus({
            kind: 'catalogue',
            title: filename,
            detail:
              status === 'completed'
                ? `${count} extracted item${count === 1 ? '' : 's'} ready for review`
                : 'Structuring extracted catalogue knowledge',
            status,
            progress: status === 'completed' ? 100 : 76,
          });
          if (status === 'completed') {
            clearPending();
            await loadSavedKnowledge();
            return;
          }
          if (status === 'failed') {
            clearPending();
            throw new Error('Catalogue normalization failed');
          }
        }
        // Normalization still going — leave key so a refresh resumes
        setRagStatus((prev) =>
          prev
            ? {
                ...prev,
                detail:
                  'Still processing in the background — refresh to resume tracking.',
                status: 'in_progress',
                progress: 90,
              }
            : null,
        );
      } else {
        // No jobId means ingestion completed on the upload response itself.
        clearPending();
      }
    } catch (e: unknown) {
      const message = errorMessage(e, 'Catalogue ingestion failed');
      setErr(message);
      setRagStatus((prev) =>
        prev
          ? { ...prev, detail: message, status: 'failed', progress: 100 }
          : null,
      );
    } finally {
      setRagBusy(false);
    }
  }

  /** On mount, pick up pending onboarding jobs handed off from the overview page.
   *  Note: we do NOT remove the localStorage keys here. The resume functions
   *  remove them only when the job is truly completed or failed. That way a
   *  page refresh mid-scrape/upload will resume the poll instead of dropping it.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let scrapeRaw: string | null = null;
    let uploadRaw: string | null = null;
    try {
      scrapeRaw = window.localStorage.getItem('pending_scrape');
      uploadRaw = window.localStorage.getItem('pending_upload');
    } catch {
      return;
    }
    if (!scrapeRaw && !uploadRaw) return;

    (async () => {
      // Sequential: watch the scrape through to completion first, THEN watch
      // the upload. Running them in parallel would have both writing to the
      // same ragStatus and flickering the UI between the two.
      try {
        if (scrapeRaw) {
          const p = JSON.parse(scrapeRaw) as {
            analysisId: number | string;
            url: string;
          };
          await resumeAnalysis(Number(p.analysisId), p.url);
        }
      } catch {
        // resumeAnalysis surfaces its own error
      }
      try {
        if (uploadRaw) {
          const p = JSON.parse(uploadRaw) as {
            documentId: number | string;
            jobId?: number | string | null;
            filename: string;
          };
          await resumeUpload(
            Number(p.documentId),
            p.jobId != null ? Number(p.jobId) : null,
            p.filename,
          );
        }
      } catch {
        // resumeUpload surfaces its own error
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayed = useMemo(() => {
    let out = [...items];

    if (filter === 'active') out = out.filter((i) => i.is_active);
    if (filter === 'inactive') out = out.filter((i) => !i.is_active);

    if (sort === 'az') out.sort((a, b) => a.question.localeCompare(b.question));
    if (sort === 'created') {
      out.sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime(),
      );
    }
    if (sort === 'updated') {
      out.sort(
        (a, b) =>
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime(),
      );
    }

    return out;
  }, [items, filter, sort]);

  const totalPages = Math.max(1, Math.ceil(displayed.length / manualPageSize));
  const currentPage = Math.min(manualPage, totalPages);
  const pageStart = (currentPage - 1) * manualPageSize;
  const pageItems = displayed.slice(pageStart, pageStart + manualPageSize);

  const active = items.filter((i) => i.is_active).length;
  const inactive = items.length - active;
  const approvedKnowledgeCount = websiteEntries.filter(
    (entry) => entry.status === 'approved',
  ).length;
  const approvedDocumentKnowledgeCount = savedEntities.length;
  const totalKnowledgeCount =
    items.length + approvedKnowledgeCount + approvedDocumentKnowledgeCount;

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    outline: 'none',
    transition: 'all .2s',
    boxSizing: 'border-box',
    border: `1px solid ${th.inputBorder}`,
    background: th.inputBg,
    color: th.text,
    boxShadow: 'none',
  };

  const onFocus = (e: React.FocusEvent<HTMLElement>) => {
    e.target.style.borderColor = th.accent;
    e.target.style.boxShadow = `0 0 0 3px ${th.accentSoft}`;
  };

  const onBlur = (e: React.FocusEvent<HTMLElement>) => {
    e.target.style.borderColor = th.inputBorder;
    e.target.style.boxShadow = 'none';
  };

  return (
    <RequireAuth>
      <LockedAccountBanner />
      <ConversationLimitBanner />
      <style>{`
        @keyframes faq-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes faq-pop { from { opacity: 0; transform: scale(.92); } to { opacity: 1; transform: scale(1); } }
        @keyframes faq-card { from { opacity: 0; transform: translateY(18px) scale(.985); } to { opacity: 1; transform: none; } }
        @keyframes faq-down { from { opacity: 0; transform: translateY(-14px) scaleY(.92); } to { opacity: 1; transform: none; } }
        @keyframes faq-expand { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes faq-head { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: none; } }
        @keyframes faq-pulse { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(2.2); opacity: 0; } }
        @keyframes faq-spin { to { transform: rotate(360deg); } }
        @keyframes faq-shim { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes faq-progress-stripes { from { background-position: 0 0; } to { background-position: 28px 0; } }
        @keyframes faq-live-pulse {
          0%   { transform: scale(1);   opacity: 1;   }
          50%  { transform: scale(1.6); opacity: .35; }
          100% { transform: scale(1);   opacity: 1;   }
        }
        @keyframes faq-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }

        .faq-shell {
          max-width: 1500px;
          margin: 0 auto;
          padding: 28px 24px 40px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .faq-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        .faq-toolbar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          animation: faq-pop .5s ease .15s both;
        }

        .faq-workbench-readable {
          font-size: 14px;
        }

        .faq-workbench-readable [style*="font-size: 10"] {
          font-size: 12px !important;
          line-height: 1.5 !important;
        }

        .faq-workbench-readable [style*="font-size: 11"] {
          font-size: 13px !important;
          line-height: 1.55 !important;
        }

        .faq-workbench-readable [style*="font-size: 12"] {
          font-size: 14px !important;
          line-height: 1.6 !important;
        }

        .faq-workbench-readable [style*="font-size: 13"] {
          font-size: 15px !important;
          line-height: 1.6 !important;
        }

        .faq-workbench-readable [style*="font-size: 14"] {
          font-size: 16px !important;
          line-height: 1.6 !important;
        }

        .faq-workbench-readable [style*="font-size: 15"] {
          font-size: 17px !important;
          line-height: 1.55 !important;
        }

        .faq-workbench-readable input,
        .faq-workbench-readable textarea,
        .faq-workbench-readable select,
        .faq-workbench-readable button {
          font-size: 14px;
        }

        .faq-workbench-readable table th,
        .faq-workbench-readable table td {
          font-size: 14px !important;
          line-height: 1.55 !important;
        }

        .faq-workbench-readable .catalogue-workspace {
          grid-template-columns: minmax(340px, .85fr) minmax(0, 1.15fr) !important;
          gap: 0 !important;
        }

        .faq-workbench-readable .catalogue-workspace > div:nth-child(3) {
          grid-column: 1 / -1 !important;
          border-left: 0 !important;
          border-top: 1px solid ${th.cardBorder} !important;
        }

        .faq-workbench-readable .catalogue-workspace > div:first-child,
        .faq-workbench-readable .website-workspace > div:first-child,
        .faq-workbench-readable .knowledge-review-grid > div:first-child {
          border-right: 1px solid ${th.cardBorder} !important;
        }

        .faq-workbench-readable .document-preview-panel {
          position: sticky;
          top: 16px;
        }

        .faq-workbench-readable .website-workspace {
          grid-template-columns: minmax(0, 1.18fr) minmax(420px, .82fr) !important;
        }

        .faq-workbench-readable .knowledge-review-grid {
          grid-template-columns: minmax(0, 1.1fr) minmax(420px, .9fr) !important;
        }

        @media (max-width: 760px) {
          .faq-stats {
            grid-template-columns: 1fr;
          }
          .faq-shell {
            padding: 22px 14px 32px;
          }
          .catalogue-workspace,
          .website-workspace {
            grid-template-columns: 1fr !important;
          }
          .knowledge-review-grid {
            grid-template-columns: 1fr !important;
          }
          .knowledge-review-grid > div:first-child {
            border-right: 0 !important;
          }
          .document-preview-panel {
            position: static !important;
          }
          .scraper-preview-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 1100px) {
          .catalogue-workspace,
          .website-workspace {
            grid-template-columns: 1fr !important;
          }
          .knowledge-review-grid {
            grid-template-columns: 1fr !important;
          }
          .knowledge-review-grid > div:first-child {
            border-right: 0 !important;
            border-bottom: 1px solid ${th.cardBorder};
          }
          .document-preview-panel {
            position: static !important;
          }
          .scraper-preview-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {delTarget && (
        <DelModal
          item={delTarget}
          ok={() => deleteFaq(delTarget.id)}
          no={() => setDelTarget(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          detail={confirm.message}
          confirmLabel={confirm.confirmLabel || 'Confirm'}
          danger={confirm.destructive !== false}
          ok={() => {
            const fn = confirm.onConfirm;
            setConfirm(null);
            Promise.resolve(fn()).catch(() => {
              /* onConfirm surfaces its own error via flashErr */
            });
          }}
          no={() => setConfirm(null)}
        />
      )}

      {ragMode === 'catalogue' && (
        <CatalogueUploadModal
          onClose={() => setRagMode(null)}
          onUpload={uploadCatalogue}
          busy={ragBusy}
          isDark={isDark}
          th={th}
          inputStyle={inputStyle}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )}

      {ragMode === 'webscraper' && (
        <WebscraperModal
          onClose={() => setRagMode(null)}
          onAnalyze={analyzeWebsite}
          busy={ragBusy}
          isDark={isDark}
          th={th}
          inputStyle={inputStyle}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      )}

      <div className='relative overflow-x-hidden'>
        <div className='mx-auto flex max-w-375 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8'>
          {/* Header */}
          <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div>
              <PageBreadcrumb pageTitle='Knowledge' />
              <p className='-mt-4 type-small text-gray-500 dark:text-gray-400'>
                {totalKnowledgeCount} entries powering automatic chat replies
              </p>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              {openedFromSettings && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => router.push(settingsBackHref)}
                >
                  <ChevronLeft size={14} />
                  Back to Settings
                </Button>
              )}
              <Button
                variant='outline'
                size='sm'
                onClick={() => setShowTest((v) => !v)}
              >
                <FlaskConical size={14} />
                Test retrieval
              </Button>
              <Button
                size='sm'
                onClick={() => {
                  setKnowledgeView('manual');
                  setShowAdd(true);
                }}
              >
                <Plus size={14} />
                New FAQ
              </Button>
            </div>
          </div>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <button
              type='button'
              onClick={() => setKnowledgeView('saved')}
              className='rounded-xl border border-brand-100 bg-brand-50 p-6 text-left transition hover:border-brand-200 hover:bg-brand-100/60 dark:border-brand-500/20 dark:bg-brand-500/10 dark:hover:bg-brand-500/15'
            >
              <div className='flex items-center gap-3'>
                <div className='flex h-9 w-9 items-center justify-center rounded-(--radius-control) bg-brand-500/15 text-brand-500 dark:bg-brand-500/20 dark:text-brand-400'>
                  <Database size={16} />
                </div>
                <span className='type-small font-medium text-gray-600 dark:text-gray-400'>
                  Total knowledge
                </span>
              </div>
              <div className='mt-3 flex items-end justify-between gap-3'>
                <span className='text-title-sm font-semibold text-gray-800 dark:text-white/90'>
                  {totalKnowledgeCount}
                </span>
                <Badge color='primary'>All sources</Badge>
              </div>
            </button>

            <button
              type='button'
              onClick={() => setKnowledgeView('manual')}
              className='rounded-xl border border-success-100 bg-success-50 p-6 text-left transition hover:border-success-200 hover:bg-success-100/60 dark:border-success-500/20 dark:bg-success-500/10 dark:hover:bg-success-500/15'
            >
              <div className='flex items-center gap-3'>
                <div className='flex h-9 w-9 items-center justify-center rounded-(--radius-control) bg-success-500/15 text-success-600 dark:bg-success-500/20 dark:text-success-400'>
                  <MessageSquare size={16} />
                </div>
                <span className='type-small font-medium text-gray-600 dark:text-gray-400'>
                  Manual FAQs
                </span>
              </div>
              <div className='mt-3 flex items-end justify-between gap-3'>
                <span className='text-title-sm font-semibold text-gray-800 dark:text-white/90'>
                  {items.length}
                </span>
                <Badge color='success'>{active} active</Badge>
              </div>
            </button>

            <button
              type='button'
              onClick={() => setKnowledgeView('catalogue')}
              className='rounded-xl border border-warning-100 bg-warning-50 p-6 text-left transition hover:border-warning-200 hover:bg-warning-100/60 dark:border-warning-500/20 dark:bg-warning-500/10 dark:hover:bg-warning-500/15'
            >
              <div className='flex items-center gap-3'>
                <div className='flex h-9 w-9 items-center justify-center rounded-(--radius-control) bg-warning-500/15 text-warning-600 dark:bg-warning-500/20 dark:text-warning-400'>
                  <FileText size={16} />
                </div>
                <span className='type-small font-medium text-gray-600 dark:text-gray-400'>
                  Uploaded docs
                </span>
              </div>
              <div className='mt-3 flex items-end justify-between gap-3'>
                <span className='text-title-sm font-semibold text-gray-800 dark:text-white/90'>
                  {knowledgeDocuments.length}
                </span>
                <Badge color='warning'>{savedEntities.length} live</Badge>
              </div>
            </button>

            <button
              type='button'
              onClick={() => setKnowledgeView('website')}
              className='rounded-xl border border-purple-100 bg-purple-50 p-6 text-left transition hover:border-purple-200 hover:bg-purple-100/60 dark:border-purple-500/20 dark:bg-purple-500/10 dark:hover:bg-purple-500/15'
            >
              <div className='flex items-center gap-3'>
                <div className='flex h-9 w-9 items-center justify-center rounded-(--radius-control) bg-purple-500/15 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400'>
                  <Globe size={16} />
                </div>
                <span className='type-small font-medium text-gray-600 dark:text-gray-400'>
                  Website entries
                </span>
              </div>
              <div className='mt-3 flex items-end justify-between gap-3'>
                <span className='text-title-sm font-semibold text-gray-800 dark:text-white/90'>
                  {websiteEntries.length}
                </span>
                <Badge color='light'>{approvedKnowledgeCount} approved</Badge>
              </div>
            </button>
          </div>

          {/* RAG status (non-webscraper) */}
          {ragStatus && ragStatus.kind !== 'webscraper' && (
            <RagStatusCard
              state={ragStatus}
              isDark={isDark}
              th={th}
              onDismiss={() => {
                // Clear any pending poll bookkeeping so a stale/failed job
                // can't quietly resurrect itself on remount.
                try {
                  window.localStorage.removeItem('pending_upload');
                  window.localStorage.removeItem('pending_scrape');
                } catch {}
                setRagStatus(null);
              }}
            />
          )}

          {/* Status / error banner */}
          {err &&
            (() => {
              const isSuccess =
                /^(Imported|Uploaded|Import completed|Updated|Approved|Rejected|Removed|Deleted|Saved|Rescanned)/.test(
                  err,
                );
              return (
                <div
                  className={cn(
                    'flex items-start gap-3 rounded-xl border px-4 py-3 type-small',
                    isSuccess
                      ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400'
                      : 'border-error-200 bg-error-50 text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400',
                  )}
                  role={isSuccess ? 'status' : 'alert'}
                  aria-live={isSuccess ? 'polite' : 'assertive'}
                >
                  {isSuccess ? (
                    <CheckCircle2 size={16} className='mt-0.5 shrink-0' />
                  ) : (
                    <AlertTriangle size={16} className='mt-0.5 shrink-0' />
                  )}
                  <span className='min-w-0 flex-1 font-medium leading-relaxed'>
                    {err}
                  </span>
                  <button
                    type='button'
                    onClick={() => flashErr('')}
                    aria-label='Dismiss message'
                    className='shrink-0 opacity-70 hover:opacity-100'
                  >
                    <X size={16} />
                  </button>
                </div>
              );
            })()}

          {addFlash && (
            <div
              role='status'
              aria-live='polite'
              className='fixed bottom-6 right-6 z-90 flex items-center gap-3 rounded-xl border border-success-200 bg-white px-4 py-3 shadow-theme-lg dark:border-success-500/30 dark:bg-gray-900'
            >
              <CheckCircle2 size={18} className='text-success-500' />
              <span className='type-small font-semibold text-success-700 dark:text-success-400'>
                FAQ added
              </span>
            </div>
          )}

          {showTest && (
            <TestDrawer items={items} onClose={() => setShowTest(false)} />
          )}

          <KnowledgeWorkbench
            view={knowledgeView}
            onView={setKnowledgeView}
            th={th}
            isDark={isDark}
            documents={knowledgeDocuments}
            documentsLoading={documentsLoading}
            selectedDocumentId={selectedDocumentId}
            documentDetail={documentDetail}
            documentLoading={documentLoading}
            documentBusyId={documentBusyId}
            approvalThreshold={documentApprovalThreshold}
            onApprovalThreshold={setDocumentApprovalThreshold}
            onRefreshDocuments={() =>
              loadKnowledgeDocuments(selectedDocumentId)
            }
            onSelectDocument={selectKnowledgeDocument}
            onApproveEntity={approveDocumentEntity}
            onRejectEntity={rejectDocumentEntity}
            onSaveEntity={saveDocumentEntity}
            onApproveDocumentThreshold={approveDocumentThreshold}
            websiteEntries={websiteEntries}
            websiteLoading={websiteEntriesLoading}
            websiteFilter={entryFilter}
            websiteSearch={entrySearch}
            selectedWebsiteIds={selectedEntryIds}
            websiteBusyId={entryBusyId}
            websiteApprovalThreshold={websiteApprovalThreshold}
            websiteScraperStatus={
              ragStatus?.kind === 'webscraper' ? ragStatus : null
            }
            onWebsiteApprovalThreshold={setWebsiteApprovalThreshold}
            onWebsiteFilter={setEntryFilter}
            onWebsiteSearch={setEntrySearch}
            onToggleWebsiteEntry={toggleWebsiteEntry}
            onSelectWebsiteDrafts={selectDraftEntries}
            onRefreshWebsite={() => loadWebsiteEntries()}
            onSaveWebsiteEntry={saveWebsiteEntry}
            onApproveWebsiteEntry={approveWebsiteEntry}
            onRejectWebsiteEntry={rejectWebsiteEntry}
            onBulkApproveWebsite={bulkApproveWebsiteEntries}
            onBulkRejectWebsite={bulkRejectWebsiteEntries}
            onDeleteAllRejectedWebsite={deleteAllRejectedWebsiteEntries}
            onApproveWebsiteThreshold={approveWebsiteThresholdEntries}
            onDismissWebsiteScraperStatus={() => {
              try {
                window.localStorage.removeItem('pending_scrape');
              } catch {}
              setRagStatus(null);
            }}
            onDeleteWebsiteSite={deleteWebsiteSite}
            savedEntities={savedEntities}
            savedLoading={savedLoading}
            manualCount={items.length}
            onOpenCatalogueUpload={() => setRagMode('catalogue')}
            onOpenWebscraper={() => setRagMode('webscraper')}
            coachTab={coachTab}
            onCoachDismiss={() => setCoachTab(null)}
            onDeleteDocument={deleteDocument}
            onDeleteApprovedEntity={deleteApprovedEntity}
            onBulkDeleteApprovedEntities={bulkDeleteApprovedEntities}
            manualContent={
              <div className='flex flex-col gap-5 p-4 sm:p-6'>
                {/* Stats tiles (also act as filter chips) */}
                {loaded && items.length > 0 && (
                  <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
                    {[
                      {
                        n: items.length,
                        l: 'Total',
                        f: 'all' as Filter,
                        tone: 'brand' as const,
                      },
                      {
                        n: active,
                        l: 'Active',
                        f: 'active' as Filter,
                        tone: 'success' as const,
                      },
                      {
                        n: inactive,
                        l: 'Inactive',
                        f: 'inactive' as Filter,
                        tone: 'gray' as const,
                      },
                    ].map((s) => {
                      const isSelected = filter === s.f;
                      return (
                        <button
                          key={s.l}
                          onClick={() => setFilter(s.f)}
                          className={cn(
                            'w-full rounded-2xl border bg-white p-6 text-left transition dark:bg-white/3',
                            isSelected
                              ? 'border-brand-300 shadow-theme-sm dark:border-brand-500/40'
                              : 'border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700',
                          )}
                        >
                          <p className='text-title-sm font-semibold tabular-nums text-gray-800 dark:text-white/90'>
                            {s.n}
                          </p>
                          <p className='mt-2 type-small text-gray-500 dark:text-gray-400'>
                            {s.l}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Manual toolbar: search + sort + Test + Export + New FAQ */}
                <div className='flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3'>
                  <div className='relative min-w-55 flex-1'>
                    <Search
                      size={15}
                      className='pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500'
                    />
                    <Input
                      value={rawQ}
                      onChange={(e) => setRawQ(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          // Bypass the debounce and fetch immediately.
                          e.preventDefault();
                          setDq(rawQ);
                          load(rawQ);
                        } else if (e.key === 'Escape' && rawQ) {
                          e.preventDefault();
                          setRawQ('');
                        }
                      }}
                      placeholder='Search questions, tags, synonyms...'
                      aria-label='Search FAQs'
                      className={cn('pl-9', rawQ || loading ? 'pr-9' : '')}
                    />
                    {rawQ && !loading && (
                      <button
                        type='button'
                        onClick={() => setRawQ('')}
                        aria-label='Clear search'
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                      >
                        <X size={15} />
                      </button>
                    )}
                    {loading && (
                      <div
                        className='pointer-events-none absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 type-caption font-medium text-gray-400 dark:text-gray-500'
                        aria-live='polite'
                      >
                        <Loader2 size={14} className='animate-spin' />
                        <span>Searching...</span>
                      </div>
                    )}
                  </div>

                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className='h-9 rounded-(--radius-control) border border-gray-300 bg-transparent px-3 type-small text-gray-700 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300'
                  >
                    <option value='updated'>Updated</option>
                    <option value='created'>Created</option>
                    <option value='az'>A - Z</option>
                  </select>

                  <Button
                    variant='outline'
                    size='sm'
                    className={cn(
                      showTest &&
                        'border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-400',
                    )}
                    onClick={() => setShowTest((v) => !v)}
                  >
                    <FlaskConical size={14} />
                    Test
                  </Button>

                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => exportCsv(displayed)}
                  >
                    <Download size={13} />
                    Export
                  </Button>

                  <div className='flex-1' />

                  <Button
                    size='sm'
                    variant={showAdd ? 'outline' : 'default'}
                    onClick={() => setShowAdd((v) => !v)}
                  >
                    {showAdd ? (
                      'Cancel'
                    ) : (
                      <>
                        <Plus size={14} /> New FAQ
                      </>
                    )}
                  </Button>
                </div>

                {/* Inline New FAQ form */}
                {showAdd && (
                  <div
                    id='new-faq-form'
                    className='rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3'
                  >
                    <div className='border-b border-gray-100 px-6 py-5 dark:border-gray-800'>
                      <h2 className='type-body font-medium text-gray-800 dark:text-white/90'>
                        New FAQ entry
                      </h2>
                      <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                        Add one approved question and answer to the manual
                        knowledge base.
                      </p>
                    </div>

                    <div className='flex flex-col gap-3 p-4 sm:p-6'>
                      <Input
                        value={nQ}
                        onChange={(e) => setNQ(e.target.value)}
                        placeholder='What question should this answer?'
                      />
                      <textarea
                        value={nA}
                        onChange={(e) => setNA(e.target.value)}
                        rows={3}
                        placeholder='Write the answer your bot will give...'
                        className='w-full resize-none rounded-(--radius-control) border border-gray-300 bg-transparent px-3.5 py-2 type-small leading-relaxed text-gray-800 shadow-theme-xs outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800'
                      />
                      <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                        <Input
                          value={nT}
                          onChange={(e) => setNT(e.target.value)}
                          placeholder='Tags: pricing, bot...'
                        />
                        <Input
                          value={nS}
                          onChange={(e) => setNS(e.target.value)}
                          placeholder='Synonyms: price cost fee...'
                        />
                      </div>
                      <Button
                        onClick={createFaq}
                        disabled={adding || !nQ.trim() || !nA.trim()}
                        className='mt-1 h-10 w-full rounded-(--radius-control) bg-brand-500 type-small font-semibold text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-400 disabled:opacity-70'
                      >
                        {adding ? 'Saving FAQ...' : 'Save FAQ'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Bulk actions bar (shows when any FAQ is selected) */}
                {selectedFaqIds.size > 0 &&
                  (() => {
                    const onThisPage = pageItems.filter((x) =>
                      selectedFaqIds.has(x.id),
                    ).length;
                    const offPage = selectedFaqIds.size - onThisPage;
                    return (
                      <div
                        className='flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-3 dark:border-brand-500/25 dark:bg-brand-500/10'
                        role='region'
                        aria-label='Bulk actions'
                      >
                        <span className='inline-flex items-center gap-2 type-small font-semibold text-brand-600 dark:text-brand-400'>
                          <span className='inline-grid min-w-5.5 place-items-center rounded-full bg-brand-500 px-1.5 py-0.5 type-caption font-bold text-white tabular-nums'>
                            {selectedFaqIds.size}
                          </span>
                          {selectedFaqIds.size === 1
                            ? 'FAQ selected'
                            : 'FAQs selected'}
                          {offPage > 0 && (
                            <span className='type-caption font-medium text-gray-500 dark:text-gray-400'>
                              ({offPage} on other page{offPage === 1 ? '' : 's'}
                              )
                            </span>
                          )}
                        </span>
                        <div className='flex-1' />
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => {
                            const allIds = pageItems.map((x) => x.id);
                            const allSelected = allIds.every((id) =>
                              selectedFaqIds.has(id),
                            );
                            setSelectedFaqIds((prev) => {
                              const next = new Set(prev);
                              if (allSelected) {
                                allIds.forEach((id) => next.delete(id));
                              } else {
                                allIds.forEach((id) => next.add(id));
                              }
                              return next;
                            });
                          }}
                        >
                          {pageItems.every((x) => selectedFaqIds.has(x.id))
                            ? 'Deselect page'
                            : 'Select page'}
                        </Button>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setSelectedFaqIds(new Set())}
                        >
                          Clear
                        </Button>
                        <Button
                          variant='destructive'
                          size='sm'
                          onClick={bulkDeleteFaqs}
                          disabled={bulkDeleting}
                        >
                          {bulkDeleting && (
                            <Loader2 size={13} className='animate-spin' />
                          )}
                          {bulkDeleting
                            ? 'Deleting...'
                            : `Delete ${selectedFaqIds.size}`}
                        </Button>
                      </div>
                    );
                  })()}

                {/* FAQ list (paginated) */}
                <div className='flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3'>
                  {loading &&
                    !loaded &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        className='flex animate-pulse flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/2'
                        aria-hidden
                      >
                        <div
                          className='h-3.5 rounded bg-gray-200 dark:bg-white/10'
                          style={{ width: `${65 + ((i * 7) % 25)}%` }}
                        />
                        <div className='h-2.5 w-[90%] rounded bg-gray-100 dark:bg-white/6' />
                        <div
                          className='h-2.5 rounded bg-gray-100 dark:bg-white/6'
                          style={{ width: `${45 + ((i * 5) % 30)}%` }}
                        />
                      </div>
                    ))}

                  {!loading && displayed.length === 0 && (
                    <div className='rounded-2xl border border-dashed border-gray-300 px-8 py-14 text-center dark:border-gray-700'>
                      <div className='mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-white/6'>
                        {rawQ ? (
                          <Search
                            size={22}
                            className='text-gray-400 dark:text-gray-500'
                          />
                        ) : (
                          <MessageSquareText
                            size={22}
                            className='text-gray-400 dark:text-gray-500'
                          />
                        )}
                      </div>
                      <p className='type-body font-semibold text-gray-800 dark:text-white/90'>
                        {rawQ
                          ? `No FAQs match "${rawQ}"`
                          : filter !== 'all'
                            ? `No ${filter} FAQs yet`
                            : "No FAQs yet - let's add one"}
                      </p>
                      <p className='mx-auto mt-2 max-w-95 type-small leading-relaxed text-gray-400 dark:text-gray-500'>
                        {rawQ
                          ? 'Try a broader search term, check the filter above, or add this as a new FAQ.'
                          : 'Add FAQs by hand. Best when you already know what customers ask. For anything at scale, try uploading docs or importing from your site.'}
                      </p>
                      {rawQ && (
                        <div className='mt-4 flex flex-wrap justify-center gap-2'>
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={() => setRawQ('')}
                          >
                            Clear search
                          </Button>
                          <Button
                            size='sm'
                            onClick={() => {
                              setNQ(rawQ);
                              setShowAdd(true);
                            }}
                          >
                            Add &quot;{rawQ}&quot; as new FAQ
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {pageItems.map((item, i) => {
                    const selected = selectedFaqIds.has(item.id);
                    return (
                      <div key={item.id} className='flex items-stretch gap-3'>
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className='flex cursor-pointer select-none items-start pt-4'
                        >
                          <input
                            type='checkbox'
                            checked={selected}
                            onChange={() => toggleFaqSelected(item.id)}
                            aria-label={`Select FAQ: ${item.question}`}
                            className='h-4 w-4 cursor-pointer accent-brand-500'
                          />
                        </label>
                        <div className='min-w-0 flex-1'>
                          <FaqCard
                            item={item}
                            idx={i}
                            sq={dq}
                            onUpdate={updateFaq}
                            onDelete={setDelTarget}
                            onDup={dupFaq}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {displayed.length > 0 && (
                  <div className='flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800'>
                    <div className='type-caption text-gray-500 dark:text-gray-400'>
                      Showing{' '}
                      <span className='font-semibold text-gray-800 dark:text-white/90'>
                        {pageStart + 1}
                      </span>{' '}
                      -{' '}
                      <span className='font-semibold text-gray-800 dark:text-white/90'>
                        {Math.min(pageStart + manualPageSize, displayed.length)}
                      </span>{' '}
                      of{' '}
                      <span className='font-semibold text-gray-800 dark:text-white/90'>
                        {displayed.length}
                      </span>
                    </div>

                    <div className='flex flex-wrap items-center gap-1.5'>
                      <button
                        onClick={() => setManualPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className='flex h-8.5 w-8.5 items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400'
                      >
                        <ChevronLeft size={15} />
                      </button>

                      {(() => {
                        const pages: (number | 'gap')[] = [];
                        if (totalPages <= 7) {
                          for (let i = 1; i <= totalPages; i++) pages.push(i);
                        } else {
                          pages.push(1);
                          if (currentPage > 3) pages.push('gap');
                          const start = Math.max(2, currentPage - 1);
                          const end = Math.min(totalPages - 1, currentPage + 1);
                          for (let i = start; i <= end; i++) pages.push(i);
                          if (currentPage < totalPages - 2) pages.push('gap');
                          pages.push(totalPages);
                        }
                        return pages.map((p, idx) =>
                          p === 'gap' ? (
                            <span
                              key={`gap-${idx}`}
                              className='px-1 type-caption text-gray-400 dark:text-gray-500'
                            >
                              ...
                            </span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setManualPage(p)}
                              className={cn(
                                'flex h-8.5 min-w-8.5 items-center justify-center rounded-(--radius-control) px-3 type-small font-medium transition',
                                p === currentPage
                                  ? 'bg-brand-500 text-white'
                                  : 'border border-gray-200 bg-white text-gray-500 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400',
                              )}
                            >
                              {p}
                            </button>
                          ),
                        );
                      })()}

                      <button
                        onClick={() =>
                          setManualPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                        className='flex h-8.5 w-8.5 items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-800 dark:bg-white/3 dark:text-gray-400'
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>

                    <span className='type-caption text-gray-400 dark:text-gray-500'>
                      8 rows per page
                    </span>
                  </div>
                )}
              </div>
            }
          />
        </div>
      </div>
    </RequireAuth>
  );
}