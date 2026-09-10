import React from "react";

import { cn } from "@/lib/utils";

interface SettingsActionRowProps {
  icon: React.ReactNode;
  iconColorClass: string;
  title: string;
  description: string;
  actionLabel: string;
  actionColorClass: string;
  onAction: () => void;
  onRowClick?: () => void;
  children?: React.ReactNode;
  meta?: React.ReactNode;
}

export function SettingsActionRow({
  icon,
  iconColorClass,
  title,
  description,
  actionLabel,
  actionColorClass,
  onAction,
  onRowClick,
  children,
  meta,
}: SettingsActionRowProps) {
  return (
    <div
      onClick={onRowClick}
      className={cn(
        "grid grid-cols-1 items-start gap-4 rounded-xl border border-gray-200 bg-white p-6 transition hover:bg-gray-50/50 dark:border-gray-800 dark:bg-white/3 dark:hover:bg-white/4 sm:grid-cols-[52px_1fr_auto] sm:gap-5 sm:p-6",
        onRowClick && "cursor-pointer"
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-xl",
          iconColorClass
        )}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <h3 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        <p className="mt-1.5 type-small leading-6 text-gray-500 dark:text-gray-400">
          {description}
        </p>
        {children}
      </div>

      <div className="flex w-full flex-col items-stretch gap-2 self-end sm:w-auto sm:items-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
          className={cn(
            "inline-flex h-10 w-full items-center justify-center gap-2 rounded-(--radius-control) px-5 type-small font-medium shadow-theme-xs transition sm:w-auto",
            actionLabel === "Configure" || actionLabel === "View Bookings"
              ? "bg-brand-500 text-white hover:bg-brand-600"
              : actionColorClass,
          )}
        >
          {actionLabel}
        </button>
        {meta && <div>{meta}</div>}
      </div>
    </div>
  );
}

export default SettingsActionRow;
