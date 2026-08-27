'use client';

import { DateFilter } from '@/components/date-filter';
import { RequireAuth } from '@/components/require-auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Ban,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarX,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock,
  FileText,
  List,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  User,
  XCircle,
} from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Modal } from '@/components/ui/modal';
import { TablePagination } from '@/components/ui/table-pagination';
import { Textarea } from '@/components/ui/textarea';
import { useOutsideClick } from '@/hooks/useOutsideClick';

const CHANNEL_LOGOS: Record<string, string> = {
  facebook: '/brand-logo/facebook.png',
  google: '/brand-logo/google-map.png',
  instagram: '/brand-logo/instagram.png',
  meta: '/brand-logo/meta.png',
  telegram: '/brand-logo/telegram.png',
  website: '/brand-logo/website.png',
  whatsapp: '/brand-logo/whatsapp.png',
  youtube: '/brand-logo/youtube.png',
};

/* Types */
type AvailabilityItem = {
  id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type BookingSettings = {
  booking_enabled: boolean;
  booking_slot_duration_minutes: number;
  booking_buffer_minutes: number;
  booking_timezone: string;
  tenant_id: string;
};

type CustomerField = {
  id: number;
  field_key: string;
  label: string;
  field_type: 'text' | 'number' | 'dropdown';
  required: boolean;
  options: string[];
  is_active: boolean;
};

type BookingSlot = {
  start_time: string;
  end_time: string;
  label: string;
};

type CheckSlotsResponse = {
  booking_enabled: boolean;
  blocked?: boolean;
  available?: boolean;
  slots: BookingSlot[];
};

type Booking = {
  id: number;
  conversation_id?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  channel: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  created_at?: string;
  profile_pic_url?: string | null;
  external_user_id?: string | null;
  customer_details?: Record<string, string> | null;
  customer_info_complete?: boolean;
  instagram_profile?: {
    username?: string | null;
    profile_pic_url?: string | null;
  } | null;
};

type TabKey =
  | 'all'
  | 'today'
  | 'upcoming'
  | 'confirmed'
  | 'completed'
  | 'cancelled';
type BookingSortKey =
  | 'created'
  | 'customer'
  | 'phone'
  | 'email'
  | 'channel'
  | 'date'
  | 'time'
  | 'status';
type SortDirection = 'asc' | 'desc';

const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];
const ITEMS_PER_PAGE = 8;

const defaultAvailability: AvailabilityItem[] = DAYS.map((_, index) => ({
  day_of_week: index,
  start_time: '10:00',
  end_time: '19:00',
  is_active: index <= 4,
}));

type StatusColor = 'success' | 'warning' | 'error' | 'info' | 'light';

const STATUS_CONFIG: Record<
  string,
  { label: string; color: StatusColor; icon: React.ReactNode }
> = {
  confirmed: {
    label: 'Confirmed',
    color: 'success',
    icon: <CheckCircle2 size={11} />,
  },
  rescheduled: {
    label: 'Rescheduled',
    color: 'warning',
    icon: <CalendarClock size={11} />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'error',
    icon: <Ban size={11} />,
  },
  completed: {
    label: 'Completed',
    color: 'info',
    icon: <CheckCircle2 size={11} />,
  },
};

/* Helpers */
function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}
function isUpcoming(dateStr: string) {
  return new Date(dateStr) > new Date();
}

const getTimeMinutes = (value: string) => {
  const timePart = value.slice(11, 16); // "15:00"
  const [h, m] = timePart.split(':').map(Number);
  return h * 60 + m;
};

const getDateKey = (value: string) => {
  return value.slice(0, 10); // "2026-06-15"
};

const getTodayLocalKey = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getCurrentLocalMinutes = () => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const isBookingCompleted = (booking: Booking) => {
  if (booking.status === 'cancelled') return false;
  if (booking.status === 'completed') return true;

  const bookingDate = getDateKey(booking.booking_date);
  const today = getTodayLocalKey();

  if (bookingDate < today) return true;
  if (bookingDate > today) return false;

  const bookingEndMinutes = getTimeMinutes(booking.end_time);
  const nowMinutes = getCurrentLocalMinutes();

  return bookingEndMinutes < nowMinutes;
};

const COMPLETED_BOOKINGS_STORAGE_KEY = 'lashvae_completed_booking_ids';

const getCompletedBookingIds = () => {
  if (typeof window === 'undefined') return new Set<number>();

  try {
    const raw = window.localStorage.getItem(COMPLETED_BOOKINGS_STORAGE_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown[]) : [];
    return new Set(
      ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
    );
  } catch {
    return new Set<number>();
  }
};

const saveCompletedBookingId = (bookingId: number) => {
  if (typeof window === 'undefined') return;

  const ids = getCompletedBookingIds();
  ids.add(bookingId);
  window.localStorage.setItem(
    COMPLETED_BOOKINGS_STORAGE_KEY,
    JSON.stringify(Array.from(ids)),
  );
};

const removeCompletedBookingId = (bookingId: number) => {
  if (typeof window === 'undefined') return;

  const ids = getCompletedBookingIds();
  ids.delete(bookingId);
  window.localStorage.setItem(
    COMPLETED_BOOKINGS_STORAGE_KEY,
    JSON.stringify(Array.from(ids)),
  );
};

const applyCompletedOverrides = (items: Booking[]) => {
  const completedIds = getCompletedBookingIds();
  if (!completedIds.size) return items;

  return items.map((booking) =>
    completedIds.has(booking.id) && booking.status !== 'cancelled'
      ? { ...booking, status: 'completed' }
      : booking,
  );
};

const SELECT_CLASS =
  'h-10 w-full appearance-none rounded-[10px] border border-gray-300 bg-transparent px-3.5 py-2 pr-8 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800';

const TIME_INPUT_CLASS =
  'h-10 w-full rounded-[10px] border border-gray-300 bg-white px-3 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90';

/* Avatar */
function Avatar({
  name,
  src,
  size = 42,
}: {
  name: string;
  src?: string | null;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const clean = name.startsWith('@') ? name.slice(1) : name;
  const initials = clean.slice(0, 2).toUpperCase();

  if (src && !imgError) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        unoptimized
        onError={() => setImgError(true)}
        style={{
          height: size,
          width: size,
          borderRadius: '50%',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: size,
        width: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.31,
        fontWeight: 600,
        color: '#344054',
        flexShrink: 0,
        background: '#F2F4F7',
        border: '1px solid #EAECF0',
      }}
    >
      {initials}
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className='flex items-center gap-3'>
      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-gray-500'>
        {icon}
      </div>
      <div className='min-w-0'>
        <span className='block type-caption font-semibold text-gray-400 dark:text-gray-500'>
          {label}
        </span>
        <span className='block truncate type-small font-bold text-gray-800 dark:text-white/90'>
          {value}
        </span>
      </div>
    </div>
  );
}

/* Tab config */
const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <List size={13} /> },
  { key: 'today', label: 'Today', icon: <CalendarDays size={13} /> },
  { key: 'upcoming', label: 'Upcoming', icon: <CalendarCheck size={13} /> },
  { key: 'confirmed', label: 'Confirmed', icon: <CheckCircle2 size={13} /> },
  { key: 'completed', label: 'Completed', icon: <CheckCircle2 size={13} /> },
  { key: 'cancelled', label: 'Cancelled', icon: <CalendarX size={13} /> },
];

/* Main page */
function AvailabilityContent() {
  const searchParams = useSearchParams();

  const isWeekly = searchParams.get('weekly') === 'true';

  const [availability, setAvailability] =
    useState<AvailabilityItem[]>(defaultAvailability);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>({
    booking_enabled: false,
    booking_slot_duration_minutes: 30,
    booking_buffer_minutes: 0,
    booking_timezone: 'UTC',
    tenant_id: '',
  });
  const [showAvailabilityPanel, setShowAvailabilityPanel] = useState<
    true | false
  >(isWeekly ? true : false);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [bookingSearch, setBookingSearch] = useState('');

  const [openBookingFilter, setOpenBookingFilter] = useState<
    'status' | 'date' | 'channel' | null
  >(null);

  const [bookingChannelFilter, setBookingChannelFilter] = useState<string[]>([]);
  const bookingChannelFilterRef = useRef<HTMLDivElement>(null);

  const [bookingDateRange, setBookingDateRange] = useState<{
    from: string;
    to: string;
  } | null>(() => {
    const today = getTodayLocalKey();
    return { from: today, to: today };
  });
  const [bookingDatePreset, setBookingDatePreset] = useState<number | null>(0);
  const bookingFilterRef = useRef<HTMLDivElement>(null);
  const bookingDateFilterRef = useRef<HTMLDivElement>(null);
  useOutsideClick(
    bookingFilterRef,
    () => setOpenBookingFilter(null),
    openBookingFilter === 'status',
  );
  useOutsideClick(
    bookingDateFilterRef,
    () => setOpenBookingFilter(null),
    openBookingFilter === 'date',
  );
  useOutsideClick(
    bookingChannelFilterRef,
    () => setOpenBookingFilter(null),
    openBookingFilter === 'channel',
  );

  const [bookingSort, setBookingSort] = useState<{
    key: BookingSortKey;
    direction: SortDirection;
  }>({ key: 'created', direction: 'desc' });
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(
    null,
  );
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    booking_date: '',
    start_time: '',
    end_time: '',
    notes: '',
  });
  const [bookingToCancel, setBookingToCancel] = useState<number | null>(null);
  const [bookingToComplete, setBookingToComplete] = useState<Booking | null>(
    null,
  );

  const [showManualBooking, setShowManualBooking] = useState(false);
  const [customerFields, setCustomerFields] = useState<CustomerField[]>([]);
  const [manualDate, setManualDate] = useState('');
  const [manualSlots, setManualSlots] = useState<BookingSlot[]>([]);
  const [selectedManualSlot, setSelectedManualSlot] = useState('');
  const [manualValues, setManualValues] = useState<Record<string, string>>({
    name: '',
  });
  const [manualNotes, setManualNotes] = useState('');
  const [manualError, setManualError] = useState('');
  const [loadingManualSlots, setLoadingManualSlots] = useState(false);
  const [creatingManualBooking, setCreatingManualBooking] = useState(false);

  const hasAvailability = availability.some((item) => item.is_active);

  /* Tab counts */
  const tabCounts = useMemo(
    () => ({
      all: bookings.filter((b) => b.status !== 'cancelled').length,
      today: bookings.filter((b) => isToday(b.start_time)).length,
      upcoming: bookings.filter(
        (b) => isUpcoming(b.start_time) && b.status !== 'cancelled',
      ).length,
      confirmed: bookings.filter(
        (b) =>
          ['confirmed', 'rescheduled'].includes(b.status) &&
          !isBookingCompleted(b),
      ).length,
      completed: bookings.filter((b) => isBookingCompleted(b)).length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
    }),
    [bookings],
  );

  const bookingKnownChannels = [
    'instagram',
    'facebook',
    'whatsapp',
    'telegram',
    'youtube',
    'website',
    'google',
  ];

  const bookingChannels = useMemo(
    () =>
      Array.from(
        new Set([
          ...bookingKnownChannels,
          ...bookings
            .map((b) => (b.channel || '').toLowerCase())
            .filter(Boolean),
        ]),
      ).sort(),
    [bookings],
  );

  const bookingChannelCounts = useMemo(
    () =>
      bookings.reduce<Record<string, number>>((acc, b) => {
        const channel = (b.channel || 'direct').toLowerCase();
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {}),
    [bookings],
  );

  const toggleBookingChannel = (channel: string) => {
    setBookingChannelFilter((current) =>
      current.includes(channel)
        ? current.filter((c) => c !== channel)
        : [...current, channel],
    );
  };

  const activeBookingChannelLabel =
    bookingChannelFilter.length === 0
      ? 'All channels'
      : bookingChannelFilter.length === 1
        ? bookingChannelFilter[0].charAt(0).toUpperCase() +
        bookingChannelFilter[0].slice(1)
        : `${bookingChannelFilter.length} channels`;

  /* Filtered list */
  const filteredBookings = useMemo(() => {
    const byTab = (() => {
      switch (activeTab) {
        case 'today':
          return bookings.filter((b) => isToday(b.start_time));

        case 'upcoming':
          return bookings.filter(
            (b) => isUpcoming(b.start_time) && b.status !== 'cancelled',
          );

        case 'confirmed':
          return bookings.filter(
            (b) =>
              ['confirmed', 'rescheduled'].includes(b.status) &&
              !isBookingCompleted(b),
          );

        case 'completed':
          return bookings.filter((b) => isBookingCompleted(b));

        case 'cancelled':
          return bookings.filter((b) => b.status === 'cancelled');

        default:
          return bookings.filter((b) => b.status !== 'cancelled');
      }
    })();

    const byDate = bookingDateRange
      ? byTab.filter((booking) => {
        const key = (booking.start_time || booking.booking_date || '').slice(
          0,
          10,
        );
        if (!key) return false;
        return key >= bookingDateRange.from && key <= bookingDateRange.to;
      })
      : byTab;

    const byChannel =
      bookingChannelFilter.length === 0
        ? byDate
        : byDate.filter((booking) =>
          bookingChannelFilter.includes((booking.channel || '').toLowerCase()),
        );

    const query = bookingSearch.trim().toLowerCase();
    if (!query) return byChannel;

    return byChannel.filter((booking) =>
      [
        booking.customer_name,
        booking.customer_phone,
        booking.customer_details?.phone,
        booking.customer_details?.email,
        booking.channel,
        booking.status,
        booking.booking_date,
        booking.start_time,
        booking.end_time,
        booking.instagram_profile?.username,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [
    bookings,
    activeTab,
    bookingSearch,
    bookingDateRange,
    bookingChannelFilter,
  ]);
  const sortedBookings = useMemo(() => {
    const getSortValue = (booking: Booking) => {
      const displayName =
        booking.instagram_profile?.username ||
        booking.customer_name ||
        booking.customer_phone ||
        'Customer';
      const effectiveStatus = isBookingCompleted(booking)
        ? 'completed'
        : booking.status;

      switch (bookingSort.key) {
        case 'created':
          return (
            booking.created_at ||
            booking.booking_date ||
            booking.start_time ||
            ''
          );
        case 'customer':
          return displayName.toLowerCase();
        case 'phone':
          return (
            booking.customer_details?.phone ||
            booking.customer_phone ||
            ''
          ).toLowerCase();
        case 'email':
          return (booking.customer_details?.email || '').toLowerCase();
        case 'channel':
          return (booking.channel || 'Direct').toLowerCase();
        case 'date':
          return booking.booking_date || '';
        case 'time':
          return booking.start_time || '';
        case 'status':
          return effectiveStatus.toLowerCase();
        default:
          return '';
      }
    };

    return [...filteredBookings].sort((a, b) => {
      const first = getSortValue(a);
      const second = getSortValue(b);
      const comparison = first.localeCompare(second, undefined, {
        numeric: true,
        sensitivity: 'base',
      });

      return bookingSort.direction === 'asc' ? comparison : -comparison;
    });
  }, [filteredBookings, bookingSort]);

  const toggleBookingSort = (key: BookingSortKey) => {
    setBookingSort((current) =>
      current.key === key
        ? {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        }
        : { key, direction: 'asc' },
    );
  };

  /* Pagination */
  const totalPages = Math.max(
    1,
    Math.ceil(sortedBookings.length / ITEMS_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedBookings = sortedBookings.slice(
    (safeCurrentPage - 1) * ITEMS_PER_PAGE,
    safeCurrentPage * ITEMS_PER_PAGE,
  );

  // Reset to page 1 when tab changes
  useEffect(() => {
    const timer = window.setTimeout(() => setCurrentPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, bookingSearch]);

  // Clamp page if filtered results shrink (e.g. after cancel)
  useEffect(() => {
    if (currentPage <= totalPages) return;
    const timer = window.setTimeout(() => setCurrentPage(totalPages), 0);
    return () => window.clearTimeout(timer);
  }, [totalPages, currentPage]);

  const loadPage = useCallback(async () => {
    try {
      setLoading(true);
      const settingsRes = await apiFetch<BookingSettings>(
        '/admin/booking/settings',
        { auth: true },
      );
      setBookingSettings(settingsRes);

      const customerFieldsRes = await apiFetch<{ items: CustomerField[] }>(
        '/admin/booking/customer-info',
        { auth: true },
      );
      setCustomerFields(
        (customerFieldsRes.items || []).filter((field) => field.is_active),
      );

      if (!settingsRes.booking_enabled) {
        setAvailability([]);
        setBookings([]);
        return;
      }

      const availabilityRes = await apiFetch<{ items: AvailabilityItem[] }>(
        '/admin/booking/availability',
        { auth: true },
      );
      const items = availabilityRes.items || [];
      if (items.length > 0) {
        setAvailability(
          defaultAvailability.map((day) => {
            const existing = items.find(
              (x) => x.day_of_week === day.day_of_week,
            );
            return existing || { ...day, is_active: false };
          }),
        );
      }

      const bookingsRes = await apiFetch<{ items: Booking[] }>(
        '/admin/bookings',
        { auth: true },
      );
      setBookings(applyCompletedOverrides(bookingsRes.items || []));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPage();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPage]);

  const saveAvailability = async () => {
    try {
      setSavingAvailability(true);
      await apiFetch('/admin/booking/availability', {
        method: 'PUT',
        body: { items: availability },
        auth: true,
      });
      alert('Availability saved');
      await loadPage();
    } finally {
      setSavingAvailability(false);
    }
  };

  const cancelBooking = async (bookingId: number) => {
    setBookingToCancel(bookingId);
  };

  const confirmCancel = async () => {
    try {
      setActionLoading(bookingToCancel);
      await apiFetch(`/admin/booking/${bookingToCancel}/cancel`, {
        method: 'POST',
        auth: true,
      });
      if (bookingToCancel) removeCompletedBookingId(bookingToCancel);
      const booking = bookings.filter((b) => b.id === bookingToCancel);
      window.location.href = `/conversations/${booking[0].conversation_id}`;
      await loadPage();
    } finally {
      setBookingToCancel(null);
      setActionLoading(null);
    }
  };

  const completeBookingRequest = async (bookingId: number) => {
    const attempts: Array<{
      path: string;
      method: 'POST' | 'PUT' | 'PATCH';
      body?: { status: string };
    }> = [
        {
          path: `/admin/booking/${bookingId}/status`,
          method: 'PUT',
          body: { status: 'completed' },
        },
        {
          path: `/admin/booking/${bookingId}/status`,
          method: 'PATCH',
          body: { status: 'completed' },
        },
        {
          path: `/admin/bookings/${bookingId}/status`,
          method: 'PUT',
          body: { status: 'completed' },
        },
        {
          path: `/admin/bookings/${bookingId}/status`,
          method: 'PATCH',
          body: { status: 'completed' },
        },
        {
          path: `/admin/booking/${bookingId}/complete`,
          method: 'POST',
        },
        {
          path: `/admin/booking/${bookingId}`,
          method: 'PATCH',
          body: { status: 'completed' },
        },
        {
          path: `/admin/bookings/${bookingId}`,
          method: 'PATCH',
          body: { status: 'completed' },
        },
      ];

    let lastError: unknown = null;
    for (const attempt of attempts) {
      try {
        await apiFetch(attempt.path, {
          method: attempt.method,
          body: attempt.body,
          auth: true,
        });
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to mark booking as completed');
  };

  const markBookingCompleted = (booking: Booking) => {
    setBookingToComplete(booking);
  };

  const confirmComplete = async () => {
    if (!bookingToComplete) return;
    const booking = bookingToComplete;

    try {
      setActionLoading(booking.id);
      const completedBooking = { ...booking, status: 'completed' };
      saveCompletedBookingId(booking.id);
      setBookings((prev) =>
        prev.map((item) => (item.id === booking.id ? completedBooking : item)),
      );
      setSelectedBooking((prev) =>
        prev?.id === booking.id ? completedBooking : prev,
      );
      void completeBookingRequest(booking.id).catch((error) => {
        console.warn('Booking completion endpoint unavailable', error);
      });
      setBookingToComplete(null);
      await loadPage();
    } finally {
      setActionLoading(null);
    }
  };

  const openReschedule = (booking: Booking) => {
    setRescheduleBooking(booking);
    setRescheduleForm({
      booking_date: booking.booking_date.slice(0, 16),
      start_time: booking.start_time.slice(0, 16),
      end_time: booking.end_time.slice(0, 16),
      notes: booking.notes || 'Rescheduled from dashboard',
    });
  };

  const submitReschedule = async () => {
    if (!rescheduleBooking) return;
    try {
      setActionLoading(rescheduleBooking.id);
      await apiFetch(`/admin/booking/${rescheduleBooking.id}/reschedule`, {
        method: 'POST',
        body: { ...rescheduleForm },
        auth: true,
      });

      setRescheduleBooking(null);
      window.location.href = `/conversations/${rescheduleBooking.conversation_id}`;
      await loadPage();
    } finally {
      setActionLoading(null);
    }
  };

  const updateAvailability = (
    dayIndex: number,
    patch: Partial<AvailabilityItem>,
  ) => {
    setAvailability((prev) =>
      prev.map((item) =>
        item.day_of_week === dayIndex ? { ...item, ...patch } : item,
      ),
    );
  };

  const resetManualBookingForm = () => {
    setManualDate('');
    setManualSlots([]);
    setSelectedManualSlot('');
    setManualValues({ name: '' });
    setManualNotes('');
    setManualError('');
  };

  const closeManualBooking = () => {
    setShowManualBooking(false);
    resetManualBookingForm();
  };

  const loadManualSlots = async (dateValue: string) => {
    setManualDate(dateValue);
    setSelectedManualSlot('');
    setManualSlots([]);
    setManualError('');

    if (!dateValue || !bookingSettings.tenant_id) return;

    try {
      setLoadingManualSlots(true);
      const result = await apiFetch<CheckSlotsResponse>(
        '/admin/booking/check-slots',
        {
          method: 'POST',
          auth: true,
          body: {
            tenant_id: bookingSettings.tenant_id,
            date: dateValue,
          },
        },
      );

      const slots = result.slots || [];
      setManualSlots(slots);

      if (result.blocked) {
        setManualError('This date is blocked in booking settings.');
      } else if (!slots.length) {
        setManualError('No available slots were found for this date.');
      }
    } catch (error) {
      console.error(error);
      setManualError(
        error instanceof Error
          ? error.message
          : 'Unable to load available slots.',
      );
    } finally {
      setLoadingManualSlots(false);
    }
  };

  const createManualBooking = async () => {
    const name = (manualValues.name || '').trim();
    const selectedSlot = manualSlots[Number(selectedManualSlot)];

    const nameConfig = customerFields.find(
      (field) => field.field_key === 'name',
    );

    if (nameConfig?.required && !name) {
      setManualError(`${nameConfig.label || 'Customer name'} is required.`);
      return;
    }
    if (!manualDate || !selectedSlot) {
      setManualError('Choose a date and an available time slot.');
      return;
    }

    for (const field of customerFields) {
      if (field.field_key === 'name') continue;
      if (field.required && !(manualValues[field.field_key] || '').trim()) {
        setManualError(`${field.label} is required.`);
        return;
      }
    }

    const customerDetails = customerFields.reduce<Record<string, string>>(
      (details, field) => {
        const value = (manualValues[field.field_key] || '').trim();
        if (value) details[field.field_key] = value;
        return details;
      },
      { name },
    );

    const phoneField = customerFields.find(
      (field) =>
        field.field_key.toLowerCase() === 'phone' ||
        field.label.toLowerCase().includes('phone'),
    );
    const emailField = customerFields.find(
      (field) =>
        field.field_key.toLowerCase() === 'email' ||
        field.label.toLowerCase().includes('email'),
    );

    try {
      setCreatingManualBooking(true);
      setManualError('');

      await apiFetch('/admin/booking/create', {
        method: 'POST',
        auth: true,
        body: {
          tenant_id: bookingSettings.tenant_id,
          conversation_id: null,
          customer_name: name,
          customer_email: emailField
            ? (manualValues[emailField.field_key] || '').trim().toLowerCase()
            : '',
          customer_phone: phoneField
            ? (manualValues[phoneField.field_key] || '').trim() || null
            : null,
          customer_details: customerDetails,
          customer_info_complete: true,
          channel: 'manual',
          booking_date: selectedSlot.start_time,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          notes: manualNotes.trim() || null,
        },
      });

      closeManualBooking();
      await loadPage();
    } catch (error) {
      console.error(error);
      setManualError(
        error instanceof Error
          ? error.message
          : 'Failed to create appointment.',
      );
    } finally {
      setCreatingManualBooking(false);
    }
  };

  const manualDayLabel = manualDate
    ? new Date(`${manualDate}T00:00:00`).toLocaleDateString('en-IN', {
      weekday: 'long',
    })
    : '';

  const primaryFieldKeys = ['name', 'phone', 'email'];

  const primaryCustomerFields = primaryFieldKeys
    .map((key) =>
      customerFields.find((field) => field.field_key.toLowerCase() === key),
    )
    .filter((field): field is CustomerField => Boolean(field));

  const customCustomerFields = customerFields.filter(
    (field) => !primaryFieldKeys.includes(field.field_key.toLowerCase()),
  );

  const formatTime = (value: string) => {
    if (!value) return '';

    return new Date(value).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  };

  const formatDate = (value: string) => {
    if (!value) return '';

    return new Date(value).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });
  };

  const resolveBookingMeta = (booking: Booking) => ({
    profilePic:
      booking.profile_pic_url ||
      booking.instagram_profile?.profile_pic_url ||
      null,
    displayName: booking.instagram_profile?.username
      ? `@${booking.instagram_profile.username}`
      : booking.customer_name || 'Customer',
  });

  const statusInfo = (status: string) =>
    STATUS_CONFIG[status] || {
      label: status,
      color: 'light' as StatusColor,
      icon: null,
    };
  const activeBookingTitle =
    TABS.find((tab) => tab.key === activeTab)?.label || 'All';
  const activeBookingLabel = `${activeBookingTitle} bookings`;

  /* Loading */
  if (loading) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center'>
        <div className='h-8 w-8 animate-spin rounded-full border-[3px] border-gray-200 border-t-brand-500 dark:border-gray-800 dark:border-t-brand-400' />
        <span className='type-small text-gray-400 dark:text-gray-500'>
          Loading...
        </span>
      </div>
    );
  }

  /* Smart Booking disabled */
  if (!bookingSettings.booking_enabled) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center'>
        <CalendarDays
          size={40}
          strokeWidth={1.5}
          className='text-warning-500/70'
        />
        <h2 className='type-h4 font-bold text-gray-800 dark:text-white/90'>
          Enable Smart Booking first
        </h2>
        <p className='max-w-sm type-small leading-relaxed text-gray-500 dark:text-gray-400'>
          Before setting weekly availability, enable Smart Booking from
          Settings.
        </p>
      </div>
    );
  }

  /* Main */
  return (
    <div className='min-w-0 max-w-full overflow-x-hidden'>
      {/* No availability warning */}
      {!hasAvailability && (
        <div className='mb-6 flex items-center gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 type-small font-medium text-warning-700 dark:border-warning-500/25 dark:bg-warning-500/10 dark:text-orange-300'>
          <AlertCircle size={16} className='shrink-0' />
          <span>
            No working hours set - customers can&apos;t book yet.{' '}
            <button
              onClick={() => setShowAvailabilityPanel(true)}
              className='font-bold underline underline-offset-2'
            >
              Set availability
            </button>
          </span>
        </div>
      )}

      {/* Bookings list */}
      <div className='min-w-0 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]'>
        <div className='flex flex-col gap-4 border-b border-gray-100 px-5 py-5 dark:border-white/[0.05] sm:px-6 lg:flex-row lg:items-center lg:justify-between'>
          <h3 className='type-body font-semibold text-gray-800 dark:text-white/90'>
            Bookings
          </h3>
          <div className='flex flex-wrap items-center gap-3'>
            <Button onClick={() => setShowManualBooking(true)}>
              <Plus size={15} />
              Add appointment
            </Button>
            <Button
              variant='outline'
              onClick={() => setShowAvailabilityPanel(true)}
            >
              <SlidersHorizontal size={14} />
              Weekly availability
            </Button>
            <Button
              variant='outline'
              size='icon'
              onClick={loadPage}
              title='Refresh'
            >
              <RefreshCw size={15} />
            </Button>
          </div>
        </div>

        <div className='min-w-0 px-5 py-5 sm:px-6'>
          <div className='flex flex-col gap-4 rounded-t-xl border border-b-0 border-gray-200 bg-white px-5 py-4 dark:border-white/[0.05] dark:bg-white/[0.01] lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex items-center gap-3'>
              <h4 className='type-card-title font-semibold text-gray-800 dark:text-white/90'>
                {activeBookingLabel}
              </h4>
              <span className='rounded-full bg-brand-50 px-3 py-0.5 type-caption font-semibold text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                {sortedBookings.length}
              </span>
            </div>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end'>
              <div className='relative w-full sm:w-[260px]'>
                <Search className='pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400' />
                <input
                  type='search'
                  value={bookingSearch}
                  onChange={(event) => setBookingSearch(event.target.value)}
                  placeholder='Search...'
                  className='h-10 w-full rounded-[10px] border border-gray-300 bg-white py-2 pl-11 pr-4 type-small text-gray-800 shadow-theme-xs outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500'
                />
              </div>
              {/* Channel filter */}
              <div ref={bookingChannelFilterRef} className='relative'>
                <Button
                  variant='outline'
                  onClick={() =>
                    setOpenBookingFilter(
                      openBookingFilter === 'channel' ? null : 'channel',
                    )
                  }
                  className='min-w-[165px]'
                >
                  <Radio size={14} className='shrink-0' />
                  {bookingChannelFilter.length > 0 && (
                    <span className='flex shrink-0 items-center'>
                      {bookingChannelFilter.slice(0, 3).map((channel, i) => {
                        const logo = CHANNEL_LOGOS[channel];
                        return (
                          <span
                            key={channel}
                            className={cn(
                              'flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white dark:bg-gray-900',
                              i > 0 && '-ml-1.5',
                            )}
                          >
                            {logo ? (
                              <Image
                                src={logo}
                                alt={channel}
                                width={16}
                                height={16}
                                className='h-4 w-4 object-contain'
                              />
                            ) : null}
                          </span>
                        );
                      })}
                    </span>
                  )}
                  <span className='truncate'>{activeBookingChannelLabel}</span>
                </Button>

                {openBookingFilter === 'channel' && (
                  <div className='absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                    <button
                      type='button'
                      onClick={() => setBookingChannelFilter([])}
                      className={cn(
                        'flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left type-small font-medium transition',
                        bookingChannelFilter.length === 0
                          ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                          : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]',
                      )}
                    >
                      <span className='inline-flex items-center gap-2'>
                        <Radio size={14} className='shrink-0' />
                        <span>All channels</span>
                      </span>
                      <span className='type-caption text-gray-400 dark:text-gray-500'>
                        {bookings.length}
                      </span>
                    </button>

                    <div className='my-1 border-t border-gray-100 dark:border-gray-800' />

                    {bookingChannels.map((channel) => {
                      const active = bookingChannelFilter.includes(channel);
                      const logo = CHANNEL_LOGOS[channel];
                      return (
                        <button
                          key={channel}
                          type='button'
                          onClick={() => toggleBookingChannel(channel)}
                          className={cn(
                            'flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left type-small font-medium capitalize transition',
                            active
                              ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]',
                          )}
                        >
                          <span className='inline-flex min-w-0 items-center gap-2'>
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                                active
                                  ? 'border-brand-500 bg-brand-500 text-white'
                                  : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900',
                              )}
                            >
                              {active && <Check size={11} strokeWidth={3} />}
                            </span>
                            {logo ? (
                              <Image
                                src={logo}
                                alt={channel}
                                width={16}
                                height={16}
                                className='h-4 w-4 shrink-0 object-contain'
                              />
                            ) : (
                              <Radio size={14} className='shrink-0' />
                            )}
                            <span className='truncate'>{channel}</span>
                          </span>
                          <span className='type-caption text-gray-400 dark:text-gray-500'>
                            {bookingChannelCounts[channel] || 0}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div ref={bookingFilterRef} className='relative'>
                <Button
                  variant='outline'
                  onClick={() =>
                    setOpenBookingFilter(
                      openBookingFilter === 'status' ? null : 'status',
                    )
                  }
                >
                  <SlidersHorizontal size={14} />
                  {activeTab === 'all'
                    ? 'Filter'
                    : `${TABS.find((t) => t.key === activeTab)?.label ?? ''} bookings`}
                </Button>
                {openBookingFilter === 'status' && (
                  <div className='absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900'>
                    {TABS.map((tab) => {
                      const isActive = activeTab === tab.key;
                      const count = tabCounts[tab.key];
                      return (
                        <button
                          key={tab.key}
                          type='button'
                          onClick={() => {
                            setActiveTab(tab.key);
                            // setBookingDateRange(null);
                            // setBookingDatePreset(null);
                            setBookingSearch('');
                            setCurrentPage(1);
                            setOpenBookingFilter(null);
                          }}
                          className={cn(
                            'flex w-full items-center justify-between rounded-[10px] px-3 py-2 text-left type-small font-medium transition',
                            isActive
                              ? 'bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'
                              : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]',
                          )}
                        >
                          <span className='inline-flex items-center gap-2'>
                            {tab.icon}
                            {tab.label} bookings
                          </span>

                          <span className='type-caption text-gray-400 dark:text-gray-500'>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div ref={bookingDateFilterRef}>
                <DateFilter
                  dateRange={bookingDateRange}
                  activePreset={bookingDatePreset}
                  setDateRange={setBookingDateRange}
                  setActivePreset={setBookingDatePreset}
                  open={openBookingFilter === 'date'}
                  onToggle={() =>
                    setOpenBookingFilter(
                      openBookingFilter === 'date' ? null : 'date',
                    )
                  }
                  onClose={() => setOpenBookingFilter(null)}
                />
              </div>
              <Button
                variant='outline'
                onClick={() => {
                  setActiveTab('all');
                  setBookingSearch('');
                  setCurrentPage(1);
                  setBookingDateRange(null);
                  setBookingDatePreset(null);
                  setBookingChannelFilter([]);
                  setOpenBookingFilter(null);
                }}
              >
                See all
              </Button>
            </div>
          </div>

          <div className='min-w-0 max-w-full overflow-hidden rounded-b-xl border border-gray-200 dark:border-white/[0.05]'>
            <div className='w-full overflow-x-auto'>
              <table className='lashvae-column-dividers min-h-65 min-w-[1560px] table-fixed'>
                <colgroup>
                  <col className='w-[200px]' />
                  <col className='w-[155px]' />
                  <col className='w-[210px]' />
                  <col className='w-[135px]' />
                  <col className='w-[135px]' />
                  <col className='w-[210px]' />
                  <col className='w-[170px]' />
                  <col className='w-[345px]' />
                </colgroup>
                <thead className='border-b border-gray-100 dark:border-white/[0.05]'>
                  <tr>
                    {[
                      { label: 'Customer', key: 'customer' },
                      { label: 'Phone', key: 'phone' },
                      { label: 'Email', key: 'email' },
                      { label: 'Channel', key: 'channel' },
                      { label: 'Date', key: 'date' },
                      { label: 'Time', key: 'time' },
                      { label: 'Status', key: 'status' },
                    ].map((column) => (
                      <th
                        key={column.key}
                        className={cn(
                          'px-5 py-3 type-body font-medium text-gray-500 dark:text-gray-400',
                          [
                            'phone',
                            'email',
                            'channel',
                            'date',
                            'time',
                          ].includes(column.key) && 'px-6',
                          column.key === 'status' ? 'text-center' : 'text-left',
                        )}
                      >
                        <button
                          type='button'
                          onClick={() =>
                            toggleBookingSort(column.key as BookingSortKey)
                          }
                          className={cn(
                            'flex w-full items-center gap-3 type-body font-medium',
                            column.key === 'status'
                              ? 'justify-center text-center'
                              : 'justify-between text-left',
                          )}
                        >
                          {column.label}
                          <ChevronsUpDown
                            className={cn(
                              'h-3.5 w-3.5',
                              bookingSort.key === column.key
                                ? 'text-brand-500'
                                : 'text-gray-300 dark:text-gray-600',
                            )}
                          />
                        </button>
                      </th>
                    ))}
                    <th className='px-6 py-3 text-left type-body font-medium text-gray-500 dark:text-gray-400'>
                      <span className='flex w-full items-center justify-between gap-3 text-left type-body font-medium'>
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100 dark:divide-white/[0.05]'>
                  {paginatedBookings.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className='px-5 py-14 text-center type-small text-gray-500 dark:text-gray-400'
                      >
                        {bookingSearch.trim()
                          ? 'No bookings match this search'
                          : activeTab === 'all'
                            ? 'No bookings yet'
                            : `No ${activeTab} bookings`}
                      </td>
                    </tr>
                  ) : (
                    paginatedBookings.map((booking) => {
                      const { profilePic, displayName } =
                        resolveBookingMeta(booking);
                      const contactPhone =
                        booking.customer_details?.phone ||
                        booking.customer_phone ||
                        '';
                      const contactEmail =
                        booking.customer_details?.email || '';
                      const effectiveStatus = isBookingCompleted(booking)
                        ? 'completed'
                        : booking.status;
                      const st = statusInfo(effectiveStatus);
                      const isLoading = actionLoading === booking.id;
                      const isCancelled = booking.status === 'cancelled';

                      return (
                        <tr
                          key={booking.id}
                          className='h-[52px] transition hover:bg-gray-50 dark:hover:bg-white/[0.02]'
                        >
                          <td className='px-5 py-3 sm:px-6'>
                            <div
                              className='flex items-center gap-3'
                              title={displayName}
                            >
                              <div className='relative shrink-0'>
                                <Avatar
                                  name={displayName}
                                  src={profilePic}
                                  size={34}
                                />
                              </div>
                              <div className='min-w-0'>
                                <span className='group relative block max-w-full type-small font-medium text-gray-800 dark:text-white/90'>
                                  <span className='block truncate'>
                                    {displayName}
                                  </span>
                                  <span className='pointer-events-none absolute left-0 top-full z-50 mt-1 hidden max-w-[280px] group-hover:block'>
                                    <span className='absolute -top-1 left-3 h-2 w-2 rotate-45 rounded-[2px] bg-gray-900' />
                                    <span className='relative block rounded-[10px] bg-gray-900 px-3 py-1.5 type-caption font-medium text-white shadow-lg'>
                                      {displayName}
                                    </span>
                                  </span>
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
                            <span className='block truncate'>
                              {contactPhone || 'No phone saved'}
                            </span>
                          </td>
                          <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
                            <span className='block truncate'>
                              {contactEmail || 'No email saved'}
                            </span>
                          </td>
                          <td className='px-6 py-3 type-small capitalize text-gray-500 dark:text-gray-400'>
                            <span className='inline-flex items-center gap-2'>
                              {booking.channel &&
                                CHANNEL_LOGOS[
                                booking.channel.toLowerCase()
                                ] && (
                                  <Image
                                    src={
                                      CHANNEL_LOGOS[
                                      booking.channel.toLowerCase()
                                      ]
                                    }
                                    alt={booking.channel}
                                    width={16}
                                    height={16}
                                    className='h-4 w-4 shrink-0 object-contain'
                                  />
                                )}
                              <span className='truncate'>
                                {booking.channel || 'Direct'}
                              </span>
                            </span>
                          </td>
                          <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
                            {formatDate(booking.booking_date)}
                          </td>
                          <td className='px-6 py-3 type-small text-gray-500 dark:text-gray-400'>
                            {formatTime(booking.start_time)} -{' '}
                            {formatTime(booking.end_time)}
                          </td>
                          <td className='px-6 py-3 text-center'>
                            <Badge color={st.color} startIcon={st.icon}>
                              {st.label}
                            </Badge>
                          </td>
                          <td className='px-6 py-3'>
                            {!isCancelled && effectiveStatus !== 'completed' ? (
                              <div className='flex items-center gap-2 whitespace-nowrap'>
                                <button
                                  type='button'
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    markBookingCompleted(booking);
                                  }}
                                  disabled={isLoading}
                                  title='Mark as completed'
                                  aria-label='Mark as completed'
                                  className='inline-flex h-8 items-center gap-2 rounded-[10px] bg-brand-500 px-3 type-small font-medium text-white shadow-theme-xs hover:bg-brand-600 disabled:opacity-50'
                                >
                                  {isLoading ? (
                                    <Loader2 className='h-3.5 w-3.5 animate-spin' />
                                  ) : (
                                    <CheckCircle2 size={14} />
                                  )}
                                  Mark as completed
                                </button>
                                <button
                                  type='button'
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    openReschedule(booking);
                                  }}
                                  disabled={isLoading}
                                  title='Reschedule'
                                  aria-label='Reschedule booking'
                                  className='inline-flex h-8 items-center gap-2 rounded-[10px] border border-gray-300 bg-white px-3 type-small font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03]'
                                >
                                  <RotateCcw size={14} />
                                  Reschedule
                                </button>
                                <button
                                  type='button'
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    cancelBooking(booking.id);
                                  }}
                                  disabled={isLoading}
                                  title='Cancel booking'
                                  aria-label='Cancel booking'
                                  className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-error-200 bg-error-50 text-error-600 hover:bg-error-100 disabled:opacity-50 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-400'
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className='type-small text-gray-400 dark:text-gray-500'>
                                No action
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              page={safeCurrentPage}
              totalItems={sortedBookings.length}
              onPageChange={setCurrentPage}
              pageSize={ITEMS_PER_PAGE}
            />
          </div>
        </div>
      </div>
      {/* Manual booking modal */}
      <Modal
        isOpen={showManualBooking}
        onClose={closeManualBooking}
        className='m-4 max-w-[720px]'
      >
        <div className='flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[20px] bg-white dark:bg-gray-900'>
          <div className='border-b border-gray-100 px-6 py-5 pr-14 dark:border-gray-800'>
            <h2 className='type-card-title font-bold text-gray-800 dark:text-white/90'>
              Add appointment
            </h2>
            <p className='mt-1 type-small text-gray-500 dark:text-gray-400'>
              Create a booking manually in{' '}
              {bookingSettings.booking_timezone || 'UTC'}.
            </p>
          </div>

          <div className='custom-scrollbar flex flex-col gap-6 overflow-y-auto p-6'>
            {/* Customer details */}
            <section>
              <div className='mb-3.5 flex items-center gap-3'>
                <div className='flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                  <User size={15} />
                </div>
                <div>
                  <h3 className='type-small font-bold text-gray-800 dark:text-white/90'>
                    Customer details
                  </h3>
                  <p className='type-caption text-gray-400 dark:text-gray-500'>
                    Basic contact information for the appointment
                  </p>
                </div>
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                {primaryCustomerFields.map((field) => (
                  <div key={field.id}>
                    <Label>
                      {field.label}
                      {field.required && (
                        <span className='text-warning-500'> *</span>
                      )}
                    </Label>
                    <Input
                      type={
                        field.field_key.toLowerCase() === 'email'
                          ? 'email'
                          : field.field_key.toLowerCase() === 'phone'
                            ? 'tel'
                            : 'text'
                      }
                      value={manualValues[field.field_key] || ''}
                      onChange={(event) =>
                        setManualValues((prev) => ({
                          ...prev,
                          [field.field_key]: event.target.value,
                        }))
                      }
                      placeholder={
                        field.field_key.toLowerCase() === 'name'
                          ? 'Enter customer name'
                          : field.field_key.toLowerCase() === 'phone'
                            ? 'Enter phone number'
                            : field.field_key.toLowerCase() === 'email'
                              ? 'Enter email address'
                              : `Enter ${field.label.toLowerCase()}`
                      }
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Custom customer questions */}
            {customCustomerFields.length > 0 && (
              <>
                <div className='h-px bg-gray-100 dark:bg-gray-800' />

                <section>
                  <div className='mb-3.5 flex items-center gap-3'>
                    <div className='flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                      <MessageSquare size={15} />
                    </div>
                    <div>
                      <h3 className='type-small font-bold text-gray-800 dark:text-white/90'>
                        Additional questions
                      </h3>
                      <p className='type-caption text-gray-400 dark:text-gray-500'>
                        Custom information configured in booking settings
                      </p>
                    </div>
                  </div>

                  <div className='rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]'>
                    <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                      {customCustomerFields.map((field) => (
                        <div
                          key={field.id}
                          className={
                            customCustomerFields.length === 1
                              ? 'sm:col-span-2'
                              : undefined
                          }
                        >
                          <Label>
                            {field.label}
                            {field.required && (
                              <span className='text-warning-500'> *</span>
                            )}
                          </Label>

                          {field.field_type === 'dropdown' ? (
                            <select
                              value={manualValues[field.field_key] || ''}
                              onChange={(event) =>
                                setManualValues((prev) => ({
                                  ...prev,
                                  [field.field_key]: event.target.value,
                                }))
                              }
                              className={SELECT_CLASS}
                            >
                              <option value=''>Select {field.label}</option>
                              {(field.options || []).map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <Input
                              type={
                                field.field_type === 'number'
                                  ? 'number'
                                  : 'text'
                              }
                              value={manualValues[field.field_key] || ''}
                              onChange={(event) =>
                                setManualValues((prev) => ({
                                  ...prev,
                                  [field.field_key]: event.target.value,
                                }))
                              }
                              placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}

            <div className='h-px bg-gray-100 dark:bg-gray-800' />

            {/* Appointment details */}
            <section>
              <div className='mb-3.5 flex items-center gap-3'>
                <div className='flex h-8 w-8 items-center justify-center rounded-[10px] bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
                  <CalendarClock size={15} />
                </div>
                <div>
                  <h3 className='type-small font-bold text-gray-800 dark:text-white/90'>
                    Appointment details
                  </h3>
                  <p className='type-caption text-gray-400 dark:text-gray-500'>
                    Choose an available date and time
                  </p>
                </div>
              </div>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div>
                  <Label>
                    Appointment date
                    <span className='text-warning-500'> *</span>
                  </Label>
                  <Input
                    type='date'
                    min={getTodayLocalKey()}
                    value={manualDate}
                    onChange={(event) => loadManualSlots(event.target.value)}
                  />
                </div>

                <div>
                  <Label>Day of week</Label>
                  <Input
                    readOnly
                    value={manualDayLabel}
                    placeholder='Choose a date'
                    className='cursor-not-allowed opacity-70'
                  />
                </div>

                <div className='sm:col-span-2'>
                  <Label>
                    Available slot
                    <span className='text-warning-500'> *</span>
                  </Label>
                  <select
                    value={selectedManualSlot}
                    onChange={(event) =>
                      setSelectedManualSlot(event.target.value)
                    }
                    disabled={
                      !manualDate ||
                      loadingManualSlots ||
                      manualSlots.length === 0
                    }
                    className={SELECT_CLASS}
                  >
                    <option value=''>
                      {loadingManualSlots
                        ? 'Loading available slots...'
                        : manualSlots.length
                          ? 'Select an available slot'
                          : 'No slots available'}
                    </option>

                    {manualSlots.map((slot, index) => (
                      <option
                        key={`${slot.start_time}-${slot.end_time}`}
                        value={index}
                      >
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className='sm:col-span-2'>
                  <Label>Internal notes</Label>
                  <Textarea
                    rows={3}
                    value={manualNotes}
                    onChange={(event) => setManualNotes(event.target.value)}
                    placeholder='Optional notes about this appointment'
                  />
                </div>
              </div>
            </section>

            {manualError && (
              <div className='flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-3.5 py-2 type-caption font-semibold text-error-600 dark:border-error-500/25 dark:bg-error-500/10 dark:text-error-400'>
                <AlertCircle size={15} className='shrink-0' />
                {manualError}
              </div>
            )}
          </div>

          <div className='flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800'>
            <Button
              variant='outline'
              onClick={closeManualBooking}
              disabled={creatingManualBooking}
            >
              Cancel
            </Button>
            <Button
              onClick={createManualBooking}
              disabled={creatingManualBooking || loadingManualSlots}
            >
              {creatingManualBooking ? (
                <Loader2 size={15} className='animate-spin' />
              ) : (
                <CalendarCheck size={15} />
              )}
              {creatingManualBooking ? 'Creating...' : 'Create appointment'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Availability weekly modal */}
      <Modal
        isOpen={showAvailabilityPanel}
        onClose={() => setShowAvailabilityPanel(false)}
        className='m-4 max-w-[760px]'
      >
        <div className='flex max-h-[85vh] w-full flex-col overflow-hidden rounded-[20px] bg-white dark:bg-gray-900'>
          <div className='border-b border-gray-100 px-6 py-5 pr-14 dark:border-gray-800'>
            <Badge color='primary' startIcon={<CalendarDays size={13} />}>
              Availability
            </Badge>
            <h2 className='mt-3 type-h4 font-bold text-gray-800 dark:text-white/90'>
              Weekly availability
            </h2>
            <p className='mt-1.5 type-small text-gray-500 dark:text-gray-400'>
              Choose active days and working hours for customer appointments.
            </p>
          </div>

          <div className='custom-scrollbar flex flex-col gap-3 overflow-y-auto p-6'>
            {availability.map((item) => (
              <div
                key={item.day_of_week}
                className={cn(
                  'grid grid-cols-1 items-center gap-3 rounded-xl border p-4 sm:grid-cols-[110px_70px_1fr]',
                  item.is_active
                    ? 'border-brand-100 bg-gray-50 dark:border-brand-500/20 dark:bg-white/[0.03]'
                    : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-transparent',
                )}
              >
                <span
                  className={cn(
                    'type-small font-bold',
                    item.is_active
                      ? 'text-gray-800 dark:text-white/90'
                      : 'text-gray-400 dark:text-gray-600',
                  )}
                >
                  {DAYS[item.day_of_week]}
                </span>

                <button
                  type='button'
                  onClick={() =>
                    updateAvailability(item.day_of_week, {
                      is_active: !item.is_active,
                    })
                  }
                  className={cn(
                    'h-[34px] rounded-full type-caption font-bold transition',
                    item.is_active
                      ? 'bg-brand-500 text-white hover:bg-brand-600'
                      : 'bg-gray-100 text-gray-500 dark:bg-white/[0.08] dark:text-gray-400',
                  )}
                >
                  {item.is_active ? 'ON' : 'OFF'}
                </button>

                <div className='grid grid-cols-[1fr_24px_1fr] items-center gap-2'>
                  <input
                    type='time'
                    value={item.start_time}
                    disabled={!item.is_active}
                    onChange={(e) =>
                      updateAvailability(item.day_of_week, {
                        start_time: e.target.value,
                      })
                    }
                    className={TIME_INPUT_CLASS}
                  />

                  <span className='text-center type-caption font-bold text-gray-300 dark:text-gray-600'>
                    to
                  </span>

                  <input
                    type='time'
                    value={item.end_time}
                    disabled={!item.is_active}
                    onChange={(e) =>
                      updateAvailability(item.day_of_week, {
                        end_time: e.target.value,
                      })
                    }
                    className={TIME_INPUT_CLASS}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className='flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800'>
            <Button
              variant='outline'
              onClick={() => setShowAvailabilityPanel(false)}
            >
              Discard
            </Button>

            <Button onClick={saveAvailability} disabled={savingAvailability}>
              <Save size={14} />
              {savingAvailability ? 'Saving...' : 'Save availability'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Reschedule modal */}
      {rescheduleBooking && (
        <Modal
          isOpen
          onClose={() => setRescheduleBooking(null)}
          className='m-4 max-w-[480px]'
        >
          <div className='w-full rounded-[20px] bg-white dark:bg-gray-900'>
            <div className='flex items-center gap-3 border-b border-gray-100 px-6 py-5 pr-14 dark:border-gray-800'>
              {(() => {
                const { profilePic, displayName } =
                  resolveBookingMeta(rescheduleBooking);
                return (
                  <>
                    <Avatar name={displayName} src={profilePic} size={40} />
                    <div>
                      <h2 className='type-body font-bold text-gray-800 dark:text-white/90'>
                        Reschedule booking
                      </h2>
                      <p className='type-caption text-gray-400 dark:text-gray-500'>
                        {displayName}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className='flex flex-col gap-4 p-6'>
              {[
                { label: 'Booking date', key: 'booking_date' },
                { label: 'Start time', key: 'start_time' },
                { label: 'End time', key: 'end_time' },
              ].map(({ label, key }) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Input
                    type='datetime-local'
                    value={rescheduleForm[key as keyof typeof rescheduleForm]}
                    onChange={(e) =>
                      setRescheduleForm((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <div>
                <Label>Notes</Label>
                <Textarea
                  rows={3}
                  value={rescheduleForm.notes}
                  onChange={(e) =>
                    setRescheduleForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className='flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800'>
              <Button
                variant='outline'
                onClick={() => setRescheduleBooking(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={submitReschedule}
                disabled={actionLoading === rescheduleBooking.id}
              >
                <RotateCcw size={14} />
                {actionLoading === rescheduleBooking.id
                  ? 'Saving...'
                  : 'Save reschedule'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Booking detail modal */}
      {selectedBooking &&
        (() => {
          const { profilePic, displayName } =
            resolveBookingMeta(selectedBooking);
          const st = statusInfo(selectedBooking.status);
          const isCancelled = selectedBooking.status === 'cancelled';
          const details = selectedBooking.customer_details || {};
          const knownKeys = ['name', 'phone', 'email'];
          const customFieldEntries = Object.entries(details).filter(
            ([k]) => !knownKeys.includes(k),
          );
          const detailEmail = details.email || null;
          const detailPhone =
            details.phone || selectedBooking.customer_phone || null;
          const detailName =
            details.name || selectedBooking.customer_name || null;
          const effectiveStatus = isBookingCompleted(selectedBooking)
            ? 'completed'
            : selectedBooking.status;

          return (
            <Modal
              isOpen
              onClose={() => setSelectedBooking(null)}
              className='m-4 max-w-[440px]'
            >
              <div className='max-h-[85vh] w-full overflow-y-auto rounded-[20px] bg-white dark:bg-gray-900'>
                <div className='flex flex-col items-center border-b border-gray-100 px-6 py-8 dark:border-gray-800'>
                  <div className='relative'>
                    <Avatar name={displayName} src={profilePic} size={72} />
                  </div>

                  <h2 className='mt-3 type-card-title font-bold text-gray-800 dark:text-white/90'>
                    {displayName}
                  </h2>

                  {selectedBooking.instagram_profile?.username &&
                    detailName && (
                      <span className='mt-0.5 type-caption text-gray-400 dark:text-gray-500'>
                        {detailName}
                      </span>
                    )}

                  <div className='mt-2.5 flex flex-wrap items-center justify-center gap-2'>
                    <Badge color={st.color} startIcon={st.icon}>
                      {st.label}
                    </Badge>
                    <Badge color='light' className='capitalize'>
                      {selectedBooking.channel || 'Direct'}
                    </Badge>
                  </div>
                </div>

                <div className='border-b border-gray-100 px-6 py-4 dark:border-gray-800'>
                  <p className='mb-3 type-caption font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                    Booking
                  </p>
                  <div className='flex flex-col gap-3'>
                    <DetailRow
                      icon={<CalendarDays size={14} />}
                      label='Date'
                      value={formatDate(selectedBooking.booking_date)}
                    />
                    <DetailRow
                      icon={<Clock size={14} />}
                      label='Time'
                      value={`${formatTime(selectedBooking.start_time)} - ${formatTime(selectedBooking.end_time)}`}
                    />
                  </div>
                </div>

                <div className='border-b border-gray-100 px-6 py-4 dark:border-gray-800'>
                  <p className='mb-3 type-caption font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                    Customer details
                  </p>
                  <div className='flex flex-col gap-3'>
                    {detailName && (
                      <DetailRow
                        icon={<User size={14} />}
                        label='Name'
                        value={detailName}
                      />
                    )}
                    {detailPhone && (
                      <DetailRow
                        icon={<Phone size={14} />}
                        label='Phone'
                        value={detailPhone}
                      />
                    )}
                    {detailEmail && (
                      <DetailRow
                        icon={<Mail size={14} />}
                        label='Email'
                        value={detailEmail}
                      />
                    )}
                    {customFieldEntries.map(([key, value]) => (
                      <DetailRow
                        key={key}
                        icon={<Tag size={14} />}
                        label={key
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                        value={value}
                      />
                    ))}
                  </div>
                </div>

                {selectedBooking.notes && (
                  <div className='border-b border-gray-100 px-6 py-4 dark:border-gray-800'>
                    <p className='mb-3 type-caption font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500'>
                      Notes
                    </p>
                    <div className='flex items-start gap-3'>
                      <div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-gray-500'>
                        <FileText size={14} />
                      </div>
                      <span className='type-small font-medium leading-relaxed text-gray-700 dark:text-gray-300'>
                        {selectedBooking.notes}
                      </span>
                    </div>
                  </div>
                )}

                {!isCancelled && effectiveStatus !== 'completed' && (
                  <div className='flex gap-3 px-6 py-4'>
                    <Button
                      variant='outline'
                      className='flex-1'
                      onClick={() => {
                        setSelectedBooking(null);
                        openReschedule(selectedBooking);
                      }}
                    >
                      <RotateCcw size={14} />
                      Reschedule
                    </Button>
                    <Button
                      variant='destructive'
                      className='flex-1'
                      onClick={() => {
                        setSelectedBooking(null);
                        cancelBooking(selectedBooking.id);
                      }}
                    >
                      <XCircle size={14} />
                      Cancel booking
                    </Button>
                  </div>
                )}
              </div>
            </Modal>
          );
        })()}

      {/* Cancel confirmation modal */}
      <Modal
        isOpen={!!bookingToCancel}
        onClose={() => setBookingToCancel(null)}
        className='m-4 max-w-[420px]'
      >
        <div className='w-full rounded-[20px] bg-white p-6 dark:bg-gray-900'>
          <div className='mb-4 flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-error-50 type-card-title font-bold text-error-500 dark:bg-error-500/15 dark:text-error-400'>
              !
            </div>
            <h3 className='type-body font-bold text-gray-800 dark:text-white/90'>
              Cancel booking?
            </h3>
          </div>

          <p className='type-small leading-relaxed text-gray-500 dark:text-gray-400'>
            This booking will be marked as cancelled and the customer will no
            longer be able to use this reservation.
          </p>

          <div className='mt-6 flex justify-end gap-3'>
            <Button variant='outline' onClick={() => setBookingToCancel(null)}>
              Keep Booking
            </Button>
            <Button variant='destructive' onClick={confirmCancel}>
              Cancel Booking
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete confirmation modal */}
      <Modal
        isOpen={!!bookingToComplete}
        onClose={() => setBookingToComplete(null)}
        className='m-4 max-w-[420px]'
      >
        <div className='w-full rounded-[20px] bg-white p-6 dark:bg-gray-900'>
          <div className='mb-4 flex items-center gap-3'>
            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400'>
              <CheckCircle2 size={18} />
            </div>
            <h3 className='type-body font-bold text-gray-800 dark:text-white/90'>
              Mark booking as completed?
            </h3>
          </div>

          <p className='type-small leading-relaxed text-gray-500 dark:text-gray-400'>
            This booking will be marked as completed and removed from active
            booking actions.
          </p>

          <div className='mt-6 flex justify-end gap-3'>
            <Button
              variant='outline'
              onClick={() => setBookingToComplete(null)}
              disabled={
                !!bookingToComplete && actionLoading === bookingToComplete.id
              }
            >
              Keep Booking
            </Button>
            <Button
              onClick={confirmComplete}
              disabled={
                !!bookingToComplete && actionLoading === bookingToComplete.id
              }
            >
              {!!bookingToComplete && actionLoading === bookingToComplete.id ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : (
                <CheckCircle2 size={14} />
              )}
              Mark Completed
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AvailabilityPage() {
  return (
    <RequireAuth>
      <AvailabilityContent />
    </RequireAuth>
  );
}
