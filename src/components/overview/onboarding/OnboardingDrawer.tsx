'use client';

import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Globe,
  Loader2,
  PencilLine,
  ShieldAlert,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Theme } from '@/lib/theme';
import type { BizType } from '../types';
import { BIZ_OPTIONS, BizIcon, BIZ_QUESTIONS } from './data';
import type { OnboardingRoute, OnboardingRouteResult } from './types';
import { OnboardingSequentialStepper } from './OnboardingSequentialStepper';

export function OnboardingDrawer({
  onClose,
  onRunScrape,
  onRunUpload,
  onRunQuestions,
  onSetBizType,
  onGuessBizType,
  onCheckDupUrl,
  onCheckDupFile,
  onFinish,
  t,
  isDark,
}: {
  onClose: () => void;
  onRunScrape: (
    url: string,
  ) => Promise<{ analysisId: number | string; url: string }>;
  onRunUpload: (
    file: File,
    docCategory: string,
  ) => Promise<{
    documentId: number | string;
    jobId?: number | string | null;
    filename: string;
  }>;
  onRunQuestions: (
    answers: Record<number, string>,
    bizType: BizType,
    about: string,
  ) => Promise<{ addedCount: number }>;
  onSetBizType: (bizType: BizType) => Promise<void>;
  onGuessBizType?: () => Promise<BizType | null>;
  onCheckDupUrl?: (url: string) => Promise<boolean>;
  onCheckDupFile?: (filename: string) => Promise<boolean>;
  onFinish: (payload: {
    coachTab: 'manual' | 'catalogue' | 'website' | 'saved';
    pendingScrape?: { analysisId: number | string; url: string };
    pendingUpload?: {
      documentId: number | string;
      jobId?: number | string | null;
      filename: string;
    };
  }) => void;
  t: Theme;
  isDark: boolean;
}) {
  const accent = isDark ? '#9CB9FF' : '#4249C6';

  type Phase = 'routes' | 'inputs' | 'running' | 'summary';
  const [phase, setPhase] = useState<Phase>('routes');
  const [routes, setRoutes] = useState<OnboardingRoute[]>([]);
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState('');
  const [bizType, setBizType] = useState<BizType | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [aboutBusiness, setAboutBusiness] = useState('');

  const [dupUrlWarn, setDupUrlWarn] = useState(false);
  const [dupUrlChecking, setDupUrlChecking] = useState(false);
  const [dupFileWarn, setDupFileWarn] = useState(false);
  const [dupFileChecking, setDupFileChecking] = useState(false);

  // Debounced dedup check on URL
  useEffect(() => {
    if (!onCheckDupUrl) return;
    const u = scrapeUrl.trim();
    if (!u) {
      // Resets local UI-only state (a flag, warning, or preview value)
      // when the relevant prop/dependency changes — not deriving render
      // output from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDupUrlWarn(false);
      return;
    }
    setDupUrlChecking(true);
    const timer = setTimeout(async () => {
      const dup = await onCheckDupUrl(u);
      setDupUrlWarn(dup);
      setDupUrlChecking(false);
    }, 500);
    return () => {
      clearTimeout(timer);
      setDupUrlChecking(false);
    };
  }, [scrapeUrl, onCheckDupUrl]);

  // Dedup check on file pick
  useEffect(() => {
    if (!onCheckDupFile || !uploadFile) {
      // Resets local UI-only state (a flag, warning, or preview value)
      // when the relevant prop/dependency changes — not deriving render
      // output from state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDupFileWarn(false);
      return;
    }
    let cancelled = false;
    setDupFileChecking(true);
    (async () => {
      const dup = await onCheckDupFile(uploadFile.name);
      if (!cancelled) {
        setDupFileWarn(dup);
        setDupFileChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uploadFile, onCheckDupFile]);

  function toggleRoute(r: OnboardingRoute) {
    setRoutes((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  type InputStep = 'scrape' | 'upload' | 'biz-type' | 'questions' | 'about';
  const inputSteps: InputStep[] = useMemo(() => {
    const s: InputStep[] = [];
    if (routes.includes('scrape')) s.push('scrape');
    if (routes.includes('upload')) s.push('upload');
    if (routes.includes('questions')) s.push('biz-type', 'questions', 'about');
    return s;
  }, [routes]);
  const [inputIndex, setInputIndex] = useState(0);
  const currentInputStep = inputSteps[inputIndex] ?? null;

  useEffect(() => {
    // Clamps/adjusts local state in response to a changing dependency
    // (e.g. pagination bounds, active tab) — reviewed; not a
    // derive-state-from-render antipattern in this context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (phase === 'inputs') setInputIndex(0);
  }, [phase]);

  const [qIndex, setQIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const bizQuestions = bizType ? BIZ_QUESTIONS[bizType] : [];
  const currentQ = bizQuestions[qIndex];

  function commitAnswer(newIdx: number) {
    const upd = { ...answers };
    if (currentAnswer.trim()) upd[qIndex] = currentAnswer.trim();
    else delete upd[qIndex];
    setAnswers(upd);
    setQIndex(newIdx);
    setCurrentAnswer(upd[newIdx] || '');
  }

  function finishQuestions() {
    const upd = { ...answers };
    if (currentAnswer.trim()) upd[qIndex] = currentAnswer.trim();
    else delete upd[qIndex];
    setAnswers(upd);
    setInputIndex((i) => i + 1);
  }

  const [results, setResults] = useState<OnboardingRouteResult[]>([]);
  const [currentRoute, setCurrentRoute] = useState<OnboardingRoute | null>(
    null,
  );
  const [pendingScrape, setPendingScrape] = useState<{
    analysisId: number | string;
    url: string;
  } | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    documentId: number | string;
    jobId?: number | string | null;
    filename: string;
  } | null>(null);

  async function runAll() {
    setPhase('running');
    setResults([]);
    setPendingScrape(null);
    setPendingUpload(null);

    for (const r of routes) {
      setCurrentRoute(r);
      try {
        let count = 0;
        if (r === 'scrape') {
          const res = await onRunScrape(scrapeUrl.trim());
          setPendingScrape(res);
          // Draft count is unknown at kickoff - reported on FAQ page instead.
          count = 0;
        } else if (r === 'upload') {
          if (!uploadFile) throw new Error('No file selected');
          const res = await onRunUpload(uploadFile, docCategory);
          setPendingUpload(res);
          count = 0;
        } else if (r === 'questions') {
          if (!bizType) throw new Error('Missing business type');
          const res = await onRunQuestions(
            answers,
            bizType,
            aboutBusiness.trim(),
          );
          count = res.addedCount;
        }
        setResults((prev) => [...prev, { route: r, status: 'done', count }]);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed';
        setResults((prev) => [
          ...prev,
          { route: r, status: 'failed', message },
        ]);
      }
    }
    setCurrentRoute(null);
    setPhase('summary');
  }

  const [guessedBiz, setGuessedBiz] = useState<BizType | null>(null);
  const [finalBiz, setFinalBiz] = useState<BizType | null>(bizType);
  const [savingBiz, setSavingBiz] = useState(false);
  const bizAlreadyAsked = routes.includes('questions');

  useEffect(() => {
    if (phase !== 'summary') return;
    if (bizAlreadyAsked) return;
    if (!onGuessBizType) return;
    let cancelled = false;
    (async () => {
      try {
        const guess = await onGuessBizType();
        if (!cancelled && guess) {
          setGuessedBiz(guess);
          setFinalBiz(guess);
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [phase, bizAlreadyAsked, onGuessBizType]);

  async function commitBizAndFinish() {
    if (finalBiz && finalBiz !== bizType) {
      setSavingBiz(true);
      try {
        await onSetBizType(finalBiz);
      } finally {
        setSavingBiz(false);
      }
    }
    // Prioritise coaching whichever tab has activity waiting for the user.
    const coachTab: 'manual' | 'catalogue' | 'website' | 'saved' = pendingScrape
      ? 'website'
      : pendingUpload
        ? 'catalogue'
        : results.find((r) => r.route === 'questions' && r.status === 'done')
          ? 'manual'
          : 'manual';
    onFinish({
      coachTab,
      pendingScrape: pendingScrape ?? undefined,
      pendingUpload: pendingUpload ?? undefined,
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'running') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  const shell = (children: React.ReactNode, maxWidth = 640) => (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && phase !== 'running') onClose();
      }}
      className='fixed inset-0 z-99999 flex items-center justify-center overflow-y-auto bg-gray-400/50 p-4 backdrop-blur-[32px]'
    >
      <style>{`
        @keyframes od-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        className='w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xl dark:border-gray-800 dark:bg-gray-900'
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>
  );

  /* ============ PHASE 1: routes ============ */
  if (phase === 'routes') {
    const routeDefs: {
      id: OnboardingRoute;
      icon: React.ComponentType<{ className?: string }>;
      title: string;
      detail: string;
      duration: string;
      tag?: string;
    }[] = [
      {
        id: 'scrape',
        icon: Globe,
        title: 'Scrape my website',
        detail:
          'We visit your site, read the pages, and turn them into draft Q&As.',
        duration: '~30 sec',
        tag: 'fastest',
      },
      {
        id: 'upload',
        icon: FileText,
        title: 'Upload a document',
        detail: 'Menu, price list, brochure - we extract the entries for you.',
        duration: '~1 min',
      },
      {
        id: 'questions',
        icon: PencilLine,
        title: 'Answer a few questions',
        detail:
          'We ask 8 quick questions about your business. No website needed.',
        duration: '~3 min',
      },
    ];
    return shell(
      <div className='p-6 sm:p-6'>
        <div className='mb-6 flex items-start justify-between gap-4'>
          <div className='min-w-0'>
            <div className='mb-3 flex flex-wrap items-center gap-2'>
              <Badge color='primary' startIcon={<Sparkles className='h-3 w-3' />}>
                Train your AI
              </Badge>
            </div>
            <h2 className='type-h4 font-semibold text-gray-800 dark:text-white/90'>
              How would you like to train your AI?
            </h2>
            <p className='mt-1 type-small leading-6 text-gray-500 dark:text-gray-400'>
              Pick one or more. We&apos;ll run them in the order you picked.
            </p>
          </div>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close train AI modal'
            className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-control) text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <div className='grid gap-3 md:grid-cols-3'>
          {routeDefs.map((r) => {
            const selected = routes.includes(r.id);
            const order = selected ? routes.indexOf(r.id) + 1 : null;
            const Icon = r.icon;
            return (
              <button
                key={r.id}
                type='button'
                onClick={() => toggleRoute(r.id)}
                className={cn(
                  'relative rounded-xl border p-4 text-left transition',
                  selected
                    ? 'border-brand-300 bg-brand-50 shadow-theme-xs dark:border-brand-500/30 dark:bg-brand-500/10'
                    : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:hover:border-brand-500/20 dark:hover:bg-white/5',
                )}
              >
                {order !== null && (
                  <span className='absolute right-3 top-3 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-500 px-2 type-caption font-semibold text-white'>
                    {order}
                  </span>
                )}
                <div
                  className={cn(
                    'mb-4 flex h-10 w-10 items-center justify-center rounded-(--radius-control)',
                    selected
                      ? 'bg-white text-brand-500 dark:bg-white/6 dark:text-brand-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                  )}
                >
                  <Icon className='h-5 w-5' />
                </div>
                <div className='pr-7 type-small font-semibold text-gray-800 dark:text-white/90'>
                  {r.title}
                </div>
                <div className='mt-1 type-caption leading-5 text-gray-500 dark:text-gray-400'>
                  {r.detail}
                </div>
                <div className='mt-3 flex flex-wrap items-center gap-2'>
                  <Badge color='light'>
                    {r.duration}
                  </Badge>
                  {r.tag && (
                    <Badge color='primary'>
                      {r.tag}
                    </Badge>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className='mt-6 flex flex-col-reverse gap-3 sm:flex-row'>
          <Button
            type='button'
            onClick={onClose}
            variant='outline'
            className='sm:w-auto'
          >
            Skip for now
          </Button>
          <Button
            type='button'
            disabled={routes.length === 0}
            onClick={() => setPhase('inputs')}
            className='flex-1'
          >
            {routes.length === 0
              ? 'Select at least one to continue'
              : routes.length === 1
                ? 'Continue'
                : `Continue with ${routes.length} tasks`}
            <ArrowRight className='h-4 w-4' />
          </Button>
        </div>
      </div>,
    );
  }

  /* ============ PHASE 2: inputs ============ */
  if (phase === 'inputs' && currentInputStep) {
    const progressPct = ((inputIndex + 1) / inputSteps.length) * 100;
    const stepTitleMap: Record<InputStep, string> = {
      'scrape': 'Which website should we scrape?',
      'upload': 'Which document should we read?',
      'biz-type': 'What type of business are you?',
      'questions': `Question ${qIndex + 1} of ${bizQuestions.length}`,
      'about': 'Anything else your AI should know?',
    };
    const canAdvance = (() => {
      if (currentInputStep === 'scrape') return scrapeUrl.trim().length > 0;
      if (currentInputStep === 'upload') return uploadFile !== null;
      if (currentInputStep === 'biz-type') return bizType !== null;
      if (currentInputStep === 'questions') return true;
      if (currentInputStep === 'about') return true;
      return false;
    })();

    function goBack() {
      if (currentInputStep === 'questions' && qIndex > 0) {
        commitAnswer(qIndex - 1);
        return;
      }
      if (inputIndex > 0) setInputIndex((i) => i - 1);
      else setPhase('routes');
    }
    function goNext() {
      if (currentInputStep === 'questions') {
        if (qIndex < bizQuestions.length - 1) commitAnswer(qIndex + 1);
        else finishQuestions();
        return;
      }
      if (inputIndex < inputSteps.length - 1) setInputIndex((i) => i + 1);
      else runAll();
    }

    return shell(
      <div className='p-6 sm:p-6'>
        <div className='mb-5'>
          <div className='mb-3 flex items-center justify-between gap-4'>
            <Badge color='light'>
              Step {inputIndex + 1} of {inputSteps.length}
            </Badge>
            <button
              type='button'
              onClick={onClose}
              aria-label='Close train AI modal'
              className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-(--radius-control) text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
          <div className='mb-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800'>
            <div
              className='h-full rounded-full bg-brand-500 transition-all duration-500'
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <h2 className='type-h4 font-semibold text-gray-800 dark:text-white/90'>
            {stepTitleMap[currentInputStep]}
          </h2>
        </div>

        {currentInputStep === 'scrape' && (
          <div>
            <p className='mb-3 type-small leading-6 text-gray-500 dark:text-gray-400'>
              We&apos;ll visit the pages, read the useful content, and turn it
              into draft Q&amp;As you can review.
            </p>
            <Input
              autoFocus
              type='url'
              value={scrapeUrl}
              onChange={(e) => setScrapeUrl(e.target.value)}
              placeholder='https://your-site.com'
              aria-invalid={dupUrlWarn}
              className='h-10 rounded-(--radius-control) bg-white dark:bg-white/3'
            />
            {dupUrlChecking && (
              <div className='mt-2 flex items-center gap-2 type-caption text-gray-500 dark:text-gray-400'>
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                Checking
              </div>
            )}
            {dupUrlWarn && !dupUrlChecking && (
              <div className='mt-3 flex gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 p-3 type-caption leading-5 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-400'>
                <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
                It looks like this site has already been scraped. Running it
                again will create duplicate drafts.
              </div>
            )}
          </div>
        )}

        {currentInputStep === 'upload' && (
          <div>
            <p className='mb-3 type-small leading-6 text-gray-500 dark:text-gray-400'>
              PDFs, price lists, menus, brochures. We&apos;ll extract the
              entries and let you review before they go live.
            </p>
            <label
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition',
                dupFileWarn
                  ? 'border-warning-300 bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10'
                  : 'border-gray-300 bg-gray-50 hover:border-brand-300 hover:bg-brand-50 dark:border-gray-700 dark:bg-white/3 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10',
              )}
            >
              <div className='mb-3 flex h-10 w-10 items-center justify-center rounded-(--radius-control) bg-white text-brand-500 shadow-theme-xs dark:bg-white/6 dark:text-brand-400'>
                <Upload className='h-5 w-5' />
              </div>
              <div className='type-small font-semibold text-gray-800 dark:text-white/90'>
                {uploadFile ? uploadFile.name : 'Click to choose a file'}
              </div>
              <div className='mt-1 type-caption text-gray-500 dark:text-gray-400'>
                {uploadFile
                  ? `${Math.round(uploadFile.size / 1024)} KB`
                  : 'PDF, DOCX, TXT accepted'}
              </div>
              <input
                type='file'
                accept='.pdf,.doc,.docx,.txt,.md'
                onChange={(e) => {
                  setUploadFile(e.target.files?.[0] ?? null);
                  setDocCategory('');
                }}
                style={{ display: 'none' }}
              />
            </label>

            {dupFileChecking && (
              <div className='mt-2 flex items-center gap-2 type-caption text-gray-500 dark:text-gray-400'>
                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                Checking
              </div>
            )}
            {dupFileWarn && !dupFileChecking && (
              <div className='mt-3 flex gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 p-3 type-caption leading-5 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-orange-400'>
                <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
                A file with this name has already been uploaded. Continuing will
                create a duplicate document.
              </div>
            )}

            <div className='mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
              <ShieldAlert className='mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400' />
              <p className='flex-1 type-small leading-5 text-left text-amber-700 dark:text-amber-300'>
                Uploaded files may be scanned for personal information (names,
                emails, or other identifying details) before they&apos;re added
                to your knowledge base.
              </p>
            </div>

            {uploadFile && (
              <label
                className='mt-4 flex flex-col gap-2 type-caption font-medium text-gray-700 dark:text-gray-300'
              >
                What kind of document is this?
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className='h-10 rounded-(--radius-control) border border-gray-200 bg-white px-3 type-small text-gray-700 outline-none transition focus:border-brand-300 focus:ring-3 focus:ring-brand-300/20 dark:border-gray-700 dark:bg-white/3 dark:text-gray-300'
                >
                  <option value=''>Auto-detect</option>
                  <option value='menu'>Menu</option>
                  <option value='catalogue'>Catalogue</option>
                  <option value='inventory'>Inventory</option>
                  <option value='invoice'>Invoice</option>
                  <option value='faq'>FAQ</option>
                  <option value='policy'>Policy</option>
                </select>
              </label>
            )}
          </div>
        )}

        {currentInputStep === 'biz-type' && (
          <div>
            <p className='mb-4 type-small leading-6 text-gray-500 dark:text-gray-400'>
              We&apos;ll use this to pick the right questions.
            </p>
            <div className='grid gap-3 sm:grid-cols-2'>
              {BIZ_OPTIONS.map((biz) => {
                const active = bizType === biz.id;
                const iconColor = active
                  ? accent
                  : isDark
                    ? '#a8bfff'
                    : '#64748b';
                return (
                  <button
                    key={biz.id}
                    type='button'
                    onClick={() => setBizType(biz.id)}
                    className={cn(
                      'rounded-xl border p-4 text-left transition',
                      active
                        ? 'border-brand-300 bg-brand-50 shadow-theme-xs dark:border-brand-500/30 dark:bg-brand-500/10'
                        : 'border-gray-200 bg-white hover:border-brand-200 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:hover:border-brand-500/20 dark:hover:bg-white/5',
                    )}
                  >
                    <div
                      className='mb-3 flex h-10 w-10 items-center justify-center rounded-(--radius-control) bg-gray-100 dark:bg-gray-800'
                    >
                      {BizIcon[biz.id](iconColor)}
                    </div>
                    <div className={cn(
                      'type-small font-semibold',
                      active
                        ? 'text-brand-500 dark:text-brand-400'
                        : 'text-gray-800 dark:text-white/90',
                    )}>
                      {biz.label}
                    </div>
                    <div className='mt-1 type-caption text-gray-500 dark:text-gray-400'>
                      {biz.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {currentInputStep === 'questions' && currentQ && (
          <div>
            <p className='mb-3 type-small font-semibold leading-6 text-gray-800 dark:text-white/90'>
              {currentQ.q}
            </p>
            <Textarea
              autoFocus
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') goNext();
              }}
              placeholder={currentQ.placeholder}
              rows={3}
              className='min-h-28 resize-none rounded-(--radius-control) bg-white leading-6 dark:bg-white/3'
            />
            <div className='mt-2 type-caption text-gray-500 dark:text-gray-400'>
              Optional. Cmd/Ctrl+Enter to continue
            </div>
          </div>
        )}

        {currentInputStep === 'about' && (
          <div>
            <p className='mb-3 type-small leading-6 text-gray-500 dark:text-gray-400'>
              Anything important your AI should know. Also saved to your
              Settings.
            </p>
            <Textarea
              autoFocus
              value={aboutBusiness}
              onChange={(e) => setAboutBusiness(e.target.value)}
              rows={6}
              placeholder="Example: We're a premium sofa brand. Customers usually ask about pricing, delivery, fabric options and warranty."
              className='min-h-40 rounded-(--radius-control) bg-white leading-6 dark:bg-white/3'
            />
          </div>
        )}

        <div className='mt-6 flex flex-col-reverse gap-3 sm:flex-row'>
          <Button
            type='button'
            onClick={goBack}
            variant='outline'
          >
            <ArrowLeft className='h-4 w-4' />
            Back
          </Button>
          <Button
            type='button'
            disabled={!canAdvance}
            onClick={goNext}
            className='flex-1'
          >
            {inputIndex === inputSteps.length - 1 &&
            currentInputStep !== 'questions'
              ? 'Start training'
              : currentInputStep === 'questions' &&
                  qIndex === bizQuestions.length - 1
                ? 'Continue'
                : 'Next'}
            <ArrowRight className='h-4 w-4' />
          </Button>
          {currentInputStep === 'questions' && (
            <Button
              type='button'
              onClick={goNext}
              variant='outline'
            >
              Skip
            </Button>
          )}
        </div>
      </div>,
    );
  }

  /* ============ PHASE 3: running ============ */
  if (phase === 'running') {
    return shell(
      <div className='p-6 sm:p-6'>
        <div className='mb-5 flex items-start gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-(--radius-control) bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
            <Loader2 className='h-5 w-5 animate-spin' />
          </div>
          <div>
            <h2 className='type-h4 font-semibold text-gray-800 dark:text-white/90'>
              Starting your training
            </h2>
            <p className='mt-1 type-small leading-6 text-gray-500 dark:text-gray-400'>
              Kicking off each task. The scrape and upload will keep running on
              the FAQ page where you can watch them progress.
            </p>
          </div>
        </div>
        <OnboardingSequentialStepper
          routes={routes}
          results={results}
          currentRoute={currentRoute}
          t={t}
          isDark={isDark}
          accent={accent}
        />
      </div>,
      560,
    );
  }

  /* ============ PHASE 4: summary ============ */
  const totalDrafts = results.reduce((s, r) => s + (r.count ?? 0), 0);
  const anyDone = results.some((r) => r.status === 'done');
  const anyFailed = results.some((r) => r.status === 'failed');

  return shell(
    <div className='p-6 sm:p-6'>
      <div className='mb-5 text-center'>
        <div
          className={cn(
            'mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full',
            anyFailed && !anyDone
              ? 'bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500'
              : 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
          )}
        >
          {anyFailed && !anyDone ? (
            <AlertTriangle className='h-6 w-6' />
          ) : (
            <CheckCircle2 className='h-6 w-6' />
          )}
        </div>
        <h2 className='type-h4 font-semibold text-gray-800 dark:text-white/90'>
          {anyDone ? 'Your AI is trained' : 'Nothing was added'}
        </h2>
        <p className='mt-2 type-small leading-6 text-gray-500 dark:text-gray-400'>
          {anyDone && totalDrafts > 0
            ? `${totalDrafts} ${totalDrafts === 1 ? 'draft is' : 'drafts are'} ready for you to review.`
            : 'You can try again from the FAQ page.'}
        </p>
      </div>

      <div className='mb-4'>
        <OnboardingSequentialStepper
          routes={routes}
          results={results}
          currentRoute={null}
          t={t}
          isDark={isDark}
          accent={accent}
        />
      </div>

      {!bizAlreadyAsked && anyDone && (
        <div className='mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/3'>
          <div className='mb-2 type-small font-semibold text-gray-800 dark:text-white/90'>
            Quick one - what kind of business is this?
            {guessedBiz && (
              <span className='ml-1 type-caption font-normal text-gray-500 dark:text-gray-400'>
                (we guessed{' '}
                {BIZ_OPTIONS.find((b) => b.id === guessedBiz)?.label})
              </span>
            )}
          </div>
          <select
            value={finalBiz ?? ''}
            onChange={(e) =>
              setFinalBiz((e.target.value || null) as BizType | null)
            }
            className='h-10 w-full rounded-(--radius-control) border border-gray-200 bg-white px-3 type-small text-gray-700 outline-none transition focus:border-brand-300 focus:ring-3 focus:ring-brand-300/20 dark:border-gray-700 dark:bg-white/3 dark:text-gray-300'
          >
            <option value=''>Skip this</option>
            {BIZ_OPTIONS.map((biz) => (
              <option key={biz.id} value={biz.id}>
                {biz.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <Button
        type='button'
        onClick={commitBizAndFinish}
        disabled={savingBiz}
        className='w-full'
      >
        {savingBiz ? (
          <>
            <Loader2 className='h-4 w-4 animate-spin' />
            Saving
          </>
        ) : (
          <>
            {anyDone ? 'Review drafts' : 'Go to FAQ'}
            <ArrowRight className='h-4 w-4' />
          </>
        )}
      </Button>
    </div>,
    520,
  );
}

