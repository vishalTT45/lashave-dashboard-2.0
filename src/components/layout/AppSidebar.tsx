'use client';
import { apiFetch } from '@/lib/api';
import { useSidebar } from '@/lib/sidebar-context';
import {
  BarChart3,
  BookOpen,
  Calendar,
  Globe,
  LayoutGrid,
  MessageSquare,
  Plug,
  Settings,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path: string;
  exact?: boolean;
  requiresBooking?: boolean;
};

const navItems: NavItem[] = [
  { name: 'Overview', icon: <LayoutGrid />, path: '/' },
  {
    name: 'Conversations',
    icon: <MessageSquare />,
    path: '/conversations',
    exact: true,
  },
  {
    name: 'Google Reviews',
    icon: <Star />,
    path: '/conversations/reviews',
  },
  { name: 'Channels', icon: <Plug />, path: '/channels' },
  { name: 'Website Widget', icon: <Globe />, path: '/customize-chat' },
  { name: 'Leads', icon: <Users />, path: '/leads' },
  { name: 'Knowledge', icon: <BookOpen />, path: '/faq' },
  { name: 'Analytics', icon: <BarChart3 />, path: '/analytics' },
  { name: 'Growth', icon: <TrendingUp />, path: '/growth' },
  {
    name: 'Bookings',
    icon: <Calendar />,
    path: '/availability',
    requiresBooking: true,
  },
  { name: 'Settings', icon: <Settings />, path: '/settings' },
];

type MeResp = { tenant: { booking_enabled: boolean } | null };

export function AppSidebar() {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const [bookingEnabled, setBookingEnabled] = useState(false);

  useEffect(() => {
    apiFetch<MeResp>('/admin/profile/me', { auth: true })
      .then((me) => setBookingEnabled(!!me.tenant?.booking_enabled))
      .catch(() => {});
  }, []);

  const isActive = useCallback(
    (item: NavItem) =>
      item.path === '/'
        ? pathname === '/'
        : item.exact
          ? pathname === item.path
          : pathname.startsWith(item.path),
    [pathname],
  );

  const items = navItems.filter(
    (item) => !item.requiresBooking || bookingEnabled,
  );
  const showLabel = isExpanded || isHovered || isMobileOpen;

  return (
    <aside
      // Position: `fixed` + full-viewport `left-0` on mobile (the
      // classic slide-in-overlay pattern, using -translate-x-full to
      // hide/show it). At desktop (lg+) it switches to `sticky` and is
      // simply the first column of the shell's CSS Grid — no `left`
      // calc needed at all, since the grid places it correctly and
      // keeps it in sync with the content column natively. This
      // replaces an earlier version that computed `left` via
      // `calc((100vw - shell-max) / 2)` to align with the centered
      // shell: that worked, but it meant three independent systems
      // (the sidebar's `left`, the content's `margin-left`, and the
      // content's `width`) were all separately trying to agree on the
      // same layout — exactly the kind of drift that caused the
      // gap/scroll/transition-jank bugs. The grid has one source of
      // truth instead: whatever is in its first column IS the
      // sidebar's position, always, at any viewport width or zoom.
      className={`fixed lg:sticky mt-16 flex flex-col lg:mt-0 top-0 left-0 lg:left-auto z-50 h-screen border-r border-(--app-primary) bg-(--app-primary) px-5 text-(--app-sidebar-text) transition-[width,transform] duration-300 ease-in-out
        ${isMobileOpen ? 'w-(--sidebar-width-mobile)' : isExpanded || isHovered ? 'w-(--sidebar-width-expanded)' : 'w-(--sidebar-width-collapsed)'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex py-8 ${!isExpanded && !isHovered ? 'lg:justify-center' : 'justify-start'}`}
      >
        <Link href='/' className='flex items-center gap-2'>
          <Image
            src='/lashvaelogo.png'
            alt='Lashvae'
            width={showLabel ? 36 : 32}
            height={showLabel ? 36 : 32}
          />
          {showLabel && (
            <span className='type-card-title font-semibold tracking-wide text-(--app-sidebar-text)'>
              LASHVAE AI
            </span>
          )}
        </Link>
      </div>

      <div className='flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar'>
        <nav className='mb-6'>
          <ul className='flex flex-col gap-2'>
            {items.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`menu-item group ${isActive(item) ? 'menu-item-active' : 'menu-item-inactive'}`}
                >
                  <span
                    className={
                      isActive(item)
                        ? 'menu-item-icon-active'
                        : 'menu-item-icon-inactive'
                    }
                  >
                    {item.icon}
                  </span>
                  {showLabel && (
                    <span className='menu-item-text'>{item.name}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </aside>
  );
}