import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@/styles/dashboard.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme-context";
import { SidebarProvider } from "@/lib/sidebar-context";
import { Suspense } from 'react';


const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lashvae Dashboard",
  description: "LASHVAE intelligent messaging platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
  <script dangerouslySetInnerHTML={{
    __html: `
      (function() {
        try {
          var theme = localStorage.getItem('theme') ||
                      localStorage.getItem('tt_theme') ||
                      localStorage.getItem('lashvae_theme') ||
                      localStorage.getItem('dashboard_theme');
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
          }
          var colors = {
            '#4249C6': ['#EEF0FF', '#343BB0', '#FFFFFF', 'rgba(255,255,255,.84)', 'rgba(255,255,255,.12)', 'rgba(255,255,255,.16)', '#FFFFFF'],
            '#D93668': ['#FCEBF1', '#BF2857', '#FFFFFF', 'rgba(255,255,255,.86)', 'rgba(255,255,255,.12)', 'rgba(255,255,255,.16)', '#FFFFFF'],
            '#007257': ['#E5F5F1', '#005D48', '#FFFFFF', 'rgba(255,255,255,.86)', 'rgba(255,255,255,.12)', 'rgba(255,255,255,.16)', '#FFFFFF'],
            '#0F7BFF': ['#EAF3FF', '#0067DD', '#FFFFFF', 'rgba(255,255,255,.86)', 'rgba(255,255,255,.12)', 'rgba(255,255,255,.16)', '#FFFFFF'],
            '#E67E22': ['#FFF2E6', '#C96818', '#FFFFFF', 'rgba(255,255,255,.86)', 'rgba(255,255,255,.12)', 'rgba(255,255,255,.16)', '#FFFFFF'],
            '#6D28D9': ['#F3EFFF', '#5B21B6', '#FFFFFF', 'rgba(255,255,255,.86)', 'rgba(255,255,255,.12)', 'rgba(255,255,255,.16)', '#FFFFFF']
          };
          var selected = localStorage.getItem('appearance_color') || '#4249C6';
          var values = colors[selected] ? selected : '#4249C6';
          var c = colors[values];
          var root = document.documentElement.style;
          root.setProperty('--app-primary', values);
          root.setProperty('--app-primary-light', c[0]);
          root.setProperty('--app-primary-hover', c[1]);
          root.setProperty('--app-sidebar-text', c[2]);
          root.setProperty('--app-sidebar-muted', c[3]);
          root.setProperty('--app-sidebar-hover', c[4]);
          root.setProperty('--app-sidebar-active-bg', c[5]);
          root.setProperty('--app-sidebar-active-text', c[6]);
        } catch(e) {}
      })();
    `
  }} />
</head>
      <body className={inter.className}>
        <AuthProvider>
          <ThemeProvider>
            <SidebarProvider>
              <Suspense>
               {children}
              </Suspense>
            </SidebarProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}