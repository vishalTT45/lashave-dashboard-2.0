"use client";

import { Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { APPEARANCE_COLORS, DEFAULT_APPEARANCE_COLOR, useTheme, type AppearanceColor } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

export function AppearancePaletteButton() {
  const { appearanceColor, setAppearanceColor } = useTheme();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMounted(true);
    function handleClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const displayColor = mounted ? appearanceColor : DEFAULT_APPEARANCE_COLOR;

  function selectColor(color: AppearanceColor) {
    setAppearanceColor(color);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Appearance color"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
      >
        <Palette className="icon-default" />
        <span
          className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900"
          style={{ backgroundColor: displayColor }}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-56 rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-3 type-small font-semibold text-gray-800 dark:text-white/90">
            Appearance
          </div>
          <div className="grid grid-cols-6 gap-2">
            {APPEARANCE_COLORS.map((item) => {
              const active = item.value === appearanceColor;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => selectColor(item.value)}
                  aria-label={`Use ${item.value}`}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition",
                    active
                      ? "border-gray-900 ring-4 ring-gray-900/10 dark:border-white dark:ring-white/10"
                      : "border-gray-200 hover:scale-105 dark:border-gray-700",
                  )}
                  style={{ backgroundColor: item.value }}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-white shadow-sm" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
