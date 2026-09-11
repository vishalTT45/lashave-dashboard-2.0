'use client';

/**
 * primitives.tsx
 * ─────────────────────────────────────────────────────────────────
 * Generic, composable layout primitives. These carry NO visual
 * styling (colour, border, shadow) — only positioning: width,
 * spacing, direction, and column count. Components (Card, Button,
 * Badge, Table, ...) decide appearance; these primitives decide
 * where things sit.
 *
 * They read from the layout tokens in globals.css (--layout-*,
 * --sidebar-width-*) and the regime classes in dashboard.css
 * (.dashboard-container, .layout-grid), so every page that adopts
 * them automatically shares the same structural rhythm instead of
 * introducing new one-off pixel values.
 *
 * Layout regimes (see dashboard.css for the source of truth):
 *   Mobile   0–767px
 *   Tablet   768–1023px
 *   Desktop  1024px+  — stable; column counts do not change again
 *            above 1024px, regardless of monitor width or browser
 *            zoom. 1024px matches the sidebar's own breakpoint and
 *            every other shared grid in the app — one desktop
 *            boundary throughout, chosen specifically to give more
 *            zoom-in headroom before anything reflows (110% zoom on
 *            an ordinary laptop screen commonly drops the effective
 *            viewport into the 1000-1200px range, and that should
 *            still read as desktop).
 *
 * Exports
 * ────────
 *   <Container>  Centered max-width content boundary + page gutters
 *   <Section>    Vertical rhythm between major page sections
 *   <Stack>      Vertical flex layout with a consistent gap
 *   <Cluster>    Horizontal flex-wrap group (filter bars, tag lists)
 *   <Split>      Header-style row: stacks on mobile/tablet, splits on
 *                desktop
 *   <Grid>       Fixed-column grid with per-regime column counts
 *
 * This file is additive: existing components in DashboardGrid.tsx
 * (KpiGrid, ChannelStrip, ...) keep working. New pages/components
 * should prefer these generic primitives; page-specific grids in
 * DashboardGrid.tsx can be migrated to <Grid> incrementally.
 * ─────────────────────────────────────────────────────────────────
 */

import { cn } from '@/lib/utils';
import type { CSSProperties, ElementType, ReactNode } from 'react';

interface BaseProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Centered content boundary with responsive page gutters. Renders
 * `.dashboard-container` (defined in dashboard.css) — the single
 * source of truth for page max-width + horizontal padding.
 *
 * Replaces ad-hoc `mx-auto w-full max-w-360 px-4 sm:px-6 lg:px-8`.
 */
export function Container({ children, className, style }: BaseProps) {
  return (
    <div className={cn('dashboard-container', className)} style={style}>
      {children}
    </div>
  );
}

/** Vertical spacing before a major section of a page. */
export function Section({ children, className, style }: BaseProps) {
  return (
    <section
      className={className}
      style={{ marginTop: 'var(--layout-section-gap)', ...style }}
    >
      {children}
    </section>
  );
}

type Gap = 'xs' | 'sm' | 'md' | 'lg';
const GAP_VAR: Record<Gap, string> = {
  xs: 'var(--layout-grid-gap-tight)', // 8px
  sm: 'var(--layout-grid-gap)', // 12px
  md: 'var(--layout-card-gap)', // 16px
  lg: 'var(--layout-section-gap)', // 24px
};

interface StackProps extends BaseProps {
  gap?: Gap;
  as?: ElementType;
}

/** Vertical flex stack — replaces ad-hoc `flex flex-col gap-*`. */
export function Stack({
  children,
  className,
  style,
  gap = 'md',
  as: As = 'div',
}: StackProps) {
  return (
    <As className={cn('flex flex-col', className)} style={{ gap: GAP_VAR[gap], ...style }}>
      {children}
    </As>
  );
}

interface ClusterProps extends BaseProps {
  gap?: Gap;
  align?: 'start' | 'center' | 'end';
  justify?: 'start' | 'center' | 'end' | 'between';
}

/**
 * Horizontal, wrapping group of controls — filter bars, tag rows,
 * action groups. Controls wrap as a group when space runs out,
 * instead of the whole page reflowing at an arbitrary breakpoint.
 */
export function Cluster({
  children,
  className,
  style,
  gap = 'sm',
  align = 'center',
  justify = 'start',
}: ClusterProps) {
  const justifyClass = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  }[justify];
  const alignClass = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
  }[align];
  return (
    <div
      className={cn('flex flex-wrap', alignClass, justifyClass, className)}
      style={{ gap: GAP_VAR[gap], ...style }}
    >
      {children}
    </div>
  );
}

interface SplitProps extends BaseProps {
  gap?: Gap;
  /** Breakpoint at which the row splits horizontally. Default 'lg'
   *  (1024px) matches the app's existing header patterns. */
  at?: 'md' | 'lg' | 'xl';
}

/**
 * Header-style row: a title/label block and an action/control block
 * that stack on mobile/tablet and sit side by side on desktop.
 */
export function Split({ children, className, style, gap = 'md', at = 'lg' }: SplitProps) {
  const splitClass = {
    md: 'md:flex-row md:items-center md:justify-between',
    lg: 'lg:flex-row lg:items-center lg:justify-between',
    xl: 'xl:flex-row xl:items-end xl:justify-between',
  }[at];
  return (
    <div className={cn('flex flex-col', splitClass, className)} style={{ gap: GAP_VAR[gap], ...style }}>
      {children}
    </div>
  );
}

interface GridProps extends BaseProps {
  /**
   * Column count per layout regime. Omit `tablet` to inherit the
   * mobile count; desktop is required and is the STABLE composition
   * — it must not change again above 1024px.
   */
  columns: { mobile: number; tablet?: number; desktop: number };
  gap?: Gap;
}

/**
 * Fixed-column grid with distinct, stable column counts per layout
 * regime (mobile <768 / tablet 768–1023 / desktop 1024+). This is
 * the primitive that replaces patterns like
 * `grid-cols-2 lg:grid-cols-4 3xl:grid-cols-8` — the desktop column
 * count is fixed and does not depend on how wide the desktop monitor
 * is or what the browser zoom level is.
 */
export function Grid({ children, className, style, columns, gap = 'sm' }: GridProps) {
  const { mobile, tablet = mobile, desktop } = columns;
  return (
    <div
      className={cn('layout-grid', className)}
      style={
        {
          '--grid-cols-mobile': mobile,
          '--grid-cols-tablet': tablet,
          '--grid-cols-desktop': desktop,
          gap: GAP_VAR[gap],
          ...style,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}