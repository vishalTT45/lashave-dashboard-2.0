"use client";
import React, { createContext, useContext, useState, useEffect, useRef } from "react";

type ScreenBucket = "mobile" | "smallDesktop" | "desktop";

function getBucket(width: number): ScreenBucket {
  if (width < 1024) return "mobile";
  if (width < 1280) return "smallDesktop";
  return "desktop";
}

type SidebarContextType = {
  isExpanded: boolean;
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => {
      const bucket = getBucket(window.innerWidth);
      const mobile = bucket === "mobile";
      setIsMobile(mobile);
      if (!mobile) setIsMobileOpen(false);

      // Only reset the expanded default when crossing into a new size
      // bucket, so it doesn't fight a manual toggle during same-bucket
      // resizes. Small desktop (1024-1279px) defaults to collapsed so
      // pages get more room; full desktop (1280px+) defaults expanded.
      if (prevBucket.current !== bucket) {
        if (bucket === "smallDesktop") setIsExpanded(false);
        if (bucket === "desktop") setIsExpanded(true);
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
        isExpanded: mounted ? (isMobile ? false : isExpanded) : true,
        isMobileOpen: mounted ? isMobileOpen : false,
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
