"use client";

import { useEffect, useState } from "react";
import { useSidebar } from "@/lib/sidebar-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Backdrop } from "@/components/layout/Backdrop";
import { GlobalBillingBanner } from "@/components/GlobalBillingBanner";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const effectiveExpanded = mounted ? isExpanded : true;
  const effectiveHovered = mounted ? isHovered : false;
  const effectiveMobileOpen = mounted ? isMobileOpen : false;

  const mainContentMargin = effectiveMobileOpen
    ? "ml-0"
    : effectiveExpanded || effectiveHovered
      ? "lg:ml-[240px] xl:ml-[290px]"
      : "lg:ml-[90px]";

  const mainContentWidth = effectiveMobileOpen
    ? "w-full max-w-full"
    : effectiveExpanded || effectiveHovered
      ? "w-full max-w-full lg:w-[calc(100%-240px)] lg:max-w-[calc(100vw-240px)] xl:w-[calc(100%-290px)] xl:max-w-[calc(100vw-290px)]"
      : "w-full max-w-full lg:w-[calc(100%-90px)] lg:max-w-[calc(100vw-90px)]";

  return (
    <div className="min-h-screen overflow-x-clip bg-background xl:flex">
      <AppSidebar />
      <Backdrop />

      <div
        className={`min-w-0 flex-1 overflow-x-clip transition-all duration-300 ease-in-out ${mainContentMargin} ${mainContentWidth}`}
      >
        <AppHeader />
        <GlobalBillingBanner />

        <div className="mx-auto min-w-0 max-w-full p-4 md:p-6">
          {children}
        </div>
      </div>
    </div>
  );
}