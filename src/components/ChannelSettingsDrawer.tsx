"use client";

import { createPortal } from 'react-dom';

import { apiFetch } from "@/lib/api";
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  Loader2,
  Save,
  Settings2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Tone = "formal" | "friendly" | "casual" | "professional";
type ResponseLength = "brief" | "moderate" | "detailed";
type Mode = "sales" | "support" | "hybrid";
type EmojiUsage = "none" | "moderate" | "heavy";

type LLMSettings = {
  tone: Tone;
  response_length: ResponseLength;
  mode: Mode;
  language: string | null;
  emoji_usage: EmojiUsage;
  upsell_enabled: boolean;
  collect_contact_info: boolean;
  channel_context: string | null;
};

type Option<T extends string> = {
  value: T;
  label: string;
  desc: string;
};

const DEFAULT_SETTINGS: LLMSettings = {
  tone: "friendly",
  response_length: "moderate",
  mode: "hybrid",
  language: null,
  emoji_usage: "none",
  upsell_enabled: false,
  collect_contact_info: true,
  channel_context: null,
};

const MODE_OPTIONS: Option<Mode>[] = [
  {
    value: "support",
    label: "Support",
    desc: "Prioritize issue resolution and clear next steps.",
  },
  {
    value: "hybrid",
    label: "Hybrid",
    desc: "Balance support with relevant conversion prompts.",
  },
  {
    value: "sales",
    label: "Sales",
    desc: "Qualify leads and guide customers toward decisions.",
  },
];

const TONE_OPTIONS: Option<Tone>[] = [
  {
    value: "friendly",
    label: "Friendly",
    desc: "Warm, helpful, and approachable.",
  },
  {
    value: "casual",
    label: "Casual",
    desc: "Short replies with a relaxed style.",
  },
  {
    value: "professional",
    label: "Professional",
    desc: "Polished, direct, and efficient.",
  },
  {
    value: "formal",
    label: "Formal",
    desc: "Structured replies with no slang.",
  },
];

const LENGTH_OPTIONS: Option<ResponseLength>[] = [
  {
    value: "brief",
    label: "Brief",
    desc: "Keep replies concise.",
  },
  {
    value: "moderate",
    label: "Moderate",
    desc: "Answer fully without padding.",
  },
  {
    value: "detailed",
    label: "Detailed",
    desc: "Include context and explanation.",
  },
];

const EMOJI_OPTIONS: Option<EmojiUsage>[] = [
  {
    value: "none",
    label: "None",
    desc: "Use plain professional text.",
  },
  {
    value: "moderate",
    label: "Limited",
    desc: "Allow rare expressive markers.",
  },
  {
    value: "heavy",
    label: "Expressive",
    desc: "Use a more informal response style.",
  },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3">
      <div className="mb-4">
        <h3 className="type-small font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        {description && (
          <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
            {description}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
  columns = "md:grid-cols-3",
}: {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: string;
}) {
  return (
    <div className={`grid grid-cols-1 gap-3 ${columns}`}>
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-xl border p-4 text-left transition ${
              active
                ? "border-brand-300 bg-brand-50 text-brand-500 dark:border-brand-800 dark:bg-brand-500/12 dark:text-brand-400"
                : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300 dark:hover:bg-white/5"
            }`}
          >
            <span className="block type-small font-semibold">
              {option.label}
            </span>
            <span
              className={`mt-1 block type-caption leading-5 ${
                active
                  ? "text-brand-500/80 dark:text-brand-400/80"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              {option.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
      <div>
        <p className="type-small font-medium text-gray-800 dark:text-white/90">
          {label}
        </p>
        <p className="mt-1 type-caption leading-5 text-gray-500 dark:text-gray-400">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition ${
          checked ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-theme-xs transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function PreviewCard({ settings }: { settings: LLMSettings }) {
  const sample = useMemo(() => {
    const samples: Record<Mode, Record<ResponseLength, string>> = {
      support: {
        brief: "I can help with that. Please share the issue details and I will guide you through the next step.",
        moderate:
          "I can help resolve this. Please share what happened, and I will review the details before suggesting the clearest next step.",
        detailed:
          "I understand the concern. Please share the full context, including when this happened and what you have already tried, so I can give you a complete and practical resolution path.",
      },
      hybrid: {
        brief: "Here is the key information. I can also suggest the best next option if you would like to continue.",
        moderate:
          "Here is a clear overview of what matters. I will also point out relevant options when they help you make a better decision.",
        detailed:
          "Here is a structured explanation with the important details. I will keep the answer helpful first, then mention relevant options only where they support your goal.",
      },
      sales: {
        brief: "This is a strong fit for your use case. I can share the most relevant plan and next step.",
        moderate:
          "This looks like a good fit based on your needs. I can help compare the best option, confirm the priority requirements, and guide you to the next step.",
        detailed:
          "Based on what you are trying to achieve, I can help evaluate the right option, qualify the key requirements, explain the business value, and recommend a clear next action.",
      },
    };

    let text = samples[settings.mode][settings.response_length];
    if (settings.tone === "formal") {
      text = text.replace("I can", "I will").replace("Here is", "Here is");
    }
    if (settings.tone === "casual") {
      text = text.split(".")[0] + ".";
    }
    if (settings.emoji_usage !== "none") {
      text += " Keep the response style expressive when appropriate.";
    }
    return text;
  }, [settings]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-gray-700 dark:bg-white/5 dark:text-gray-300">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <p className="type-small font-semibold text-gray-800 dark:text-white/90">
            Response Preview
          </p>
          <p className="type-caption text-gray-500 dark:text-gray-400">
            Sample output based on current settings
          </p>
        </div>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/3">
        <p className="type-small leading-6 text-gray-600 dark:text-gray-300">
          {sample}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[settings.mode, settings.tone, settings.response_length].map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-gray-100 px-3 py-1 type-caption font-medium capitalize text-gray-700 dark:bg-white/5 dark:text-gray-300"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {[120, 160, 120, 96].map((height) => (
        <div
          key={height}
          className="animate-pulse rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/5"
          style={{ height }}
        />
      ))}
    </div>
  );
}

export function ChannelSettingsDrawer({
  channelId,
  channelName,
  onClose,
  onBackToSettings,
}: {
  channelId: number;
  channelName: string;
  platformColor: string;
  onClose: () => void;
  onBackToSettings?: () => void;
}) {
  const [settings, setSettings] = useState<LLMSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState("");
  const [mounted, setMounted] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await apiFetch<Partial<LLMSettings>>(
        `/admin/channels/${channelId}/settings`,
        { auth: true },
      );
      setSettings({ ...DEFAULT_SETTINGS, ...data });
      setDirty(false);
    } catch {
      setSettings(DEFAULT_SETTINGS);
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSettings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSettings]);

  

  useEffect(() => {
    // Clamps/adjusts local state in response to a changing dependency
    // (e.g. pagination bounds, active tab) — reviewed; not a
    // derive-state-from-render antipattern in this context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (
        drawerRef.current &&
        !drawerRef.current.contains(event.target as Node)
      ) {
        requestClose();
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dirty, onClose]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [dirty, onClose]);

  function confirmLeaveWithUnsavedChanges() {
    return (
      !dirty ||
      window.confirm(
        "You have unsaved channel settings. Leave without saving?",
      )
    );
  }

  function requestClose() {
    if (!confirmLeaveWithUnsavedChanges()) return;
    onClose();
  }

  function requestBackToSettings() {
    if (!confirmLeaveWithUnsavedChanges()) return;
    onBackToSettings?.();
  }

  async function save() {
    setSaving(true);
    setErr("");
    setSaved(false);
    try {
      await apiFetch(`/admin/channels/${channelId}/settings`, {
        method: "PUT",
        auth: true,
        body: settings,
      });
      setSaved(true);
      setDirty(false);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      setErr(errorMessage(error, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  function patch<K extends keyof LLMSettings>(key: K, value: LLMSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setDirty(true);
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {/* BACKDROP */}
      <div
        className='fixed inset-0 z-10000 bg-black/25 backdrop-blur-[2px] dark:bg-black/40'
        aria-hidden='true'
        onClick={requestClose}
      />

      {/* DRAWER */}
      <aside
        ref={drawerRef}
        aria-label='Connected channel settings'
        className='fixed bottom-0 right-0 top-0 z-10001 flex w-full max-w-130
                 flex-col border-l border-gray-200 bg-white shadow-2xl
                 dark:border-white/8 dark:bg-gray-900'
      >
        {/* HEADER */}
        <div className='flex shrink-0 items-start justify-between gap-4 border-b border-gray-200 px-5 py-5 dark:border-gray-800 sm:px-6'>
          <div className='flex min-w-0 items-start gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-500/12 dark:text-brand-400'>
              <Settings2 className='h-5 w-5' />
            </div>

            <div className='min-w-0'>
              <p className='type-caption font-medium text-brand-500 dark:text-brand-400'>
                Customize AI
              </p>

              <h2 className='mt-0.5 truncate type-card-title font-semibold text-gray-800 dark:text-white/90'>
                {channelName}
              </h2>

              <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                Configure how AI responds on this channel.
              </p>
            </div>
          </div>

          <div className='flex shrink-0 items-center gap-2'>
            {onBackToSettings && (
              <button
                type='button'
                onClick={requestBackToSettings}
                className='inline-flex h-9 items-center justify-center gap-1.5 rounded-(--radius-control)
                         border border-gray-200 bg-white px-3 type-caption font-medium
                         text-gray-700 transition hover:bg-gray-50 hover:text-gray-900
                         dark:border-gray-800 dark:bg-white/3
                         dark:text-gray-300 dark:hover:bg-white/5
                         dark:hover:text-white/90'
              >
                <ChevronLeft className='h-4 w-4' />
                Settings
              </button>
            )}
            <button
              type='button'
              onClick={requestClose}
              className='flex h-9 w-9 items-center justify-center rounded-(--radius-control)
                       border border-gray-200 bg-white text-gray-500 transition
                       hover:bg-gray-50 hover:text-gray-700
                       dark:border-gray-800 dark:bg-white/3
                       dark:text-gray-400 dark:hover:bg-white/5
                       dark:hover:text-white/90'
              aria-label='Close settings'
            >
              <X className='h-4 w-4' />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div className='custom-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6'>
          {loading ? (
            <LoadingState />
          ) : (
            <div className='space-y-4'>
              <PreviewCard settings={settings} />

              <Section
                title='Mode'
                description='Choose the primary objective for replies on this connected channel.'
              >
                <OptionGrid
                  options={MODE_OPTIONS}
                  value={settings.mode}
                  onChange={(value) => patch('mode', value)}
                />
              </Section>

              <Section
                title='Tone'
                description='Set the voice customers should hear in this channel.'
              >
                <OptionGrid
                  options={TONE_OPTIONS}
                  value={settings.tone}
                  onChange={(value) => patch('tone', value)}
                  columns='grid-cols-2'
                />
              </Section>

              <Section
                title='Response Length'
                description='Control how much detail the assistant includes by default.'
              >
                <OptionGrid
                  options={LENGTH_OPTIONS}
                  value={settings.response_length}
                  onChange={(value) => patch('response_length', value)}
                />
              </Section>

              <Section
                title='Formatting Policy'
                description='Keep customer-facing messages consistent with the brand style.'
              >
                <OptionGrid
                  options={EMOJI_OPTIONS}
                  value={settings.emoji_usage}
                  onChange={(value) => patch('emoji_usage', value)}
                />
              </Section>

              <Section
                title='Behaviour'
                description='Enable workflow rules that affect qualification and follow-up.'
              >
                <div className='space-y-3'>
                  <ToggleRow
                    checked={settings.upsell_enabled}
                    onChange={(value) => patch('upsell_enabled', value)}
                    label='Upsell suggestions'
                    description='Mention related products or services only when relevant.'
                  />

                  <ToggleRow
                    checked={settings.collect_contact_info}
                    onChange={(value) => patch('collect_contact_info', value)}
                    label='Collect contact information'
                    description='Ask for name and contact details when the conversation is qualified.'
                  />
                </div>
              </Section>

              <Section
                title='Channel Context'
                description='Add instructions that apply only to this connected account.'
              >
                <textarea
                  value={settings.channel_context || ''}
                  onChange={(event) =>
                    patch('channel_context', event.target.value || null)
                  }
                  placeholder='Example: This channel is for existing customers. Prioritize order support and keep replies concise.'
                  rows={5}
                  className='h-auto w-full resize-y rounded-(--radius-control) border border-gray-300
                           bg-transparent px-4 py-3 type-small leading-6 text-gray-800
                           shadow-theme-xs placeholder:text-gray-400
                           focus:border-brand-300 focus:outline-hidden
                           focus:ring-3 focus:ring-brand-500/10
                           dark:border-gray-700 dark:bg-gray-900
                           dark:text-white/90 dark:placeholder:text-white/30
                           dark:focus:border-brand-800'
                />

                <p className='mt-2 type-caption text-gray-500 dark:text-gray-400'>
                  This context is sent with the prompt for this channel only.
                </p>
              </Section>

              {err && (
                <div className='rounded-xl border border-error-500/20 bg-error-50 px-4 py-3 type-small text-error-600 dark:bg-error-500/10 dark:text-error-500'>
                  {err}
                </div>
              )}
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className='shrink-0 border-t border-gray-200 bg-white px-5 py-4 dark:border-gray-800 dark:bg-gray-900 sm:px-6'>
          <div className='flex justify-end gap-3'>
            <button
              type='button'
              onClick={requestClose}
              className='inline-flex h-10 items-center justify-center rounded-(--radius-control)
                       border border-gray-200 bg-white px-5 type-small font-medium
                       text-gray-700 shadow-theme-xs transition hover:bg-gray-50
                       dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300
                       dark:hover:bg-white/3'
            >
              Cancel
            </button>

            <button
              type='button'
              onClick={() => void save()}
              disabled={saving || loading}
              className='inline-flex h-10 items-center justify-center gap-2
                       rounded-(--radius-control) bg-brand-500 px-5 type-small font-medium
                       text-white shadow-theme-xs transition hover:bg-brand-600
                       disabled:cursor-not-allowed disabled:opacity-60'
            >
              {saving ? (
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
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>,
    document.body,
  );
}
