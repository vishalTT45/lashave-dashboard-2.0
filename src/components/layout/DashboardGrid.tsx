"use client";

/**
 * DashboardGrid.tsx
 * ─────────────────────────────────────────────────────────────────
 * Responsive grid primitives for every layout pattern in the
 * dashboard. Pages import these instead of hardcoding
 * gridTemplateColumns or inline media queries.
 *
 * All layout is driven by CSS classes defined in dashboard.css
 * (imported once in app/layout.tsx). The components are thin
 * wrappers — they handle layout only, never colours or theme.
 *
 * Exports
 * ────────
 *   <KpiGrid>              2 cols → 4 cols at lg
 *   <ChannelStrip>         2 → 3 → 6 cols
 *   <ChartRowMain>         stacked → 2fr + 1fr at lg
 *   <ChartRowSecondary>    stacked → 1fr + 2fr at lg
 *   <ChartRowEqual>        stacked → 1fr + 1fr at lg
 *   <ChartRowThirds>       stacked → 3 equal cols at lg
 *   <HeaderRow>            flex-col → flex-row at md
 *   <OnboardingLayout>     single col → sidebar + content at sm
 *   <BizPickerGrid>        2 cols → 3 cols at sm
 *   <GridItem>             column/row span helper
 *   <SectionLabel>         consistent uppercase label above cards
 * ─────────────────────────────────────────────────────────────────
 */

import type { CSSProperties, ReactNode } from "react";

/* shared gap used in every grid — sourced from the foundation's
   --layout-grid-gap token (globals.css) so this file and the generic
   primitives in primitives.tsx never drift apart. */
const GAP = "var(--layout-grid-gap)";

/* ── shared prop shape (no polymorphic `as` — that caused the error) ── */
interface DivProps {
  children:   ReactNode;
  className?: string;
  style?:     CSSProperties;
}

/* ══════════════════════════════════════════════════════════════════
   KpiGrid
   Mobile: 2 cols  |  Desktop (1024px+): 4 cols
   CSS class: .kpi-grid  (defined in dashboard.css)
══════════════════════════════════════════════════════════════════ */
export function KpiGrid({ children, className = "", style }: DivProps) {
  return (
    <div className={`kpi-grid ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ChannelStrip
   Mobile: 2 cols  |  Tablet (640px+): 3 cols  |  Desktop: 6 cols
   CSS class: .channel-strip
══════════════════════════════════════════════════════════════════ */
export function ChannelStrip({ children, className = "", style }: DivProps) {
  return (
    <div className={`channel-strip ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ChartRowMain
   Mobile: 1 col  |  Desktop: 2fr left + 1fr right
   Used for: MessagesChart (large) + Pipeline (small)
   CSS class: .chart-row-main
══════════════════════════════════════════════════════════════════ */
export function ChartRowMain({ children, className = "", style }: DivProps) {
  return (
    <div className={`chart-row-main ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ChartRowSecondary
   Mobile: 1 col  |  Desktop: 1fr left + 2fr right
   Used for: Leads bar (small) + Heatmap (large)
   CSS class: .chart-row-secondary
══════════════════════════════════════════════════════════════════ */
export function ChartRowSecondary({ children, className = "", style }: DivProps) {
  return (
    <div className={`chart-row-secondary ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ChartRowEqual
   Mobile: 1 col  |  Desktop: 1fr + 1fr
   General-purpose two-column row when both cards are equal width.
══════════════════════════════════════════════════════════════════ */
export function ChartRowEqual({ children, className = "", style }: DivProps) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: GAP,
        ...style,
      }}
    >
      {children}
      <style>{`
        @media (min-width: 1024px) {
          .crq-inner { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/**
 * Wrap ChartRowEqual's children in this to get the responsive
 * behaviour. The outer ChartRowEqual handles the animation delay /
 * extra className; this inner div handles the actual columns.
 *
 * Usage:
 *   <ChartRowEqual>
 *     <ChartRowEqualInner>
 *       <ChartCard>…</ChartCard>
 *       <ChartCard>…</ChartCard>
 *     </ChartRowEqualInner>
 *   </ChartRowEqual>
 *
 * Or simply use the CSS class directly:
 *   <div className="crq-inner" style={{ display:"grid", gap:"0.75rem" }}>
 */
export function ChartRowEqualInner({ children, className = "", style }: DivProps) {
  return (
    <div
      className={`crq-inner ${className}`}
      style={{ display: "grid", gridTemplateColumns: "1fr", gap: GAP, ...style }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ChartRowThirds
   Mobile: 1 col  |  Desktop: 3 equal columns
   For pages that have three medium-sized chart cards side-by-side.
══════════════════════════════════════════════════════════════════ */
export function ChartRowThirds({ children, className = "", style }: DivProps) {
  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: GAP,
        ...style,
      }}
    >
      {children}
      <style>{`
        @media (min-width: 1024px) {
          .crt-inner { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

export function ChartRowThirdsInner({ children, className = "", style }: DivProps) {
  return (
    <div
      className={`crt-inner ${className}`}
      style={{ display: "grid", gridTemplateColumns: "1fr", gap: GAP, ...style }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   HeaderRow
   Mobile: flex-col  |  Tablet (768px+): flex-row, space-between
   CSS class: .header-row  (defined in dashboard.css)
══════════════════════════════════════════════════════════════════ */
export function HeaderRow({ children, className = "", style }: DivProps) {
  return (
    <div className={`header-row ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   OnboardingLayout
   Sidebar + content split. Sidebar is hidden on mobile.
   Accepts token strings directly so the component stays theme-aware
   without importing useTheme (avoids coupling layout to theme).
══════════════════════════════════════════════════════════════════ */
interface OnboardingLayoutProps {
  sidebar:             ReactNode;
  content:             ReactNode;
  className?:          string;
  style?:              CSSProperties;
  borderColor?:        string;
  sidebarBg?:          string;
  sidebarBorderColor?: string;
}

export function OnboardingLayout({
  sidebar,
  content,
  className = "",
  style,
  borderColor        = "rgba(141,166,255,0.2)",
  sidebarBg          = "rgba(8,12,28,0.88)",
  sidebarBorderColor = "rgba(141,166,255,0.12)",
}: OnboardingLayoutProps) {
  return (
    <>
      {/* Scoped breakpoint styles — no Tailwind required */}
      <style>{`
        .onb-layout  { display: grid; grid-template-columns: 1fr; }
        .onb-sidebar { display: none; }
        @media (min-width: 640px) {
          .onb-layout  { grid-template-columns: 200px 1fr; }
          .onb-sidebar { display: block; }
        }
      `}</style>

      <div
        className={`onb-layout ${className}`}
        style={{
          borderRadius: 16,
          border:       `1px solid ${borderColor}`,
          overflow:     "hidden",
          animation:    "slide-up .5s cubic-bezier(.34,1.2,.64,1) both",
          ...style,
        }}
      >
        {/* Sidebar — hidden below 640 px */}
        <div
          className="onb-sidebar"
          style={{
            background:  sidebarBg,
            borderRight: `1px solid ${sidebarBorderColor}`,
            padding:     "20px 18px",
          }}
        >
          {sidebar}
        </div>

        {/* Main content */}
        <div style={{ padding: "22px 24px" }}>
          {content}
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   BizPickerGrid
   Mobile: 2 cols  |  Tablet (480px+): 3 cols
   CSS class: .biz-picker-grid  (defined in dashboard.css)
══════════════════════════════════════════════════════════════════ */
export function BizPickerGrid({ children, className = "", style }: DivProps) {
  return (
    <div className={`biz-picker-grid ${className}`} style={style}>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   GridItem
   Column / row span helper. Works inside any grid primitive above.

   Usage:
     <KpiGrid>
       <KpiCard ... />
       <GridItem span={2}><WideCard /></GridItem>
       <KpiCard ... />
     </KpiGrid>
══════════════════════════════════════════════════════════════════ */
interface GridItemProps {
  children:   ReactNode;
  /** Columns to span — default 1 (no explicit span set) */
  span?:      number;
  /** Rows to span — default 1 */
  rowSpan?:   number;
  className?: string;
  style?:     CSSProperties;
}

export function GridItem({
  children,
  span    = 1,
  rowSpan = 1,
  className = "",
  style,
}: GridItemProps) {
  return (
    <div
      className={className}
      style={{
        gridColumn: span    > 1 ? `span ${span}`    : undefined,
        gridRow:    rowSpan > 1 ? `span ${rowSpan}` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SectionLabel
   Tiny uppercase label used above chart cards.
   Centralised so font-size / letter-spacing are consistent.

   Usage:
     <SectionLabel color={t.labelColor}>Messages · daily</SectionLabel>
══════════════════════════════════════════════════════════════════ */
interface SectionLabelProps {
  children:  ReactNode;
  color?:    string;
  style?:    CSSProperties;
  className?: string;
}

export function SectionLabel({
  children,
  color = "rgba(182,193,222,0.5)",
  style,
  className = "",
}: SectionLabelProps) {
  return (
    <p
      className={className}
      style={{
        fontSize:      10,
        fontWeight:    700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color,
        marginBottom:  4,
        ...style,
      }}
    >
      {children}
    </p>
  );
}