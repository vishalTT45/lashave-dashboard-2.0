"use client";
// booking/create
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import {
  Bot,
  CalendarDays,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  CreditCard,
  FileText,
  Globe2,
  Menu,
  MessageSquare,
  PlayCircle,
  Power,
  Save,
  TimerReset,
  User,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import CustomerInfoCard from "@/components/CustomerInfoCard";
import CustomerInfoModal from "@/components/CustomerInfoModal";
// NOTE: this component already existed in the old dashboard
// (@/components/ReservationBookingCard). It is reused as-is here —
// its internal implementation was not part of either pasted file,
// so its props are assumed to match how the old dashboard used it.
import ReservationBookingCard, {
  type ReservationSettings,
  type ReservationDateRange,
} from "@/components/ReservationBookingCard";
import NotificationSettingsCard from "@/components/settings/NotificationSettingsCard";
import PageBreadcrumb from "@/components/common/PageBreadcrumb";
import { SettingsActionRow } from "@/components/settings/SettingsActionRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useRouter, useSearchParams } from "next/navigation";

type RawOverviewStats = {
  total_conversations?: number;
  conversations?: number;
  total_messages?: number;
  messages?: number;
  total_leads?: number;
  leads?: number;
  total_errors?: number;
  errors?: number;
  total_handoffs?: number;
  handoffs?: number;
  avg_latency_ms?: number;
};

type Settings = {
  system_prompt: string;
  opening_message: string;
  temperature: number;
  max_tokens: number;
  ai_enabled: boolean;

  // Handoff automation
  verified_ig_handoff_enabled: boolean;
  verified_ig_handoff_message: string;
  keyword_handoff_enabled: boolean;
  handoff_keywords: string[];
};

type AvailabilityItem = {
  id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

type Booking = {
  id: number;
  conversation_id?: number | null;
  customer_name: string;
  customer_phone?: string | null;
  channel: string;
  booking_type?: "appointment" | "reservation";
  booking_date: string | null;
  start_time: string | null;
  end_time: string | null;
  check_in_date?: string | null;
  check_out_date?: string | null;
  status: string;
  notes?: string | null;
  created_at?: string;
  profile_pic_url?: string | null;
  external_user_id?: string | null;
  instagram_profile?: {
    username?: string | null;
    profile_pic_url?: string | null;
  } | null;
};

type BlockedDate = {
  id?: number;
  blocked_date: string;
  reason?: string | null;
};

// ── Booking type / completion mode (ported from old dashboard) ──────────
type BookingCompletionMode = "manual" | "automatic";
type BookingSettings = Omit<ReservationSettings, "booking_type"> & {
  booking_type: "appointment" | "reservation";
  booking_enabled: boolean;
  booking_slot_duration_minutes: number;
  booking_buffer_minutes: number;
  booking_timezone: string;
  booking_completion_mode: BookingCompletionMode;
  booking_advance_days: number;
};

function normalizeBookingSettings(
  data: Partial<BookingSettings>,
): BookingSettings {
  return {
    booking_type:
      data.booking_type === "reservation" ? "reservation" : "appointment",
    booking_enabled: data.booking_enabled ?? false,
    booking_slot_duration_minutes: data.booking_slot_duration_minutes ?? 30,
    booking_buffer_minutes: data.booking_buffer_minutes ?? 10,
    booking_timezone: data.booking_timezone ?? "Asia/Kolkata",
    booking_completion_mode:
      data.booking_completion_mode === "automatic" ? "automatic" : "manual",
    booking_advance_days: clampBookingWindowDays(
      data.booking_advance_days ?? 30,
    ),
    reservation_min_nights: data.reservation_min_nights ?? 1,
    reservation_max_nights: data.reservation_max_nights ?? null,
    reservation_available_ranges:
      data.reservation_available_ranges?.map((range: ReservationDateRange) => ({
        ...range,
      })) ?? [],
  };
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const defaultAvailability: AvailabilityItem[] = DAYS.map((_, index) => ({
  day_of_week: index,
  start_time: "10:00",
  end_time: "19:00",
  is_active: index <= 4,
}));

interface BookingSettingsResponse {
  ok: boolean;
  booking_enabled: boolean;
  booking_advance_days?: number;
}

const BOOKING_WINDOW_MIN = 1;
const BOOKING_WINDOW_MAX = 365;
const BOOKING_WINDOW_PRESETS = [7, 30, 90, 180, 365] as const;

function clampBookingWindowDays(value: number) {
  return Math.max(
    BOOKING_WINDOW_MIN,
    Math.min(BOOKING_WINDOW_MAX, Math.round(value)),
  );
}

function formatBookingWindowDate(days: number) {
  return new Date(Date.now() + (days - 1) * 86_400_000).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
    },
  );
}

function isUpcoming(dateStr?: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) > new Date();
}

const SELECT_CLASS =
  "h-10 w-full appearance-none rounded-[10px] border border-gray-300 bg-transparent px-4 py-2 pr-8 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800";

const TIME_INPUT_CLASS =
  "h-10 w-full rounded-[10px] border border-gray-300 bg-white px-3 type-small text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

const INPUT_CLASS =
  "h-10 rounded-[10px] border-gray-300 px-4 py-2 type-small text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus-visible:border-brand-300 focus-visible:ring-3 focus-visible:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus-visible:border-brand-800";

const TEXTAREA_CLASS =
  "rounded-[10px] border-gray-300 px-4 py-3 type-small text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus-visible:border-brand-300 focus-visible:ring-3 focus-visible:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus-visible:border-brand-800";

const SETTINGS_SECTIONS = [
  "ai",
  "profile",
  "booking",
  "channels",
  "knowledge",
  "billing",
];

function BookingWindowEditor({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const days = clampBookingWindowDays(value);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div>
        <h4 className="type-small font-semibold text-gray-800 dark:text-white/90">
          Booking window
        </h4>
        <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
          How many days ahead can customers book, starting from today?
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className="shrink-0 type-small text-gray-500 dark:text-gray-400">
          Open for next
        </span>
        <input
          type="range"
          min={BOOKING_WINDOW_MIN}
          max={BOOKING_WINDOW_MAX}
          value={days}
          onChange={(e) =>
            onChange(clampBookingWindowDays(Number(e.target.value)))
          }
          className="h-2 flex-1 cursor-pointer accent-brand-500"
        />
        <div className="min-w-[78px] rounded-[10px] border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-center type-small font-semibold text-brand-500 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400">
          {days} day{days === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {BOOKING_WINDOW_PRESETS.map((preset) => {
          const active = days === preset;

          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={cn(
                "rounded-lg px-3 py-1.5 type-caption font-semibold transition",
                active
                  ? "border border-brand-300 bg-brand-50 text-brand-500 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-400"
                  : "border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-400 dark:hover:bg-white/[0.03]",
              )}
            >
              {preset === BOOKING_WINDOW_MAX ? "365d (max)" : `${preset}d`}
            </button>
          );
        })}
      </div>

      <p className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2.5 type-small leading-6 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
        Customers can pick any date from{" "}
        <strong>
          {new Date().toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </strong>{" "}
        to <strong>{formatBookingWindowDate(days)}</strong> — shifts forward
        automatically every day.
      </p>
    </div>
  );
}

function formatBlockedDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function BlockedDatesEditor({
  value,
  onChange,
}: {
  value: BlockedDate[];
  onChange: (value: BlockedDate[]) => void;
}) {
  const [draftDate, setDraftDate] = useState("");
  const [draftReason, setDraftReason] = useState("");

  const sorted = [...value].sort((a, b) =>
    a.blocked_date.localeCompare(b.blocked_date),
  );

  const handleAdd = async () => {
    if (!draftDate) return;

    const created = await apiFetch<BlockedDate>(
      "/admin/booking/blocked-dates",
      {
        method: "POST",
        body: {
          blocked_date: draftDate,
          reason: draftReason.trim() || null,
        },
        auth: true,
      },
    );

    onChange(
      [...value, created].sort((a, b) =>
        a.blocked_date.localeCompare(b.blocked_date),
      ),
    );

    setDraftDate("");
    setDraftReason("");
  };

  const handleRemove = async (id?: number) => {
    if (!id) return;

    await apiFetch(`/admin/booking/blocked-dates/${id}`, {
      method: "DELETE",
      auth: true,
    });

    onChange(value.filter((item) => item.id !== id));
  };

  return (
    <div className="rounded-xl border bg-gray-50 border-gray-200 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div>
        <h4 className="type-small font-semibold text-gray-800 dark:text-white/90">
          Blocked dates
        </h4>
        <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
          One-off closures — holidays, days off. No monthly reset needed.
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-white px-3.5 py-3 type-small italic text-gray-500 dark:border-gray-700 dark:bg-transparent dark:text-gray-400">
          No blocked dates yet
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {sorted.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
            >
              <div className="flex items-baseline gap-3">
                <span className="type-small font-semibold text-gray-800 dark:text-white/90">
                  {formatBlockedDate(item.blocked_date)}
                </span>
                <span className="type-small text-gray-400 dark:text-gray-500">
                  {item.reason || "Closed"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(item.id)}
                aria-label="Remove blocked date"
                className="type-small leading-none text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="date"
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
          className="w-[150px] rounded-lg border border-gray-200 bg-white px-3 py-2 type-small text-gray-800 dark:border-gray-700 dark:bg-white/[0.02] dark:text-white/90"
        />
        <input
          type="text"
          placeholder="Reason (e.g. Independence Day)"
          value={draftReason}
          onChange={(e) => setDraftReason(e.target.value)}
          className="min-w-[160px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 type-small text-gray-800 placeholder-gray-400 dark:border-gray-700 dark:bg-white/[0.02] dark:text-white/90 dark:placeholder-gray-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draftDate}
          className="rounded-lg bg-brand-500 px-4 py-2 type-caption font-semibold text-white transition hover:bg-brand-600 dark:hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { isDark } = useTheme();
  const searchParams = useSearchParams();
  const isWeekly = searchParams.get("weekly") === "true";
  const requestedSection = searchParams.get("section");
  const initialSection = SETTINGS_SECTIONS.includes(requestedSection || "")
    ? (requestedSection as string)
    : "ai";

  const [s, setS] = useState<Settings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState("");

  const [savingAI, setSavingAI] = useState(false);
  const [savedAI, setSavedAI] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);

  const [togglingAI, setTogglingAI] = useState(false);
  const [activeSection, setActiveSection] = useState(initialSection);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAvailabilityPanel, setShowAvailabilityPanel] = useState<
    true | false
  >(isWeekly ? true : false);
  const [availability, setAvailability] =
    useState<AvailabilityItem[]>(defaultAvailability);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [showCustomerInfoModal, setShowCustomerInfoModal] = useState(false);

  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);

  const router = useRouter();
  const settingsReturnHref = `/settings?section=${encodeURIComponent(activeSection)}`;

  useEffect(() => {
    if (SETTINGS_SECTIONS.includes(requestedSection || "")) {
      setActiveSection(requestedSection as string);
    }
  }, [requestedSection]);

  /* Filtered list */
  const bookingStats = [
    {
      label: "Upcoming",
      value: bookings.filter(
        (b) =>
          isUpcoming(
            b.booking_type === "reservation" ? b.check_in_date : b.start_time,
          ) && b.status !== "cancelled",
      ).length,
    },
    {
      label: "Confirmed",
      value: bookings.filter((b) =>
        ["confirmed", "rescheduled"].includes(b.status),
      ).length,
    },
    {
      label: "Cancelled",
      value: bookings.filter((b) => b.status === "cancelled").length,
    },
  ];

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);

    check();
    window.addEventListener("resize", check);

    return () => window.removeEventListener("resize", check);
  }, []);

  // ── Booking settings (now type-aware: appointment | reservation) ──────
  const [bookingSettings, setBookingSettings] = useState<BookingSettings>(() =>
    normalizeBookingSettings({}),
  );
  // Draft used while the modal is open, only committed to bookingSettings on save.
  const [bookingDraft, setBookingDraft] = useState<BookingSettings>(() =>
    normalizeBookingSettings({}),
  );
  const [bookingModalStep, setBookingModalStep] = useState<
    "type" | "appointment" | "reservation"
  >("type");
  const [bookingError, setBookingError] = useState("");
  const [reservationBusy, setReservationBusy] = useState(false);
  const [reservationDirty, setReservationDirty] = useState(false);
  const bookingDialogRef = useRef<HTMLDivElement>(null);
  const bookingSaveInFlight = useRef(false);

  const [advanceDaysDraft, setAdvanceDaysDraft] = useState(30);
  const [savingBookingSettings, setSavingBookingSettings] = useState(false);

  // Handoff automation state
  const [handoffKwInput, setHandoffKwInput] = useState("");
  const [savingHandoff, setSavingHandoff] = useState(false);
  const [savedHandoff, setSavedHandoff] = useState(false);
  const [togglingVerifiedHandoff, setTogglingVerifiedHandoff] = useState(false);
  const [togglingKeywordHandoff, setTogglingKeywordHandoff] = useState(false);

  const [testMsg, setTestMsg] = useState("What services do you offer?");
  const [testOut, setTestOut] = useState<{
    answer: string;
    latency_ms: number;
    model: string;
    provider?: string;
    faq_id?: number;
    faq_score?: number;
  } | null>(null);

  const [testing, setTesting] = useState(false);
  const [tenantId, setTenantId] = useState<string>("");

  const [healthOverview, setHealthOverview] = useState<{
    conversations: number;
    messages: number;
    leads: number;
    errors: number;
    handoffs: number;
    avg_latency_ms: number;
  } | null>(null);
  // Rendering this is a separate, pre-existing gap (fetched but not
  // yet surfaced in the UI) — out of scope for this pass, which is
  // only removing the `any` on the fetch itself.
  void healthOverview;

  const taRef = useRef<HTMLTextAreaElement>(null);

  const openAvailabilityPanel = () => {
    setAdvanceDaysDraft(bookingSettings.booking_advance_days || 30);
    setShowAvailabilityPanel(true);
  };

  // ── Booking modal open/close (with unsaved-changes guard, ported) ─────
  const openBookingModal = (changeType = false) => {
    setBookingDraft(normalizeBookingSettings(bookingSettings));
    setBookingModalStep(changeType ? "type" : bookingSettings.booking_type);
    setBookingError("");
    setReservationDirty(false);
    setShowBookingModal(true);
  };

  const closeBookingModal = () => {
    if (bookingSaveInFlight.current || reservationBusy) return;
    const hasUnsavedChanges =
      reservationDirty ||
      JSON.stringify(bookingDraft) !== JSON.stringify(bookingSettings);
    if (
      hasUnsavedChanges &&
      !window.confirm("Discard unsaved booking settings?")
    ) {
      return;
    }
    setShowBookingModal(false);
    setReservationDirty(false);
  };

  // Keep the escape/focus-trap handlers pointed at the latest closeBookingModal
  const closeBookingRef = useRef(closeBookingModal);
  closeBookingRef.current = closeBookingModal;

  // Focus trap + Escape-to-close for the booking modal (ported from old dashboard).
  // The shared <Modal> component is used for the *availability* panel below and
  // already provides this; this custom modal needs it wired in manually because
  // the booking flow has its own multi-step body.
  useEffect(() => {
    if (!showBookingModal) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    bookingDialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeBookingRef.current();
      }
      if (event.key !== "Tab") return;

      const elements = Array.from(
        bookingDialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }

      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === bookingDialogRef.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      previousFocus?.focus();
    };
  }, [showBookingModal]);

  const saveBookingSettings = async () => {
    if (bookingSaveInFlight.current) return;
    bookingSaveInFlight.current = true;
    setSavingBookingSettings(true);
    setBookingError("");

    try {
      const payload = {
        booking_type: bookingDraft.booking_type,
        booking_enabled: bookingDraft.booking_enabled,
        booking_slot_duration_minutes:
          bookingDraft.booking_slot_duration_minutes,
        booking_buffer_minutes: bookingDraft.booking_buffer_minutes,
        booking_timezone: bookingDraft.booking_timezone,
        booking_completion_mode: bookingDraft.booking_completion_mode,
        booking_advance_days: clampBookingWindowDays(
          bookingDraft.booking_advance_days || 30,
        ),
      };

      const data = await apiFetch<BookingSettingsResponse>(
        "/admin/booking/settings",
        {
          method: "PUT",
          body: payload,
          auth: true,
        },
      );

      const saved = normalizeBookingSettings({ ...bookingDraft, ...payload });
      setBookingSettings(saved);
      setBookingDraft(saved);
      setAdvanceDaysDraft(saved.booking_advance_days);

      if (data.booking_enabled && saved.booking_type === "appointment") {
        setShowAvailabilityPanel(true);
      }

      setShowBookingModal(false);
    } catch (e: any) {
      setBookingError(e?.message || "Could not save booking settings.");
    } finally {
      bookingSaveInFlight.current = false;
      setSavingBookingSettings(false);
    }
  };

  const updateAvailability = async (
    dayIndex: number,
    patch: Partial<AvailabilityItem>,
  ) => {
    setAvailability((prev) =>
      prev.map((item) =>
        item.day_of_week === dayIndex ? { ...item, ...patch } : item,
      ),
    );
  };

  const saveAvailability = async () => {
    try {
      setSavingAvailability(true);

      await apiFetch("/admin/booking/availability", {
        method: "PUT",
        body: { items: availability },
        auth: true,
      });

      const nextAdvanceDays = clampBookingWindowDays(advanceDaysDraft);

      await apiFetch<BookingSettingsResponse>("/admin/booking/settings", {
        method: "PUT",
        body: { booking_advance_days: nextAdvanceDays },
        auth: true,
      });

      // await apiFetch("/admin/booking/blocked-dates", {
      //   method: "POST",
      //   body: { items: blockedDates },
      //   auth: true,
      // });

      setBookingSettings((prev) => ({
        ...prev,
        booking_advance_days: nextAdvanceDays,
      }));
      setAdvanceDaysDraft(nextAdvanceDays);

      setShowAvailabilityPanel(false);
    } catch (e: any) {
      setErr(e?.message || "Failed to save availability");
    } finally {
      setSavingAvailability(false);
    }
  };

  async function load() {
    setErr("");

    try {
      const [data, me] = await Promise.all([
        apiFetch<Settings>("/admin/settings", { auth: true }),
        apiFetch<{ user: { tenant_id: string } }>("/admin/auth/me", {
          auth: true,
        }),
      ]);

      const bookingRes = await apiFetch<BookingSettings>(
        "/admin/booking/settings",
        { auth: true },
      );

      const availabilityRes = await apiFetch<{ items: AvailabilityItem[] }>(
        "/admin/booking/availability",
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

      try {
        const blockedDatesRes = await apiFetch<{ items: BlockedDate[] }>(
          "/admin/booking/blocked-dates",
          { auth: true },
        );
        setBlockedDates(blockedDatesRes.items || []);
      } catch {
        // Endpoint may not exist yet on the backend — don't block the rest
        // of settings from loading.
        setBlockedDates([]);
      }

      const bookingsRes = await apiFetch<{ items: Booking[] }>(
        "/admin/bookings",
        { auth: true },
      );
      setBookings(bookingsRes.items || []);

      const savedBookingSettings = normalizeBookingSettings(bookingRes);
      setBookingSettings(savedBookingSettings);
      setBookingDraft(savedBookingSettings);
      setAdvanceDaysDraft(savedBookingSettings.booking_advance_days);

      data.handoff_keywords = Array.isArray(data.handoff_keywords)
        ? data.handoff_keywords
        : [];

      // Sensible defaults if backend ever omits these
      data.verified_ig_handoff_enabled = Boolean(
        data.verified_ig_handoff_enabled,
      );
      data.keyword_handoff_enabled = Boolean(data.keyword_handoff_enabled);
      data.verified_ig_handoff_message =
        typeof data.verified_ig_handoff_message === "string"
          ? data.verified_ig_handoff_message
          : "";

      data.system_prompt =
        typeof data.system_prompt === "string"
          ? data.system_prompt.slice(0, 1000)
          : "";

      setS(data);
      setTenantId(me.user.tenant_id);
      setLoaded(true);

      apiFetch<any>("/admin/stats/overview", { auth: true })
        .then((ov) =>
          setHealthOverview({
            conversations: ov.total_conversations ?? ov.conversations ?? 0,
            messages: ov.total_messages ?? ov.messages ?? 0,
            leads: ov.total_leads ?? ov.leads ?? 0,
            errors: ov.total_errors ?? ov.errors ?? 0,
            handoffs: ov.total_handoffs ?? ov.handoffs ?? 0,
            avg_latency_ms: ov.avg_latency_ms ?? 0,
          }),
        )
        .catch(() => {});
    } catch (e: any) {
      setErr(e?.message || "Failed to load settings");
    }
  }

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = taRef.current.scrollHeight + "px";
    }
  }, [s?.system_prompt]);

  async function saveAISettings() {
    if (!s) return;

    setSavingAI(true);
    setErr("");

    try {
      await apiFetch("/admin/settings", {
        method: "PUT",
        auth: true,
        body: {
          system_prompt: s.system_prompt,
          opening_message: s.opening_message,
          temperature: s.temperature,
          max_tokens: s.max_tokens,
        },
      });

      setSavedAI(true);
      setTimeout(() => setSavedAI(false), 2000);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSavingAI(false);
    }
  }

  async function toggleAI() {
    if (!s) return;

    setTogglingAI(true);
    setErr("");

    const next = !s.ai_enabled;

    try {
      await apiFetch("/admin/settings", {
        method: "PUT",
        auth: true,
        body: { ai_enabled: next },
      });

      setS((p) => (p ? { ...p, ai_enabled: next } : p));
    } catch (e: any) {
      setErr(e?.message || "Toggle failed");
    } finally {
      setTogglingAI(false);
    }
  }

  // Handoff automation handlers
  async function toggleVerifiedHandoff() {
    if (!s) return;

    setTogglingVerifiedHandoff(true);
    setErr("");

    const next = !s.verified_ig_handoff_enabled;

    try {
      await apiFetch("/admin/settings", {
        method: "PUT",
        auth: true,
        body: { verified_ig_handoff_enabled: next },
      });

      setS((p) => (p ? { ...p, verified_ig_handoff_enabled: next } : p));
    } catch (e: any) {
      setErr(e?.message || "Toggle failed");
    } finally {
      setTogglingVerifiedHandoff(false);
    }
  }

  async function toggleKeywordHandoff() {
    if (!s) return;

    setTogglingKeywordHandoff(true);
    setErr("");

    const next = !s.keyword_handoff_enabled;

    try {
      await apiFetch("/admin/settings", {
        method: "PUT",
        auth: true,
        body: { keyword_handoff_enabled: next },
      });

      setS((p) => (p ? { ...p, keyword_handoff_enabled: next } : p));
    } catch (e: any) {
      setErr(e?.message || "Toggle failed");
    } finally {
      setTogglingKeywordHandoff(false);
    }
  }

  function addHandoffKw() {
    const kw = handoffKwInput.trim().toLowerCase();

    if (!kw || !s) return;

    if (s.handoff_keywords.includes(kw)) {
      setHandoffKwInput("");
      return;
    }

    setS((p) =>
      p ? { ...p, handoff_keywords: [...p.handoff_keywords, kw] } : p,
    );

    setHandoffKwInput("");
  }

  function removeHandoffKw(kw: string) {
    setS((p) =>
      p
        ? {
            ...p,
            handoff_keywords: p.handoff_keywords.filter((k) => k !== kw),
          }
        : p,
    );
  }

  async function saveHandoffSettings() {
    if (!s) return;

    setSavingHandoff(true);
    setErr("");

    try {
      await apiFetch("/admin/settings", {
        method: "PUT",
        auth: true,
        body: {
          verified_ig_handoff_message: s.verified_ig_handoff_message,
          handoff_keywords: s.handoff_keywords,
        },
      });

      setSavedHandoff(true);
      setTimeout(() => setSavedHandoff(false), 2000);
    } catch (e: any) {
      setErr(e?.message || "Save failed");
    } finally {
      setSavingHandoff(false);
    }
  }

  async function runTest() {
    setErr("");
    setTestOut(null);
    setTesting(true);

    try {
      const r = await apiFetch<{
        answer: string;
        latency_ms: number;
        model: string;
        provider?: string;
        faq_id?: number;
        faq_score?: number;
      }>("/internal/chat_api", {
        method: "POST",
        auth: true,
        body: {
          tenant_id: tenantId,
          conversation_id: "settings-test",
          message: testMsg,
          channel: "test",
        },
      });

      setTestOut(r);
    } catch (e: any) {
      setErr(e?.message || "Test failed");
    } finally {
      setTesting(false);
    }
  }

  const settingsLoading = !loaded || !s;
  const isLive = s?.ai_enabled === true;
  const isAppointment = bookingSettings.booking_type === "appointment";

  const SETTINGS_ITEMS = [
    {
      key: "ai",
      title: "General",
      subtitle: "Auto reply, tone and behavior",
      icon: <Bot size={20} />,
    },
    {
      key: "profile",
      title: "Profile",
      subtitle: "Account and security settings",
      icon: <User size={20} />,
    },
    {
      key: "booking",
      title: "Smart Booking",
      subtitle: "Manage booking preferences",
      icon: <CalendarDays size={20} />,
    },
    {
      key: "channels",
      title: "Channels",
      subtitle: "Connect your channels",
      icon: <MessageSquare size={20} />,
    },
    {
      key: "knowledge",
      title: "Knowledge",
      subtitle: "Manage files and FAQs",
      icon: <FileText size={20} />,
    },
    {
      key: "billing",
      title: "Billing",
      subtitle: "Plan and billing details",
      icon: <CreditCard size={20} />,
    },
  ];

  return (
    <RequireAuth>
      <PageBreadcrumb pageTitle="Settings" />

      {err && (
        <div className="mb-6 rounded-[10px] border border-error-200 bg-error-50 px-4 py-3 type-small text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[290px_1fr] lg:items-start">
        {/* SIDEBAR */}
        <div>
          {isMobile && (
            <button
              onClick={() => setSettingsMenuOpen((p) => !p)}
              className="mb-3 flex h-10 w-full items-center justify-between rounded-[10px] border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              <span>Settings Menu</span>
              <Menu size={18} />
            </button>
          )}

          {(!isMobile || settingsMenuOpen) && (
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
                <h3 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
                  Settings
                </h3>
                <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
                  Manage workspace preferences
                </p>
              </div>

              <div className="flex flex-col gap-1 p-3">
                {SETTINGS_ITEMS.map((item) => {
                  const active = activeSection === item.key;

                  return (
                    <button
                      key={item.key}
                      onClick={() => {
                        if (item.key === "profile") {
                          router.push("/profile");
                          return;
                        }

                        if (item.key === "channels") {
                          router.push(
                            `/channels?from=settings&returnTo=${encodeURIComponent(settingsReturnHref)}`,
                          );
                          return;
                        }

                        if (item.key === "knowledge") {
                          router.push(
                            `/faq?from=settings&returnTo=${encodeURIComponent(settingsReturnHref)}`,
                          );
                          return;
                        }

                        if (item.key === "billing") {
                          router.push("/profile?billing=True");
                          return;
                        }

                        setActiveSection(item.key);
                        setSettingsMenuOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-[10px] px-3 py-3 text-left transition",
                        active
                          ? "bg-brand-50 dark:bg-brand-500/[0.12]"
                          : "hover:bg-gray-50 dark:hover:bg-white/[0.03]",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-[10px]",
                            active
                              ? "bg-white text-brand-500 shadow-theme-xs dark:bg-white/10 dark:text-brand-400"
                              : "text-gray-500 dark:text-gray-400",
                          )}
                        >
                          {item.icon}
                        </span>

                        <span>
                          <span
                            className={cn(
                              "block type-small font-semibold",
                              active
                                ? "text-brand-500 dark:text-brand-400"
                                : "text-gray-700 dark:text-gray-300",
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="mt-0.5 block type-caption font-normal text-gray-400 dark:text-gray-500">
                            {item.subtitle}
                          </span>
                        </span>
                      </span>

                      <ChevronRight
                        size={16}
                        className={cn(
                          "shrink-0",
                          active
                            ? "text-brand-400"
                            : "text-gray-300 dark:text-gray-600",
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* CONTENT */}
        <div className="min-w-0">
          {activeSection === "ai" && (
            <div className="flex flex-col gap-6">
              <NotificationSettingsCard />

              {/* AI enable card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
                      AI Auto Reply
                    </h2>
                    <p className="mt-1 type-small leading-6 text-gray-500 dark:text-gray-400">
                      Control whether the bot responds automatically to incoming
                      messages
                    </p>
                  </div>

                  <Badge
                    color={isLive ? "primary" : "light"}
                    startIcon={
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          isLive ? "animate-pulse bg-brand-500" : "bg-gray-400",
                        )}
                      />
                    }
                  >
                    {isLive ? "Live" : "Paused"}
                  </Badge>
                </div>

                <div
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4",
                    isLive
                      ? "border-brand-100 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10"
                      : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/[0.02]",
                  )}
                >
                  <div>
                    <p className="flex items-center gap-1.5 type-small font-semibold text-gray-800 dark:text-white/90">
                      <Bot size={16} className="text-brand-500" />
                      {isLive
                        ? "AI is responding automatically"
                        : "Manual mode - AI is paused"}
                    </p>
                    <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
                      {isLive
                        ? "All incoming messages get an AI reply. Click to pause."
                        : "Messages are saved but no auto replies are sent. Click to resume."}
                    </p>
                  </div>

                  <Switch
                    checked={isLive}
                    disabled={settingsLoading || togglingAI}
                    onChange={toggleAI}
                  />
                </div>
              </div>

              {/* Handoff Automation */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
                <div className="mb-2">
                  <h2 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
                    Handoff Automation
                  </h2>
                  <p className="mt-1 type-small leading-6 text-gray-500 dark:text-gray-400">
                    Route conversations to your team automatically. The AI does
                    not reply when a handoff is triggered.
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-4 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="type-small font-semibold text-gray-800 dark:text-white/90">
                      Auto-handoff verified Instagram accounts
                    </p>
                    <p className="mt-1 type-small text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="#0095F6"
                        className="h-4 w-4 flex-shrink-0"
                      >
                        <path d="M22 12l-2.1-2.4.3-3.2-3.1-.7L15.5 3 12 4.6 8.5 3 6.9 5.7l-3.1.7.3 3.2L2 12l2.1 2.4-.3 3.2 3.1.7L8.5 21l3.5-1.6 3.5 1.6 1.6-2.7 3.1-.7-.3-3.2L22 12zm-11 3.2l-2.3-2.3 1.1-1.1 1.2 1.2 3.1-3.1 1.1 1.1-4.2 4.2z" />
                      </svg>

                      <span>
                        Verified Instagram profiles skip the AI and go straight
                        to your team.
                      </span>
                    </p>
                  </div>

                  <Switch
                    checked={!!s?.verified_ig_handoff_enabled}
                    disabled={!s || togglingVerifiedHandoff}
                    onChange={toggleVerifiedHandoff}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 border-t border-gray-100 py-4 dark:border-gray-800">
                  <div className="min-w-0">
                    <p className="type-small font-semibold text-gray-800 dark:text-white/90">
                      Auto-handoff on keywords
                    </p>
                    <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
                      Hand off when a customer message contains any keyword
                      below.
                    </p>
                  </div>

                  <Switch
                    checked={!!s?.keyword_handoff_enabled}
                    disabled={!s || togglingKeywordHandoff}
                    onChange={toggleKeywordHandoff}
                  />
                </div>

                <div
                  className={cn(
                    "border-t border-gray-100 pt-4 dark:border-gray-800",
                    !s?.keyword_handoff_enabled && "opacity-55",
                  )}
                >
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <Label className="mb-0">Handoff keywords</Label>
                    <span className="font-mono type-caption font-medium text-brand-500 dark:text-brand-400">
                      {s?.handoff_keywords?.length ?? 0} active
                    </span>
                  </div>

                  <p className="mb-2.5 type-small text-gray-500 dark:text-gray-400">
                    Case-insensitive substring match. Use single words or short
                    phrases like <code>human</code>, <code>refund</code>,{" "}
                    <code>call me</code>.
                  </p>

                  <div className="mb-3 flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
                    {(s?.handoff_keywords?.length ?? 0) === 0 && (
                      <span className="type-small text-gray-400 dark:text-gray-600">
                        No handoff keywords yet. Add one below.
                      </span>
                    )}

                    {(s?.handoff_keywords ?? []).map((kw) => (
                      <Badge key={kw} color="light" className="gap-1.5">
                        {kw}
                        <button
                          type="button"
                          onClick={() => removeHandoffKw(kw)}
                          className="text-gray-400 transition hover:text-gray-700 dark:hover:text-white/80"
                          aria-label={`Remove ${kw}`}
                        >
                          <X size={12} />
                        </button>
                      </Badge>
                    ))}
                  </div>

                  <div className="mb-4 flex gap-2">
                    <Input
                      value={handoffKwInput}
                      onChange={(e) => setHandoffKwInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addHandoffKw()}
                      placeholder="Type a keyword or phrase and press Enter"
                      className={INPUT_CLASS}
                    />

                    <Button
                      variant="outline"
                      size="lg"
                      onClick={addHandoffKw}
                      disabled={!handoffKwInput.trim()}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4 dark:border-gray-800">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <Label className="mb-0">Opening message</Label>
                    <span className="font-mono type-caption font-medium text-brand-500 dark:text-brand-400">
                      {(s?.verified_ig_handoff_message || "").length} chars
                    </span>
                  </div>

                  <Textarea
                    rows={3}
                    value={s?.verified_ig_handoff_message || ""}
                    onChange={(e) =>
                      setS((p) =>
                        p
                          ? {
                              ...p,
                              verified_ig_handoff_message: e.target.value,
                            }
                          : p,
                      )
                    }
                    placeholder="Thanks for reaching out. I've passed this to our team and someone will reply shortly."
                    className={TEXTAREA_CLASS}
                  />

                  <p className="mt-1.5 type-small text-gray-500 dark:text-gray-400">
                    Sent once to the customer when handoff is triggered. Used by
                    both verified and keyword paths. Leave blank to use the
                    default.
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="type-small text-gray-500 dark:text-gray-400">
                    Toggles save instantly. Keywords and message save here.
                  </p>

                  <Button
                    onClick={saveHandoffSettings}
                    disabled={savingHandoff}
                  >
                    {savingHandoff
                      ? "Saving..."
                      : savedHandoff
                        ? "Saved"
                        : "Save handoff settings"}
                  </Button>
                </div>
              </div>

              {/* About */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
                <h2 className="mb-4 type-card-title font-semibold text-gray-800 dark:text-white/90">
                  About
                </h2>

                <div className="mb-1.5 flex items-baseline justify-between">
                  <Label className="mb-0">
                    Tell us more about your business
                  </Label>
                  <span
                    className={cn(
                      "font-mono type-caption font-semibold",
                      (s?.system_prompt || "").length >= 900
                        ? "text-gray-800 dark:text-white/90"
                        : "text-brand-500 dark:text-brand-400",
                    )}
                  >
                    {(s?.system_prompt || "").length}/1000 chars
                  </span>
                </div>

                <Textarea
                  ref={taRef}
                  value={s?.system_prompt || ""}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, 1000);

                    setS((p) => (p ? { ...p, system_prompt: value } : p));
                  }}
                  maxLength={1000}
                  rows={5}
                  placeholder="You are a helpful assistant for..."
                  className={cn(TEXTAREA_CLASS, "min-h-[120px] resize-none")}
                />

                <div className="mt-4 flex justify-end">
                  <Button onClick={saveAISettings} disabled={savingAI}>
                    {savingAI
                      ? "Saving..."
                      : savedAI
                        ? "Saved"
                        : "Save AI settings"}
                  </Button>
                </div>
              </div>

              {/* Test */}
              <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
                      Test Prompt
                    </h2>
                    <p className="mt-1 type-small leading-6 text-gray-500 dark:text-gray-400">
                      Fire a live message against the current system prompt
                    </p>
                  </div>

                  {testing && (
                    <div className="flex items-center gap-2 type-caption font-semibold text-brand-500 dark:text-brand-400">
                      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500 dark:border-brand-500/30 dark:border-t-brand-400" />
                      Thinking...
                    </div>
                  )}
                </div>

                <div className="mb-4 flex gap-2">
                  <Input
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && runTest()}
                    placeholder="Type a test message"
                    className={INPUT_CLASS}
                  />

                  <Button
                    onClick={runTest}
                    disabled={testing || !testMsg.trim()}
                  >
                    <PlayCircle size={16} />
                    Run
                  </Button>
                </div>

                {testMsg && (
                  <div className="mb-2 flex justify-end">
                    <div className="max-w-[65%] rounded-[10px] border border-gray-200 bg-gray-50 px-3.5 py-2 type-small text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
                      {testMsg}
                    </div>
                  </div>
                )}

                {testOut && (
                  <div>
                    <div className="mb-2 flex gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                        <Bot size={16} />
                      </div>

                      <div className="flex-1 whitespace-pre-wrap rounded-[10px] border border-gray-200 bg-white px-4 py-3 type-small leading-6 text-gray-700 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-200">
                        {testOut.answer || (
                          <span className="italic text-gray-400 dark:text-gray-600">
                            Empty response
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pl-[42px] type-caption text-gray-400 dark:text-gray-500">
                      <span>Latency: {testOut.latency_ms}ms</span>
                      <span>Model: {testOut.model}</span>
                      {testOut.provider && (
                        <span>Provider: {testOut.provider}</span>
                      )}
                      {testOut.faq_id && <span>FAQ #{testOut.faq_id}</span>}
                      {testOut.faq_score != null && (
                        <span>Score: {testOut.faq_score}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSection === "booking" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03] sm:p-6">
              <div className="mb-6">
                <Badge color="primary">Smart Booking</Badge>
                <h2 className="mt-3 text-title-sm font-bold text-gray-800 dark:text-white/90">
                  Smart Booking
                </h2>
                <p className="mt-2 max-w-xl type-small leading-6 text-gray-500 dark:text-gray-400">
                  Configure how your customers can book appointments or
                  reservations with you.
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <SettingsActionRow
                  icon={<Power size={28} />}
                  iconColorClass="bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                  title={`General (${
                    bookingSettings.booking_enabled ? "Enabled" : "Disabled"
                  })`}
                  description="Enable or disable Smart Booking, choose appointment vs. reservation, and configure basic booking preferences."
                  actionLabel="Configure"
                  actionColorClass="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/[0.08] dark:text-gray-300 dark:hover:bg-white/[0.14]"
                  onAction={() => openBookingModal()}
                >
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
                    {[
                      {
                        icon: <Clock3 size={16} />,
                        value: isAppointment
                          ? `${bookingSettings.booking_slot_duration_minutes || 45} min`
                          : `${bookingSettings.reservation_min_nights} night${
                              bookingSettings.reservation_min_nights === 1
                                ? ""
                                : "s"
                            }`,
                        label: isAppointment ? "Slot duration" : "Minimum stay",
                      },
                      {
                        icon: <TimerReset size={16} />,
                        value: isAppointment
                          ? `${bookingSettings.booking_buffer_minutes || 10} min`
                          : bookingSettings.reservation_max_nights === null
                            ? "No limit"
                            : `${bookingSettings.reservation_max_nights} night${
                                bookingSettings.reservation_max_nights === 1
                                  ? ""
                                  : "s"
                              }`,
                        label: isAppointment ? "Buffer time" : "Maximum stay",
                      },
                      {
                        icon: <Globe2 size={16} />,
                        value:
                          bookingSettings.booking_timezone || "Asia/Kolkata",
                        label: "Timezone",
                      },
                      {
                        icon: <CalendarDays size={16} />,
                        value: isAppointment
                          ? `${bookingSettings.booking_advance_days || 30} days`
                          : `${bookingSettings.reservation_available_ranges.length} range${
                              bookingSettings.reservation_available_ranges
                                .length === 1
                                ? ""
                                : "s"
                            }`,
                        label: isAppointment
                          ? "Booking window"
                          : "Available dates",
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="min-w-0 rounded-[10px] border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
                      >
                        <div className="mb-1.5 flex items-center gap-1.5 whitespace-nowrap type-caption font-medium text-gray-500 dark:text-gray-400">
                          {item.icon}
                          <span>{item.label}</span>
                        </div>
                        <div className="break-words type-small font-semibold text-gray-800 dark:text-white/90">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => openBookingModal(true)}
                      className="type-caption font-semibold text-brand-500 hover:underline dark:text-brand-400"
                    >
                      Change booking type (
                      {isAppointment ? "Appointment" : "Reservation"})
                    </button>
                  </div>
                </SettingsActionRow>

                {isAppointment && (
                  <SettingsActionRow
                    icon={<CalendarDays size={28} />}
                    iconColorClass="bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                    title="Availability (Weekly)"
                    description="Set your working days and available hours for appointments."
                    actionLabel="Configure"
                    actionColorClass="bg-brand-50 text-brand-500 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25"
                    onAction={openAvailabilityPanel}
                    onRowClick={openAvailabilityPanel}
                  >
                    <div className="mt-4 flex flex-wrap gap-2">
                      {availability.map((day, index) => (
                        <span
                          key={`${day.day_of_week}-${index}`}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-[10px] type-caption font-bold",
                            day.is_active
                              ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                              : "bg-gray-100 text-gray-400 dark:bg-white/[0.06] dark:text-gray-500",
                          )}
                        >
                          {DAYS[day.day_of_week][0]}
                        </span>
                      ))}
                    </div>
                  </SettingsActionRow>
                )}

                <SettingsActionRow
                  icon={<CalendarDays size={28} />}
                  iconColorClass="bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                  title={isAppointment ? "Appointments" : "Reservations"}
                  description="View and manage your upcoming, rescheduled and cancelled bookings."
                  actionLabel="View Bookings"
                  actionColorClass="bg-brand-50 text-brand-500 hover:bg-brand-100 dark:bg-brand-500/15 dark:hover:bg-brand-500/25"
                  onAction={() => router.push("/availability")}
                  onRowClick={() => router.push("/availability")}
                >
                  <div className="mt-4 grid grid-cols-1 gap-3 2xl:grid-cols-3">
                    {bookingStats.map((item) => (
                      <div
                        key={item.label}
                        className="min-w-0 rounded-[10px] border border-gray-200 bg-gray-50 px-3.5 py-3 dark:border-gray-800 dark:bg-white/[0.02]"
                      >
                        <div className="whitespace-nowrap type-caption font-medium text-gray-500 dark:text-gray-400">
                          {item.label}
                        </div>
                        <div className="mt-1 break-words type-small font-semibold text-gray-800 dark:text-white/90">
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </SettingsActionRow>

                <CustomerInfoCard
                  onOpen={() => setShowCustomerInfoModal(true)}
                />
              </div>
            </div>
          )}

          {activeSection === "billing" && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center type-small text-gray-400 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-500">
              Coming soon
            </div>
          )}
        </div>
      </div>

      {/* ── Booking settings modal (multi-step: type -> appointment/reservation) ── */}
      {showBookingModal && (
        <div
          onClick={closeBookingModal}
          className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-gray-900/70 p-3 backdrop-blur-sm sm:items-center sm:p-5"
        >
          <div
            ref={bookingDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Smart Booking settings"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-24px)] w-full max-w-[820px] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none dark:bg-gray-900 sm:p-8"
          >
            {bookingModalStep === "type" ? (
              <div>
                <Badge color="primary" startIcon={<CalendarDays size={14} />}>
                  Smart Booking
                </Badge>
                <h3 className="mt-3 type-h4 font-bold text-gray-800 dark:text-white/90 sm:type-h3">
                  General settings
                </h3>
                <p className="mt-2.5 type-small leading-relaxed text-gray-500 dark:text-gray-400">
                  Choose the booking type for your business.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {(
                    [
                      {
                        type: "appointment" as const,
                        title: "Appointment based",
                        description:
                          "Customers book a specific date and time slot.",
                        examples: "Services, consultations, classes, meetings",
                        Icon: Clock3,
                      },
                      {
                        type: "reservation" as const,
                        title: "Reservation / date based",
                        description:
                          "Customers book a stay across multiple days.",
                        examples: "Stays, rentals, accommodations",
                        Icon: CalendarDays,
                      },
                    ] as const
                  ).map(({ type, title, description, examples, Icon }) => {
                    const active = bookingDraft.booking_type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setBookingDraft((prev) => ({
                            ...prev,
                            booking_type: type,
                          }))
                        }
                        className={cn(
                          "rounded-xl border-2 p-5 text-left transition",
                          active
                            ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10"
                            : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/[0.03]",
                        )}
                      >
                        <Icon size={26} className="text-brand-500" />
                        <h4 className="mt-3 type-small font-bold text-gray-800 dark:text-white/90">
                          {title}
                        </h4>
                        <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
                          {description}
                        </p>
                        <p className="mt-2 type-caption text-gray-400 dark:text-gray-500">
                          {examples}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <label className="mt-5 flex items-center gap-3 type-small text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={bookingDraft.booking_enabled}
                    onChange={(e) =>
                      setBookingDraft((prev) => ({
                        ...prev,
                        booking_enabled: e.target.checked,
                      }))
                    }
                  />
                  Enable Smart Booking
                </label>

                <p className="mt-2 type-caption text-gray-400 dark:text-gray-500">
                  Changing the type does not convert existing bookings. Changes
                  are saved on the next screen.
                </p>

                <div className="mt-6 flex justify-end gap-3">
                  <Button variant="outline" onClick={closeBookingModal}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() =>
                      setBookingModalStep(bookingDraft.booking_type)
                    }
                  >
                    Continue →
                  </Button>
                </div>
              </div>
            ) : bookingModalStep === "reservation" ? (
              <ReservationBookingCard
                initialSettings={{
                  ...bookingDraft,
                  booking_type: "reservation",
                }}
                isDark={isDark}
                onClose={closeBookingModal}
                onBack={() => {
                  if (
                    reservationDirty &&
                    !window.confirm(
                      "Discard unsaved reservation edits and choose booking type?",
                    )
                  ) {
                    return;
                  }
                  setReservationDirty(false);
                  setBookingModalStep("type");
                }}
                onSaved={(saved) => {
                  setBookingSettings((prev) => ({ ...prev, ...saved }));
                  setBookingDraft((prev) => ({ ...prev, ...saved }));
                  setReservationDirty(false);
                  setShowBookingModal(false);
                }}
                onBusyChange={setReservationBusy}
                onDirtyChange={setReservationDirty}
              />
            ) : (
              <div>
                <button
                  type="button"
                  disabled={savingBookingSettings}
                  onClick={() => setBookingModalStep("type")}
                  className="mb-4 type-small font-semibold text-brand-500 hover:underline dark:text-brand-400"
                >
                  ← Booking type
                </button>

                {bookingError && (
                  <div className="mb-4 rounded-[10px] border border-error-200 bg-error-50 px-4 py-3 type-small text-error-600 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
                    {bookingError}
                  </div>
                )}

                <fieldset
                  disabled={savingBookingSettings}
                  className="min-w-0 border-0 p-0"
                >
                  <div className="mb-6 flex flex-wrap items-start justify-between gap-4 pr-10">
                    <div>
                      <Badge
                        color="primary"
                        startIcon={<CalendarDays size={14} />}
                      >
                        Smart Booking
                      </Badge>
                      <h3 className="mt-3 type-h4 font-bold text-gray-800 dark:text-white/90 sm:type-h3">
                        Appointment booking
                      </h3>
                      <p className="mt-2.5 max-w-lg type-small leading-relaxed text-gray-500 dark:text-gray-400">
                        Let customers book appointments directly from Instagram
                        DM and other connected channels. The AI checks your
                        availability, shows open slots, confirms with the
                        customer, and stores the booking.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setBookingDraft((prev) => ({
                          ...prev,
                          booking_enabled: !prev.booking_enabled,
                        }))
                      }
                      className={cn(
                        "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-[10px] px-4 type-small font-medium shadow-theme-xs transition",
                        bookingDraft.booking_enabled
                          ? "bg-brand-500 text-white hover:bg-brand-600"
                          : "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03]",
                      )}
                    >
                      <Power size={16} />
                      {bookingDraft.booking_enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        icon: <Clock3 size={18} />,
                        label: "Slot Duration",
                        value: `${bookingDraft.booking_slot_duration_minutes || 45} min`,
                      },
                      {
                        icon: <TimerReset size={18} />,
                        label: "Buffer Time",
                        value: `${bookingDraft.booking_buffer_minutes ?? 10} min`,
                      },
                      {
                        icon: <Globe2 size={18} />,
                        label: "Timezone",
                        value: bookingDraft.booking_timezone || "Asia/Kolkata",
                      },
                      {
                        icon: <CalendarDays size={18} />,
                        label: "Booking Window",
                        value: `${bookingDraft.booking_advance_days || 30} days`,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.03]"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                          {item.icon}
                        </div>
                        <div>
                          <div className="type-caption font-semibold text-gray-500 dark:text-gray-400">
                            {item.label}
                          </div>
                          <div className="mt-0.5 type-small font-bold text-gray-800 dark:text-white/90">
                            {item.value}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <Label>Slot duration</Label>
                      <select
                        value={bookingDraft.booking_slot_duration_minutes || 45}
                        onChange={(e) =>
                          setBookingDraft((prev) => ({
                            ...prev,
                            booking_slot_duration_minutes: Number(
                              e.target.value,
                            ),
                          }))
                        }
                        className={SELECT_CLASS}
                      >
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                        <option value={45}>45 minutes</option>
                        <option value={60}>60 minutes</option>
                      </select>
                    </div>

                    <div>
                      <Label>Buffer between slots</Label>
                      <select
                        value={bookingDraft.booking_buffer_minutes ?? 10}
                        onChange={(e) =>
                          setBookingDraft((prev) => ({
                            ...prev,
                            booking_buffer_minutes: Number(e.target.value),
                          }))
                        }
                        className={SELECT_CLASS}
                      >
                        <option value={0}>No buffer</option>
                        <option value={5}>5 minutes</option>
                        <option value={10}>10 minutes</option>
                        <option value={15}>15 minutes</option>
                        <option value={30}>30 minutes</option>
                      </select>
                    </div>

                    <div>
                      <Label>Timezone</Label>
                      <select
                        value={bookingDraft.booking_timezone || "Asia/Kolkata"}
                        onChange={(e) =>
                          setBookingDraft((prev) => ({
                            ...prev,
                            booking_timezone: e.target.value,
                          }))
                        }
                        className={SELECT_CLASS}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata</option>
                        <option value="Europe/London">Europe/London</option>
                        <option value="Asia/Dubai">Asia/Dubai</option>
                        <option value="Asia/Singapore">Asia/Singapore</option>
                        <option value="America/New_York">
                          America/New_York
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="mb-6">
                    <BookingWindowEditor
                      value={bookingDraft.booking_advance_days || 30}
                      onChange={(days) =>
                        setBookingDraft((prev) => ({
                          ...prev,
                          booking_advance_days: days,
                        }))
                      }
                    />
                  </div>

                  {/* ── Completion mode (ported from old dashboard) ── */}
                  <div className="mb-6">
                    <div className="mb-2.5 flex items-center gap-1.5 type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      <CircleCheckBig size={14} />
                      Completion handling
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(
                        [
                          {
                            mode: "manual" as const,
                            title: "Manual confirmation",
                            description:
                              "Admin marks finished appointments as completed or no-show.",
                          },
                          {
                            mode: "automatic" as const,
                            title: "Automatic completion",
                            description:
                              "Appointments appear completed after their scheduled end time.",
                          },
                        ] as const
                      ).map(({ mode, title, description }) => {
                        const active =
                          bookingDraft.booking_completion_mode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() =>
                              setBookingDraft((prev) => ({
                                ...prev,
                                booking_completion_mode: mode,
                              }))
                            }
                            className={cn(
                              "rounded-xl border p-4 text-left transition",
                              active
                                ? "border-brand-300 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10"
                                : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/[0.03]",
                            )}
                          >
                            <div className="type-small font-bold text-gray-800 dark:text-white/90">
                              {title}
                            </div>
                            <div className="mt-1 type-small text-gray-500 dark:text-gray-400">
                              {description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <p className="type-caption text-gray-500 dark:text-gray-400">
                      Booking works only when this toggle is enabled. Customers
                      stay inside their original chat.
                    </p>

                    <Button
                      onClick={saveBookingSettings}
                      disabled={savingBookingSettings}
                    >
                      {savingBookingSettings
                        ? "Saving..."
                        : "Save booking settings"}
                    </Button>
                  </div>
                </fieldset>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Availability weekly modal (appointment type only) */}
      {isAppointment && (
        <Modal
          isOpen={showAvailabilityPanel}
          onClose={() => setShowAvailabilityPanel(false)}
          className="m-4 max-w-[760px]"
        >
          <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl bg-white dark:bg-gray-900">
            <div className="border-b border-gray-100 px-6 py-5 pr-14 dark:border-gray-800">
              <Badge color="primary" startIcon={<CalendarDays size={13} />}>
                Availability
              </Badge>
              <h2 className="mt-3 type-h4 font-bold text-gray-800 dark:text-white/90">
                Weekly availability
              </h2>
              <p className="mt-1.5 type-small text-gray-500 dark:text-gray-400">
                Choose active days and working hours for customer appointments.
              </p>
            </div>

            <div className="custom-scrollbar flex flex-col gap-4 overflow-y-auto p-6">
              <BookingWindowEditor
                value={advanceDaysDraft}
                onChange={setAdvanceDaysDraft}
              />
              <BlockedDatesEditor
                value={blockedDates}
                onChange={setBlockedDates}
              />

              {availability.map((item) => (
                <div
                  key={item.day_of_week}
                  className={cn(
                    "grid grid-cols-1 items-center gap-3 rounded-xl border p-4 sm:grid-cols-[110px_70px_1fr]",
                    item.is_active
                      ? "border-brand-100 bg-gray-50 dark:border-brand-500/20 dark:bg-white/[0.03]"
                      : "border-gray-200 bg-white dark:border-gray-800 dark:bg-transparent",
                  )}
                >
                  <span
                    className={cn(
                      "type-small font-bold",
                      item.is_active
                        ? "text-gray-800 dark:text-white/90"
                        : "text-gray-400 dark:text-gray-600",
                    )}
                  >
                    {DAYS[item.day_of_week]}
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      updateAvailability(item.day_of_week, {
                        is_active: !item.is_active,
                      })
                    }
                    className={cn(
                      "h-[34px] rounded-full type-caption font-bold transition",
                      item.is_active
                        ? "bg-brand-500 text-white hover:bg-brand-600"
                        : "bg-gray-100 text-gray-500 dark:bg-white/[0.08] dark:text-gray-400",
                    )}
                  >
                    {item.is_active ? "ON" : "OFF"}
                  </button>

                  <div className="grid grid-cols-[1fr_24px_1fr] items-center gap-2">
                    <input
                      type="time"
                      value={item.start_time}
                      disabled={!item.is_active}
                      onChange={(e) =>
                        updateAvailability(item.day_of_week, {
                          start_time: e.target.value,
                        })
                      }
                      className={TIME_INPUT_CLASS}
                    />

                    <span className="text-center type-caption font-bold text-gray-300 dark:text-gray-600">
                      to
                    </span>

                    <input
                      type="time"
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
              <Button
                variant="outline"
                onClick={() => setShowAvailabilityPanel(false)}
              >
                Discard
              </Button>

              <Button onClick={saveAvailability} disabled={savingAvailability}>
                <Save size={14} />
                {savingAvailability ? "Saving..." : "Save availability"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {showCustomerInfoModal && (
        <CustomerInfoModal
          isDark={isDark}
          isMobile={isMobile}
          onClose={() => setShowCustomerInfoModal(false)}
          apiFetch={apiFetch}
        />
      )}
    </RequireAuth>
  );
}