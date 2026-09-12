"use client";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useSidebar } from "@/lib/sidebar-context";
import { ThemeToggleButton } from "@/components/layout/ThemeToggleButton";
import { AppearancePaletteButton } from "@/components/layout/AppearancePaletteButton";
import { UserDropdown } from "@/components/layout/UserDropdown";
import { TrialPill } from "@/components/billing/TrialPill";

export function AppHeader() {
  const { isMobile, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  function handleToggle() {
    if (isMobile) {
      toggleMobileSidebar();
    } else {
      toggleSidebar();
    }
  }

  return (
    <header className="flex w-full border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:border-b">
      <div className="flex grow flex-col items-center justify-between lg:flex-row lg:px-(--layout-page-gutter)">
        <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
          <button
            className="z-99999 flex h-10 w-10 items-center justify-center rounded-(--radius-control) border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-white/3 dark:hover:text-gray-300 lg:h-10 lg:w-10"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <X className="icon-nav" />
            ) : (
              <Menu className="icon-default" strokeWidth={1.8} />
            )}
          </button>

          <Link href="/" className="lg:hidden">
            <Image width={36} height={36} src="/lashvaelogo.png" alt="Lashvae" />
          </Link>
        </div>

        <div className="flex w-full items-center justify-between gap-4 px-5 py-4 shadow-theme-md lg:w-auto lg:justify-end lg:px-0 lg:shadow-none">
          <div className="hidden lg:block">
            <TrialPill />
          </div>
          <div className="flex items-center gap-2 2xsm:gap-3">
            <AppearancePaletteButton />
            <ThemeToggleButton />
          </div>
          <UserDropdown />
        </div>
      </div>
    </header>
  );
}