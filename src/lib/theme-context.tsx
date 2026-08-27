"use client";

// ─────────────────────────────────────────────────────────────────────────────
// lib/theme-context.tsx
//
// Usage: const { isDark, toggleTheme } = useTheme()
// Also exports `toggle` as an alias for backward-compatibility with topbar.tsx
// ─────────────────────────────────────────────────────────────────────────────

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { DARK, LIGHT, type Theme } from "@/lib/theme";

export const APPEARANCE_COLORS = [
  {
    value: "#4249C6",
    light: "#EEF0FF",
    hover: "#343BB0",
    sidebarText: "#FFFFFF",
    sidebarMuted: "rgba(255,255,255,.84)",
    sidebarHover: "rgba(255,255,255,.12)",
    sidebarActiveBg: "rgba(255,255,255,.16)",
    sidebarActiveText: "#FFFFFF",
  },
  {
    value: "#D93668",
    light: "#FCEBF1",
    hover: "#BF2857",
    sidebarText: "#FFFFFF",
    sidebarMuted: "rgba(255,255,255,.86)",
    sidebarHover: "rgba(255,255,255,.12)",
    sidebarActiveBg: "rgba(255,255,255,.16)",
    sidebarActiveText: "#FFFFFF",
  },
  {
    value: "#007257",
    light: "#E5F5F1",
    hover: "#005D48",
    sidebarText: "#FFFFFF",
    sidebarMuted: "rgba(255,255,255,.86)",
    sidebarHover: "rgba(255,255,255,.12)",
    sidebarActiveBg: "rgba(255,255,255,.16)",
    sidebarActiveText: "#FFFFFF",
  },
  {
    value: "#0F7BFF",
    light: "#EAF3FF",
    hover: "#0067DD",
    sidebarText: "#FFFFFF",
    sidebarMuted: "rgba(255,255,255,.86)",
    sidebarHover: "rgba(255,255,255,.12)",
    sidebarActiveBg: "rgba(255,255,255,.16)",
    sidebarActiveText: "#FFFFFF",
  },
  {
    value: "#E67E22",
    light: "#FFF2E6",
    hover: "#C96818",
    sidebarText: "#FFFFFF",
    sidebarMuted: "rgba(255,255,255,.86)",
    sidebarHover: "rgba(255,255,255,.12)",
    sidebarActiveBg: "rgba(255,255,255,.16)",
    sidebarActiveText: "#FFFFFF",
  },
  {
    value: "#6D28D9",
    light: "#F3EFFF",
    hover: "#5B21B6",
    sidebarText: "#FFFFFF",
    sidebarMuted: "rgba(255,255,255,.86)",
    sidebarHover: "rgba(255,255,255,.12)",
    sidebarActiveBg: "rgba(255,255,255,.16)",
    sidebarActiveText: "#FFFFFF",
  },
] as const;

export type AppearanceColor = (typeof APPEARANCE_COLORS)[number]["value"];
export const DEFAULT_APPEARANCE_COLOR: AppearanceColor = "#4249C6";

function applyAppearanceColor(value: string) {
  const option =
    APPEARANCE_COLORS.find((item) => item.value.toLowerCase() === value.toLowerCase()) ||
    APPEARANCE_COLORS[0];
  const root = document.documentElement;
  root.style.setProperty("--app-primary", option.value);
  root.style.setProperty("--app-primary-light", option.light);
  root.style.setProperty("--app-primary-hover", option.hover);
  root.style.setProperty("--app-sidebar-text", option.sidebarText);
  root.style.setProperty("--app-sidebar-muted", option.sidebarMuted);
  root.style.setProperty("--app-sidebar-hover", option.sidebarHover);
  root.style.setProperty("--app-sidebar-active-bg", option.sidebarActiveBg);
  root.style.setProperty("--app-sidebar-active-text", option.sidebarActiveText);
}

type ThemeContextValue = {
  isDark: boolean;
  toggleTheme: () => void;
  toggle: () => void;
  t: Theme;
  appearanceColor: AppearanceColor;
  setAppearanceColor: (color: AppearanceColor) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  isDark: false,
  toggleTheme: () => { },
  toggle: () => { },
  t: LIGHT,
  appearanceColor: DEFAULT_APPEARANCE_COLOR,
  setAppearanceColor: () => { },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [appearanceColor, setAppearanceColorState] = useState<AppearanceColor>(DEFAULT_APPEARANCE_COLOR);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Support both localStorage keys the app might use
    // const stored = localStorage.getItem("theme") ?? localStorage.getItem("tt_theme");
    const stored = localStorage.getItem("theme") ?? localStorage.getItem("tt_theme");

    if (!stored) {
      localStorage.setItem("theme", "light");
    }
    const initial = stored === "dark" ? true : false;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    // const initial = stored ? stored === "dark" : false;
    setIsDark(initial);
    document.documentElement.classList.toggle("dark", initial);

    const storedAppearance = localStorage.getItem("appearance_color") || DEFAULT_APPEARANCE_COLOR;
    const nextAppearance =
      APPEARANCE_COLORS.find((item) => item.value.toLowerCase() === storedAppearance.toLowerCase())?.value ||
      DEFAULT_APPEARANCE_COLOR;
    setAppearanceColorState(nextAppearance);
    applyAppearanceColor(nextAppearance);
    setMounted(true);
  }, []);


  function toggleTheme() {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem("theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }

  const t = isDark ? DARK : LIGHT;

  function setAppearanceColor(color: AppearanceColor) {
    setAppearanceColorState(color);
    localStorage.setItem("appearance_color", color);
    applyAppearanceColor(color);
  }

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, toggle: toggleTheme, t, appearanceColor, setAppearanceColor }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
