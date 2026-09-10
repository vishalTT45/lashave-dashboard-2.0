import React, { useState } from 'react';

/* ─────────────────────────────────────────────
   Types
   ───────────────────────────────────────────── */
type GuideType = 'builder' | 'custom' | 'unsure';
type BuilderPlatform = 'wordpress' | 'shopify' | 'webflow' | 'wix' | 'squarespace' | 'other';
type CodeFramework = 'html' | 'react' | 'nextjs' | 'wordpress' | 'shopify' | 'webflow' | 'angular' | 'other';

/* The API sometimes returns widget fields nested under `config`, and
   sometimes flat on the widget object itself — the component reads
   both shapes (see `const config = widget?.config || widget` below),
   so both are declared optional here. */
type WebsiteWidgetConfig = {
  is_active?: boolean;
  widget_key?: string;
};

type WebsiteWidgetData = WebsiteWidgetConfig & {
  config?: WebsiteWidgetConfig;
  embed_code?: string;
  script?: string;
  embedCode?: string;
};

/* ─────────────────────────────────────────────
   Main Modal
   ───────────────────────────────────────────── */
export default function WebsiteWidgetModal({
  isDark,
  loading,
  saving,
  widget,
  onClose,
  onEnable,
  onDisable,
  onCopy,
}: {
  isDark: boolean;
  loading: boolean;
  saving: boolean;
  widget: WebsiteWidgetData | null;
  onClose: () => void;
  onEnable: () => void;
  onDisable: () => void | Promise<void>;
  onCopy: () => void;
}) {
  const config = widget?.config || widget;
  const isConnected = Boolean(config?.is_active);

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const widgetKey = config?.widget_key || '';

  const embedCode = widget?.embed_code ||
    widget?.script ||
    widget?.embedCode ||
    (widgetKey
      ? `<script\n  src="https://api.thundertribes.com/widget/embed.js"\n  data-widget-id="${widgetKey}"\n  async\n></script>`
      : '');

  async function confirmDisableWebsiteWidget() {
    await onDisable();
    setShowDisconnectConfirm(false);
  }

  function handleCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  /* ── Palette ── */
  const bg = isDark ? 'linear-gradient(180deg,#10172F,#080D1D)' : '#FFFFFF';
  const cardBg = isDark ? '#050816' : '#F8FAFC';
  const borderCol = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.10)';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textSecondary = isDark ? 'rgba(226,232,240,0.58)' : '#64748B';
  const textMuted = isDark ? 'rgba(226,232,240,0.48)' : '#94A3B8';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.62)',
        backdropFilter: 'blur(10px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(720px, 100%)',
          maxHeight: 'calc(100vh - 40px)',
          overflow: 'auto',
          borderRadius: 24,
          background: bg,
          border: `1px solid ${borderCol}`,
          boxShadow: '0 30px 100px rgba(0,0,0,0.45)',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            padding: '22px 24px',
            borderBottom: `1px solid ${borderCol}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: textPrimary }}>
              Connect your website
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: textSecondary }}>
              Add Lashvae AI chatbot to your website with one script tag.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 12,
              border: `1px solid ${borderCol}`,
              background: 'transparent',
              color: isDark ? '#CBD5E1' : '#475569',
              cursor: 'pointer', fontSize: 18, flex: '0 0 auto',
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: 24 }}>
          {loading ? (
            <div style={{ padding: 50, textAlign: 'center', color: textSecondary }}>
              Loading website widget...
            </div>
          ) : !isConnected ? (
            <NotConnectedState
              isDark={isDark}
              saving={saving}
              onEnable={onEnable}
            />
          ) : (
            <ConnectedState
              isDark={isDark}
              saving={saving}
              widgetKey={widgetKey}
              embedCode={embedCode}
              copiedKey={copiedKey}
              onCopy={handleCopy}
              onClose={onClose}
              onDisconnect={() => setShowDisconnectConfirm(true)}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              textMuted={textMuted}
              cardBg={cardBg}
              borderCol={borderCol}
            />
          )}
        </div>
      </div>

      {/* ── Disconnect confirmation ── */}
      {showDisconnectConfirm && (
        <DisconnectConfirmModal
          isDark={isDark}
          saving={saving}
          onCancel={() => setShowDisconnectConfirm(false)}
          onConfirm={confirmDisableWebsiteWidget}
        />
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Not Connected State
   ───────────────────────────────────────────── */
function NotConnectedState({
  isDark,
  saving,
  onEnable,
}: {
  isDark: boolean;
  saving: boolean;
  onEnable: () => void;
}) {
  return (
    <>
      <div
        style={{
          padding: 18, borderRadius: 18,
          background: isDark ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.08)',
          border: '1px solid rgba(59,130,246,0.22)',
          marginBottom: 20,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: isDark ? '#F8FAFC' : '#0F172A', marginBottom: 6 }}>
          Website chatbot is not connected yet
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: isDark ? 'rgba(226,232,240,0.6)' : '#64748B' }}>
          Enable the widget to generate a unique script for this business. The client can paste that script
          into their website once.
        </div>
      </div>
      <button
        type="button"
        onClick={onEnable}
        disabled={saving}
        style={{
          width: '100%', height: 46, borderRadius: 14, border: 'none',
          cursor: saving ? 'not-allowed' : 'pointer',
          background: 'linear-gradient(135deg,#38BDF8,#6366F1)',
          color: '#fff', fontWeight: 700, fontSize: 14,
          opacity: saving ? 0.65 : 1,
        }}
      >
        {saving ? 'Enabling...' : 'Enable Website Chatbot'}
      </button>
    </>
  );
}

/* ─────────────────────────────────────────────
   Connected State
   ───────────────────────────────────────────── */
function ConnectedState({
  isDark,
  saving,
  widgetKey,
  embedCode,
  copiedKey,
  onCopy,
  onClose,
  onDisconnect,
  textPrimary,
  textSecondary,
  textMuted,
  cardBg,
  borderCol,
}: {
  isDark: boolean;
  saving: boolean;
  widgetKey: string;
  embedCode: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  onClose: () => void;
  onDisconnect: () => void;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  cardBg: string;
  borderCol: string;
}) {
  const [guideType, setGuideType] = useState<GuideType>('builder');
  const [scriptTab, setScriptTab] = useState<'embed' | 'test'>('embed');

  const consoleTestCode = widgetKey
    ? `const old = document.getElementById('lashvae-demo-widget');\nif (old) old.remove();\n\nconst s = document.createElement('script');\ns.id = 'lashvae-demo-widget';\ns.src = '${process.env.NEXT_PUBLIC_API_BASE}/widget/embed.js';\ns.setAttribute('data-widget-id', '${widgetKey}');\ns.async = true;\n\ndocument.body.appendChild(s);`
    : '';

  return (
    <>
      {/* ── Status Banner ── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px', borderRadius: 16,
          background: 'rgba(16,185,129,0.08)',
          border: '1px solid rgba(16,185,129,0.20)',
          marginBottom: 18, gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>✅</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: textPrimary }}>
              Website chatbot is enabled
            </div>
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
              Choose the simplest install path below and follow the instructions.
            </div>
          </div>
        </div>
        <span
          style={{
            padding: '6px 10px', borderRadius: 999,
            color: '#34D399', background: 'rgba(16,185,129,0.12)',
            border: '1px solid rgba(16,185,129,0.24)',
            fontSize: 11, fontWeight: 700, flex: '0 0 auto',
          }}
        >
          LIVE
        </span>
      </div>

      {/* ── Script Tab Toggle (Embed / Quick Testing) ── */}
      <div
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 6, padding: 5, borderRadius: 14,
          background: isDark ? 'rgba(255,255,255,0.035)' : 'rgba(15,23,42,0.04)',
          border: `1px solid ${borderCol}`,
          marginBottom: 18,
        }}
      >
        {(['embed', 'test'] as const).map((tab) => {
          const active = scriptTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setScriptTab(tab)}
              style={{
                height: 38, borderRadius: 11,
                border: active ? '1px solid rgba(99,102,241,0.45)' : '1px solid transparent',
                background: active
                  ? 'linear-gradient(135deg,rgba(99,102,241,0.22),rgba(139,92,246,0.18))'
                  : 'transparent',
                color: active
                  ? (isDark ? '#E0E7FF' : '#4338CA')
                  : (isDark ? 'rgba(226,232,240,0.55)' : '#64748B'),
                cursor: 'pointer', fontWeight: 600, fontSize: 13,
              }}
            >
              {tab === 'embed' ? 'Embed Script' : 'Quick Testing'}
            </button>
          );
        })}
      </div>

      {scriptTab === 'test' ? (
        /* ── Quick Testing view ── */
        <QuickTestingPanel
          isDark={isDark}
          consoleTestCode={consoleTestCode}
          copiedKey={copiedKey}
          onCopy={onCopy}
          textSecondary={textSecondary}
          cardBg={cardBg}
          borderCol={borderCol}
        />
      ) : (
        /* ── Embed Script → Guide Selection ── */
        <>
          {/* ── Guide Type Selection ── */}
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 11, fontWeight: 600, letterSpacing: '.1em',
                textTransform: 'uppercase', color: textMuted, marginBottom: 10,
              }}
            >
              How should we guide you?
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {GUIDE_OPTIONS.map(({ key, icon, label }) => {
                const active = guideType === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGuideType(key as GuideType)}
                    style={{
                      position: 'relative',
                      height: 48, borderRadius: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      border: active
                        ? '1.5px solid rgba(99,102,241,0.55)'
                        : `1px solid ${borderCol}`,
                      background: active
                        ? (isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.06)')
                        : 'transparent',
                      color: active
                        ? (isDark ? '#C4B5FD' : '#4F46E5')
                        : (isDark ? 'rgba(226,232,240,0.6)' : '#64748B'),
                      cursor: 'pointer', fontWeight: 600, fontSize: 13,
                      transition: 'all .15s ease',
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{icon}</span>
                    {label}
                    {active && (
                      <span
                        style={{
                          position: 'absolute', top: -5, right: -5,
                          width: 18, height: 18, borderRadius: 999,
                          background: '#6366F1', color: '#fff',
                          display: 'grid', placeItems: 'center', fontSize: 10,
                        }}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Guide Content ── */}
          {guideType === 'builder' && (
            <WebsiteBuilderGuide
              isDark={isDark}
              widgetKey={widgetKey}
              embedCode={embedCode}
              copiedKey={copiedKey}
              onCopy={onCopy}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              textMuted={textMuted}
              cardBg={cardBg}
              borderCol={borderCol}
            />
          )}
          {guideType === 'custom' && (
            <CustomCodeGuide
              isDark={isDark}
              widgetKey={widgetKey}
              copiedKey={copiedKey}
              onCopy={onCopy}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              textMuted={textMuted}
              cardBg={cardBg}
              borderCol={borderCol}
            />
          )}
          {guideType === 'unsure' && (
            <UnsureGuide
              isDark={isDark}
              widgetKey={widgetKey}
              embedCode={embedCode}
              copiedKey={copiedKey}
              onCopy={onCopy}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              cardBg={cardBg}
              borderCol={borderCol}
            />
          )}
        </>
      )}

      {/* ── Action Buttons ── */}
      <div style={{ marginTop: 20 }}>
        {/* Customize Chatbot */}
        <button
          type="button"
          onClick={() => { onClose(); window.location.href = '/customize-chat'; }}
          style={{
            width: '100%', height: 44, borderRadius: 14, border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
            color: '#fff', fontWeight: 700, fontSize: 13,
            marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 8px 24px rgba(99,102,241,.28)',
          }}
        >
          🎨 Customize Chatbot
        </button>

        {/* Copy + Disconnect row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <button
            type="button"
            onClick={() => onCopy(embedCode, 'footer-embed')}
            style={{
              height: 44, borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg,#F97316,#EC4899)',
              color: '#fff', fontWeight: 700, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {copiedKey === 'footer-embed' ? '✓ Copied!' : '📋 Copy Embed Script'}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={saving}
            style={{
              height: 44, borderRadius: 14,
              border: '1px solid rgba(239,68,68,0.28)',
              cursor: saving ? 'not-allowed' : 'pointer',
              background: 'rgba(239,68,68,0.08)',
              color: '#F87171', fontWeight: 700, fontSize: 13,
              opacity: saving ? 0.65 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {saving ? 'Disabling...' : '🔌 Disconnect'}
          </button>
        </div>

        {/* Need Help + Get Support row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => { onClose(); window.location.href = '/profile?activeNav=support'; }}
            style={{
              height: 42, borderRadius: 14,
              border: '1px solid rgba(59,130,246,0.35)',
              background: isDark ? 'rgba(59,130,246,0.14)' : 'rgba(59,130,246,0.08)',
              color: isDark ? '#BFDBFE' : '#2563EB',
              cursor: 'pointer', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            💬 Need Help?
          </button>
          <button
            type="button"
            onClick={() => { onClose(); window.location.href = '/profile?activeNav=support'; }}
            style={{
              height: 42, borderRadius: 14,
              border: '1px solid rgba(59,130,246,0.35)',
              background: isDark ? 'linear-gradient(135deg,#2563EB,#4F46E5)' : 'linear-gradient(135deg,#3B82F6,#4F46E5)',
              color: '#FFFFFF',
              cursor: 'pointer', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              boxShadow: '0 8px 22px rgba(59,130,246,0.28)',
            }}
          >
            🛟 Get Support
          </button>
        </div>

        {/* Footer note */}
        <div style={{ fontSize: 12, lineHeight: 1.6, color: textSecondary, textAlign: 'center' }}>
          Install this once. Future changes to colors, greeting, logo, and placement will update
          automatically from your dashboard.
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   Guide Options Config
   ───────────────────────────────────────────── */
const GUIDE_OPTIONS = [
  { key: 'builder', icon: '🖥️', label: 'Website builder' },
  { key: 'custom',  icon: '</>', label: 'Custom coded site' },
  { key: 'unsure',  icon: '❓', label: "I'm not sure" },
];

/* ─────────────────────────────────────────────
   Quick Testing Panel
   ───────────────────────────────────────────── */
function QuickTestingPanel({
  isDark,
  consoleTestCode,
  copiedKey,
  onCopy,
  textSecondary,
  cardBg,
  borderCol,
}: {
  isDark: boolean;
  consoleTestCode: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  textSecondary: string;
  cardBg: string;
  borderCol: string;
}) {
  return (
    <div
      style={{
        borderRadius: 16, background: cardBg,
        border: `1px solid ${borderCol}`, overflow: 'hidden',
      }}
    >
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-start', gap: 12, marginBottom: 12,
          }}
        >
          <div>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '.12em',
              textTransform: 'uppercase',
              color: isDark ? '#94A3B8' : '#64748B',
            }}>
              Temporary Console Preview
            </div>
            <div style={{ fontSize: 12, marginTop: 5, lineHeight: 1.6, color: textSecondary }}>
              Paste this in the browser console to preview the chatbot before integration.
            </div>
          </div>
          <CopyButton
            isDark={isDark}
            label={copiedKey === 'test-code' ? 'Copied!' : 'Copy Code'}
            onClick={() => onCopy(consoleTestCode, 'test-code')}
          />
        </div>

        <CodeBlock isDark={isDark} code={consoleTestCode} showLineNumbers />

        <div
          style={{
            marginTop: 14, padding: 13, borderRadius: 14,
            background: isDark ? 'rgba(59,130,246,0.08)' : 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.18)',
            fontSize: 12, lineHeight: 1.7,
            color: isDark ? 'rgba(226,232,240,0.62)' : '#475569',
          }}
        >
          <strong style={{ color: isDark ? '#DBEAFE' : '#1D4ED8' }}>How to test:</strong><br />
          1. Open the client website in Chrome.<br />
          2. Right-click anywhere → <b>Inspect</b>.<br />
          3. Open the <b>Console</b> tab.<br />
          4. Paste the script and press Enter.<br />
          5. The chatbot bubble should appear instantly.
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Website Builder Guide
   ───────────────────────────────────────────── */
function WebsiteBuilderGuide({
  isDark,
  widgetKey,
  embedCode,
  copiedKey,
  onCopy,
  textPrimary,
  textSecondary,
  textMuted,
  cardBg,
  borderCol,
}: {
  isDark: boolean;
  widgetKey: string;
  embedCode: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  cardBg: string;
  borderCol: string;
}) {
  const [platform, setPlatform] = useState<BuilderPlatform>('wordpress');

  const platforms: { key: BuilderPlatform; label: string; icon: string }[] = [
    { key: 'wordpress', label: 'WordPress', icon: '🔵' },
    { key: 'shopify', label: 'Shopify', icon: '🟢' },
    { key: 'webflow', label: 'Webflow', icon: '🔷' },
    { key: 'wix', label: 'Wix', icon: '🟡' },
    { key: 'squarespace', label: 'Squarespace', icon: '⬛' },
    { key: 'other', label: 'Other', icon: '···' },
  ];

  const instructions = getBuilderInstructions(platform, widgetKey);

  return (
    <>
      {/* ── Platform Picker ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '.1em',
          textTransform: 'uppercase', color: textMuted, marginBottom: 10,
        }}>
          Choose your platform
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {platforms.map(({ key, label, icon }) => {
            const active = platform === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPlatform(key)}
                style={{
                  height: 36, padding: '0 14px', borderRadius: 10,
                  border: active
                    ? '1.5px solid rgba(99,102,241,0.50)'
                    : `1px solid ${borderCol}`,
                  background: active
                    ? (isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.07)')
                    : 'transparent',
                  color: active
                    ? (isDark ? '#C4B5FD' : '#4F46E5')
                    : (isDark ? 'rgba(226,232,240,0.6)' : '#64748B'),
                  cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'all .15s ease',
                }}
              >
                <span style={{ fontSize: 13 }}>{icon}</span>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Instructions Card ── */}
      <div
        style={{
          borderRadius: 16, background: cardBg,
          border: `1px solid ${borderCol}`, overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div style={{
              fontSize: 14, fontWeight: 600, color: textPrimary,
              textTransform: 'uppercase', letterSpacing: '.06em',
            }}>
              {instructions.title}
            </div>
            <CopyButton
              isDark={isDark}
              label={copiedKey === 'builder-code' ? 'Copied!' : 'Copy Code'}
              onClick={() => onCopy(embedCode, 'builder-code')}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
            {/* Left: Steps */}
            <div>
              {instructions.steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex', gap: 10, marginBottom: 10,
                    fontSize: 13, lineHeight: 1.6, color: textSecondary,
                  }}
                >
                  <span style={{
                    flex: '0 0 auto', width: 22, height: 22, borderRadius: 7,
                    background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
                    color: isDark ? '#A5B4FC' : '#6366F1',
                    fontSize: 11, fontWeight: 700,
                    display: 'grid', placeItems: 'center',
                  }}>
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            {/* Right: Code */}
            <CodeBlock isDark={isDark} code={embedCode} showLineNumbers={false} />
          </div>

          {instructions.tip && (
            <div style={{
              marginTop: 12, fontSize: 12, lineHeight: 1.6, color: textMuted,
              display: 'flex', gap: 6, alignItems: 'flex-start',
            }}>
              <span style={{ flex: '0 0 auto' }}>ℹ️</span>
              {instructions.tip}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   Custom Code Guide
   ───────────────────────────────────────────── */
function CustomCodeGuide({
  isDark,
  widgetKey,
  copiedKey,
  onCopy,
  textPrimary,
  textSecondary,
  textMuted,
  cardBg,
  borderCol,
}: {
  isDark: boolean;
  widgetKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  cardBg: string;
  borderCol: string;
}) {
  const [framework, setFramework] = useState<CodeFramework>('html');

  const frameworks: { key: CodeFramework; label: string }[] = [
    { key: 'html', label: '</> HTML' },
    { key: 'react', label: '⚛️ React' },
    { key: 'nextjs', label: '▲ Next.js' },
    { key: 'wordpress', label: '🔵 WordPress' },
    { key: 'shopify', label: '🟢 Shopify' },
    { key: 'webflow', label: '🔷 Webflow' },
    { key: 'angular', label: '🔺 Angular' },
    { key: 'other', label: '··· Other' },
  ];

  const snippet = getFrameworkSnippet(framework, widgetKey);

  return (
    <>
      {/* ── Framework Tabs ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontSize: 11, fontWeight: 600, letterSpacing: '.1em',
          textTransform: 'uppercase', color: textMuted, marginBottom: 10,
        }}>
          Install on
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {frameworks.map(({ key, label }) => {
            const active = framework === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFramework(key)}
                style={{
                  height: 34, padding: '0 13px', borderRadius: 10,
                  border: active
                    ? '1.5px solid rgba(99,102,241,0.50)'
                    : `1px solid ${borderCol}`,
                  background: active
                    ? (isDark ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.07)')
                    : 'transparent',
                  color: active
                    ? (isDark ? '#C4B5FD' : '#4F46E5')
                    : (isDark ? 'rgba(226,232,240,0.6)' : '#64748B'),
                  cursor: 'pointer', fontWeight: 600, fontSize: 12,
                  transition: 'all .15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Code Card ── */}
      <div
        style={{
          borderRadius: 16, background: cardBg,
          border: `1px solid ${borderCol}`, overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
            <div>
              <div style={{
                fontSize: 14, fontWeight: 600, color: textPrimary,
                textTransform: 'uppercase', letterSpacing: '.06em',
              }}>
                {snippet.title}
              </div>
              <div style={{ fontSize: 12, marginTop: 4, lineHeight: 1.5, color: textSecondary }}>
                {snippet.subtitle}
              </div>
            </div>
            <CopyButton
              isDark={isDark}
              label={copiedKey === 'custom-code' ? 'Copied!' : 'Copy Code'}
              onClick={() => onCopy(snippet.code, 'custom-code')}
            />
          </div>

          <div style={{ marginTop: 12 }}>
            <CodeBlock isDark={isDark} code={snippet.code} showLineNumbers />
          </div>

          {snippet.note && (
            <div style={{
              marginTop: 12, fontSize: 12, lineHeight: 1.6, color: textMuted,
              display: 'flex', gap: 6, alignItems: 'flex-start',
            }}>
              <span style={{ flex: '0 0 auto' }}>ℹ️</span>
              {snippet.note}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────
   I'm Not Sure Guide
   ───────────────────────────────────────────── */
function UnsureGuide({
  isDark,
  widgetKey,
  embedCode,
  copiedKey,
  onCopy,
  textPrimary,
  textSecondary,
  cardBg,
  borderCol,
}: {
  isDark: boolean;
  widgetKey: string;
  embedCode: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  borderCol: string;
}) {
  const devMessage = `Hi,

We've set up an AI chatbot for our website using Lashvae. Could you please add the following script to our website?

Paste this code just before the closing </body> tag on every page (or in the site footer/template):

${embedCode}

That's all that's needed — it loads asynchronously and won't affect page speed. Once it's added, the chatbot will appear automatically.

If you're using WordPress, you can use a plugin like "WPCode" or "Insert Headers and Footers" and paste it in the Footer Scripts section.

If you're using Shopify, add it to theme.liquid before the closing </body> tag.

For any other platform, paste it in the site-wide footer code or custom code section.

Let me know once it's live. Thanks!`;

  return (
    <div
      style={{
        borderRadius: 16, background: cardBg,
        border: `1px solid ${borderCol}`, overflow: 'hidden',
      }}
    >
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.07)',
              display: 'grid', placeItems: 'center', fontSize: 20,
            }}
          >
            📨
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: textPrimary }}>
              Send this to your developer
            </div>
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
              Don&apos;t know how your website is built? Copy this message and send it to whoever manages your site.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 14, borderRadius: 14,
            background: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9',
            border: isDark
              ? '1px solid rgba(255,255,255,0.06)'
              : '1px solid rgba(15,23,42,0.08)',
            fontSize: 12.5, lineHeight: 1.7,
            color: isDark ? 'rgba(226,232,240,0.72)' : '#334155',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            maxHeight: 260, overflow: 'auto',
          }}
        >
          {devMessage}
        </div>

        <button
          type="button"
          onClick={() => onCopy(devMessage, 'dev-message')}
          style={{
            marginTop: 12, width: '100%', height: 42, borderRadius: 13,
            border: '1px solid rgba(99,102,241,0.35)',
            background: 'rgba(99,102,241,0.12)',
            color: isDark ? '#C4B5FD' : '#4F46E5',
            cursor: 'pointer', fontWeight: 700, fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {copiedKey === 'dev-message' ? '✓ Copied!' : '📋 Copy message for developer'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Shared: Code Block with optional line numbers
   ───────────────────────────────────────────── */
function CodeBlock({
  isDark,
  code,
  showLineNumbers = false,
}: {
  isDark: boolean;
  code: string;
  showLineNumbers?: boolean;
}) {
  const lines = code.split('\n');

  return (
    <pre
      style={{
        margin: 0, padding: 14, borderRadius: 12,
        background: isDark ? 'rgba(0,0,0,0.35)' : '#F1F5F9',
        border: isDark
          ? '1px solid rgba(255,255,255,0.06)'
          : '1px solid rgba(15,23,42,0.08)',
        overflow: 'auto', fontSize: 12, lineHeight: 1.65,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', minHeight: 20 }}>
          {showLineNumbers && (
            <span
              style={{
                flex: '0 0 32px', textAlign: 'right', paddingRight: 12,
                color: isDark ? 'rgba(148,163,184,0.35)' : 'rgba(100,116,139,0.4)',
                userSelect: 'none',
              }}
            >
              {i + 1}
            </span>
          )}
          <span style={{ color: isDark ? '#E2E8F0' : '#0F172A' }}>
            {colorize(line, isDark)}
          </span>
        </div>
      ))}
    </pre>
  );
}

/* ── Minimal syntax highlighting ── */
function colorize(line: string, isDark: boolean): React.ReactNode {
  // Highlight strings (in quotes)
  const parts: React.ReactNode[] = [];
  const regex = /(["'`])(.*?)\1/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  const stringColor = isDark ? '#A5D6FF' : '#0550AE';
  const keywordColor = isDark ? '#D2A8FF' : '#8250DF';
  const tagColor = isDark ? '#7EE787' : '#116329';
  const defaultColor = isDark ? '#E2E8F0' : '#0F172A';

  const keywords = ['import', 'from', 'export', 'default', 'function', 'return', 'const', 'let', 'var', 'if', 'async', 'true'];

  const styledLine = line;

  while ((match = regex.exec(styledLine)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} style={{ color: defaultColor }}>
          {highlightKeywords(styledLine.slice(lastIndex, match.index), keywordColor, tagColor, defaultColor)}
        </span>
      );
    }
    parts.push(
      <span key={key++} style={{ color: stringColor }}>
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < styledLine.length) {
    parts.push(
      <span key={key++} style={{ color: defaultColor }}>
        {highlightKeywords(styledLine.slice(lastIndex), keywordColor, tagColor, defaultColor)}
      </span>
    );
  }

  return parts.length ? <>{parts}</> : <span style={{ color: defaultColor }}>{line}</span>;
}

function highlightKeywords(
  text: string,
  keywordColor: string,
  tagColor: string,
  defaultColor: string,
): React.ReactNode {
  const keywords = /\b(import|from|export|default|function|return|const|let|var|if|async|true|false|null)\b/g;
  const tags = /(<\/?[\w-]+|>|\/>)/g;
  const comments = /(\/\/.*$|\/\*.*?\*\/|<!--.*?-->)/;

  // Simple: just check for comment first
  const commentMatch = text.match(comments);
  if (commentMatch && text.trim().startsWith('//') || text.trim().startsWith('<!--')) {
    return <span style={{ color: 'rgba(148,163,184,0.5)', fontStyle: 'italic' }}>{text}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  const combined = /\b(import|from|export|default|function|return|const|let|var|if|async|true|false|null)\b|(<\/?[\w-]+|>|\/>)/g;

  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const isTag = match[0].startsWith('<') || match[0] === '>' || match[0] === '/>';
    parts.push(
      <span key={key++} style={{ color: isTag ? tagColor : keywordColor }}>
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return parts.length ? <>{parts}</> : text;
}

/* ─────────────────────────────────────────────
   Shared: Copy Button
   ───────────────────────────────────────────── */
function CopyButton({
  isDark,
  label,
  onClick,
}: {
  isDark: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 32, padding: '0 12px', borderRadius: 10, whiteSpace: 'nowrap',
        border: '1px solid rgba(99,102,241,0.32)',
        background: 'rgba(99,102,241,0.12)',
        color: isDark ? '#C4B5FD' : '#4F46E5',
        cursor: 'pointer', fontSize: 12, fontWeight: 600,
        flex: '0 0 auto',
      }}
    >
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Disconnect Confirmation Modal
   ───────────────────────────────────────────── */
function DisconnectConfirmModal({
  isDark,
  saving,
  onCancel,
  onConfirm,
}: {
  isDark: boolean;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'grid', placeItems: 'center', padding: 20,
        background: 'rgba(2,6,23,0.48)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)', borderRadius: 24, padding: 22,
          background: isDark
            ? 'linear-gradient(180deg,#111827,#070B18)'
            : 'linear-gradient(180deg,#FFFFFF,#FFF7F7)',
          border: isDark
            ? '1px solid rgba(255,255,255,0.12)'
            : '1px solid rgba(239,68,68,0.18)',
          boxShadow: isDark
            ? '0 30px 90px rgba(0,0,0,0.55)'
            : '0 30px 80px rgba(15,23,42,0.22)',
        }}
      >
        <div
          style={{
            width: 46, height: 46, borderRadius: 16,
            display: 'grid', placeItems: 'center',
            background: 'rgba(239,68,68,0.13)',
            color: '#EF4444', fontSize: 22, marginBottom: 14,
          }}
        >
          ⚠️
        </div>

        <div style={{
          fontSize: 19, fontWeight: 700, color: isDark ? '#F8FAFC' : '#111827',
          marginBottom: 8, letterSpacing: '-0.02em',
        }}>
          Disconnect website chatbot?
        </div>

        <div style={{
          fontSize: 13, lineHeight: 1.65,
          color: isDark ? 'rgba(226,232,240,0.66)' : '#64748B',
        }}>
          The installed widget will stop working on the client website. Visitors will not be able
          to chat until you enable it again.
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{
              height: 40, padding: '0 16px', borderRadius: 13,
              border: isDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(15,23,42,0.12)',
              background: isDark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
              color: isDark ? '#CBD5E1' : '#334155',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 600, fontSize: 13, opacity: saving ? 0.65 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            style={{
              height: 40, padding: '0 17px', borderRadius: 13,
              border: '1px solid rgba(239,68,68,0.42)',
              background: saving ? 'rgba(239,68,68,0.45)' : 'linear-gradient(135deg,#EF4444,#DC2626)',
              color: '#FFFFFF',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: 13,
              boxShadow: '0 12px 28px rgba(239,68,68,0.28)',
              opacity: saving ? 0.72 : 1,
            }}
          >
            {saving ? 'Disconnecting...' : 'Yes, disconnect'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Data: Builder Platform Instructions
   ───────────────────────────────────────────── */
function getBuilderInstructions(
  platform: BuilderPlatform,
  widgetKey: string,
): { title: string; steps: string[]; tip?: string } {
  switch (platform) {
    case 'wordpress':
      return {
        title: 'WordPress Installation',
        steps: [
          'Open your WordPress admin dashboard.',
          'Install a plugin like WPCode or Insert Headers and Footers.',
          'Paste the chatbot script into the Footer Scripts section.',
          'Save changes.',
        ],
        tip: 'Not sure where to paste it? Use the plugin\'s Footer Scripts or Custom Code section.',
      };
    case 'shopify':
      return {
        title: 'Shopify Installation',
        steps: [
          'Go to your Shopify admin → Online Store → Themes.',
          'Click Actions → Edit code.',
          'Open the theme.liquid file.',
          'Paste the script just before the closing </body> tag.',
          'Save.',
        ],
        tip: 'This works for all Shopify themes. The script loads asynchronously and won\'t slow down your store.',
      };
    case 'webflow':
      return {
        title: 'Webflow Installation',
        steps: [
          'Open your Webflow project settings.',
          'Go to the Custom Code tab.',
          'Paste the script in the Footer Code section.',
          'Save and publish your site.',
        ],
      };
    case 'wix':
      return {
        title: 'Wix Installation',
        steps: [
          'In your Wix dashboard, go to Settings → Custom Code.',
          'Click + Add Custom Code.',
          'Paste the script, set placement to Body - end.',
          'Apply to All Pages and save.',
        ],
        tip: 'If you don\'t see Custom Code, you may need a Wix Premium plan.',
      };
    case 'squarespace':
      return {
        title: 'Squarespace Installation',
        steps: [
          'Go to your Squarespace site → Settings → Advanced → Code Injection.',
          'Paste the script in the Footer field.',
          'Save.',
        ],
        tip: 'Code Injection is available on Business and Commerce plans.',
      };
    case 'other':
      return {
        title: 'General Installation',
        steps: [
          'Find your platform\'s custom code or footer section.',
          'Paste the script before the closing </body> tag.',
          'Save and publish.',
        ],
        tip: 'Most website builders have a "Custom Code" or "Footer Scripts" section in settings.',
      };
  }
}

/* ─────────────────────────────────────────────
   Data: Framework Code Snippets
   ───────────────────────────────────────────── */
function getFrameworkSnippet(
  framework: CodeFramework,
  widgetKey: string,
): { title: string; subtitle: string; code: string; note?: string } {
  switch (framework) {
    case 'html':
      return {
        title: 'HTML Installation',
        subtitle: 'Add this before the closing </body> tag.',
        code: `<!-- Lashvae Chat Widget -->
<script
  src="https://api.thundertribes.com/widget/embed.js"
  data-widget-id="${widgetKey}"
  async
></script>`,
      };
    case 'react':
      return {
        title: 'React Installation',
        subtitle: 'Add this hook in your root App component.',
        code: `import { useEffect } from "react";

export default function App() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://api.thundertribes.com/widget/embed.js";
    script.setAttribute("data-widget-id", "${widgetKey}");
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return <>{/* your app */}</>;
}`,
      };
    case 'nextjs':
      return {
        title: 'Next.js Installation',
        subtitle: 'Add this inside app/layout.tsx, near the end of <body>.',
        code: `import Script from "next/script";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://api.thundertribes.com/widget/embed.js"
          data-widget-id="${widgetKey}"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}`,
        note: 'For Pages Router, you can add this inside pages/_app.tsx or pages/_app.js.',
      };
    case 'wordpress':
      return {
        title: 'WordPress (Theme) Installation',
        subtitle: 'Add to your theme\'s footer.php or use a code snippets plugin.',
        code: `<?php // Add to functions.php ?>

function lashvae_chatbot_script() {
  ?>
  <script
    src="https://api.thundertribes.com/widget/embed.js"
    data-widget-id="<?php echo '${widgetKey}'; ?>"
    async
  ></script>
  <?php
}
add_action('wp_footer', 'lashvae_chatbot_script');`,
        note: 'Alternatively, use a plugin like WPCode to add the script without editing theme files.',
      };
    case 'shopify':
      return {
        title: 'Shopify (Liquid) Installation',
        subtitle: 'Add to your theme.liquid file before </body>.',
        code: `{% comment %} Lashvae Chat Widget {% endcomment %}
<script
  src="https://api.thundertribes.com/widget/embed.js"
  data-widget-id="${widgetKey}"
  async
></script>`,
      };
    case 'webflow':
      return {
        title: 'Webflow Installation',
        subtitle: 'Paste in Project Settings → Custom Code → Footer Code.',
        code: `<!-- Lashvae Chat Widget -->
<script
  src="https://api.thundertribes.com/widget/embed.js"
  data-widget-id="${widgetKey}"
  async
></script>`,
      };
    case 'angular':
      return {
        title: 'Angular Installation',
        subtitle: 'Add the script tag to your src/index.html.',
        code: `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>My App</title>
</head>
<body>
  <app-root></app-root>

  <!-- Lashvae Chat Widget -->
  <script
    src="https://api.thundertribes.com/widget/embed.js"
    data-widget-id="${widgetKey}"
    async
  ></script>
</body>
</html>`,
        note: 'For Angular Universal (SSR), ensure the script only runs in the browser environment.',
      };
    case 'other':
      return {
        title: 'General Installation',
        subtitle: 'Add this script before the closing </body> tag on your site.',
        code: `<!-- Lashvae Chat Widget -->
<script
  src="https://api.thundertribes.com/widget/embed.js"
  data-widget-id="${widgetKey}"
  async
></script>`,
        note: 'This works on any platform. The script loads asynchronously and won\'t affect page performance.',
      };
  }
}
