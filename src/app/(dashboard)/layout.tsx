"use client";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Backdrop } from "@/components/layout/Backdrop";
import { GlobalBillingBanner } from "@/components/GlobalBillingBanner";
import { BillingProvider } from "@/lib/billing-context";
import { Container } from "@/components/layout/primitives";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <BillingProvider>
      {/*
        CSS Grid is the single source of truth for the sidebar/content
        split at desktop widths — this replaces an earlier version that
        computed the sidebar's `left`, the content's `margin-left`, and
        the content's `width` as three *independent* calc()s that all
        had to individually agree on the same layout. That's exactly
        what caused the gap/scroll-pinning/zoom-transition bugs: three
        sources of truth for one measurement will eventually drift.

        `lg:grid-cols-[auto_minmax(0,1fr)]` needs no sidebar-width
        variable of its own: an `auto` track sizes itself to match
        whatever width its content (the sidebar) actually has right
        now, so it automatically follows the sidebar's own width
        through both its expand/collapse states *and* its transition
        animation, frame for frame — nothing here needs to know or
        duplicate whether the sidebar is currently 90px or 240px.
        (Known trade-off, left as-is for now: this means a temporary
        hover-expand in the compact-rail bucket also nudges the content
        column rather than purely overlaying on top of it. Revisit with
        a decoupled track if that becomes a real complaint.)

        `max-w + mx-auto` cap the whole shell (sidebar + topbar +
        content together) and center it on very wide viewports, so the
        sidebar/topbar belong to the same bounded shell as the content
        instead of stretching to the true browser edges while only the
        inner page content stays centered.

        Below `lg`, this container has no special `display` at all
        (falls back to a plain block), which is exactly what mobile
        needs: the sidebar is `fixed` (removed from flow, slides in as
        an overlay) and the content wrapper is just an ordinary
        full-width block — no explicit margin/width classes required
        for that case either.
      */}
      <div className="min-h-screen overflow-x-clip bg-background lg:grid lg:grid-cols-[auto_minmax(0,1fr)] max-w-(--layout-shell-max) mx-auto">
        <AppSidebar />
        <Backdrop />
        <div className="min-w-0">
          {/*
            Header + billing banner scroll-pin together as one unit.
            Previously each was independently `position: sticky; top:
            0`, which meant the banner would stick to the very top of
            the viewport too — the same offset the header already
            occupies — and end up hidden behind/under the header
            instead of stacking beneath it. Making *this* wrapper the
            single sticky element (and leaving the header/banner
            themselves un-positioned) means there's one source of
            truth for "what's pinned to the top," and the banner
            naturally stacks below the header's actual rendered height
            instead of both racing for the same `top: 0`.
          */}
          <div className="sticky top-0 z-99999">
            <AppHeader />
            <GlobalBillingBanner />
          </div>
          {/*
            Container owns the page gutter (padding-inline, via the
            `clamp()`-based --layout-page-gutter token) — this wrapper
            only contributes vertical rhythm. Previously this div also
            carried `p-4 md:p-6` (horizontal *and* vertical), which
            stacked with the horizontal gutter every page-level
            <Container> already applies, double-padding every page
            that uses the primitive. Pages that don't use <Container>
            for their own top-level wrapper still get their horizontal
            gutter from here, for free, instead of doing without one.
          */}
          <Container className="py-4 md:py-6">{children}</Container>
        </div>
      </div>
    </BillingProvider>
  );
}