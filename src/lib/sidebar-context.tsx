"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from "react";

type ScreenBucket = "mobile" | "compact" | "desktop";

function getBucket(width: number): ScreenBucket {
  // Three genuinely different layout regimes, based on how much width
  // is actually available — not tied to any specific browser zoom
  // percentage (a screen at 100% and a bigger screen zoomed out can
  // land on the same width, and should behave the same way).
  //
  //   < 1024       : mobile     — sidebar becomes an overlay/drawer.
  //                  Must match the CSS shell's `lg:` (1024px) grid
  //                  breakpoint in `(dashboard)/layout.tsx` /
  //                  `AppSidebar.tsx` exactly: below `lg`, the aside
  //                  is `fixed` + `-translate-x-full` (only visible
  //                  when `isMobileOpen`), and only becomes an in-flow
  //                  `sticky` grid column at `lg` and up. If this
  //                  threshold and the CSS breakpoint ever disagree,
  //                  there's a dead width range where this context
  //                  thinks the sidebar should be a persistent
  //                  collapsed rail but the CSS still has it hidden as
  //                  a closed mobile drawer.
  //   1024 – 1149   : compact    — a collapsed icon-only rail is always
  //                  visible; hovering it temporarily expands over the
  //                  content, and it auto-collapses when the pointer
  //                  moves back into the main content area (see
  //                  AppSidebar.tsx's onMouseEnter/onMouseLeave — that
  //                  hover mechanism already exists and works for any
  //                  collapsed state, so this bucket just needs to
  //                  leave `isExpanded` false and let it do its job).
  //                  This is the state a normal laptop screen lands in
  //                  around ~125% browser zoom.
  //   >= 1150       : desktop    — sidebar fully expanded, exactly as
  //                  at 100% zoom. A normal laptop screen at ~110% zoom
  //                  should still land comfortably in this bucket —
  //                  110% is not meant to look any different from 100%.
  if (width < 1024) return "mobile";
  if (width < 1150) return "compact";
  return "desktop";
}

type SidebarContextType = {
  isExpanded: boolean;
  isMobile: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  openSubmenu: string | null;
  toggleSidebar: () => void;
  toggleMobileSidebar: () => void;
  setIsHovered: (isHovered: boolean) => void;
  toggleSubmenu: (item: string) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const prevBucket = useRef<ScreenBucket | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const bucket = getBucket(window.innerWidth);
      const mobile = bucket === "mobile";
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);

      // Only reset the expanded default when crossing into a new size
      // bucket, so it doesn't fight a manual toggle during same-bucket
      // resizes.
      //   desktop -> force expanded (matches 100%/110% zoom).
      //   compact -> force collapsed; the sidebar's own hover
      //              mechanism (onMouseEnter/onMouseLeave) takes over
      //              from here to temporarily expand it and
      //              auto-collapse again, without this context needing
      //              to know anything about hover itself.
      //   mobile  -> isExpanded is irrelevant here (isMobile ? false
      //              below overrides it), the drawer's own
      //              isMobileOpen/toggleMobileSidebar handles that
      //              case entirely separately.
      if (prevBucket.current !== bucket) {
        if (bucket === "desktop") setIsExpanded(true);
        if (bucket === "compact") setIsExpanded(false);
        prevBucket.current = bucket;
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const toggleSidebar = () => setIsExpanded((prev) => !prev);
  const toggleMobileSidebar = () => setIsMobileOpen((prev) => !prev);
  const toggleSubmenu = (item: string) =>
    setOpenSubmenu((prev) => (prev === item ? null : item));

  return (
    <SidebarContext.Provider
      value={{
        isExpanded: isMobile ? false : isExpanded,
        isMobile,
        isMobileOpen,
        isHovered,
        openSubmenu,
        toggleSidebar,
        toggleMobileSidebar,
        setIsHovered,
        toggleSubmenu,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}