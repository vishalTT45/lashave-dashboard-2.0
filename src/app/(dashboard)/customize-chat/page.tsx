'use client';

/* ══════════════════════════════════════════════════════════════════════════
   MERGED WEBSITE CHATBOT PAGE
   Combines /customize-chat (appearance/behavior/preview) with the old
   WebsiteWidgetModal install/testing flow into a single sidebar-driven page.

   BACKEND COMPATIBILITY
   All NEW options are sent inside a single `advanced_config` JSON object so
   the backend only needs ONE new nullable JSON column. If your API rejects
   unknown keys, set this to false and everything still works exactly as
   before (new options become preview-only until the column is added).
   ══════════════════════════════════════════════════════════════════════════ */

import { RequireAuth } from '@/components/require-auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch as UiSwitch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api';
import { useTheme } from '@/lib/theme-context';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowLeft,
  Blocks,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  DollarSign,
  Eye,
  Handshake,
  HelpCircle,
  Info,
  Layout,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Monitor,
  Palette,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings,
  ShoppingBag,
  Smartphone,
  Sparkles,
  TestTube,
  Trash2,
  Upload,
  User,
  Users,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SEND_ADVANCED_CONFIG = true;

/* ── types ─────────────────────────────────────────────────────────────── */

type GuideType = 'builder' | 'custom' | 'unsure';
type BuilderPlatform =
  | 'wordpress'
  | 'shopify'
  | 'webflow'
  | 'wix'
  | 'squarespace'
  | 'other';
type CodeFramework =
  | 'html'
  | 'react'
  | 'nextjs'
  | 'wordpress'
  | 'shopify'
  | 'webflow'
  | 'angular'
  | 'other';

type CustomDetailField = {
  key: string;
  label: string;
  type: 'text' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];
};

type ContactTopic = { icon: string; label: string };
type FaqItem = { q: string; a: string };

type ProactiveRuleConditions = {
  path_match?: string;
  time_on_page_ms?: number;
  min_scroll_pct?: number;
  exit_intent?: boolean;
  min_pageviews?: number;
  widget_never_opened?: boolean;
  returning_visitor?: boolean | null;
  referrer_contains?: string;
};
type ProactiveRule = {
  id: string;
  name: string;
  enabled: boolean;
  conditions: ProactiveRuleConditions;
  message: string;
  priority: number;
};

type AdvancedConfig = {
  greeting_heading: string;
  widget_theme: 'light' | 'dark' | 'auto';
  header_style: 'aurora' | 'solid' | 'custom' | 'glass';
  gradient_from: string;
  gradient_to: string;
  font_family: string;
  corner_radius: 'sharp' | 'soft' | 'round';
  hide_branding: boolean;
  enable_home: boolean;
  enable_faq: boolean;
  enable_survey: boolean;
  contact_topics: ContactTopic[];
  faq_items: FaqItem[];
  launcher_pulse: boolean; // DEPRECATED — kept for backward compat; migrated to launcher_animation on load
  launcher_style:
    | 'gradient'
    | 'classic'
    | 'glass'
    | 'neon'
    | 'outlined'
    | 'elevated';
  launcher_animation: 'none' | 'pulse' | 'bounce' | 'wobble' | 'shine' | 'glow';
  launcher_icon_size: 'small' | 'medium' | 'large';
  launcher_custom_icon_url: string; // empty string means: use the bubble_icon selection
  // Backend has a strict enum validator on top-level bubble_icon/bubble_shape.
  // We keep the true user selection here so premium options (sparkle, blob, star, etc.)
  // can be saved without a schema migration. On load, these take precedence over the
  // top-level fields; on save, we still send a "safe" legacy value up top.
  launcher_icon: string;
  launcher_shape: string;
  launcher_size: number;
  teaser_text: string;
  teaser_delay_ms: number;
  show_unread_badge: boolean;
  sound_enabled: boolean;
  hide_on_mobile: boolean;
  gdpr_enabled: boolean;
  gdpr_privacy_url: string;
  marketing_consent_enabled: boolean;
  marketing_consent_text: string;
  age_assurance_enabled: boolean;
  activity_tracking_enabled: boolean;
  lead_profiling_consent_enabled: boolean;
  business_hours_enabled: boolean;
  widget_language: string;
  proactive_rules: ProactiveRule[];
};

const DEFAULT_ADVANCED: AdvancedConfig = {
  greeting_heading: '',
  widget_theme: 'light',
  header_style: 'solid',
  gradient_from: '#0b0d18',
  gradient_to: '#f3f4f8',
  font_family: 'rounded',
  corner_radius: 'soft',
  hide_branding: false,
  enable_home: true,
  enable_faq: false,
  enable_survey: false,
  contact_topics: [
    { icon: '', label: 'General information' },
    { icon: '', label: 'A problem with an order' },
  ],
  faq_items: [],
  launcher_pulse: true,
  launcher_style: 'gradient',
  launcher_animation: 'pulse',
  launcher_icon_size: 'medium',
  launcher_custom_icon_url: '',
  launcher_icon: '',
  launcher_shape: '',
  launcher_size: 60,
  teaser_text: '',
  teaser_delay_ms: 4000,
  show_unread_badge: true,
  sound_enabled: true,
  hide_on_mobile: false,
  gdpr_enabled: false,
  gdpr_privacy_url: '',
  marketing_consent_enabled: false,
  marketing_consent_text:
    'I would like to receive product updates and offers by email.',
  age_assurance_enabled: false,
  activity_tracking_enabled: false,
  lead_profiling_consent_enabled: false,
  business_hours_enabled: false,
  widget_language: 'en',
  proactive_rules: [],
};

type WidgetConfig = {
  id?: number;
  tenant_id?: string;
  channel_id?: number;
  widget_key?: string;
  brand_color: string;
  position: string;
  widget_title: string;
  greeting_text: string;
  avatar_url: string;
  offline_message: string;
  collect_name: boolean;
  collect_email: boolean;
  custom_details?: boolean;
  custom_details_fields?: CustomDetailField[];
  allowed_domains: string[];
  auto_open_delay_ms: number;
  bubble_color?: string;
  bubble_shape?: string;
  bubble_icon?: string;
  is_active?: boolean;
  advanced_config?: Partial<AdvancedConfig> | null;
};

type WidgetResponse = {
  config: WidgetConfig | null;
  embed_code: string | null;
};

/* ── Bubble constants ──────────────────────────────────────────────────── */

const BUBBLE_SHAPES = [
  { id: 'circle', label: 'Circle' },
  { id: 'squircle', label: 'Squircle' },
  { id: 'square', label: 'Square' },
  { id: 'rounded-square', label: 'Rounded' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'blob', label: 'Blob' },
  { id: 'star', label: 'Star' },
  { id: 'shield', label: 'Shield' },
];

const BUBBLE_STYLES: Array<{
  id: AdvancedConfig['launcher_style'];
  label: string;
  desc: string;
}> = [
  { id: 'gradient', label: 'Gradient', desc: 'Diagonal color sweep' },
  { id: 'classic', label: 'Classic', desc: 'Flat brand color' },
  { id: 'glass', label: 'Glass', desc: 'Frosted translucent' },
  { id: 'neon', label: 'Neon', desc: 'Vibrant colored halo' },
  { id: 'outlined', label: 'Outlined', desc: 'Transparent with ring' },
  { id: 'elevated', label: 'Elevated', desc: 'Deep 3D shadow' },
];

const LAUNCHER_ANIMATIONS: Array<{
  id: AdvancedConfig['launcher_animation'];
  label: string;
  desc: string;
}> = [
  { id: 'none', label: 'None', desc: 'Static' },
  { id: 'pulse', label: 'Pulse', desc: 'Radial ring' },
  { id: 'bounce', label: 'Bounce', desc: 'Gentle hop' },
  { id: 'wobble', label: 'Wobble', desc: 'Playful sway' },
  { id: 'shine', label: 'Shine', desc: 'Light sweep' },
  { id: 'glow', label: 'Glow', desc: 'Breathing halo' },
];

const BUBBLE_ICONS = [
  {
    id: 'chat',
    label: 'Chat',
    path: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.2L4 17.2V4h16v12z',
  },
  {
    id: 'message',
    label: 'Email',
    path: 'M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
  },
  {
    id: 'headset',
    label: 'Support',
    path: 'M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z',
  },
  {
    id: 'help',
    label: 'Help',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z',
  },
  {
    id: 'wave',
    label: 'Wave',
    path: 'M23 5.5V20c0 2.2-1.8 4-4 4h-7.93c-1.62 0-3.07-.92-3.77-2.37l-4.82-9.98C1.93 10.46 2.72 9 4 9c.53 0 1.04.21 1.41.59L7 11.17V4c0-1.1.9-2 2-2s2 .9 2 2v.5c0-1.1.9-2 2-2s2 .9 2 2v.5c0-1.1.9-2 2-2s2 .9 2 2v1c0-1.1.9-2 2-2s2 .9 2 2z',
  },
  {
    id: 'bolt',
    label: 'Bolt',
    path: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
  },
  // ── Premium additions ──
  {
    id: 'sparkle',
    label: 'AI Spark',
    path: 'M19 1l-1.26 2.75L15 5l2.74 1.26L19 9l1.25-2.75L23 5l-2.75-1.25L19 1zM9 4L6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5L9 4zm10 12l-1.26 2.74L15 20l2.74 1.26L19 24l1.25-2.75L23 20l-2.75-1.26L19 16z',
  },
  {
    id: 'bell',
    label: 'Bell',
    path: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
  },
  {
    id: 'info',
    label: 'Info',
    path: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  },
  {
    id: 'cart',
    label: 'Cart',
    path: 'M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z',
  },
  {
    id: 'phone',
    label: 'Phone',
    path: 'M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z',
  },
  {
    id: 'rocket',
    label: 'Rocket',
    path: 'M9.19 6.35c-2.04 2.29-3.44 5.58-3.57 5.89L2 10.69l4.05-4.05c.47-.47 1.15-.68 1.81-.55l1.33.26zM11.17 17s3.74-1.55 5.89-3.7c5.4-5.4 4.5-9.62 4.21-10.57-.95-.3-5.17-1.19-10.57 4.21C8.55 9.09 7 12.83 7 12.83L11.17 17zm6.48-2.19c-2.29 2.04-5.58 3.44-5.89 3.57L13.31 22l4.05-4.05c.47-.47.68-1.15.55-1.81l-.26-1.33zM9 18c0 .83-.34 1.58-.88 2.12C6.94 21.3 2 22 2 22s.7-4.94 1.88-6.12C4.42 15.34 5.17 15 6 15c1.66 0 3 1.34 3 3zm4-9c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2-2-.9-2-2z',
  },
];

const LAUNCHER_ICON_SIZES: Array<{
  id: AdvancedConfig['launcher_icon_size'];
  label: string;
  ratio: number;
}> = [
  { id: 'small', label: 'Small', ratio: 0.38 },
  { id: 'medium', label: 'Medium', ratio: 0.46 },
  { id: 'large', label: 'Large', ratio: 0.56 },
];

/**
 * Backend-safe values for the top-level bubble_icon and bubble_shape columns.
 * The backend rejects anything outside these sets with a 400. When the user
 * picks a premium option (sparkle, blob, star, etc.), we still send one of
 * these up top as a fallback and store the real choice in advanced_config.
 * Add to these sets ONLY when the backend enum is expanded to match.
 */
const BACKEND_ALLOWED_ICONS = new Set([
  'chat',
  'message',
  'headset',
  'help',
  'wave',
  'bolt',
]);
const BACKEND_ALLOWED_SHAPES = new Set([
  'circle',
  'square',
  'rounded-square',
  'hexagon',
  'diamond',
]);
const BACKEND_ICON_FALLBACK = 'chat';
const BACKEND_SHAPE_FALLBACK = 'circle';

/* ── premium constants ─────────────────────────────────────────────────── */

const WIDGET_FONTS = [
  {
    id: 'rounded',
    label: 'Rounded',
    stack: "'Poppins','Quicksand','Nunito',system-ui,sans-serif",
  },
  {
    id: 'modern',
    label: 'Modern',
    stack: "'Inter','SF Pro Display',system-ui,sans-serif",
  },
  {
    id: 'system',
    label: 'System',
    stack: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  {
    id: 'elegant',
    label: 'Elegant',
    stack: "'Georgia','Times New Roman',serif",
  },
];

const RADIUS_PRESETS: Record<
  string,
  { panel: number; card: number; input: number }
> = {
  sharp: { panel: 12, card: 10, input: 8 },
  soft: { panel: 24, card: 18, input: 12 },
  round: { panel: 32, card: 24, input: 16 },
};

const WIDGET_LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
  { id: 'pt', label: 'Português' },
  { id: 'it', label: 'Italiano' },
  { id: 'nl', label: 'Nederlands' },
  { id: 'ar', label: 'العربية' },
  { id: 'hi', label: 'हिन्दी' },
];

const PRESET_THEMES: Array<{
  name: string;
  brand: string;
  bubble: string;
  theme: AdvancedConfig['widget_theme'];
  font: string;
  radius: AdvancedConfig['corner_radius'];
}> = [
  {
    name: 'Midnight',
    brand: '#465FFF',
    bubble: '#111827',
    theme: 'light',
    font: 'rounded',
    radius: 'soft',
  },
  {
    name: 'Slate',
    brand: '#344054',
    bubble: '#344054',
    theme: 'light',
    font: 'rounded',
    radius: 'soft',
  },
  {
    name: 'Success',
    brand: '#12B76A',
    bubble: '#027A48',
    theme: 'light',
    font: 'modern',
    radius: 'soft',
  },
  {
    name: 'Noir',
    brand: '#18181B',
    bubble: '#18181B',
    theme: 'dark',
    font: 'modern',
    radius: 'sharp',
  },
  {
    name: 'Steel',
    brand: '#667085',
    bubble: '#475467',
    theme: 'light',
    font: 'modern',
    radius: 'soft',
  },
  {
    name: 'Ocean',
    brand: '#465FFF',
    bubble: '#344054',
    theme: 'light',
    font: 'rounded',
    radius: 'soft',
  },
];

const GUIDE_OPTIONS = [
  { key: 'builder', icon: Blocks, label: 'Website builder' },
  { key: 'custom', icon: Code2, label: 'Custom coded' },
  { key: 'unsure', icon: HelpCircle, label: "I'm not sure" },
];

const cloudinary_name = process.env.NEXT_PUBLIC_CLOUDINARY_NAME;
const cloudinary_unsigned_present =
  process.env.NEXT_PUBLIC_CLOUDINARY_UNSIGNED_PRESENT;

/* ── color helpers ─────────────────────────────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((x) => x + x)
          .join('')
      : h.padEnd(6, '0');
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function mix(hexA: string, hexB: string, weightOfB: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const w = Math.max(0, Math.min(1, weightOfB));
  const out = a.map((ch, i) => Math.round(ch * (1 - w) + b[i] * w));
  return `#${out.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

const darken = (hex: string, amt: number) => mix(hex, '#07080f', amt);
const lighten = (hex: string, amt: number) => mix(hex, '#ffffff', amt);

function rgba(hex: string, alpha: number) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function heroBackground(
  style: string,
  brand: string,
  from: string,
  to: string,
  dark: boolean,
): string {
  switch (style) {
    case 'solid':
      return brand;
    case 'custom':
      return `linear-gradient(180deg, ${from} 0%, ${to} 100%)`;
    case 'glass':
      return `linear-gradient(180deg, ${rgba(darken(brand, 0.35), 0.92)} 0%, ${rgba(brand, 0.55)} 60%, ${rgba(lighten(brand, 0.85), 0.35)} 100%)`;
    case 'aurora':
    default:
      return `linear-gradient(178deg, ${darken(brand, 0.86)} 0%, ${darken(brand, 0.62)} 34%, ${mix(brand, dark ? '#12141f' : '#eceef4', 0.72)} 72%, ${dark ? '#12141f' : '#f3f4f8'} 100%)`;
  }
}

/* ── theme helper (dashboard chrome) ───────────────────────────────────── */

function th(isDark: boolean) {
  return {
    pageBg: isDark ? '#101828' : '#f9fafb',
    cardBg: isDark ? 'rgba(255,255,255,.03)' : '#ffffff',
    cardBorder: isDark ? '#1d2939' : '#e4e7ec',
    inputBg: isDark ? '#101828' : '#ffffff',
    inputBorder: isDark ? '#344054' : '#d0d5dd',
    textPrimary: isDark ? 'rgba(255,255,255,.9)' : '#1d2939',
    textSub: isDark ? '#98a2b3' : '#667085',
    textMuted: isDark ? '#667085' : '#98a2b3',
    sectionIcon: isDark ? '#98a2b3' : '#667085',
    borderFaint: isDark ? '#1d2939' : '#eaecf0',
    toggleTrackOn: '#465FFF',
    toggleTrackOff: isDark ? 'rgba(255,255,255,.10)' : '#e4e7ec',
    codeBg: isDark ? '#101828' : '#f9fafb',
    codeBorder: isDark ? '#1d2939' : '#eaecf0',
    codeText: isDark ? '#9CB9FF' : '#465FFF',
    codeTextMuted: isDark ? '#98a2b3' : '#667085',
    sidebarBg: isDark ? 'rgba(255,255,255,.03)' : '#ffffff',
    sidebarItemHover: isDark ? 'rgba(255,255,255,.05)' : '#f9fafb',
    sidebarItemActiveBg: isDark ? 'rgba(70,95,255,.14)' : '#ecf3ff',
    sidebarItemActiveText: isDark ? '#9CB9FF' : '#465FFF',
  };
}

/* ── helper: bubble shape → inline styles ──────────────────────────────── */

function getBubbleShapeStyle(shape: string): React.CSSProperties {
  switch (shape) {
    case 'square':
      return { borderRadius: 0 };
    case 'rounded-square':
      return { borderRadius: 12 };
    case 'squircle':
      return { borderRadius: '30%' };
    case 'hexagon':
      return {
        borderRadius: 0,
        clipPath: 'polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)',
      };
    case 'diamond':
      return { borderRadius: 0, transform: 'rotate(45deg)' };
    // Premium additions
    case 'blob':
      return {
        // Organic morphing border-radius — each corner different for a natural feel
        borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%',
      };
    case 'star':
      return {
        borderRadius: 0,
        clipPath:
          'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
      };
    case 'shield':
      return {
        borderRadius: 0,
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)',
      };
    case 'circle':
    default:
      return { borderRadius: '50%' };
  }
}

/**
 * getShapeIconScale
 * Multiplier applied on top of the user's Icon Size preference to account for
 * shapes whose visible "safe area" is smaller than their bounding box.
 * A regular circle/square gets 1.0; a star gets ~0.7 because its points steal
 * corner space; a shield's tapered bottom eats icon space too.
 */
function getShapeIconScale(shape: string): number {
  switch (shape) {
    case 'star':
      return 0.68;
    case 'shield':
      return 0.82;
    case 'hexagon':
      return 0.9;
    case 'diamond':
      return 1.15; // rotated 45° — bigger icon reads better
    case 'blob':
      return 0.92;
    default:
      return 1;
  }
}

/**
 * getBubbleStyleCSS
 * Returns the visual look (background, shadow, border, icon color) for a bubble style preset.
 * The icon color falls back to '#fff' when not returned.
 */
function getBubbleStyleCSS(
  style: AdvancedConfig['launcher_style'],
  color: string,
): {
  background: string;
  boxShadow: string;
  border?: string;
  iconColor: string;
} {
  const lc = lighten(color, 0.2);
  const dc = darken(color, 0.18);
  switch (style) {
    case 'classic':
      return {
        background: color,
        boxShadow: `0 6px 20px ${rgba(color, 0.32)}, 0 2px 4px rgba(0,0,0,.06)`,
        iconColor: '#fff',
      };
    case 'glass':
      return {
        background: `linear-gradient(135deg, ${rgba(color, 0.5)}, ${rgba(lc, 0.4)})`,
        boxShadow: `0 10px 32px ${rgba(color, 0.32)}, inset 0 1px 0 rgba(255,255,255,.4)`,
        border: `1px solid ${rgba(lc, 0.55)}`,
        iconColor: '#fff',
      };
    case 'neon':
      return {
        background: `linear-gradient(135deg, ${color}, ${lc})`,
        boxShadow: `0 0 0 3px ${rgba(color, 0.14)}, 0 10px 44px ${rgba(color, 0.72)}, 0 4px 14px ${rgba(color, 0.52)}`,
        iconColor: '#fff',
      };
    case 'outlined':
      return {
        background: 'rgba(255,255,255,.06)',
        boxShadow: `inset 0 0 0 3px ${color}, 0 8px 22px ${rgba(color, 0.22)}`,
        iconColor: color,
      };
    case 'elevated':
      return {
        background: `linear-gradient(135deg, ${color}, ${dc})`,
        boxShadow: `0 22px 44px -10px ${rgba(dc, 0.62)}, 0 12px 20px -6px ${rgba(dc, 0.42)}, 0 4px 8px rgba(0,0,0,.16)`,
        iconColor: '#fff',
      };
    case 'gradient':
    default:
      return {
        background: `linear-gradient(135deg, ${color}, ${lc})`,
        boxShadow: `0 8px 26px ${rgba(color, 0.45)}, 0 2px 4px rgba(0,0,0,.08)`,
        iconColor: '#fff',
      };
  }
}

/**
 * Categorize an animation by which layer it lives on.
 * Transform-based ones (bounce, wobble) run on a MOTION wrapper so they don't
 * fight the diamond shape's own 45deg rotate.
 */
function classifyAnimation(a: AdvancedConfig['launcher_animation']): {
  outer: string; // animation class applied to motion wrapper
  inner: string; // animation class applied to shape itself
} {
  if (a === 'bounce') return { outer: 'cw-anim-bounce', inner: '' };
  if (a === 'wobble') return { outer: 'cw-anim-wobble', inner: '' };
  if (a === 'pulse') return { outer: '', inner: 'cw-anim-pulse' };
  if (a === 'glow') return { outer: '', inner: 'cw-anim-glow' };
  if (a === 'shine') return { outer: '', inner: 'cw-anim-shine' };
  return { outer: '', inner: '' };
}

/* ══════════════════════════════════════════════════════════════════════════
   SHARED UI PRIMITIVES
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Color Swatch Input ─────────────────────────────────────────────────── */

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const colorRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value.toUpperCase());

  useEffect(() => {
    // Clamps/adjusts local state in response to a changing dependency
    // (e.g. pagination bounds, active tab) — reviewed; not a
    // derive-state-from-render antipattern in this context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(value.toUpperCase());
  }, [value]);

  function handleTextChange(raw: string) {
    const next = raw.startsWith('#') ? raw : `#${raw}`;
    const normalized = `#${next.replace('#', '').slice(0, 6)}`.toUpperCase();

    if (!/^#[0-9A-F]{0,6}$/.test(normalized)) return;

    setDraft(normalized);
    if (/^#[0-9A-F]{6}$/.test(normalized)) {
      onChange(normalized);
    }
  }

  return (
    <div className='flex-1'>
      <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
        {label}
      </div>
      <div
        className='flex min-h-10 cursor-pointer items-center gap-3 rounded-(--radius-control) border border-gray-300 bg-white px-3 py-2 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900'
        onClick={() => colorRef.current?.click()}
      >
        <div
          className='h-7 w-7 shrink-0 rounded-(--radius-control) border border-gray-300 dark:border-gray-700'
          style={{ background: value }}
        />
        <input
          ref={colorRef}
          type='color'
          value={value}
          onChange={(e) => {
            const next = e.target.value.toUpperCase();
            setDraft(next);
            onChange(next);
          }}
          className='absolute h-0 w-0 border-none p-0 opacity-0'
        />
        <input
          type='text'
          value={draft}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={() => {
            if (!/^#[0-9A-F]{6}$/.test(draft)) {
              setDraft(value.toUpperCase());
            }
          }}
          className='w-full bg-transparent font-mono type-small font-medium text-gray-800 outline-none dark:text-white/90'
        />
      </div>
    </div>
  );
}

/* ── Toggle Switch ──────────────────────────────────────────────────────── */

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return <UiSwitch checked={checked} onChange={onChange} />;
}

/* ── Toggle Row ─────────────────────────────────────────────────────────── */

function ToggleRow({
  title,
  desc,
  checked,
  onChange,
  mb = 18,
  large,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  mb?: number;
  large?: boolean;
}) {
  return (
    <div
      className='flex min-h-10 items-center justify-between gap-4'
      style={{ marginBottom: mb }}
    >
      <div>
        <div
          className={cn(
            'mb-0.5 font-semibold text-gray-800 dark:text-white/90',
            large ? 'type-body' : 'type-small',
          )}
        >
          {title}
        </div>
        {desc && (
          <div
            className={cn(
              large ? 'type-body' : 'type-small',
              'text-gray-400 dark:text-gray-500',
            )}
          >
            {desc}
          </div>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

/* ── Segmented control ─────────────────────────────────────────────────── */

function Segmented({
  options,
  value,
  onChange,
  accent,
}: {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
  accent: string;
}) {
  return (
    <div className='inline-flex flex-wrap gap-0.5 rounded-(--radius-control) border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-white/3'>
      {options.map((o) => {
        const sel = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              'min-h-8.5 rounded-(--radius-control) px-3.5 py-1.5 type-small font-medium transition',
              sel
                ? 'text-white shadow-theme-xs'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            )}
            style={sel ? { background: accent } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Text field ─────────────────────────────────────────────────────────── */

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mb = 16,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  mb?: number;
}) {
  return (
    <div style={{ marginBottom: mb }}>
      <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
        {label}
      </div>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className='h-10 rounded-(--radius-control) border-gray-300 px-4 py-2 type-small text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus-visible:border-brand-300 focus-visible:ring-3 focus-visible:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus-visible:border-brand-800'
      />
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────────────────── */

function SectionHeader({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className='mb-4.5 flex items-center gap-3'>
      <h2 className='type-body font-semibold text-gray-800 dark:text-white/90'>
        {title}
      </h2>
      {badge && <Badge color='primary'>{badge}</Badge>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   EDITORS: Custom Field, Topic, FAQ
   ══════════════════════════════════════════════════════════════════════════ */

function CustomFieldEditor({
  field,
  index,
  onUpdate,
  onRemove,
}: {
  field: CustomDetailField;
  index: number;
  onUpdate: (index: number, patch: Partial<CustomDetailField>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className='rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-700 dark:bg-gray-900'>
      <div className='mb-2.5 grid grid-cols-[1fr_120px] gap-3'>
        <div>
          <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
            Question
          </div>
          <Input
            value={field.label}
            onChange={(e) => onUpdate(index, { label: e.target.value })}
            placeholder='What service are you looking for?'
            className='h-auto py-2 type-small'
          />
        </div>
        <div>
          <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
            Type
          </div>
          <select
            value={field.type}
            onChange={(e) =>
              onUpdate(index, {
                type: e.target.value as CustomDetailField['type'],
              })
            }
            className='h-9 w-full rounded-(--radius-control) border border-gray-300 bg-transparent px-3 type-small text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
          >
            <option value='text'>Text</option>
            <option value='number'>Number</option>
          </select>
        </div>
      </div>
      <div className='mb-2.5'>
        <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
          Placeholder
        </div>
        <Input
          value={field.placeholder || ''}
          onChange={(e) => onUpdate(index, { placeholder: e.target.value })}
          placeholder='Enter answer...'
          className='h-auto py-2 type-small'
        />
      </div>
      <div className='flex items-center justify-between gap-3'>
        <Button
          type='button'
          variant='outline'
          size='xs'
          className='border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10'
          onClick={() => onRemove(index)}
        >
          <Trash2 size={12} /> Remove
        </Button>
      </div>
    </div>
  );
}

function TopicEditor({
  topics,
  onChange,
}: {
  topics: ContactTopic[];
  onChange: (t: ContactTopic[]) => void;
}) {
  return (
    <div className='flex flex-col gap-2'>
      {topics.map((t, i) => (
        <div key={i} className='flex items-center gap-2'>
          <Input
            value={t.label}
            onChange={(e) =>
              onChange(
                topics.map((x, j) =>
                  j === i ? { ...x, label: e.target.value } : x,
                ),
              )
            }
            placeholder='Topic label (e.g. Billing question)'
            className='h-auto flex-1 py-2 type-body'
          />
          <Button
            type='button'
            variant='outline'
            size='icon-sm'
            className='shrink-0 border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10'
            onClick={() => onChange(topics.filter((_, j) => j !== i))}
          >
            <X size={14} />
          </Button>
        </div>
      ))}
      <Button
        type='button'
        variant='outline'
        className='w-full border-dashed text-gray-500 dark:text-gray-400'
        onClick={() => onChange([...topics, { icon: '', label: '' }])}
      >
        <Plus size={14} /> Add Contact Topic
      </Button>
    </div>
  );
}

function FaqEditor({
  items,
  onChange,
}: {
  items: FaqItem[];
  onChange: (f: FaqItem[]) => void;
}) {
  return (
    <div className='flex flex-col gap-3'>
      {items.map((f, i) => (
        <div
          key={i}
          className='rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900'
        >
          <Input
            value={f.q}
            onChange={(e) =>
              onChange(
                items.map((x, j) =>
                  j === i ? { ...x, q: e.target.value } : x,
                ),
              )
            }
            placeholder='Question — e.g. What are your opening hours?'
            className='mb-2 h-auto py-2 type-body font-semibold'
          />
          <textarea
            value={f.a}
            onChange={(e) =>
              onChange(
                items.map((x, j) =>
                  j === i ? { ...x, a: e.target.value } : x,
                ),
              )
            }
            placeholder='Answer shown to visitors…'
            rows={2}
            className='mb-2 w-full resize-y rounded-(--radius-control) border border-gray-300 bg-transparent px-3 py-2 type-body text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
          />
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='border-error-200 type-small text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10'
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={16} /> Remove
          </Button>
        </div>
      ))}
      <Button
        type='button'
        variant='outline'
        className='w-full border-dashed text-gray-500 dark:text-gray-400'
        onClick={() => onChange([...items, { q: '', a: '' }])}
      >
        <Plus size={14} /> Add FAQ Article
      </Button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PROACTIVE RULES
   ══════════════════════════════════════════════════════════════════════════ */

const RULE_TEMPLATES: Array<{
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  desc: string;
  build: () => Omit<ProactiveRule, 'id'>;
}> = [
  {
    name: 'Pricing hesitation',
    icon: DollarSign,
    desc: 'Visitor lingers on your pricing page',
    build: () => ({
      name: 'Pricing hesitation',
      enabled: true,
      priority: 5,
      message: 'Any questions about pricing? I can help.',
      conditions: {
        path_match: '/pricing*',
        time_on_page_ms: 30000,
        widget_never_opened: true,
      },
    }),
  },
  {
    name: 'Product interest',
    icon: ShoppingBag,
    desc: 'Visitor spent time on a product page',
    build: () => ({
      name: 'Product interest',
      enabled: true,
      priority: 4,
      message: 'Curious about this product? Happy to answer any questions!',
      conditions: {
        path_match: '/products/*',
        time_on_page_ms: 45000,
        widget_never_opened: true,
      },
    }),
  },
  {
    name: 'Exit intent',
    icon: LogOut,
    desc: 'Visitor about to leave the page',
    build: () => ({
      name: 'Exit intent',
      enabled: true,
      priority: 10,
      message: 'Before you go — is there anything I can help with?',
      conditions: {
        exit_intent: true,
        min_pageviews: 2,
        widget_never_opened: true,
      },
    }),
  },
  {
    name: 'Deep engagement',
    icon: BookOpen,
    desc: 'Visitor scrolled through most of a page',
    build: () => ({
      name: 'Deep engagement',
      enabled: true,
      priority: 3,
      message: 'Enjoying the article? Let me know if you have questions.',
      conditions: {
        min_scroll_pct: 75,
        time_on_page_ms: 20000,
        widget_never_opened: true,
      },
    }),
  },
  {
    name: 'Welcome new visitor',
    icon: Sparkles,
    desc: 'First-time visitor spent 10 seconds',
    build: () => ({
      name: 'Welcome new visitor',
      enabled: true,
      priority: 1,
      message: 'Hi there! First time here? I can help you get started.',
      conditions: {
        time_on_page_ms: 10000,
        returning_visitor: false,
        widget_never_opened: true,
      },
    }),
  },
  {
    name: 'Welcome back',
    icon: Handshake,
    desc: 'Returning visitor greeting',
    build: () => ({
      name: 'Welcome back',
      enabled: true,
      priority: 2,
      message: 'Welcome back! Need help with anything today?',
      conditions: {
        time_on_page_ms: 8000,
        returning_visitor: true,
        widget_never_opened: true,
      },
    }),
  },
];

function newRuleId() {
  return 'rule_' + Math.random().toString(36).slice(2, 9);
}

function summarizeConditions(c: ProactiveRuleConditions): string {
  const parts: string[] = [];
  if (c.path_match) parts.push(`on ${c.path_match}`);
  if (c.time_on_page_ms)
    parts.push(`after ${Math.round(c.time_on_page_ms / 1000)}s`);
  if (c.min_scroll_pct) parts.push(`scrolled ≥${c.min_scroll_pct}%`);
  if (c.exit_intent) parts.push('on exit intent');
  if (c.min_pageviews) parts.push(`viewed ${c.min_pageviews}+ pages`);
  if (c.returning_visitor === true) parts.push('returning visitors');
  if (c.returning_visitor === false) parts.push('new visitors');
  if (c.referrer_contains) parts.push(`from ${c.referrer_contains}`);
  return parts.length ? parts.join(' · ') : 'always';
}

function normalizePathPattern(input: string): string | undefined {
  if (!input) return undefined;
  let s = String(input).trim();
  if (!s) return undefined;
  if (s === '*') return '*';
  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s);
      s = u.pathname + (u.search || '') + (u.hash || '');
    } else if (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s)) {
      s = s.replace(/^[a-z0-9.-]+\.[a-z]{2,}/i, '');
    }
  } catch {
    /* fall through */
  }
  if (s && !s.startsWith('/') && !s.startsWith('*')) s = '/' + s;
  if (s.length > 1 && s.endsWith('/') && !s.endsWith('/*')) s = s.slice(0, -1);
  return s || undefined;
}

function ProactiveRuleCard({
  rule,
  onUpdate,
  onDelete,
}: {
  rule: ProactiveRule;
  onUpdate: (r: ProactiveRule) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cond = rule.conditions || {};
  const patchCond = (p: Partial<ProactiveRuleConditions>) =>
    onUpdate({ ...rule, conditions: { ...cond, ...p } });

  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-200 bg-white p-3.5 transition-opacity dark:border-gray-700 dark:bg-gray-900',
        !rule.enabled && 'opacity-55',
      )}
    >
      <div className={cn('flex items-center gap-3', expanded && 'mb-3.5')}>
        <Toggle
          checked={rule.enabled}
          onChange={(v) => onUpdate({ ...rule, enabled: v })}
        />
        <div className='min-w-0 flex-1'>
          <div className='truncate type-small font-semibold text-gray-800 dark:text-white/90'>
            {rule.name || 'Untitled rule'}
          </div>
          <div className='mt-0.5 type-caption text-gray-400 dark:text-gray-500'>
            {summarizeConditions(cond)}
          </div>
        </div>
        <Button
          type='button'
          variant='outline'
          size='xs'
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Done' : 'Edit'}
        </Button>
      </div>

      {expanded && (
        <div className='flex flex-col gap-3'>
          <div>
            <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
              Rule name (internal)
            </div>
            <Input
              value={rule.name}
              onChange={(e) => onUpdate({ ...rule, name: e.target.value })}
              placeholder='e.g. Pricing hesitation'
              className='h-auto py-2 type-small'
            />
          </div>

          <div>
            <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
              Message shown to visitor
            </div>
            <textarea
              value={rule.message}
              onChange={(e) => onUpdate({ ...rule, message: e.target.value })}
              placeholder='Any questions about pricing? I can help.'
              rows={2}
              className='w-full resize-y rounded-(--radius-control) border border-gray-300 bg-transparent px-3 py-2 type-small text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
            />
          </div>

          <div className='grid grid-cols-2 gap-3'>
            <div>
              <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
                Page URL
                <span className='ml-1.5 font-normal opacity-70'>
                  · leave blank to match every page
                </span>
              </div>
              <Input
                value={cond.path_match || ''}
                onChange={(e) =>
                  patchCond({ path_match: e.target.value || undefined })
                }
                onBlur={(e) => {
                  const normalized = normalizePathPattern(e.target.value);
                  if (normalized !== cond.path_match)
                    patchCond({ path_match: normalized });
                }}
                placeholder='e.g. /careers or /products/* or paste a URL'
                className='h-auto py-2 font-mono type-small'
              />
              {cond.path_match && (
                <div className='mt-1.5 text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500'>
                  Fires when the visitor is on a URL matching{' '}
                  <b className='text-gray-500 dark:text-gray-400'>
                    {cond.path_match}
                  </b>
                  .{' '}
                  {cond.path_match.includes('*')
                    ? 'The * is a wildcard for any characters.'
                    : "Add * at the end to include sub-pages (e.g. '/careers*' also matches '/careers/senior')."}
                </div>
              )}
            </div>
            <div>
              <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
                Priority
                <span className='ml-1.5 font-normal opacity-70'>
                  · higher wins if multiple match
                </span>
              </div>
              <Input
                type='number'
                value={rule.priority}
                onChange={(e) =>
                  onUpdate({ ...rule, priority: Number(e.target.value) || 0 })
                }
                min={0}
                max={100}
                className='h-auto py-2 type-small'
              />
            </div>
          </div>

          <div>
            <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
              Time on page — {(cond.time_on_page_ms || 0) / 1000}s
            </div>
            <input
              type='range'
              min={0}
              max={120000}
              step={5000}
              value={cond.time_on_page_ms || 0}
              onChange={(e) =>
                patchCond({
                  time_on_page_ms: Number(e.target.value) || undefined,
                })
              }
              className='w-full accent-brand-500'
            />
          </div>

          <div>
            <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
              Min scroll depth — {cond.min_scroll_pct ?? 0}%
            </div>
            <input
              type='range'
              min={0}
              max={100}
              step={5}
              value={cond.min_scroll_pct || 0}
              onChange={(e) =>
                patchCond({
                  min_scroll_pct: Number(e.target.value) || undefined,
                })
              }
              className='w-full accent-brand-500'
            />
          </div>

          <ToggleRow
            title='Fire on exit intent'
            desc='Visitor appears to be leaving (cursor exit, fast upward movement, or tab switch)'
            checked={!!cond.exit_intent}
            onChange={(v) => patchCond({ exit_intent: v || undefined })}
            mb={0}
          />

          <ToggleRow
            title='Only if widget has not been opened yet'
            desc='Skip visitors who already engaged with the chat'
            checked={cond.widget_never_opened !== false}
            onChange={(v) => patchCond({ widget_never_opened: v })}
            mb={0}
          />

          <div>
            <div className='mb-1.5 type-caption font-semibold text-gray-400 dark:text-gray-500'>
              Show for
            </div>
            <Segmented
              options={[
                { id: 'any', label: 'All visitors' },
                { id: 'new', label: 'New only' },
                { id: 'returning', label: 'Returning only' },
              ]}
              value={
                cond.returning_visitor === true
                  ? 'returning'
                  : cond.returning_visitor === false
                    ? 'new'
                    : 'any'
              }
              onChange={(v) =>
                patchCond({
                  returning_visitor:
                    v === 'returning' ? true : v === 'new' ? false : null,
                })
              }
              accent='#465FFF'
            />
          </div>

          <Button
            type='button'
            variant='outline'
            size='sm'
            className='self-start border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10'
            onClick={onDelete}
          >
            <Trash2 size={13} /> Delete rule
          </Button>
        </div>
      )}
    </div>
  );
}

function ProactiveRulesSection({
  rules,
  onChange,
}: {
  rules: ProactiveRule[];
  onChange: (r: ProactiveRule[]) => void;
}) {
  const [showTemplates, setShowTemplates] = useState(false);

  const addFromTemplate = (t: (typeof RULE_TEMPLATES)[number]) => {
    onChange([{ id: newRuleId(), ...t.build() }, ...rules]);
    setShowTemplates(false);
  };
  const addBlank = () => {
    onChange([
      {
        id: newRuleId(),
        name: 'New rule',
        enabled: true,
        priority: 0,
        message: '',
        conditions: { widget_never_opened: true, time_on_page_ms: 20000 },
      },
      ...rules,
    ]);
    setShowTemplates(false);
  };

  return (
    <div className='flex flex-col gap-3'>
      {rules.length === 0 && (
        <div className='rounded-2xl border border-dashed border-gray-300 px-4 py-4.5 text-center type-caption font-medium leading-relaxed text-gray-400 dark:border-gray-700 dark:text-gray-500'>
          No proactive rules yet.
          <br />
          Add one below to nudge visitors when they hesitate, exit, or scroll
          deep.
        </div>
      )}
      {rules.map((r, i) => (
        <ProactiveRuleCard
          key={r.id}
          rule={r}
          onUpdate={(updated) =>
            onChange(rules.map((x, j) => (j === i ? updated : x)))
          }
          onDelete={() => onChange(rules.filter((_, j) => j !== i))}
        />
      ))}

      {showTemplates ? (
        <div className='rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-white/2'>
          <div className='mb-2.5 type-caption font-semibold text-gray-800 dark:text-white/90'>
            Start from a template
          </div>
          <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
            {RULE_TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.name}
                  onClick={() => addFromTemplate(t)}
                  className='flex items-start gap-2 rounded-(--radius-control) border border-gray-200 bg-white p-2.5 text-left dark:border-gray-700 dark:bg-gray-900'
                >
                  <Icon
                    size={16}
                    className='mt-0.5 shrink-0 text-gray-400 dark:text-gray-500'
                  />
                  <div className='min-w-0'>
                    <div className='type-caption font-semibold text-gray-800 dark:text-white/90'>
                      {t.name}
                    </div>
                    <div className='mt-0.5 text-[10.5px] leading-relaxed text-gray-400 dark:text-gray-500'>
                      {t.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className='mt-2.5 flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='flex-1'
              onClick={addBlank}
            >
              Blank rule
            </Button>
            <Button
              variant='outline'
              size='sm'
              className='flex-1'
              onClick={() => setShowTemplates(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant='outline'
          className='w-full border-dashed text-gray-500 dark:text-gray-400'
          onClick={() => setShowTemplates(true)}
        >
          <Plus size={14} /> Add Proactive Rule
        </Button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALL / EMBED HELPERS  (moved from WebsiteWidgetModal)
   ══════════════════════════════════════════════════════════════════════════ */

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
      type='button'
      onClick={onClick}
      style={{
        height: 32,
        padding: '0 12px',
        borderRadius: 10,
        whiteSpace: 'nowrap',
        border: '1px solid rgba(70,95,255,0.32)',
        background: 'rgba(70,95,255,0.12)',
        color: isDark ? '#9CB9FF' : '#465FFF',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        flex: '0 0 auto',
      }}
    >
      {label}
    </button>
  );
}

function highlightKeywords(
  text: string,
  keywordColor: string,
  tagColor: string,
  defaultColor: string,
): React.ReactNode {
  const commentMatch = /(\/\/.*$|\/\*.*?\*\/|<!--.*?-->)/.test(text);
  if (
    commentMatch &&
    (text.trim().startsWith('//') || text.trim().startsWith('<!--'))
  ) {
    return (
      <span style={{ color: 'rgba(148,163,184,0.5)', fontStyle: 'italic' }}>
        {text}
      </span>
    );
  }
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;
  const combined =
    /\b(import|from|export|default|function|return|const|let|var|if|async|true|false|null)\b|(<\/?[\w-]+|>|\/>)/g;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, match.index)}</span>);
    }
    const isTag =
      match[0].startsWith('<') || match[0] === '>' || match[0] === '/>';
    parts.push(
      <span key={key++} style={{ color: isTag ? tagColor : keywordColor }}>
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length)
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  return parts.length ? <>{parts}</> : text;
}

function colorize(line: string, isDark: boolean): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(["'`])(.*?)\1/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  const stringColor = isDark ? '#A5D6FF' : '#0550AE';
  const keywordColor = isDark ? '#D2A8FF' : '#8250DF';
  const tagColor = isDark ? '#7EE787' : '#116329';
  const defaultColor = isDark ? '#E2E8F0' : '#0F172A';
  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} style={{ color: defaultColor }}>
          {highlightKeywords(
            line.slice(lastIndex, match.index),
            keywordColor,
            tagColor,
            defaultColor,
          )}
        </span>,
      );
    }
    parts.push(
      <span key={key++} style={{ color: stringColor }}>
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) {
    parts.push(
      <span key={key++} style={{ color: defaultColor }}>
        {highlightKeywords(
          line.slice(lastIndex),
          keywordColor,
          tagColor,
          defaultColor,
        )}
      </span>,
    );
  }
  return parts.length ? (
    <>{parts}</>
  ) : (
    <span style={{ color: defaultColor }}>{line}</span>
  );
}

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
        margin: 0,
        padding: 14,
        borderRadius: 12,
        background: isDark ? 'rgba(0,0,0,0.35)' : '#F1F5F9',
        border: isDark
          ? '1px solid rgba(255,255,255,0.06)'
          : '1px solid rgba(15,23,42,0.08)',
        overflow: 'auto',
        fontSize: 12,
        lineHeight: 1.65,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ display: 'flex', minHeight: 20 }}>
          {showLineNumbers && (
            <span
              style={{
                flex: '0 0 32px',
                textAlign: 'right',
                paddingRight: 12,
                color: isDark
                  ? 'rgba(148,163,184,0.35)'
                  : 'rgba(100,116,139,0.4)',
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

/* ── data: builder platform instructions ───────────────────────────────── */

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
        tip: "Not sure where to paste it? Use the plugin's Footer Scripts or Custom Code section.",
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
        tip: "This works for all Shopify themes. The script loads asynchronously and won't slow down your store.",
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
        tip: "If you don't see Custom Code, you may need a Wix Premium plan.",
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
          "Find your platform's custom code or footer section.",
          'Paste the script before the closing </body> tag.',
          'Save and publish.',
        ],
        tip: 'Most website builders have a "Custom Code" or "Footer Scripts" section in settings.',
      };
  }
}

/* ── data: framework code snippets ─────────────────────────────────────── */

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
        subtitle:
          "Add to your theme's footer.php or use a code snippets plugin.",
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
        subtitle:
          'Add this script before the closing </body> tag on your site.',
        code: `<!-- Lashvae Chat Widget -->
<script
  src="https://api.thundertribes.com/widget/embed.js"
  data-widget-id="${widgetKey}"
  async
></script>`,
        note: "This works on any platform. The script loads asynchronously and won't affect page performance.",
      };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   INSTALL GUIDE COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

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
  const platforms: { key: BuilderPlatform; label: string; logo?: string }[] = [
    { key: 'wordpress', label: 'WordPress', logo: '/brand-logo/wordpress.png' },
    { key: 'shopify', label: 'Shopify', logo: '/brand-logo/shopify.png' },
    { key: 'webflow', label: 'Webflow', logo: '/brand-logo/webflow.png' },
    { key: 'wix', label: 'Wix', logo: '/brand-logo/wix.png' },
    {
      key: 'squarespace',
      label: 'Squarespace',
      logo: '/brand-logo/squarespace.png',
    },
    { key: 'other', label: 'Other' },
  ];
  const instructions = getBuilderInstructions(platform, widgetKey);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: textMuted,
            marginBottom: 10,
          }}
        >
          Choose your platform
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {platforms.map(({ key, label, logo }) => {
            const active = platform === key;
            return (
              <button
                key={key}
                type='button'
                onClick={() => setPlatform(key)}
                style={{
                  height: 42,
                  padding: '0 18px',
                  borderRadius: 10,
                  border: active
                    ? '1.5px solid rgba(70,95,255,0.50)'
                    : `1px solid ${borderCol}`,
                  background: active
                    ? isDark
                      ? 'rgba(70,95,255,0.14)'
                      : 'rgba(70,95,255,0.07)'
                    : 'transparent',
                  color: active
                    ? isDark
                      ? '#9CB9FF'
                      : '#465FFF'
                    : isDark
                      ? 'rgba(226,232,240,0.6)'
                      : '#64748B',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all .15s ease',
                }}
              >
                {logo && (
                  <img
                    src={logo}
                    alt=''
                    width={18}
                    height={18}
                    style={{ objectFit: 'contain' }}
                  />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderRadius: 16,
          background: cardBg,
          border: `1px solid ${borderCol}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: textPrimary,
              }}
            >
              {instructions.title}
            </div>
            <CopyButton
              isDark={isDark}
              label={copiedKey === 'builder-code' ? 'Copied!' : 'Copy Code'}
              onClick={() => onCopy(embedCode, 'builder-code')}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 16,
              alignItems: 'start',
            }}
          >
            <div>
              {instructions.steps.map((step, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 10,
                    marginBottom: 10,
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: textSecondary,
                  }}
                >
                  <span
                    style={{
                      flex: '0 0 auto',
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      background: isDark
                        ? 'rgba(70,95,255,0.15)'
                        : 'rgba(70,95,255,0.08)',
                      color: isDark ? '#A5B4FC' : '#465FFF',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
            <CodeBlock
              isDark={isDark}
              code={embedCode}
              showLineNumbers={false}
            />
          </div>

          {instructions.tip && (
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                lineHeight: 1.6,
                color: textMuted,
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
              }}
            >
              <Info size={14} style={{ flex: '0 0 auto', marginTop: 1 }} />
              {instructions.tip}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

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
  const frameworks: { key: CodeFramework; label: string; logo?: string }[] = [
    { key: 'html', label: 'HTML' },
    { key: 'react', label: 'React' },
    { key: 'nextjs', label: 'Next.js' },
    { key: 'wordpress', label: 'WordPress', logo: '/brand-logo/wordpress.png' },
    { key: 'shopify', label: 'Shopify', logo: '/brand-logo/shopify.png' },
    { key: 'webflow', label: 'Webflow', logo: '/brand-logo/webflow.png' },
    { key: 'angular', label: 'Angular' },
    { key: 'other', label: 'Other' },
  ];
  const snippet = getFrameworkSnippet(framework, widgetKey);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '.1em',
            textTransform: 'uppercase',
            color: textMuted,
            marginBottom: 10,
          }}
        >
          Install on
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {frameworks.map(({ key, label, logo }) => {
            const active = framework === key;
            return (
              <button
                key={key}
                type='button'
                onClick={() => setFramework(key)}
                style={{
                  height: 34,
                  padding: '0 13px',
                  borderRadius: 10,
                  border: active
                    ? '1.5px solid rgba(70,95,255,0.50)'
                    : `1px solid ${borderCol}`,
                  background: active
                    ? isDark
                      ? 'rgba(70,95,255,0.14)'
                      : 'rgba(70,95,255,0.07)'
                    : 'transparent',
                  color: active
                    ? isDark
                      ? '#9CB9FF'
                      : '#465FFF'
                    : isDark
                      ? 'rgba(226,232,240,0.6)'
                      : '#64748B',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all .15s ease',
                }}
              >
                {logo && (
                  <img
                    src={logo}
                    alt=''
                    width={13}
                    height={13}
                    style={{ objectFit: 'contain' }}
                  />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        style={{
          borderRadius: 16,
          background: cardBg,
          border: `1px solid ${borderCol}`,
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: textPrimary,
                }}
              >
                {snippet.title}
              </div>
              <div
                style={{
                  fontSize: 13.5,
                  marginTop: 4,
                  lineHeight: 1.5,
                  color: textSecondary,
                }}
              >
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
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                lineHeight: 1.6,
                color: textMuted,
                display: 'flex',
                gap: 6,
                alignItems: 'flex-start',
              }}
            >
              <Info size={14} style={{ flex: '0 0 auto', marginTop: 1 }} />
              {snippet.note}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

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
        borderRadius: 16,
        background: cardBg,
        border: `1px solid ${borderCol}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: isDark
                ? 'rgba(70,95,255,0.12)'
                : 'rgba(70,95,255,0.07)',
              display: 'grid',
              placeItems: 'center',
              color: isDark ? '#9CB9FF' : '#465FFF',
            }}
          >
            <Send size={18} />
          </span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: textPrimary }}>
              Send this to your developer
            </div>
            <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
              Don&apos;t know how your website is built? Copy this message and send
              it to whoever manages your site.
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9',
            border: isDark
              ? '1px solid rgba(255,255,255,0.06)'
              : '1px solid rgba(15,23,42,0.08)',
            fontSize: 12.5,
            lineHeight: 1.7,
            color: isDark ? 'rgba(226,232,240,0.72)' : '#334155',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            maxHeight: 260,
            overflow: 'auto',
          }}
        >
          {devMessage}
        </div>

        <button
          type='button'
          onClick={() => onCopy(devMessage, 'dev-message')}
          style={{
            marginTop: 12,
            width: '100%',
            height: 42,
            borderRadius: 13,
            border: '1px solid rgba(70,95,255,0.35)',
            background: 'rgba(70,95,255,0.12)',
            color: isDark ? '#9CB9FF' : '#465FFF',
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          {copiedKey === 'dev-message' ? (
            <>
              <Check size={14} /> Copied!
            </>
          ) : (
            <>
              <Copy size={14} /> Copy Message
            </>
          )}
        </button>
      </div>
    </div>
  );
}

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
        borderRadius: 16,
        background: cardBg,
        border: `1px solid ${borderCol}`,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '.02em',
                color: isDark ? '#94A3B8' : '#64748B',
              }}
            >
              Temporary Console Preview
            </div>
            <div
              style={{
                fontSize: 14,
                marginTop: 5,
                lineHeight: 1.6,
                color: textSecondary,
              }}
            >
              Paste this in the browser console to preview the chatbot before
              integration.
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
            marginTop: 14,
            padding: 13,
            borderRadius: 14,
            background: isDark
              ? 'rgba(59,130,246,0.08)'
              : 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.18)',
            fontSize: 14,
            lineHeight: 1.7,
            color: isDark ? 'rgba(226,232,240,0.62)' : '#475569',
          }}
        >
          <strong style={{ color: isDark ? '#DBEAFE' : '#1D4ED8' }}>
            How to test:
          </strong>
          <br />
          1. Open the client website in Chrome.
          <br />
          2. Right-click anywhere → <b>Inspect</b>.<br />
          3. Open the <b>Console</b> tab.
          <br />
          4. Paste the script and press Enter.
          <br />
          5. The chatbot bubble should appear instantly.
        </div>
      </div>
    </div>
  );
}

/* ── Disconnect confirmation modal ─────────────────────────────────────── */

function DisconnectConfirmModal({
  saving,
  onCancel,
  onConfirm,
}: {
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className='fixed inset-0 z-100 flex items-center justify-center bg-gray-400/50 p-4 backdrop-blur-[10px] dark:bg-black/70'
    >
      <div className='w-full max-w-105 rounded-2xl border border-error-200 bg-white p-6 shadow-theme-xl dark:border-error-500/30 dark:bg-gray-900'>
        <div className='mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl bg-error-50 text-error-500 dark:bg-error-500/15 dark:text-error-400'>
          <AlertTriangle size={22} />
        </div>

        <div className='mb-2 type-card-title font-semibold text-gray-800 dark:text-white/90'>
          Disconnect website chatbot?
        </div>

        <div className='type-small leading-relaxed text-gray-500 dark:text-gray-400'>
          The installed widget will stop working on your website. Visitors will
          not be able to chat until you enable it again.
        </div>

        <div className='mt-5.5 flex justify-end gap-3'>
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type='button'
            variant='destructive'
            onClick={onConfirm}
            disabled={saving}
          >
            {saving ? 'Disconnecting...' : 'Yes, disconnect'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LIVE PREVIEW — tabbed mini-app (Home / Chat / Help / Survey)
   Preserved exactly from original — fully interactive.
   ══════════════════════════════════════════════════════════════════════════ */

type PreviewProps = {
  brandColor: string;
  widgetTitle: string;
  greetingText: string;
  avatarUrl: string;
  collectName: boolean;
  collectEmail: boolean;
  customDetails: boolean;
  customDetailsFields: CustomDetailField[];
  adv: AdvancedConfig;
  dashboardDark: boolean;
  device: 'desktop' | 'mobile';
};

/* Hoisted to module scope — this was previously defined inside
   LivePreview's render body on every render, which is a real bug
   (React treats a new function identity as a different component type
   each render, discarding any internal state and remounting
   needlessly). Takes `avatarUrl` as an explicit prop instead of
   closing over it. */
function AvatarThumb({ size, avatarUrl }: { size: number; avatarUrl: string }) {
  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt=''
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        objectFit: 'cover',
      }}
    />
  ) : (
    <svg viewBox='0 0 24 24' width={size} height={size} fill='#fff'>
      <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z' />
    </svg>
  );
}

function LivePreview({
  brandColor,
  widgetTitle,
  greetingText,
  avatarUrl,
  collectName,
  collectEmail,
  customDetails,
  customDetailsFields,
  adv,
  dashboardDark,
  device,
}: PreviewProps) {
  const widgetDark =
    adv.widget_theme === 'dark' ||
    (adv.widget_theme === 'auto' && dashboardDark);

  const [tab, setTab] = useState<'home' | 'chat' | 'help' | 'survey'>(
    adv.enable_home ? 'home' : 'chat',
  );
  const [stars, setStars] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    // Clamps/adjusts local state in response to a changing dependency
    // (e.g. pagination bounds, active tab) — reviewed; not a
    // derive-state-from-render antipattern in this context.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!adv.enable_home && tab === 'home') setTab('chat');
    if (!adv.enable_faq && tab === 'help')
      setTab(adv.enable_home ? 'home' : 'chat');
    if (!adv.enable_survey && tab === 'survey')
      setTab(adv.enable_home ? 'home' : 'chat');
  }, [adv.enable_home, adv.enable_faq, adv.enable_survey, tab]);

  const R = RADIUS_PRESETS[adv.corner_radius] || RADIUS_PRESETS.soft;
  const font =
    WIDGET_FONTS.find((f) => f.id === adv.font_family)?.stack ||
    WIDGET_FONTS[0].stack;

  const panelBg = widgetDark ? '#111827' : '#f8fafc';
  const cardBg = widgetDark ? '#1f2937' : '#ffffff';
  const topicCardBg = widgetDark ? 'rgba(255,255,255,.04)' : '#ffffff';
  const cardShadow = widgetDark
    ? '0 14px 34px rgba(0,0,0,.35)'
    : '0 10px 26px rgba(15,23,42,.07)';
  const textMain = widgetDark ? '#f1f5f9' : '#111827';
  const textSub = widgetDark ? 'rgba(226,232,240,.68)' : '#667085';
  const faintBorder = widgetDark ? 'rgba(255,255,255,.09)' : '#e5e7eb';
  const heroText = '#ffffff';

  const width = device === 'mobile' ? 342 : 372;
  const height = device === 'mobile' ? 610 : 636;

  const showForm =
    collectName ||
    collectEmail ||
    (customDetails && customDetailsFields.length > 0);

  const tabs: Array<{ id: typeof tab; label: string; icon: React.ReactNode }> =
    [];
  if (adv.enable_home)
    tabs.push({
      id: 'home',
      label: 'Home',
      icon: (
        <svg
          viewBox='0 0 24 24'
          width='21'
          height='21'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.8'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <path d='M4 11.5 12 4l8 7.5' />
          <path d='M6.5 10.5v8.2c0 .7.6 1.3 1.3 1.3h8.4c.7 0 1.3-.6 1.3-1.3v-8.2' />
        </svg>
      ),
    });
  tabs.push({
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg
        viewBox='0 0 24 24'
        width='21'
        height='21'
        fill='none'
        stroke='currentColor'
        strokeWidth='1.8'
        strokeLinecap='round'
        strokeLinejoin='round'
      >
        <path d='M21 11.5a8.4 8.4 0 0 1-8.8 8.2 9.3 9.3 0 0 1-3.7-.9L3 20l1.2-5.1a8.2 8.2 0 0 1-.7-3.4 8.5 8.5 0 0 1 17 0Z' />
      </svg>
    ),
  });
  if (adv.enable_faq)
    tabs.push({
      id: 'help',
      label: 'Help',
      icon: (
        <svg
          viewBox='0 0 24 24'
          width='21'
          height='21'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.8'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <circle cx='12' cy='12' r='8.5' />
          <path d='M9.7 9.2a2.5 2.5 0 0 1 4.8.9c0 1.9-2.5 2.1-2.5 4' />
          <path d='M12 17.2h.01' />
        </svg>
      ),
    });
  if (adv.enable_survey)
    tabs.push({
      id: 'survey',
      label: 'Survey',
      icon: (
        <svg
          viewBox='0 0 24 24'
          width='21'
          height='21'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.8'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <path d='m12 3.5 2.55 5.16 5.7.83-4.12 4.02.97 5.67L12 16.5l-5.1 2.68.97-5.67-4.12-4.02 5.7-.83L12 3.5Z' />
        </svg>
      ),
    });

  const floatCard = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: cardBg,
    borderRadius: Math.max(R.card, 16),
    boxShadow: cardShadow,
    border: `1px solid ${faintBorder}`,
    ...extra,
  });

  const inputGhost: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 14px',
    borderRadius: Math.max(R.input, 12),
    border: `1px solid ${widgetDark ? 'rgba(255,255,255,.12)' : '#e5e7eb'}`,
    marginBottom: 10,
    fontSize: 13.5,
    color: widgetDark ? 'rgba(226,232,240,.45)' : '#9ca3af',
    background: widgetDark ? 'rgba(255,255,255,.04)' : '#fff',
  };

  const hero = (
    <div
      style={{
        height: 78,
        background: brandColor,
        padding: '0 18px',
        color: heroText,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        borderBottom: `1px solid ${rgba('#ffffff', widgetDark ? 0.08 : 0.14)}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 0,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=''
              style={{
                width: 42,
                height: 42,
                objectFit: 'cover',
                borderRadius: 999,
                transition: 'all .3s',
                background: '#fff',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: widgetDark ? 'rgba(255,255,255,.14)' : '#fff7e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all .3s',
                flexShrink: 0,
              }}
            >
              <AvatarThumb size={18} avatarUrl={avatarUrl} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 15.5,
                letterSpacing: 0,
                lineHeight: 1.15,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 170,
              }}
            >
              {widgetTitle || 'Lashvae'}
            </div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                opacity: 0.9,
                marginTop: 3,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 0 2px rgba(34,197,94,.22)',
                }}
              />
              Online
            </div>
          </div>
        </div>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,.12)',
            flexShrink: 0,
          }}
        >
          <svg
            viewBox='0 0 24 24'
            width='18'
            height='18'
            fill='none'
            stroke='#fff'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            opacity={0.9}
          >
            <path d='M18 6 6 18' />
            <path d='m6 6 12 12' />
          </svg>
        </div>
      </div>
    </div>
  );

  const homeBody = (
    <div style={{ padding: '18px 12px 14px' }}>
      <div
        style={{
          margin: '0 auto',
          width: '100%',
          padding: '4px 2px 8px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: brandColor,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              <AvatarThumb size={14} avatarUrl={avatarUrl} />
            </div>
            <div
              style={{
                maxWidth: '82%',
                background: widgetDark ? 'rgba(255,255,255,.05)' : '#f8fafc',
                border: `1px solid ${faintBorder}`,
                borderRadius: `${Math.max(R.card, 16)}px ${Math.max(R.card, 16)}px ${Math.max(R.card, 16)}px 6px`,
                padding: '11px 13px',
                color: textMain,
                fontSize: 13.5,
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              Choose a topic to start the conversation.
            </div>
          </div>

          {(adv.contact_topics.length
            ? adv.contact_topics
            : DEFAULT_ADVANCED.contact_topics
          ).map((t, i) => (
            <div
              key={i}
              style={{ display: 'flex', justifyContent: 'flex-end' }}
            >
              <button
                className='pw-topic'
                onClick={() => setTab('chat')}
                style={{
                  maxWidth: '86%',
                  minHeight: 46,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 14px',
                  borderRadius: `${Math.max(R.card, 16)}px ${Math.max(R.card, 16)}px 6px ${Math.max(R.card, 16)}px`,
                  border: 'none',
                  background: brandColor,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  lineHeight: 1.4,
                  boxShadow: `0 8px 18px ${rgba(brandColor, 0.22)}`,
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  {t.label || 'General information'}
                </span>
                <svg
                  viewBox='0 0 24 24'
                  width='15'
                  height='15'
                  fill='none'
                  stroke='#fff'
                  strokeWidth='2.2'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  className='pw-chev'
                >
                  <path d='M9 18l6-6-6-6' />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {adv.enable_faq && adv.faq_items.length > 0 && (
        <div
          style={floatCard({
            padding: '15px 16px',
            marginTop: 12,
            background: topicCardBg,
          })}
        >
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 600,
              color: textMain,
              marginBottom: 8,
            }}
          >
            Popular articles
          </div>
          {adv.faq_items.slice(0, 2).map((f, i) => (
            <button
              key={i}
              onClick={() => setTab('help')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 0',
                border: 'none',
                borderTop: i > 0 ? `1px solid ${faintBorder}` : 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                color: textSub,
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span>{f.q || 'Untitled article'}</span>
              <svg
                viewBox='0 0 24 24'
                width='13'
                height='13'
                fill='none'
                stroke={brandColor}
                strokeWidth='2.4'
              >
                <path d='M9 18l6-6-6-6' />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const chatBody = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}
    >
      {showForm ? (
        <div style={{ padding: '22px 16px 0' }}>
          <div style={floatCard({ padding: 16 })}>
            <p
              style={{
                fontSize: 13.5,
                color: textSub,
                margin: '0 0 12px',
                fontWeight: 600,
                lineHeight: 1.45,
              }}
            >
              Before we start, may I have a few details?
            </p>
            {collectName && (
              <div style={inputGhost}>
                <svg
                  width='14'
                  height='14'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                >
                  <path d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2' />
                  <circle cx='12' cy='7' r='4' />
                </svg>
                Your name
              </div>
            )}
            {collectEmail && (
              <div style={inputGhost}>
                <svg
                  width='14'
                  height='14'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeWidth='2'
                >
                  <rect x='2' y='4' width='20' height='16' rx='2' />
                  <path d='m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' />
                </svg>
                Your email
              </div>
            )}
            {customDetails &&
              customDetailsFields.map((field) => (
                <div key={field.key} style={inputGhost}>
                  <Sparkles size={13} />
                  {field.label || 'Custom question'}
                  {field.required ? ' *' : ''}
                </div>
              ))}
            {adv.gdpr_enabled && (
              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  alignItems: 'flex-start',
                  margin: '4px 0 6px',
                }}
              >
                <div
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 4,
                    border: `1.5px solid ${brandColor}`,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <span
                  style={{ fontSize: 12, color: textSub, lineHeight: 1.45 }}
                >
                  I agree to the{' '}
                  <span style={{ color: brandColor, fontWeight: 700 }}>
                    privacy policy
                  </span>
                </span>
              </div>
            )}
            {adv.marketing_consent_enabled && (
              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  alignItems: 'flex-start',
                  margin: '0 0 6px',
                }}
              >
                <div
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 4,
                    border: `1.5px solid ${brandColor}`,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <span
                  style={{ fontSize: 12, color: textSub, lineHeight: 1.45 }}
                >
                  {adv.marketing_consent_text ||
                    'I would like to receive product updates and offers by email.'}
                </span>
              </div>
            )}
            {adv.age_assurance_enabled && (
              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  alignItems: 'flex-start',
                  margin: '0 0 6px',
                }}
              >
                <div
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 4,
                    border: `1.5px solid ${brandColor}`,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <span
                  style={{ fontSize: 12, color: textSub, lineHeight: 1.45 }}
                >
                  I confirm I am 16 years of age or older.
                </span>
              </div>
            )}
            {adv.activity_tracking_enabled && (
              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  alignItems: 'flex-start',
                  margin: '0 0 6px',
                }}
              >
                <div
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 4,
                    border: `1.5px solid ${brandColor}`,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <span
                  style={{ fontSize: 12, color: textSub, lineHeight: 1.45 }}
                >
                  Allow activity tracking on this site (pages viewed, time
                  spent).
                </span>
              </div>
            )}
            {adv.lead_profiling_consent_enabled && (
              <div
                style={{
                  display: 'flex',
                  gap: 7,
                  alignItems: 'flex-start',
                  margin: '0 0 10px',
                }}
              >
                <div
                  style={{
                    width: 13,
                    height: 13,
                    borderRadius: 4,
                    border: `1.5px solid ${brandColor}`,
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <span
                  style={{ fontSize: 12, color: textSub, lineHeight: 1.45 }}
                >
                  Allow building a profile and lead score from this
                  conversation.
                </span>
              </div>
            )}
            <button
              style={{
                width: '100%',
                padding: '12px 0',
                borderRadius: Math.max(R.input, 12),
                border: 'none',
                background: brandColor,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'default',
                boxShadow: `0 8px 18px ${rgba(brandColor, 0.24)}`,
                fontFamily: 'inherit',
              }}
            >
              Start Chat
            </button>
          </div>
        </div>
      ) : null}

      <div
        style={{
          padding: showForm ? '16px 16px 10px' : '22px 16px 10px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 11,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: textSub,
            margin: '0 0 2px',
            fontWeight: 600,
          }}
        >
          Today
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: brandColor,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <AvatarThumb size={15} avatarUrl={avatarUrl} />
          </div>
          <div
            style={{
              background: cardBg,
              border: `1px solid ${faintBorder}`,
              borderRadius: `${R.card}px ${R.card}px ${R.card}px 5px`,
              padding: '11px 14px',
              fontSize: 13.5,
              maxWidth: '80%',
              lineHeight: 1.45,
              color: textMain,
              boxShadow: widgetDark ? 'none' : '0 2px 8px rgba(15,23,42,.05)',
            }}
          >
            {greetingText || 'Hi there! How can we help you today?'}
          </div>
        </div>

        <div
          style={{
            alignSelf: 'flex-end',
            background: brandColor,
            color: '#fff',
            borderRadius: `${R.card}px ${R.card}px 5px ${R.card}px`,
            padding: '11px 14px',
            fontSize: 13.5,
            maxWidth: '80%',
            lineHeight: 1.45,
            boxShadow: `0 6px 16px ${rgba(brandColor, 0.24)}`,
          }}
        >
          I&apos;d like to book a consultation.
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              background: brandColor,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <AvatarThumb size={15} avatarUrl={avatarUrl} />
          </div>
          <div
            style={{
              background: cardBg,
              border: `1px solid ${faintBorder}`,
              borderRadius: `${R.card}px ${R.card}px ${R.card}px 5px`,
              padding: '12px 14px',
              display: 'flex',
              gap: 4,
              alignItems: 'center',
            }}
          >
            <span className='pw-dot' style={{ background: textSub }} />
            <span className='pw-dot pw-dot2' style={{ background: textSub }} />
            <span className='pw-dot pw-dot3' style={{ background: textSub }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 16px 14px' }}>
        <div
          style={floatCard({
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '9px 9px 9px 15px',
            borderRadius: 999,
          })}
        >
          <div style={{ flex: 1, fontSize: 13.5, color: textSub }}>
            Type a message
          </div>
          <svg
            viewBox='0 0 24 24'
            width='16'
            height='16'
            fill={textSub}
            style={{ opacity: 0.7 }}
          >
            <path d='M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z' />
          </svg>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: brandColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: `0 5px 12px ${rgba(brandColor, 0.26)}`,
            }}
          >
            <svg viewBox='0 0 24 24' width='14' height='14' fill='#fff'>
              <path d='M2.01 21L23 12 2.01 3 2 10l15 2-15 2z' />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );

  const helpBody = (
    <div style={{ padding: '22px 16px 14px', flex: 1, overflow: 'hidden' }}>
      <div
        style={floatCard({
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
          boxShadow: 'none',
        })}
      >
        <svg
          viewBox='0 0 24 24'
          width='17'
          height='17'
          fill='none'
          stroke={textSub}
          strokeWidth='2.1'
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <circle cx='11' cy='11' r='7' />
          <path d='m21 21-4.35-4.35' />
        </svg>
        <span style={{ fontSize: 13.5, color: textSub }}>Search for help</span>
      </div>
      <div style={floatCard({ padding: '6px 0' })}>
        {(adv.faq_items.length
          ? adv.faq_items
          : [{ q: 'Add articles in the Help Center section', a: '' }]
        ).map((f, i) => (
          <div
            key={i}
            style={{ borderTop: i > 0 ? `1px solid ${faintBorder}` : 'none' }}
          >
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                padding: '14px 16px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 13.5,
                fontWeight: 700,
                color: textMain,
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              {f.q || 'Untitled article'}
              <svg
                viewBox='0 0 24 24'
                width='15'
                height='15'
                fill='none'
                stroke={brandColor}
                strokeWidth='2.2'
                strokeLinecap='round'
                strokeLinejoin='round'
                style={{
                  transform: openFaq === i ? 'rotate(90deg)' : 'none',
                  transition: 'transform .2s',
                  flexShrink: 0,
                }}
              >
                <path d='M9 18l6-6-6-6' />
              </svg>
            </button>
            {openFaq === i && f.a && (
              <div
                style={{
                  padding: '0 16px 14px',
                  fontSize: 13,
                  color: textSub,
                  lineHeight: 1.6,
                }}
              >
                {f.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  const surveyBody = (
    <div style={{ padding: '22px 16px 14px' }}>
      <div style={floatCard({ padding: 20, textAlign: 'center' })}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: textMain,
            marginBottom: 5,
          }}
        >
          How was your experience?
        </div>
        <div style={{ fontSize: 13, color: textSub, marginBottom: 16 }}>
          Your feedback helps us improve
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 6,
            marginBottom: 16,
          }}
        >
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => setStars(s)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
              }}
            >
              <svg
                viewBox='0 0 24 24'
                width='29'
                height='29'
                fill={s <= stars ? brandColor : 'none'}
                stroke={s <= stars ? brandColor : textSub}
                strokeWidth='1.8'
                strokeLinecap='round'
                strokeLinejoin='round'
                style={{
                  transition: 'fill .15s, transform .15s',
                  transform: s <= stars ? 'scale(1.1)' : 'none',
                }}
              >
                <path d='M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z' />
              </svg>
            </button>
          ))}
        </div>
        <div
          style={{
            ...inputGhost,
            marginBottom: 14,
            minHeight: 64,
            alignItems: 'flex-start',
            paddingTop: 12,
          }}
        >
          Tell us more (optional)
        </div>
        <button
          style={{
            width: '100%',
            padding: '12px 0',
            borderRadius: Math.max(R.input, 12),
            border: 'none',
            background: brandColor,
            color: '#fff',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'default',
            boxShadow: `0 8px 18px ${rgba(brandColor, 0.24)}`,
            fontFamily: 'inherit',
          }}
        >
          Send Feedback
        </button>
      </div>
    </div>
  );

  return (
    <div
      style={{
        width,
        height,
        borderRadius: Math.max(R.panel, 24),
        overflow: 'hidden',
        boxShadow: widgetDark
          ? '0 24px 70px rgba(0,0,0,.35), 0 4px 16px rgba(0,0,0,.18)'
          : '0 24px 70px rgba(15,23,42,.16), 0 4px 16px rgba(15,23,42,.08)',
        border: `1px solid ${faintBorder}`,
        fontFamily: font,
        fontSize: 14,
        lineHeight: 1.5,
        background: panelBg,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width .3s ease, height .3s ease',
      }}
    >
      {hero}

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {tab === 'home' && homeBody}
        {tab === 'chat' && chatBody}
        {tab === 'help' && helpBody}
        {tab === 'survey' && surveyBody}
        {tab !== 'chat' && <div style={{ flex: 1 }} />}
        {!adv.hide_branding && (
          <div
            style={{
              textAlign: 'center',
              padding: '10px 0 12px',
              fontSize: 12,
              color: textSub,
              fontWeight: 500,
              letterSpacing: 0,
            }}
          >
            Powered by{' '}
            <span style={{ fontWeight: 700, color: textMain }}>Lashvae</span>
          </div>
        )}
      </div>

      {tabs.length > 1 && (
        <div
          style={{
            display: 'flex',
            borderTop: `1px solid ${faintBorder}`,
            background: widgetDark ? 'rgba(17,24,39,.92)' : '#ffffff',
            backdropFilter: 'blur(14px)',
            padding: '9px 8px 11px',
          }}
        >
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  padding: '5px 0 4px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: active ? brandColor : textSub,
                  transition: 'color .18s',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 30,
                    height: 25,
                  }}
                >
                  {t.icon}
                </span>
                <span
                  style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.1 }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Bubble Preview (simulated webpage corner) ─────────────────────────── */

function BubblePreview({
  bubbleColor,
  bubbleShape,
  bubbleIcon,
  position,
  widgetTitle,
  isDark,
  adv,
}: {
  bubbleColor: string;
  bubbleShape: string;
  bubbleIcon: string;
  position: string;
  widgetTitle: string;
  isDark: boolean;
  adv: AdvancedConfig;
}) {
  const c = th(isDark);
  const iconPath =
    BUBBLE_ICONS.find((i) => i.id === bubbleIcon)?.path || BUBBLE_ICONS[0].path;
  const isDiamond = bubbleShape === 'diamond';
  const isLeft = position === 'bottom-left';
  const size = adv.launcher_size || 60;

  const visual = getBubbleStyleCSS(
    adv.launcher_style || 'gradient',
    bubbleColor,
  );
  const { outer, inner } = classifyAnimation(adv.launcher_animation || 'none');
  const shapeStyle = getBubbleShapeStyle(bubbleShape);

  // CSS custom properties consumed by keyframes for color-adaptive
  // animations. React.CSSProperties doesn't declare arbitrary `--x`
  // custom-property keys, so the whole object is cast once instead of
  // casting each key individually.
  const bubbleVars = {
    '--bubble-color': bubbleColor,
    '--bubble-pulse-color': rgba(bubbleColor, 0.5),
    '--bubble-shadow-base': visual.boxShadow,
    '--bubble-shadow-glow': `0 10px 44px ${rgba(bubbleColor, 0.75)}, 0 4px 16px ${rgba(bubbleColor, 0.55)}`,
  } as React.CSSProperties;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 140,
        borderRadius: 14,
        background: isDark
          ? 'linear-gradient(135deg, rgba(15,20,40,.9) 0%, rgba(20,26,50,.9) 100%)'
          : 'linear-gradient(135deg, #eef1f5 0%, #e2e8f0 100%)',
        border: `1px solid ${c.inputBorder}`,
        overflow: 'hidden',
      }}
    >
      {/* Fake webpage content */}
      <div style={{ padding: '16px 20px', opacity: 0.3 }}>
        <div
          style={{
            height: 8,
            width: '60%',
            borderRadius: 4,
            background: isDark ? '#fff' : '#475569',
            marginBottom: 8,
          }}
        />
        <div
          style={{
            height: 6,
            width: '85%',
            borderRadius: 3,
            background: isDark ? '#fff' : '#475569',
            marginBottom: 6,
          }}
        />
        <div
          style={{
            height: 6,
            width: '70%',
            borderRadius: 3,
            background: isDark ? '#fff' : '#475569',
          }}
        />
      </div>

      {/* Teaser */}
      <div
        style={{
          position: 'absolute',
          bottom: 26 + (size - 52) / 2,
          ...(isLeft ? { left: size + 24 } : { right: size + 24 }),
          background: isDark ? '#fff' : '#1a1a2e',
          color: isDark ? '#1a1a2e' : '#fff',
          fontSize: 11,
          fontWeight: 600,
          padding: '8px 13px',
          borderRadius: 14,
          whiteSpace: 'nowrap',
          boxShadow: '0 6px 18px rgba(0,0,0,.22)',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          maxWidth: '60%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {adv.teaser_text || widgetTitle || 'Chat with us'}
      </div>

      {/* Positioner → Motion wrapper → Shape → Badge sibling */}
      <div
        style={{
          position: 'absolute',
          bottom: 14,
          ...(isLeft ? { left: 14 } : { right: 14 }),
          width: size,
          height: size,
        }}
      >
        <div
          className={outer}
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            className={inner}
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'default',
              transition: 'background .25s ease, box-shadow .25s ease',
              position: 'relative',
              background: visual.background,
              boxShadow: visual.boxShadow,
              border: visual.border,
              ...(adv.launcher_animation === 'shine'
                ? { overflow: 'hidden' }
                : {}),
              ...shapeStyle,
              ...bubbleVars,
            }}
          >
            {(() => {
              // Compute the actual icon pixel size from user preference × shape adjustment.
              const sizeRatio =
                LAUNCHER_ICON_SIZES.find(
                  (s) => s.id === (adv.launcher_icon_size || 'medium'),
                )?.ratio ?? 0.46;
              const shapeAdj = getShapeIconScale(bubbleShape);
              const iconPx = Math.round(size * sizeRatio * shapeAdj);
              const iconTransform = isDiamond ? 'rotate(-45deg)' : undefined;

              // Custom uploaded icon takes precedence — we don't recolor it, we show it as-is.
              if (adv.launcher_custom_icon_url) {
                return (
                  <img
                    src={adv.launcher_custom_icon_url}
                    alt=''
                    style={{
                      width: iconPx,
                      height: iconPx,
                      objectFit: 'contain',
                      transform: iconTransform,
                      // Neutralize color-clashing icons on light bubble styles like Outlined
                      // by ensuring white icons still read on colored backgrounds — but only
                      // if the user chose no explicit color. Default: leave the image untouched.
                      pointerEvents: 'none',
                    }}
                  />
                );
              }
              return (
                <svg
                  viewBox='0 0 24 24'
                  width={iconPx}
                  height={iconPx}
                  fill={visual.iconColor}
                  style={{ transform: iconTransform }}
                >
                  <path d={iconPath} />
                </svg>
              );
            })()}
          </div>

          {adv.show_unread_badge && (
            <span
              style={{
                position: 'absolute',
                top: -3,
                right: -3,
                minWidth: 18,
                height: 18,
                borderRadius: 999,
                background: '#ef4444',
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #fff',
                padding: '0 3px',
                zIndex: 2,
              }}
            >
              1
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SIDEBAR NAVIGATION
   ══════════════════════════════════════════════════════════════════════════ */

type SectionId =
  | 'install'
  | 'testing'
  | 'appearance'
  | 'launcher'
  | 'branding'
  | 'content'
  | 'leadcapture'
  | 'proactive'
  | 'advanced';

type SidebarItem = {
  id: SectionId;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
};

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    id: 'install',
    label: 'Install',
    subtitle: 'Add the widget to your site',
    icon: <Wrench size={20} />,
  },
  {
    id: 'testing',
    label: 'Testing',
    subtitle: 'Preview and test the widget',
    icon: <TestTube size={20} />,
  },
  {
    id: 'appearance',
    label: 'Appearance',
    subtitle: 'Colors, radius and font',
    icon: <Palette size={20} />,
  },
  {
    id: 'launcher',
    label: 'Launcher',
    subtitle: 'Bubble shape and icon',
    icon: <MessageCircle size={20} />,
  },
  {
    id: 'branding',
    label: 'Branding',
    subtitle: 'Name, avatar and greeting',
    icon: <User size={20} />,
  },
  {
    id: 'content',
    label: 'Content',
    subtitle: 'Topics and quick replies',
    icon: <Layout size={20} />,
  },
  {
    id: 'leadcapture',
    label: 'Lead Capture',
    subtitle: 'Name, email and custom fields',
    icon: <Users size={20} />,
  },
  {
    id: 'proactive',
    label: 'Proactive',
    subtitle: 'Auto-open and offline message',
    icon: <Zap size={20} />,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    subtitle: 'Fine-tune widget behavior',
    icon: <Settings size={20} />,
  },
];

/* sections that should hide the right rail (per user requirement) */
const SECTIONS_HIDE_RIGHT_RAIL: SectionId[] = ['install', 'testing'];

function Sidebar({
  activeSection,
  onSelect,
  router,
}: {
  activeSection: SectionId;
  onSelect: (id: SectionId) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className='sticky top-6 flex flex-col gap-4'>
      <div className='rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3'>
        <div className='border-b border-gray-100 px-5 py-4 dark:border-gray-800'>
          <h3 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
            Website Widget
          </h3>
          <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
            Configure your chat widget
          </p>
        </div>

        <div className='flex flex-col gap-1 p-3'>
          {SIDEBAR_ITEMS.map((item) => {
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
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

                  <span>
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
                    <span className='mt-0.5 block type-caption font-normal text-gray-400 dark:text-gray-500'>
                      {item.subtitle}
                    </span>
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

      {/* Need help card */}
      <div className='rounded-2xl border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-white/3'>
        <div className='mb-1.5 flex items-center gap-2'>
          <LifeBuoy size={15} className='text-gray-500 dark:text-gray-400' />
          <span className='type-small font-semibold text-gray-800 dark:text-white/90'>
            Need help?
          </span>
        </div>
        <div className='mb-3 type-small text-gray-400 dark:text-gray-500'>
          We&apos;re here to help you set up your chatbot.
        </div>
        <Button
          variant='outline'
          size='sm'
          className='w-full'
          onClick={() => router.push('/profile?support=True')}
        >
          Contact Support
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN PAGE — CustomizeChatInner
   ══════════════════════════════════════════════════════════════════════════ */

function CustomizeChatInner() {
  const { isDark } = useTheme();
  const c = th(isDark);
  const router = useRouter();

  /* ── section state ─────────────────────────────────────────────────────── */
  const [activeSection, setActiveSection] = useState<SectionId>('appearance');
  const [previewTab, setPreviewTab] = useState<'widget' | 'bubble'>('widget');

  /* ── config state (preserved 1:1 from original) ───────────────────────── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const [embedCode, setEmbedCode] = useState('');
  const [original, setOriginal] = useState<WidgetConfig | null>(null);
  const [widgetKey, setWidgetKey] = useState('');
  const [isActive, setIsActive] = useState(false);

  const [brandColor, setBrandColor] = useState('#465FFF');
  const [sendBtnColor, setSendBtnColor] = useState('#465FFF');
  const [position, setPosition] = useState('bottom-right');
  const [widgetTitle, setWidgetTitle] = useState('');
  const [greetingText, setGreetingText] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [collectName, setCollectName] = useState(true);
  const [collectEmail, setCollectEmail] = useState(true);
  const [customDetails, setCustomDetails] = useState(false);
  const [customDetailsFields, setCustomDetailsFields] = useState<
    CustomDetailField[]
  >([]);

  const [bubbleColor, setBubbleColor] = useState('#465FFF');
  const [bubbleShape, setBubbleShape] = useState('circle');
  const [bubbleIcon, setBubbleIcon] = useState('chat');

  const [autoOpenDelayMs, setAutoOpenDelayMs] = useState(0);
  const [offlineMessage, setOfflineMessage] = useState('');

  const [adv, setAdv] = useState<AdvancedConfig>({ ...DEFAULT_ADVANCED });
  const patchAdv = (p: Partial<AdvancedConfig>) =>
    setAdv((prev) => ({ ...prev, ...p }));

  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  /* install/testing state */
  const [guideType, setGuideType] = useState<GuideType>('builder');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  /* ── load config ───────────────────────────────────────────────────────── */
  const load = useCallback(async () => {
    try {
      const data = await apiFetch<WidgetResponse>('/admin/widget', {
        auth: true,
      });
      if (data.config) {
        const cfg = data.config;
        setBrandColor(cfg.brand_color || '#465FFF');
        setSendBtnColor(cfg.brand_color || '#465FFF');
        setPosition(cfg.position || 'bottom-right');
        setWidgetTitle(cfg.widget_title || '');
        setGreetingText(cfg.greeting_text || '');
        setAvatarUrl(cfg.avatar_url || '');
        setCollectName(cfg.collect_name ?? true);
        setCollectEmail(cfg.collect_email ?? true);
        setCustomDetails(Boolean(cfg.custom_details));
        setCustomDetailsFields(cfg.custom_details_fields || []);
        setBubbleColor(cfg.bubble_color || cfg.brand_color || '#465FFF');
        // Prefer the advanced_config value (which supports premium options)
        // over the top-level column (which is enum-limited by the backend).
        setBubbleShape(
          cfg.advanced_config?.launcher_shape || cfg.bubble_shape || 'circle',
        );
        setBubbleIcon(
          cfg.advanced_config?.launcher_icon || cfg.bubble_icon || 'chat',
        );
        setAutoOpenDelayMs(cfg.auto_open_delay_ms ?? 0);
        setOfflineMessage(cfg.offline_message || '');
        // Merge saved advanced config over defaults, then migrate legacy fields.
        const mergedAdv: AdvancedConfig = {
          ...DEFAULT_ADVANCED,
          ...(cfg.advanced_config || {}),
        };
        // Legacy migration: if animation wasn't saved but the old `launcher_pulse`
        // was, translate it to the new field so behavior stays identical.
        if (!cfg.advanced_config?.launcher_animation) {
          mergedAdv.launcher_animation = mergedAdv.launcher_pulse
            ? 'pulse'
            : 'none';
        }
        setAdv(mergedAdv);
        setWidgetKey(cfg.widget_key || '');
        setIsActive(Boolean(cfg.is_active));
        setOriginal(cfg);
      }
      if (data.embed_code) setEmbedCode(data.embed_code);
    } catch (e: unknown) {
      console.error('Failed to load widget config:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  /* ── computed values ───────────────────────────────────────────────────── */
  const effectiveEmbedCode = useMemo(() => {
    if (embedCode) return embedCode;
    return widgetKey
      ? `<script\n  src="https://api.thundertribes.com/widget/embed.js"\n  data-widget-id="${widgetKey}"\n  async\n></script>`
      : '';
  }, [embedCode, widgetKey]);

  const consoleTestCode = useMemo(
    () =>
      widgetKey
        ? `const old = document.getElementById('lashvae-demo-widget');\nif (old) old.remove();\n\nconst s = document.createElement('script');\ns.id = 'lashvae-demo-widget';\ns.src = '${process.env.NEXT_PUBLIC_API_BASE}/widget/embed.js';\ns.setAttribute('data-widget-id', '${widgetKey}');\ns.async = true;\n\ndocument.body.appendChild(s);`
        : '',
    [widgetKey],
  );

  /* ── field helpers ─────────────────────────────────────────────────────── */
  function makeKeyFromLabel(label: string) {
    return label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40);
  }

  function addCustomField() {
    setCustomDetails(true);
    setCustomDetailsFields((prev) => [
      ...prev,
      {
        key: `field_${prev.length + 1}`,
        label: '',
        type: 'text',
        required: false,
        placeholder: '',
        options: [],
      },
    ]);
  }

  function updateCustomField(index: number, patch: Partial<CustomDetailField>) {
    setCustomDetailsFields((prev) =>
      prev.map((field, i) => {
        if (i !== index) return field;
        const next = { ...field, ...patch };
        if (
          patch.label !== undefined &&
          (!field.key || field.key.startsWith('field_'))
        ) {
          next.key = makeKeyFromLabel(patch.label) || field.key;
        }
        return next;
      }),
    );
  }

  function removeCustomField(index: number) {
    setCustomDetailsFields((prev) => prev.filter((_, i) => i !== index));
  }

  /* ── preset theme apply ────────────────────────────────────────────────── */
  function applyPreset(p: (typeof PRESET_THEMES)[number]) {
    setBrandColor(p.brand);
    setSendBtnColor(p.brand);
    setBubbleColor(p.bubble);
    patchAdv({
      header_style: 'solid',
      widget_theme: p.theme,
      font_family: p.font,
      corner_radius: p.radius,
    });
  }

  /* ── save ──────────────────────────────────────────────────────────────── */
  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      // The backend enforces a strict enum on bubble_icon and bubble_shape.
      // If the user picked a premium option (e.g. sparkle, blob), we send a
      // safe fallback up top and preserve the real choice in advanced_config.
      const safeBubbleIcon = BACKEND_ALLOWED_ICONS.has(bubbleIcon)
        ? bubbleIcon
        : BACKEND_ICON_FALLBACK;
      const safeBubbleShape = BACKEND_ALLOWED_SHAPES.has(bubbleShape)
        ? bubbleShape
        : BACKEND_SHAPE_FALLBACK;

      const body: {
        brand_color: string;
        position: string;
        widget_title: string;
        greeting_text: string;
        avatar_url: string | null;
        collect_name: boolean;
        collect_email: boolean;
        custom_details: boolean;
        bubble_color: string;
        bubble_shape: string;
        bubble_icon: string;
        custom_details_fields: CustomDetailField[];
        auto_open_delay_ms: number;
        offline_message: string | null;
        advanced_config?: AdvancedConfig & {
          header_style: string;
          launcher_icon: string;
          launcher_shape: string;
        };
      } = {
        brand_color: brandColor,
        position,
        widget_title: widgetTitle,
        greeting_text: greetingText,
        avatar_url: avatarUrl || null,
        collect_name: collectName,
        collect_email: collectEmail,
        custom_details: customDetails,
        bubble_color: bubbleColor,
        bubble_shape: safeBubbleShape,
        bubble_icon: safeBubbleIcon,
        custom_details_fields: customDetails
          ? customDetailsFields.filter((field) => field.label.trim())
          : [],
        auto_open_delay_ms: autoOpenDelayMs,
        offline_message: offlineMessage || null,
      };
      if (SEND_ADVANCED_CONFIG) {
        body.advanced_config = {
          ...adv,
          header_style: 'solid',
          // Real launcher selection lives here so premium options round-trip.
          launcher_icon: bubbleIcon,
          launcher_shape: bubbleShape,
          contact_topics: adv.contact_topics.filter((t) => t.label.trim()),
          faq_items: adv.faq_items.filter((f) => f.q.trim()),
          proactive_rules: adv.proactive_rules.filter((r) => r.message.trim()),
        };
      }
      await apiFetch('/admin/widget', { method: 'PUT', auth: true, body });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  /* ── reset ─────────────────────────────────────────────────────────────── */
  function handleReset() {
    if (original) {
      setBrandColor(original.brand_color || '#465FFF');
      setSendBtnColor(original.brand_color || '#465FFF');
      setPosition(original.position || 'bottom-right');
      setWidgetTitle(original.widget_title || '');
      setGreetingText(original.greeting_text || '');
      setAvatarUrl(original.avatar_url || '');
      setCollectName(original.collect_name ?? true);
      setCollectEmail(original.collect_email ?? true);
      setCustomDetails(Boolean(original.custom_details));
      setCustomDetailsFields(original.custom_details_fields || []);
      setBubbleColor(
        original.bubble_color || original.brand_color || '#465FFF',
      );
      setBubbleShape(
        original.advanced_config?.launcher_shape ||
          original.bubble_shape ||
          'circle',
      );
      setBubbleIcon(
        original.advanced_config?.launcher_icon ||
          original.bubble_icon ||
          'chat',
      );
      setAutoOpenDelayMs(original.auto_open_delay_ms ?? 0);
      setOfflineMessage(original.offline_message || '');
      const mergedAdv: AdvancedConfig = {
        ...DEFAULT_ADVANCED,
        ...(original.advanced_config || {}),
      };
      if (!original.advanced_config?.launcher_animation) {
        mergedAdv.launcher_animation = mergedAdv.launcher_pulse
          ? 'pulse'
          : 'none';
      }
      setAdv(mergedAdv);
    }
  }

  /* ── copy embed ────────────────────────────────────────────────────────── */
  async function handleCopy() {
    if (!effectiveEmbedCode) return;
    await navigator.clipboard.writeText(effectiveEmbedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  function handleGenericCopy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  /* ── enable / disable widget ───────────────────────────────────────────── */
  async function handleEnableWidget() {
    setSaving(true);
    try {
      await apiFetch('/admin/widget/enable', { method: 'POST', auth: true });
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to enable widget');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisableWidget() {
    setSaving(true);
    try {
      await apiFetch('/admin/widget/disable', { method: 'POST', auth: true });
      await load();
      setShowDisconnectConfirm(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to disable widget');
    } finally {
      setSaving(false);
    }
  }

  /* ── logo upload ───────────────────────────────────────────────────────── */
  async function uploadToCloudinary(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', `${cloudinary_unsigned_present}`);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudinary_name}/image/upload`,
      { method: 'POST', body: formData },
    );
    const data = await res.json();
    return data.secure_url;
  }

  /**
   * Client-side background removal for uploaded logos and launcher icons.
   * Samples 5×5 pixel blocks from all four corners; if they agree closely,
   * assumes that color is the background and fades matching pixels to
   * transparent (with soft edges — no hard cutout look). Bails out and
   * returns the original file if the corners disagree (indicates a complex
   * background that this heuristic can't handle safely).
   *
   * Best for: logos on white, product shots on flat backgrounds, screenshots.
   * Not great for: gradients, photos of scenes, images with the bg color
   * present inside the subject. Skips SVGs entirely since they're already
   * transparent by design.
   */
  async function removeUniformBackground(file: File): Promise<File> {
    if (file.type === 'image/svg+xml') return file;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to decode image'));
        el.src = url;
      });
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h || w * h > 6_000_000) {
        // Bail on huge images (>6MP) to avoid multi-second main-thread blocks.
        return file;
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      // Average a 5×5 block anchored at (x,y) — noise-resistant sampler.
      const sample = (x: number, y: number, size = 5) => {
        let r = 0,
          g = 0,
          b = 0,
          n = 0;
        for (let dy = 0; dy < size; dy++) {
          for (let dx = 0; dx < size; dx++) {
            const px = Math.min(w - 1, x + dx);
            const py = Math.min(h - 1, y + dy);
            const idx = (py * w + px) * 4;
            r += d[idx];
            g += d[idx + 1];
            b += d[idx + 2];
            n++;
          }
        }
        return [r / n, g / n, b / n];
      };
      const corners = [
        sample(0, 0),
        sample(w - 5, 0),
        sample(0, h - 5),
        sample(w - 5, h - 5),
      ];
      const bg = [
        (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4,
        (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4,
        (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4,
      ];

      // Sanity check: if the corners disagree by more than ~50 in RGB
      // distance, this isn't a uniform bg. Don't mangle the image.
      let maxCornerDelta = 0;
      for (const c of corners) {
        const dr = c[0] - bg[0],
          dg = c[1] - bg[1],
          db = c[2] - bg[2];
        maxCornerDelta = Math.max(
          maxCornerDelta,
          Math.sqrt(dr * dr + dg * dg + db * db),
        );
      }
      if (maxCornerDelta > 50) return file;

      // Fade pixels within `tolerance` distance of the bg color. Pixels
      // right at the bg color go fully transparent; pixels near the edge
      // fade proportionally — this avoids the "cardboard cutout" look.
      const tolerance = 42;
      const tol2 = tolerance * tolerance;
      for (let i = 0; i < d.length; i += 4) {
        const dr = d[i] - bg[0];
        const dg = d[i + 1] - bg[1];
        const db = d[i + 2] - bg[2];
        const dist2 = dr * dr + dg * dg + db * db;
        if (dist2 < tol2) {
          d[i + 3] = Math.round((Math.sqrt(dist2) / tolerance) * d[i + 3]);
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
      if (!blob) return file;
      const outName = file.name.replace(/\.\w+$/, '') + '_nobg.png';
      return new File([blob], outName, { type: 'image/png' });
    } catch {
      return file;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const fileRef = useRef<HTMLInputElement>(null);
  const iconFileRef = useRef<HTMLInputElement>(null);

  // "Remove background on upload" toggles — UI-only state, not persisted.
  const [logoRemoveBg, setLogoRemoveBg] = useState(false);
  const [iconRemoveBg, setIconRemoveBg] = useState(true); // default ON for launcher icons — usually wanted

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('File must be under 2 MB');
      return;
    }
    try {
      const processed = logoRemoveBg
        ? await removeUniformBackground(file)
        : file;
      const publicUrl = await uploadToCloudinary(processed);
      setAvatarUrl(publicUrl);
    } catch {
      alert('Logo upload failed');
    }
  }

  /**
   * Custom launcher icon — takes precedence over the built-in icon set.
   * Kept smaller (1 MB) since it renders inside a ~60px bubble; anything larger
   * is wasted bandwidth. Accepts SVG, PNG, WebP.
   */
  async function handleLauncherIconSelect(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1 * 1024 * 1024) {
      alert('Icon must be under 1 MB');
      return;
    }
    try {
      const processed = iconRemoveBg
        ? await removeUniformBackground(file)
        : file;
      const publicUrl = await uploadToCloudinary(processed);
      patchAdv({ launcher_custom_icon_url: publicUrl });
    } catch {
      alert('Icon upload failed');
    }
  }

  /* ── loading state ─────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: c.textMuted,
          fontSize: 14,
        }}
      >
        Loading widget config...
      </div>
    );
  }

  const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
    borderRadius: 16,
    background: c.cardBg,
    border: `1px solid ${c.cardBorder}`,
    padding: 24,
    boxShadow: isDark ? 'none' : '0 1px 2px rgba(16,24,40,.05)',
    ...extra,
  });

  const divider = (
    <div style={{ height: 1, background: c.borderFaint, margin: '0 0 24px' }} />
  );

  /* palette pass-through values for install guide components (they were designed for the modal) */
  const installTextPrimary = c.textPrimary;
  const installTextSecondary = c.textSub;
  const installTextMuted = c.textMuted;
  const installCardBg = isDark ? '#050816' : '#F8FAFC';
  const installBorderCol = c.cardBorder;

  const hideRightRail = SECTIONS_HIDE_RIGHT_RAIL.includes(activeSection);

  /* ── section content renderer ─────────────────────────────────────────── */
  function renderSection() {
    switch (activeSection) {
      /* ── INSTALL ─────────────────────────────────────────────────────── */
      case 'install':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Status / enable card */}
            <div style={cardStyle({ padding: 22 })}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: isActive
                        ? 'rgba(18,183,106,.12)'
                        : 'rgba(148,163,184,.14)',
                      display: 'grid',
                      placeItems: 'center',
                      color: isActive ? '#10B981' : c.textMuted,
                    }}
                  >
                    {isActive ? (
                      <CheckCircle2 size={22} />
                    ) : (
                      <MessageCircle size={20} />
                    )}
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        lineHeight: '24px',
                        fontWeight: 600,
                        color: c.textPrimary,
                        marginBottom: 2,
                      }}
                    >
                      {isActive
                        ? 'Website chatbot is live'
                        : 'Widget not installed yet'}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: '20px',
                        color: c.textSub,
                      }}
                    >
                      {isActive
                        ? 'Visitors on your website can chat with the bot right now.'
                        : 'Follow the install steps below to add the chatbot to your website.'}
                    </div>
                  </div>
                </div>
                {isActive ? (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(16,185,129,.12)',
                      color: '#10B981',
                      fontSize: 12,
                      lineHeight: '18px',
                      fontWeight: 500,
                      textTransform: 'uppercase',
                      padding: '6px 12px',
                      borderRadius: 999,
                      border: '1px solid rgba(16,185,129,.28)',
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: '#10B981',
                        boxShadow: '0 0 8px #10B981',
                      }}
                    />
                    Connected
                  </span>
                ) : (
                  <button
                    onClick={handleEnableWidget}
                    disabled={saving}
                    style={{
                      height: 40,
                      padding: '0 18px',
                      borderRadius: 8,
                      border: 'none',
                      background: '#465FFF',
                      color: '#fff',
                      fontSize: 14,
                      lineHeight: '20px',
                      fontWeight: 500,
                      cursor: saving ? 'not-allowed' : 'pointer',
                      boxShadow: '0 1px 2px rgba(16,24,40,.05)',
                      opacity: saving ? 0.7 : 1,
                    }}
                  >
                    {saving ? 'Enabling...' : 'Enable Widget'}
                  </button>
                )}
              </div>
            </div>

            {/* Guide type selection */}
            <div style={cardStyle()}>
              <SectionHeader title='How is your website built?' />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginBottom: 22,
                }}
              >
                {GUIDE_OPTIONS.map((opt) => {
                  const active = guideType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setGuideType(opt.key as GuideType)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                        padding: '18px 12px',
                        borderRadius: 14,
                        border: active
                          ? '1.5px solid rgba(70,95,255,0.5)'
                          : `1px solid ${c.cardBorder}`,
                        background: active
                          ? isDark
                            ? 'rgba(70,95,255,0.10)'
                            : 'rgba(70,95,255,0.05)'
                          : c.inputBg,
                        cursor: 'pointer',
                        transition: 'all .18s',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          width: 44,
                          height: 44,
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 12,
                          border: active
                            ? '1px solid rgba(70,95,255,.28)'
                            : `1px solid ${c.borderFaint}`,
                          background: active
                            ? isDark
                              ? 'rgba(70,95,255,.14)'
                              : '#ecf3ff'
                            : isDark
                              ? 'rgba(255,255,255,.03)'
                              : '#f9fafb',
                          color: active
                            ? isDark
                              ? '#9CB9FF'
                              : '#465FFF'
                            : c.textSub,
                        }}
                      >
                        <opt.icon size={20} />
                      </span>
                      <span
                        style={{
                          fontSize: 15,
                          lineHeight: '22px',
                          fontWeight: 600,
                          color: active
                            ? isDark
                              ? '#9CB9FF'
                              : '#465FFF'
                            : c.textPrimary,
                        }}
                      >
                        {opt.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              {guideType === 'builder' && (
                <WebsiteBuilderGuide
                  isDark={isDark}
                  widgetKey={widgetKey}
                  embedCode={effectiveEmbedCode}
                  copiedKey={copiedKey}
                  onCopy={handleGenericCopy}
                  textPrimary={installTextPrimary}
                  textSecondary={installTextSecondary}
                  textMuted={installTextMuted}
                  cardBg={installCardBg}
                  borderCol={installBorderCol}
                />
              )}
              {guideType === 'custom' && (
                <CustomCodeGuide
                  isDark={isDark}
                  widgetKey={widgetKey}
                  copiedKey={copiedKey}
                  onCopy={handleGenericCopy}
                  textPrimary={installTextPrimary}
                  textSecondary={installTextSecondary}
                  textMuted={installTextMuted}
                  cardBg={installCardBg}
                  borderCol={installBorderCol}
                />
              )}
              {guideType === 'unsure' && (
                <UnsureGuide
                  isDark={isDark}
                  widgetKey={widgetKey}
                  embedCode={effectiveEmbedCode}
                  copiedKey={copiedKey}
                  onCopy={handleGenericCopy}
                  textPrimary={installTextPrimary}
                  textSecondary={installTextSecondary}
                  cardBg={installCardBg}
                  borderCol={installBorderCol}
                />
              )}
            </div>

            {/* Copy embed shortcut */}
            {effectiveEmbedCode && (
              <div style={cardStyle({ padding: 20 })}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 14,
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 16,
                        lineHeight: '24px',
                        fontWeight: 600,
                        color: c.textPrimary,
                        marginBottom: 3,
                      }}
                    >
                      Embed Script
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: '20px',
                        color: c.textSub,
                      }}
                    >
                      One line of code that adds the chatbot to every page of
                      your site.
                    </div>
                  </div>
                  <button
                    onClick={handleCopy}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: `1px solid ${c.inputBorder}`,
                      background: c.inputBg,
                      color: c.textPrimary,
                      fontSize: 14,
                      lineHeight: '20px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? (
                      <>
                        <Check size={14} /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy Embed Script
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        );

      /* ── TESTING ─────────────────────────────────────────────────────── */
      case 'testing':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={cardStyle()}>
              <SectionHeader title='Quick Testing' />
              <p
                style={{
                  fontSize: 15,
                  color: c.textSub,
                  margin: '0 0 20px',
                  lineHeight: '22px',
                }}
              >
                Preview the chatbot on any site — even before your customer
                installs the embed script — by pasting this snippet into their
                browser console.
              </p>
              {widgetKey ? (
                <QuickTestingPanel
                  isDark={isDark}
                  consoleTestCode={consoleTestCode}
                  copiedKey={copiedKey}
                  onCopy={handleGenericCopy}
                  textSecondary={installTextSecondary}
                  cardBg={installCardBg}
                  borderCol={installBorderCol}
                />
              ) : (
                <div
                  style={{
                    padding: 20,
                    borderRadius: 14,
                    border: `1px dashed ${c.inputBorder}`,
                    color: c.textMuted,
                    fontSize: 15,
                    lineHeight: '22px',
                    textAlign: 'center',
                  }}
                >
                  Your widget key isn&apos;t set yet — enable the widget in the
                  Install tab first.
                </div>
              )}
            </div>
          </div>
        );

      /* ── APPEARANCE ──────────────────────────────────────────────────── */
      case 'appearance':
        return (
          <div className='flex flex-col gap-5'>
            {/* Quick themes */}
            {/* Quick themes */}
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Quick Themes' badge='New' />

              <p className='-mt-2 mb-4.5 type-small text-gray-500 dark:text-gray-400'>
                One click applies a coordinated look — colors, radius, font.
              </p>

              <div className='grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3'>
                {PRESET_THEMES.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => applyPreset(p)}
                    className='flex min-h-12 min-w-0 items-center gap-3 rounded-(--radius-control) border border-gray-300 bg-white px-3.5 py-3 text-left shadow-theme-xs transition hover:border-brand-300 dark:border-gray-700 dark:bg-gray-900'
                  >
                    <span
                      className='h-6 w-6 shrink-0 rounded-(--radius-control) border border-gray-300 dark:border-gray-700'
                      style={{ background: p.brand }}
                    />

                    <span className='truncate type-small font-semibold text-gray-800 dark:text-white/90'>
                      {p.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Colors & Style */}
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Colors & Style' />
              <ColorInput
                label='Brand color'
                value={brandColor}
                onChange={(v) => {
                  setBrandColor(v);
                  setSendBtnColor(v);
                }}
              />
              <div className='h-4' />

              <div className='mb-4.5 grid grid-cols-2 gap-5'>
                <div>
                  <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                    Widget Theme
                  </div>
                  <Segmented
                    options={[
                      { id: 'light', label: 'Light' },
                      { id: 'dark', label: 'Dark' },
                      { id: 'auto', label: 'Auto' },
                    ]}
                    value={adv.widget_theme}
                    onChange={(v) => patchAdv({ widget_theme: v as 'light' | 'dark' | 'auto' })}
                    accent={brandColor}
                  />
                </div>
                <div>
                  <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                    Corner Radius
                  </div>
                  <Segmented
                    options={[
                      { id: 'sharp', label: 'Sharp' },
                      { id: 'soft', label: 'Soft' },
                      { id: 'round', label: 'Round' },
                    ]}
                    value={adv.corner_radius}
                    onChange={(v) => patchAdv({ corner_radius: v as 'sharp' | 'soft' | 'round' })}
                    accent={brandColor}
                  />
                </div>
              </div>

              <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                Font
              </div>
              <Segmented
                options={WIDGET_FONTS.map((f) => ({
                  id: f.id,
                  label: f.label,
                }))}
                value={adv.font_family}
                onChange={(v) => patchAdv({ font_family: v })}
                accent={brandColor}
              />
            </div>
          </div>
        );

      /* ── LAUNCHER ────────────────────────────────────────────────────── */
      case 'launcher':
        return (
          <div className='flex flex-col gap-5'>
            {/* Position */}
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Widget Position' />
              <div className='grid grid-cols-2 gap-3'>
                {[
                  { id: 'bottom-right', label: 'Bottom Right' },
                  { id: 'bottom-left', label: 'Bottom Left' },
                ].map((p) => {
                  const active = position === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPosition(p.id)}
                      className={cn(
                        'min-h-10 rounded-(--radius-control) px-3.5 py-2 type-small font-semibold transition',
                        active
                          ? ''
                          : 'border border-gray-300 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90',
                      )}
                      style={
                        active
                          ? {
                              border: `1.5px solid ${brandColor}`,
                              background: rgba(brandColor, 0.08),
                              color: brandColor,
                            }
                          : undefined
                      }
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bubble color + Style presets */}
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Bubble Style' badge='Premium' />
              <p className='-mt-2 mb-4.5 type-small text-gray-500 dark:text-gray-400'>
                Pick a visual style — color, gradient, glow and depth are baked
                in.
              </p>

              <div className='mb-5'>
                <ColorInput
                  label='Bubble color'
                  value={bubbleColor}
                  onChange={setBubbleColor}
                />
              </div>

              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                {BUBBLE_STYLES.map((s) => {
                  const active = (adv.launcher_style || 'gradient') === s.id;
                  const visual = getBubbleStyleCSS(s.id, bubbleColor);
                  return (
                    <button
                      key={s.id}
                      onClick={() => patchAdv({ launcher_style: s.id })}
                      className={cn(
                        'flex min-h-18 items-center gap-3 rounded-(--radius-control) p-3.5 text-left shadow-theme-xs transition',
                        active
                          ? ''
                          : 'border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900',
                      )}
                      style={
                        active
                          ? {
                              border: `1.5px solid ${brandColor}`,
                              background: rgba(brandColor, 0.06),
                            }
                          : undefined
                      }
                    >
                      <div
                        className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full'
                        style={{
                          background: visual.background,
                          border: visual.border,
                        }}
                      >
                        <svg
                          viewBox='0 0 24 24'
                          width='19'
                          height='19'
                          fill={visual.iconColor}
                        >
                          <path d={BUBBLE_ICONS[0].path} />
                        </svg>
                      </div>
                      <div className='min-w-0'>
                        <div
                          className='type-small font-semibold'
                          style={{ color: active ? brandColor : undefined }}
                        >
                          <span
                            className={
                              !active ? 'text-gray-800 dark:text-white/90' : ''
                            }
                          >
                            {s.label}
                          </span>
                        </div>
                        <div className='mt-0.5 type-small text-gray-400 dark:text-gray-500'>
                          {s.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Animation */}
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Animation' badge='New' />
              <p className='-mt-2 mb-4.5 type-small text-gray-500 dark:text-gray-400'>
                Motion draws attention — pick the one that fits your brand
                energy.
              </p>

              <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                {LAUNCHER_ANIMATIONS.map((a) => {
                  const active = (adv.launcher_animation || 'none') === a.id;
                  const { outer, inner } = classifyAnimation(a.id);
                  const previewVisual = getBubbleStyleCSS(
                    adv.launcher_style || 'gradient',
                    bubbleColor,
                  );
                  const previewVars = {
                    '--bubble-color': bubbleColor,
                    '--bubble-pulse-color': rgba(bubbleColor, 0.5),
                    '--bubble-shadow-base': previewVisual.boxShadow,
                    '--bubble-shadow-glow': `0 8px 30px ${rgba(bubbleColor, 0.75)}, 0 4px 14px ${rgba(bubbleColor, 0.55)}`,
                  } as React.CSSProperties;
                  return (
                    <button
                      key={a.id}
                      onClick={() => patchAdv({ launcher_animation: a.id })}
                      className={cn(
                        'flex min-h-18 items-center gap-3 rounded-(--radius-control) p-3.5 text-left shadow-theme-xs transition',
                        active
                          ? ''
                          : 'border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900',
                      )}
                      style={
                        active
                          ? {
                              border: `1.5px solid ${brandColor}`,
                              background: rgba(brandColor, 0.06),
                            }
                          : undefined
                      }
                    >
                      <div className='flex h-12 w-12 shrink-0 items-center justify-center'>
                        <div
                          className={outer}
                          style={{
                            width: 38,
                            height: 38,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                          }}
                        >
                          <div
                            className={inner}
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: previewVisual.background,
                              boxShadow: active
                                ? '0 1px 2px rgba(16,24,40,.08)'
                                : 'none',
                              border: previewVisual.border,
                              position: 'relative',
                              overflow: a.id === 'shine' ? 'hidden' : undefined,
                              ...previewVars,
                            }}
                          >
                            <svg
                              viewBox='0 0 24 24'
                              width='18'
                              height='18'
                              fill={previewVisual.iconColor}
                            >
                              <path d={BUBBLE_ICONS[0].path} />
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className='min-w-0'>
                        <div
                          className='type-small font-semibold'
                          style={{ color: active ? brandColor : undefined }}
                        >
                          <span
                            className={
                              !active ? 'text-gray-800 dark:text-white/90' : ''
                            }
                          >
                            {a.label}
                          </span>
                        </div>
                        <div className='mt-0.5 type-small text-gray-400 dark:text-gray-500'>
                          {a.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Shape */}
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Shape & Icon' />

              <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                Shape
              </div>
              <div className='mb-5.5 grid grid-cols-4 gap-2 sm:grid-cols-5'>
                {BUBBLE_SHAPES.map((s) => {
                  const active = bubbleShape === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setBubbleShape(s.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 rounded-xl px-1.5 py-3.5 transition',
                        active
                          ? ''
                          : 'border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900',
                      )}
                      style={
                        active
                          ? {
                              border: `1.5px solid ${brandColor}`,
                              background: rgba(brandColor, 0.06),
                            }
                          : undefined
                      }
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          background: `linear-gradient(135deg, ${bubbleColor}, ${lighten(bubbleColor, 0.2)})`,
                          ...getBubbleShapeStyle(s.id),
                        }}
                      />
                      <span
                        className='type-caption font-semibold'
                        style={{ color: active ? brandColor : undefined }}
                      >
                        <span
                          className={
                            !active ? 'text-gray-400 dark:text-gray-500' : ''
                          }
                        >
                          {s.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                Icon
              </div>
              <div
                className='mb-5.5 grid grid-cols-4 gap-2 transition-opacity sm:grid-cols-6'
                style={{
                  opacity: adv.launcher_custom_icon_url ? 0.4 : 1,
                  pointerEvents: adv.launcher_custom_icon_url ? 'none' : 'auto',
                }}
              >
                {BUBBLE_ICONS.map((ic) => {
                  const active = bubbleIcon === ic.id;
                  return (
                    <button
                      key={ic.id}
                      onClick={() => setBubbleIcon(ic.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl px-1 py-3 transition',
                        active
                          ? ''
                          : 'border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900',
                      )}
                      style={
                        active
                          ? {
                              border: `1.5px solid ${brandColor}`,
                              background: rgba(brandColor, 0.06),
                            }
                          : undefined
                      }
                    >
                      <svg
                        viewBox='0 0 24 24'
                        width='20'
                        height='20'
                        fill={active ? brandColor : undefined}
                        className={
                          !active ? 'fill-gray-500 dark:fill-gray-400' : ''
                        }
                      >
                        <path d={ic.path} />
                      </svg>
                      <span
                        className='type-caption font-semibold'
                        style={{ color: active ? brandColor : undefined }}
                      >
                        <span
                          className={
                            !active ? 'text-gray-400 dark:text-gray-500' : ''
                          }
                        >
                          {ic.label}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {adv.launcher_custom_icon_url && (
                <div className='-mt-3.5 mb-5.5 rounded-(--radius-control) border border-dashed border-gray-200 bg-gray-50 px-3 py-2 type-small text-gray-400 dark:border-gray-800 dark:bg-white/3 dark:text-gray-500'>
                  Icon set disabled — you have a custom icon uploaded below.
                  Remove it to switch back.
                </div>
              )}

              {/* Icon size */}
              <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                Icon Size
              </div>
              <div className='mb-5.5'>
                <Segmented
                  options={LAUNCHER_ICON_SIZES.map((s) => ({
                    id: s.id,
                    label: s.label,
                  }))}
                  value={adv.launcher_icon_size || 'medium'}
                  onChange={(v) => patchAdv({ launcher_icon_size: v as 'small' | 'medium' | 'large' })}
                  accent={brandColor}
                />
              </div>

              {/* Custom icon upload */}
              <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                Custom Icon
                <span className='ml-1.5 font-medium opacity-70'>
                  · SVG or PNG, overrides the icon set above
                </span>
              </div>
              <div className='flex items-center gap-3 rounded-xl border border-gray-300 bg-white p-3 dark:border-gray-700 dark:bg-gray-900'>
                <div
                  className='flex h-13 w-13 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-gray-300 dark:border-gray-700'
                  style={{
                    background: adv.launcher_custom_icon_url
                      ? `linear-gradient(135deg, ${bubbleColor}, ${lighten(bubbleColor, 0.2)})`
                      : undefined,
                    borderStyle: adv.launcher_custom_icon_url
                      ? 'solid'
                      : 'dashed',
                    borderColor: adv.launcher_custom_icon_url
                      ? 'transparent'
                      : undefined,
                  }}
                >
                  {adv.launcher_custom_icon_url ? (
                    <img
                      src={adv.launcher_custom_icon_url}
                      alt='Custom icon'
                      style={{ width: 26, height: 26, objectFit: 'contain' }}
                    />
                  ) : (
                    <Upload
                      size={18}
                      className='text-gray-400 dark:text-gray-500'
                    />
                  )}
                </div>
                <div className='min-w-0 flex-1'>
                  <input
                    type='file'
                    ref={iconFileRef}
                    onChange={handleLauncherIconSelect}
                    accept='image/svg+xml,image/png,image/webp'
                    className='hidden'
                  />
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      onClick={() => iconFileRef.current?.click()}
                    >
                      <Upload size={12} />
                      {adv.launcher_custom_icon_url
                        ? 'Replace icon'
                        : 'Upload icon'}
                    </Button>
                    {adv.launcher_custom_icon_url && (
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='text-gray-400 dark:text-gray-500'
                        onClick={() =>
                          patchAdv({ launcher_custom_icon_url: '' })
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className='mt-1.5 type-small text-gray-400 dark:text-gray-500'>
                    Best results with a transparent-background SVG or PNG · max
                    1 MB. Colored icons keep their colors; monochrome white SVGs
                    work with any bubble style.
                  </div>
                  <label className='mt-2 inline-flex cursor-pointer items-center gap-2 type-small text-gray-500 dark:text-gray-400'>
                    <input
                      type='checkbox'
                      checked={iconRemoveBg}
                      onChange={(e) => setIconRemoveBg(e.target.checked)}
                      className='cursor-pointer accent-brand-500'
                    />
                    <span>
                      <b className='text-gray-800 dark:text-white/90'>
                        Auto-remove background
                      </b>{' '}
                      on upload
                      <span className='ml-1 opacity-70'>
                        · makes solid backgrounds transparent
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Size + badge */}
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Size & Badge' />

              <div className='mb-4.5'>
                <div className='mb-1.5 flex justify-between'>
                  <span className='type-small font-medium text-gray-500 dark:text-gray-400'>
                    Launcher size
                  </span>
                  <span className='type-small font-semibold text-gray-800 dark:text-white/90'>
                    {adv.launcher_size}px
                  </span>
                </div>
                <input
                  type='range'
                  min={44}
                  max={80}
                  step={2}
                  value={adv.launcher_size}
                  onChange={(e) =>
                    patchAdv({ launcher_size: Number(e.target.value) })
                  }
                  className='w-full accent-brand-500'
                />
              </div>

              <ToggleRow
                title='Show unread badge'
                desc="Red '1' indicator on the launcher"
                checked={adv.show_unread_badge}
                onChange={(v) => patchAdv({ show_unread_badge: v })}
                mb={0}
              />
            </div>

            {/* Teaser */}
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Teaser Message' />
              <TextField
                label='Teaser text'
                value={adv.teaser_text}
                onChange={(v) => patchAdv({ teaser_text: v })}
                placeholder='Chat with us'
              />
              <div>
                <div className='mb-1.5 flex justify-between'>
                  <span className='type-small font-medium text-gray-500 dark:text-gray-400'>
                    Teaser delay
                  </span>
                  <span className='type-small font-semibold text-gray-800 dark:text-white/90'>
                    {adv.teaser_delay_ms === 0
                      ? 'immediately'
                      : `${adv.teaser_delay_ms / 1000}s`}
                  </span>
                </div>
                <input
                  type='range'
                  min={0}
                  max={20000}
                  step={1000}
                  value={adv.teaser_delay_ms}
                  onChange={(e) =>
                    patchAdv({ teaser_delay_ms: Number(e.target.value) })
                  }
                  className='w-full accent-brand-500'
                />
              </div>
            </div>
          </div>
        );

      /* ── BRANDING ────────────────────────────────────────────────────── */
      case 'branding':
        return (
          <div className='flex flex-col gap-5'>
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Branding' />

              <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                Logo (optional)
              </div>
              <div className='mb-5 flex items-center gap-3'>
                <div className='flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-900'>
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt='Logo'
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <User
                      size={28}
                      className='text-gray-400 dark:text-gray-500'
                    />
                  )}
                </div>
                <div className='flex-1'>
                  <input
                    type='file'
                    ref={fileRef}
                    onChange={handleLogoSelect}
                    accept='image/*'
                    className='hidden'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload size={14} />
                    {avatarUrl ? 'Change logo' : 'Upload logo'}
                  </Button>
                  {avatarUrl && (
                    <Button
                      type='button'
                      variant='outline'
                      size='sm'
                      className='ml-2 text-gray-400 dark:text-gray-500'
                      onClick={() => setAvatarUrl('')}
                    >
                      Remove
                    </Button>
                  )}
                  <div className='mt-1.5 type-caption text-gray-400 dark:text-gray-500'>
                    PNG or JPG · max 2MB. Recommended: transparent PNG on light
                    and dark backgrounds.
                  </div>
                  <label className='mt-2 inline-flex cursor-pointer items-center gap-2 type-caption text-gray-500 dark:text-gray-400'>
                    <input
                      type='checkbox'
                      checked={logoRemoveBg}
                      onChange={(e) => setLogoRemoveBg(e.target.checked)}
                      className='cursor-pointer accent-brand-500'
                    />
                    <span>
                      <b className='text-gray-800 dark:text-white/90'>
                        Auto-remove background
                      </b>{' '}
                      on upload
                      <span className='ml-1 opacity-70'>
                        · best for solid-color backgrounds
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <TextField
                label='Company name (widget title)'
                value={widgetTitle}
                onChange={setWidgetTitle}
                placeholder='Acme Support'
              />
              <TextField
                label='Greeting heading (e.g. "Hello", "Hi there!")'
                value={adv.greeting_heading}
                onChange={(v) => patchAdv({ greeting_heading: v })}
                placeholder='Hello'
              />
              <TextField
                label='Headline text (shown under greeting)'
                value={greetingText}
                onChange={setGreetingText}
                placeholder='How can we help you today?'
                mb={20}
              />

              <ToggleRow
                title='Hide "Powered by Lashvae"'
                desc='Removes the branding footer from the widget.'
                checked={adv.hide_branding}
                onChange={(v) => patchAdv({ hide_branding: v })}
                mb={0}
              />
            </div>
          </div>
        );

      /* ── CONTENT (tabs) ──────────────────────────────────────────────── */
      case 'content':
        return (
          <div className='flex flex-col gap-5'>
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Home Tab' />
              <ToggleRow
                title='Show Home tab'
                desc='Landing screen with a friendly greeting and contact topics.'
                checked={adv.enable_home}
                onChange={(v) => patchAdv({ enable_home: v })}
                large
              />
              {adv.enable_home && (
                <>
                  <div className='mb-2 type-small font-semibold text-gray-500 dark:text-gray-400'>
                    Contact topics
                  </div>
                  <TopicEditor
                    topics={adv.contact_topics}
                    onChange={(t) => patchAdv({ contact_topics: t })}
                  />
                </>
              )}
            </div>

            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Help Center Tab' />
              <ToggleRow
                title='Show Help Center tab'
                desc='Show a searchable list of FAQs inside the widget.'
                checked={adv.enable_faq}
                onChange={(v) => patchAdv({ enable_faq: v })}
                large
              />
              {adv.enable_faq && (
                <>
                  <div className='mb-2 type-small font-semibold text-gray-500 dark:text-gray-400'>
                    FAQ articles
                  </div>
                  <FaqEditor
                    items={adv.faq_items}
                    onChange={(f) => patchAdv({ faq_items: f })}
                  />
                </>
              )}
            </div>

            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Survey Tab' />
              <ToggleRow
                title='Show Survey tab'
                desc='Collect ratings and quick feedback from visitors.'
                checked={adv.enable_survey}
                onChange={(v) => patchAdv({ enable_survey: v })}
                mb={0}
                large
              />
            </div>
          </div>
        );

      /* ── LEAD CAPTURE ────────────────────────────────────────────────── */
      /* ── LEAD CAPTURE ────────────────────────────────────────────────── */
      case 'leadcapture':
        return (
          <div className='flex flex-col gap-5'>
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Lead Capture' />

              <p className='-mt-2 mb-4.5 type-small text-gray-500 dark:text-gray-400'>
                Ask visitors for a few details before they start chatting.
              </p>

              <div className='space-y-1'>
                <ToggleRow
                  title='Ask for name'
                  checked={collectName}
                  onChange={setCollectName}
                />

                <ToggleRow
                  title='Ask for email'
                  checked={collectEmail}
                  onChange={setCollectEmail}
                />
              </div>

              <div className='mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800'>
                <div className='mb-5'>
                  <h3 className='type-small font-semibold text-gray-800 dark:text-white/90'>
                    Privacy & consent
                  </h3>

                  <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
                    Control how visitor consent is collected before tracking or
                    profiling.
                  </p>
                </div>

                <ToggleRow
                  title='GDPR consent'
                  desc='Require visitors to agree before chatting.'
                  checked={adv.gdpr_enabled}
                  onChange={(v) => patchAdv({ gdpr_enabled: v })}
                  mb={16}
                />

                {adv.gdpr_enabled && (
                  <div className='mb-4'>
                    <TextField
                      label='Privacy policy URL'
                      value={adv.gdpr_privacy_url}
                      onChange={(v) => patchAdv({ gdpr_privacy_url: v })}
                      placeholder='https://yoursite.com/privacy'
                      mb={0}
                    />
                  </div>
                )}

                <ToggleRow
                  title='Marketing consent'
                  desc='Ask before sending product updates or promotional emails.'
                  checked={adv.marketing_consent_enabled}
                  onChange={(v) => patchAdv({ marketing_consent_enabled: v })}
                  mb={16}
                />

                {adv.marketing_consent_enabled && (
                  <div className='mb-4'>
                    <TextField
                      label='Marketing consent text'
                      value={adv.marketing_consent_text}
                      onChange={(v) => patchAdv({ marketing_consent_text: v })}
                      placeholder='I would like to receive product updates and offers by email.'
                      mb={0}
                    />
                  </div>
                )}

                <ToggleRow
                  title='Age verification'
                  desc='Ask visitors to confirm they are 16+ before chatting.'
                  checked={adv.age_assurance_enabled}
                  onChange={(v) => patchAdv({ age_assurance_enabled: v })}
                  mb={16}
                />

                <ToggleRow
                  title='Activity tracking'
                  desc='Ask before remembering pages viewed and time spent.'
                  checked={adv.activity_tracking_enabled}
                  onChange={(v) => patchAdv({ activity_tracking_enabled: v })}
                  mb={16}
                />

                <ToggleRow
                  title='Lead profiling consent'
                  desc='Ask before automatically building visitor profiles or scoring leads.'
                  checked={adv.lead_profiling_consent_enabled}
                  onChange={(v) =>
                    patchAdv({ lead_profiling_consent_enabled: v })
                  }
                  mb={0}
                />
              </div>
            </div>

            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Custom Details' />

              <ToggleRow
                title='Collect additional info'
                desc='Add custom questions to the lead form.'
                checked={customDetails}
                onChange={setCustomDetails}
              />

              {customDetails && (
                <>
                  <div className='mb-3 flex flex-col gap-3'>
                    {customDetailsFields.map((field, i) => (
                      <CustomFieldEditor
                        key={i}
                        field={field}
                        index={i}
                        onUpdate={updateCustomField}
                        onRemove={removeCustomField}
                      />
                    ))}
                  </div>

                  <Button
                    type='button'
                    variant='outline'
                    className='w-full border-dashed text-gray-500 dark:text-gray-400'
                    onClick={addCustomField}
                  >
                    <Plus size={14} />
                    Add Custom Question
                  </Button>
                </>
              )}
            </div>
          </div>
        );

      /* ── PROACTIVE ───────────────────────────────────────────────────── */
      case 'proactive':
        return (
          <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
            <SectionHeader title='Proactive Messages' badge='NEW' />
            <p className='-mt-2 mb-4.5 type-small text-gray-500 dark:text-gray-400'>
              Nudge visitors when they hesitate, exit, or scroll deep — with
              smart, targeted messages that open the chat automatically.
            </p>
            <ProactiveRulesSection
              rules={adv.proactive_rules}
              onChange={(r) => patchAdv({ proactive_rules: r })}
            />
          </div>
        );

      /* ── ADVANCED ────────────────────────────────────────────────────── */
      case 'advanced':
        return (
          <div className='flex flex-col gap-5'>
            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Behavior' />

              <ToggleRow
                title='Notification sound'
                desc='Subtle chime when a new message arrives.'
                checked={adv.sound_enabled}
                onChange={(v) => patchAdv({ sound_enabled: v })}
              />
              <ToggleRow
                title='Hide on mobile'
                desc="Don't display the widget on phones."
                checked={adv.hide_on_mobile}
                onChange={(v) => patchAdv({ hide_on_mobile: v })}
              />

              <div className='mb-4.5'>
                <div className='mb-1.5 flex justify-between'>
                  <span className='type-small font-medium text-gray-500 dark:text-gray-400'>
                    Auto-open delay
                  </span>
                  <span className='type-small font-semibold text-gray-800 dark:text-white/90'>
                    {autoOpenDelayMs === 0
                      ? 'never'
                      : `${autoOpenDelayMs / 1000}s`}
                  </span>
                </div>
                <input
                  type='range'
                  min={0}
                  max={30000}
                  step={1000}
                  value={autoOpenDelayMs}
                  onChange={(e) => setAutoOpenDelayMs(Number(e.target.value))}
                  className='w-full accent-brand-500'
                />
                <div className='mt-1 type-small text-gray-400 dark:text-gray-500'>
                  Automatically open the chat after this many seconds. Set to 0
                  to disable.
                </div>
              </div>

              <div className='mb-1'>
                <div className='mb-2 type-small font-medium text-gray-500 dark:text-gray-400'>
                  Widget Language
                </div>
                <select
                  value={adv.widget_language}
                  onChange={(e) =>
                    patchAdv({ widget_language: e.target.value })
                  }
                  className='h-10 w-full rounded-(--radius-control) border border-gray-300 bg-transparent px-3 type-small text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90'
                >
                  {WIDGET_LANGUAGES.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/3'>
              <SectionHeader title='Business Hours' />
              <ToggleRow
                title='Enable business hours'
                desc='Show an offline message outside your working hours.'
                checked={adv.business_hours_enabled}
                onChange={(v) => patchAdv({ business_hours_enabled: v })}
                mb={adv.business_hours_enabled ? 12 : 0}
              />
              {adv.business_hours_enabled && (
                <TextField
                  label='Offline message'
                  value={offlineMessage}
                  onChange={setOfflineMessage}
                  placeholder="We're offline — leave a message and we'll get back to you soon."
                  mb={0}
                />
              )}
            </div>

            {isActive && (
              <div className='rounded-2xl border border-error-200 bg-white p-6 dark:border-error-500/30 dark:bg-white/3'>
                <SectionHeader title='Disconnect Widget' />
                <p className='-mt-2 mb-4 type-small text-gray-500 dark:text-gray-400'>
                  Stop the widget from loading on your website. You can
                  reconnect any time.
                </p>
                <Button
                  variant='outline'
                  className='border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10'
                  onClick={() => setShowDisconnectConfirm(true)}
                >
                  Disconnect widget
                </Button>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  }

  /* ══════════════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════════════ */
  return (
    <>
      <style>{`
  .cw-admin-page {
    --cw-text: ${c.textPrimary};
    --cw-sub: ${c.textSub};
    --cw-muted: ${c.textMuted};
    --cw-border: ${c.cardBorder};
    --cw-input: ${c.inputBorder};
  }

  .cw-admin-page * {
    letter-spacing: 0;
  }

  .cw-admin-page button,
  .cw-admin-page input,
  .cw-admin-page textarea,
  .cw-admin-page select {
    font-family: inherit;
  }

  .cw-admin-page input:not([type="color"]):not([type="range"]):not([data-slot="input"]),
  .cw-admin-page select,
  .cw-admin-page textarea {
    min-height: 44px;
    border-radius: 8px !important;
    font-size: 14px !important;
    line-height: 20px !important;
    font-weight: 400 !important;
    box-shadow: ${isDark ? 'none' : '0 1px 2px rgba(16,24,40,.05)'};
  }

  .cw-admin-page input[type="range"] {
    accent-color: #465fff;
  }

  .cw-admin-page p {
    font-size: 14px;
    line-height: 20px;
  }

  /*
   * Desktop/laptop:
   * sidebar + settings + preview in one row
   */
  .cw-grid {
    grid-template-columns: 260px minmax(0, 1fr) 340px !important;
  }

  .cw-rail {
    grid-column: auto !important;
    position: sticky !important;
    top: 24px !important;
  }

  /*
   * Smaller laptop/tablet:
   * sidebar + settings, preview below
   */
  @media (max-width: 1279px) {
    .cw-grid {
      grid-template-columns: 250px minmax(0, 1fr) !important;
    }

    .cw-rail {
      grid-column: 1 / -1 !important;
      position: static !important;
      top: auto !important;
    }
  }

  /*
   * Mobile:
   * single content column
   */
  @media (max-width: 820px) {
    .cw-grid {
      grid-template-columns: minmax(0, 1fr) !important;
    }

    .cw-sidebar-col {
      display: none !important;
    }
  }

  @keyframes cw-fade {
    from {
      opacity: 0;
      transform: translateY(6px);
    }

    to {
      opacity: 1;
      transform: none;
    }
  }

  @keyframes pw-wave-anim {
    0%,
    60%,
    100% {
      transform: rotate(0);
    }

    10%,
    30% {
      transform: rotate(-14deg);
    }

    20% {
      transform: rotate(14deg);
    }
  }

  .pw-wave {
    animation: pw-wave-anim 2.4s ease-in-out infinite;
    transform-origin: 70% 70%;
  }

  @keyframes pw-dot-anim {
    0%,
    80%,
    100% {
      transform: scale(.7);
      opacity: .4;
    }

    40% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .pw-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: pw-dot-anim 1.3s infinite ease-in-out;
  }

  .pw-dot2 {
    animation-delay: .18s;
  }

  .pw-dot3 {
    animation-delay: .36s;
  }
    .cw-grid-no-rail {
  grid-template-columns: 260px minmax(0, 1fr) !important;
}
`}</style>

      <div className='cw-admin-page mx-auto max-w-360 px-4 py-8'>
        {/* ── Top bar ────────────────────────────────────────────────── */}
        <div className='mx-auto mb-6 flex max-w-350 flex-wrap items-center justify-between gap-4'>
          <div className='flex min-w-0 items-center gap-3.5'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => router.push('/channels')}
            >
              <ArrowLeft size={14} />
              Back
            </Button>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-3'>
                <h1 className='text-title-sm font-bold text-gray-800 dark:text-white/90'>
                  Website Chatbot
                </h1>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 type-caption font-medium uppercase',
                    isActive
                      ? 'border-success-200 bg-success-50 text-success-600 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-500'
                      : 'border-gray-200 bg-gray-100 text-gray-400 dark:border-gray-800 dark:bg-white/5 dark:text-gray-500',
                  )}
                >
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      isActive
                        ? 'bg-success-500'
                        : 'bg-gray-400 dark:bg-gray-500',
                    )}
                  />
                  {isActive ? 'Live' : 'Offline'}
                </span>
              </div>
              <div className='mt-1 truncate type-small text-gray-500 dark:text-gray-400'>
                Install, customize, and manage your website chat widget.
              </div>
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <Button variant='outline' size='sm' onClick={handleReset}>
              <RotateCcw size={13} />
              Reset
            </Button>
            <Button
              size='sm'
              onClick={handleSave}
              disabled={saving}
              className={cn(saved && 'bg-success-500 hover:bg-success-600')}
            >
              {saved ? (
                <>
                  <Check size={14} /> Saved
                </>
              ) : saving ? (
                'Saving...'
              ) : (
                <>
                  <Save size={14} /> Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ── 3-column grid ─────────────────────────────────────────── */}
        <div
          className={cn(
            'cw-grid mx-auto grid w-full max-w-400 items-start gap-6',
            hideRightRail && 'cw-grid-no-rail',
          )}
        >
          {/* Sidebar column */}
          <div className='cw-sidebar-col'>
            <Sidebar
              activeSection={activeSection}
              onSelect={setActiveSection}
              router={router}
            />
          </div>

          {/* Center content column */}
          <div
            style={{ minWidth: 0, animation: 'cw-fade .25s ease' }}
            key={activeSection}
          >
            {renderSection()}
          </div>

          {/* Right rail column */}
          {!hideRightRail && (
            <div className='cw-rail sticky top-6 flex flex-col gap-4'>
              <div className='rounded-2xl border border-gray-200 bg-white p-4.5 dark:border-gray-800 dark:bg-white/3'>
                <div className='mb-3.5 flex items-center justify-between gap-2'>
                  <div className='flex items-center gap-2'>
                    <Eye
                      size={15}
                      className='text-gray-500 dark:text-gray-400'
                    />
                    <span className='type-body font-semibold text-gray-800 dark:text-white/90'>
                      Live Preview
                    </span>
                  </div>
                  <Segmented
                    options={[
                      { id: 'widget', label: 'Widget' },
                      { id: 'bubble', label: 'Bubble' },
                    ]}
                    value={previewTab}
                    onChange={(v) => setPreviewTab(v as 'widget' | 'bubble')}
                    accent={brandColor}
                  />
                </div>

                {previewTab === 'widget' ? (
                  <>
                    <div className='flex justify-center py-2'>
                      <div className='inline-flex gap-0.5 rounded-(--radius-control) bg-gray-100 p-0.5 dark:bg-white/5'>
                        <button
                          onClick={() => setDevice('desktop')}
                          className='inline-flex items-center gap-1.5 rounded-(--radius-control) px-3 py-1.5 type-caption font-medium'
                          style={{
                            background:
                              device === 'desktop' ? brandColor : 'transparent',
                            color: device === 'desktop' ? '#fff' : undefined,
                          }}
                        >
                          <Monitor
                            size={12}
                            className={
                              device !== 'desktop'
                                ? 'text-gray-400 dark:text-gray-500'
                                : ''
                            }
                          />
                          <span
                            className={
                              device !== 'desktop'
                                ? 'text-gray-400 dark:text-gray-500'
                                : ''
                            }
                          >
                            Desktop
                          </span>
                        </button>
                        <button
                          onClick={() => setDevice('mobile')}
                          className='inline-flex items-center gap-1.5 rounded-(--radius-control) px-3 py-1.5 type-caption font-medium'
                          style={{
                            background:
                              device === 'mobile' ? brandColor : 'transparent',
                            color: device === 'mobile' ? '#fff' : undefined,
                          }}
                        >
                          <Smartphone
                            size={12}
                            className={
                              device !== 'mobile'
                                ? 'text-gray-400 dark:text-gray-500'
                                : ''
                            }
                          />
                          <span
                            className={
                              device !== 'mobile'
                                ? 'text-gray-400 dark:text-gray-500'
                                : ''
                            }
                          >
                            Mobile
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className='flex justify-center py-1.5'>
                      <LivePreview
                        brandColor={brandColor}
                        widgetTitle={widgetTitle}
                        greetingText={greetingText}
                        avatarUrl={avatarUrl}
                        collectName={collectName}
                        collectEmail={collectEmail}
                        customDetails={customDetails}
                        customDetailsFields={customDetailsFields}
                        adv={adv}
                        dashboardDark={isDark}
                        device={device}
                      />
                    </div>
                  </>
                ) : (
                  <div className='py-1.5'>
                    <BubblePreview
                      bubbleColor={bubbleColor}
                      bubbleShape={bubbleShape}
                      bubbleIcon={bubbleIcon}
                      position={position}
                      widgetTitle={widgetTitle}
                      isDark={isDark}
                      adv={adv}
                    />
                  </div>
                )}
              </div>

              {/* Widget status card */}
              <div className='rounded-2xl border border-gray-200 bg-white p-4.5 dark:border-gray-800 dark:bg-white/3'>
                <div className='mb-3 flex items-center gap-2'>
                  <Sparkles
                    size={15}
                    className='text-gray-500 dark:text-gray-400'
                  />
                  <span className='type-body font-semibold text-gray-800 dark:text-white/90'>
                    Widget Status
                  </span>
                </div>
                <div className='mb-3 flex items-center justify-between rounded-(--radius-control) border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/2'>
                  <span className='type-small font-medium text-gray-500 dark:text-gray-400'>
                    Connection
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1 type-caption font-medium uppercase',
                      isActive
                        ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
                        : 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500',
                    )}
                  >
                    <span
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isActive
                          ? 'bg-success-500'
                          : 'bg-gray-400 dark:bg-gray-500',
                      )}
                    />
                    {isActive ? 'Live' : 'Offline'}
                  </span>
                </div>
                <Button
                  variant='outline'
                  size='sm'
                  className='mb-2 w-full'
                  onClick={() => setActiveSection('install')}
                >
                  <Copy size={12} />
                  View Embed Script
                </Button>
                <Button
                  variant='outline'
                  size='sm'
                  className='w-full'
                  onClick={() => setActiveSection('testing')}
                >
                  <TestTube size={12} />
                  Quick Testing
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Disconnect confirmation modal ───────────────────────────── */}
      {showDisconnectConfirm && (
        <DisconnectConfirmModal
          saving={saving}
          onCancel={() => setShowDisconnectConfirm(false)}
          onConfirm={handleDisableWidget}
        />
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DEFAULT EXPORT
   ══════════════════════════════════════════════════════════════════════════ */

export default function CustomizeChatPage() {
  return (
    <RequireAuth>
      <CustomizeChatInner />
    </RequireAuth>
  );
}
