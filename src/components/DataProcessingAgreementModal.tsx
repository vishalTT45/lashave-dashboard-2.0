'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export type SocialChannel =
  | 'instagram'
  | 'facebook'
  | 'telegram'
  | 'youtube'
  | 'google'
  | 'google reviews'
  | 'website';

const PLATFORM_LABELS: Record<SocialChannel, string> = {
  'instagram': 'Instagram',
  'facebook': 'Facebook',
  'telegram': 'Telegram',
  'youtube': 'YouTube',
  'google': 'Google Reviews',
  'google reviews': 'Google Reviews',
  'website': 'Website Chat',
};

function getPlatformLabel(channel: SocialChannel): string {
  return PLATFORM_LABELS[channel] || channel;
}

type Props = {
  platform: SocialChannel;
  isDark: boolean;
  onAccepted: () => void;
  onClose: () => void;
};

export default function DataProcessingAgreementModal({
  platform,
  isDark,
  onAccepted,
  onClose,
}: Props) {
  const [accepted, setAccepted] = useState(false);
  const [privacyUrl, setPrivacyUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const platformLabel = getPlatformLabel(platform);

  async function handleAccept() {
    setError('');

    if (!accepted) {
      setError('Confirm the data-processing instructions to continue.');
      return;
    }

    try {
      setSaving(true);

      const fallbackPrivacyUrl = 'https://lashvae.com/legal/dpa';
      await apiFetch('/admin/processing-acceptance', {
        method: 'POST',
        auth: true,
        body: {
          accepted: true,
          acknowledged: true,
          privacy_notice_url: privacyUrl.trim() || fallbackPrivacyUrl,
          platform,
          channel: platform,
          source: 'dpa-modal',
          dpa_version: 1,
          accepted_version: 1,
        },
      });

      onAccepted();
    } catch (err: unknown) {
      console.error(err);
      const detail = err instanceof Error ? err.message : '';
      const ignore =
        /duplicate/i.test(detail) ||
        /already/i.test(detail) ||
        /exists/i.test(detail) ||
        /recorded/i.test(detail);
      if (ignore) {
        onAccepted();
        return;
      }
      setError(
        `Could not record legal acceptance${detail ? `. ${detail}` : '.'}`,
      );
    } finally {
      setSaving(false);
    }
  }

  const bg = isDark ? 'rgba(12,14,21,.97)' : '#ffffff';
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a';
  const textSub = isDark ? 'rgba(226,232,240,.65)' : '#475569';
  const border = isDark ? 'rgba(255,255,255,.10)' : 'rgba(15,23,42,.10)';

  const accentBg = isDark ? 'rgba(52,211,153,.08)' : 'rgba(52,211,153,.06)';

  const accentBorder = isDark ? 'rgba(52,211,153,.20)' : 'rgba(52,211,153,.22)';

  const checkboxBoxBg = accepted
    ? '#2563eb'
    : isDark
      ? 'rgba(255,255,255,.04)'
      : '#ffffff';

  const checkboxBoxBorder = accepted
    ? '#2563eb'
    : isDark
      ? 'rgba(255,255,255,.22)'
      : 'rgba(15,23,42,.28)';

  const buttonReady = accepted && !saving;

  const buttonBg = buttonReady
    ? '#2563eb'
    : isDark
      ? 'rgba(37,99,235,.35)'
      : 'rgba(37,99,235,.4)';

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: isDark ? 'rgba(0,0,0,.8)' : 'rgba(15,23,42,.45)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: bg,
          borderRadius: 22,
          border: `1px solid ${border}`,
          padding: 28,
          boxShadow: '0 40px 90px rgba(0,0,0,.35)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 19,
                fontWeight: 700,
                color: isDark ? '#f1f5f9' : '#2563eb',
                margin: '0 0 4px',
              }}
            >
              Enable {platformLabel}
            </h2>

            <p
              style={{
                fontSize: 12,
                color: textSub,
                margin: 0,
              }}
            >
              Customer data processing
            </p>
          </div>

          <button
            type='button'
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: `1px solid ${border}`,
              background: 'transparent',
              color: textSub,
              cursor: 'pointer',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            lineHeight: 1.6,
            color: textSub,
          }}
        >
          By continuing, you confirm that you are authorised to connect this
          business account and instruct Lashvae to receive, store and process
          customer messages, comments, reviews and relevant account information
          on your behalf.
        </p>

        <p
          style={{
            marginTop: 10,
            fontSize: 13,
            lineHeight: 1.6,
            color: textSub,
          }}
        >
          Depending on the features you enable, processing may include
          AI-assisted replies, enquiry management, bookings, conversation
          classification, lead identification, sentiment analysis and business
          insights.
        </p>

        <div
          style={{
            marginTop: 14,
            padding: '11px 14px',
            borderRadius: 12,
            fontSize: 12,
            lineHeight: 1.55,
            background: accentBg,
            border: `1px solid ${accentBorder}`,
            color: textSub,
          }}
        >
          Processed under GDPR (EU) and DPDPA (India) safeguards. Your business
          remains responsible for identifying an appropriate lawful basis and
          providing customers with the required privacy information.
        </div>

        <label
          style={{
            display: 'block',
            marginTop: 18,
            fontSize: 12,
            fontWeight: 700,
            color: textPrimary,
          }}
        >
          Business privacy notice URL
        </label>

        <input
          type='url'
          value={privacyUrl}
          onChange={(e) => setPrivacyUrl(e.target.value)}
          placeholder='https://yourbusiness.com/privacy'
          style={{
            marginTop: 8,
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: 10,
            border: `1px solid ${border}`,
            padding: '10px 12px',
            fontSize: 13,
            background: isDark ? 'rgba(255,255,255,.04)' : '#ffffff',
            color: textPrimary,
            outline: 'none',
          }}
        />

        <label
          htmlFor='dpa-consent'
          style={{
            marginTop: 18,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 11,
            padding: '12px 14px',
            borderRadius: 12,
            border: `1px solid ${accepted ? 'rgba(37,99,235,.35)' : border}`,
            background: accepted
              ? isDark
                ? 'rgba(37,99,235,.08)'
                : 'rgba(37,99,235,.04)'
              : 'transparent',
            cursor: 'pointer',
            transition: 'background .15s, border-color .15s',
            userSelect: 'none',
          }}
        >
          <input
            id='dpa-consent'
            type='checkbox'
            checked={accepted}
            onChange={(e) => {
              setAccepted(e.target.checked);

              if (e.target.checked) {
                setError('');
              }
            }}
            style={{
              position: 'absolute',
              opacity: 0,
              width: 1,
              height: 1,
              margin: 0,
            }}
          />

          <span
            aria-hidden='true'
            style={{
              flexShrink: 0,
              width: 18,
              height: 18,
              marginTop: 1,
              borderRadius: 5,
              background: checkboxBoxBg,
              border: `1.5px solid ${checkboxBoxBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background .15s, border-color .15s',
            }}
          >
            {accepted && (
              <svg
                width='11'
                height='11'
                viewBox='0 0 24 24'
                fill='none'
                stroke='#fff'
                strokeWidth='3.5'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <polyline points='20 6 9 17 4 12' />
              </svg>
            )}
          </span>

          <span
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: textSub,
            }}
          >
            I have read and agree to the Data Processing Agreement and confirm
            that I am authorised to instruct Lashvae to receive, store and
            process customer data on behalf of my organisation.
          </span>
        </label>

        <p
          style={{
            marginTop: 10,
            fontSize: 11,
            lineHeight: 1.5,
            color: textSub,
            opacity: 0.8,
          }}
        >
          By continuing, you also accept the Lashvae Data Processing Agreement
          and Privacy Terms.
        </p>

        {error && (
          <p
            style={{
              marginTop: 12,
              fontSize: 12.5,
              color: '#dc2626',
            }}
          >
            {error}
          </p>
        )}

        <button
          type='button'
          onClick={handleAccept}
          disabled={!buttonReady}
          style={{
            marginTop: 20,
            width: '100%',
            padding: '12px 0',
            borderRadius: 12,
            border: 'none',
            fontSize: 13,
            fontWeight: 800,
            color: '#fff',
            background: buttonBg,
            cursor: buttonReady ? 'pointer' : 'not-allowed',
            boxShadow: buttonReady ? '0 8px 22px rgba(37,99,235,.35)' : 'none',
            opacity: saving ? 0.7 : 1,
            transition: 'background .15s, box-shadow .15s',
          }}
        >
          {saving ? 'Saving…' : 'Accept & Continue'}
        </button>
      </div>
    </div>
  );
}
