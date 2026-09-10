"use client";

import { DateFilter } from "@/components/date-filter";

import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import {
  getPageItems,
  TablePagination,
} from "@/components/ui/table-pagination";
import { useOutsideClick } from "@/hooks/useOutsideClick";
import { apiFetch } from "@/lib/api";
import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";
import type { ApexOptions } from "apexcharts";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Star,
  Wand2,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type Channel = {
  id: number;
  platform: string;
  platform_account_id: string;
  display_name?: string | null;
  account_name?: string | null;
  username?: string | null;
  is_active: boolean;
};

type GoogleReview = {
  id: number;
  google_review_id: string;
  reviewer_name?: string | null;
  rating?: string | null;
  comment?: string | null;
  status: string;
  reply_text?: string | null;
  ai_suggestion?: string | null;
  replied_at?: string | null;
  review_created_at?: string | null;
  is_critical?: boolean;
  critical_reasons?: string[];
};

type ReplyResponse = { success: boolean; review_id: string; reply: string };
type AiSuggestionResponse = {
  success: boolean;
  review_id: string;
  suggestion: string;
};
type AiPublishResponse = {
  success: boolean;
  review_id: string;
  reply: string;
  published: boolean;
  status: string;
};
type CriticalReviewsResponse = {
  critical_count: number;
  pending_count: number;
  needs_review_count: number;
  items: GoogleReview[];
};
type ClassifyPendingResponse = {
  processed: number;
  needs_review: number;
  failed: number;
  remaining: number;
};
type AutoReplyResponse = {
  replied: number;
  failed: number;
};

type FilterKey =
  | "needs_reply"
  | "replied"
  | "rating_only"
  | "low_rating"
  | "critical";

const RATING_VALUE: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

const RATING_LABEL: Record<number, string> = {
  1: "ONE",
  2: "TWO",
  3: "THREE",
  4: "FOUR",
  5: "FIVE",
};

const REVIEW_KEYWORDS = [
  {
    key: "refund",
    label: "Refund",
    terms: ["refund", "money back", "reimburse", "reimbursement"],
  },
  {
    key: "health",
    label: "Health",
    terms: ["health", "sick", "ill", "allergy", "hygiene", "unsafe"],
  },
  {
    key: "complaint",
    label: "Complaints",
    terms: ["complaint", "bad experience", "terrible", "worst", "unhappy"],
  },
  {
    key: "delivery",
    label: "Delivery",
    terms: ["delivery", "late", "delay", "shipping", "courier"],
  },
  {
    key: "quality",
    label: "Quality",
    terms: ["quality", "damaged", "broken", "defective", "expired"],
  },
  {
    key: "service",
    label: "Service",
    terms: ["service", "support", "staff", "response", "rude"],
  },
  {
    key: "price",
    label: "Price",
    terms: ["price", "pricing", "cost", "expensive", "overpriced"],
  },
] as const;

type KeywordKey = (typeof REVIEW_KEYWORDS)[number]["key"];

const REVIEW_STATUS_TABS: {
  key: FilterKey;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "needs_reply", label: "Needs reply", icon: <Send size={13} /> },
  { key: "replied", label: "Replied", icon: <Check size={13} /> },
  { key: "rating_only", label: "Rating only", icon: <Star size={13} /> },
  { key: "low_rating", label: "1-2 stars", icon: <AlertTriangle size={13} /> },
  { key: "critical", label: "Critical", icon: <Flag size={13} /> },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function getRating(review: GoogleReview) {
  return RATING_VALUE[review.rating?.toUpperCase() || ""] || 0;
}

function formatDate(value?: string | null) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

function initials(name?: string | null) {
  return (name || "Google User")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function reviewMatchesKeyword(
  review: GoogleReview,
  keyword: (typeof REVIEW_KEYWORDS)[number],
) {
  const searchable = [review.comment, review.reply_text, review.ai_suggestion]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return keyword.terms.some((term) => searchable.includes(term));
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3 ${className}`}
    >
      {children}
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  tone = "primary",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "primary" | "success" | "warning" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
      : tone === "warning"
        ? "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400"
        : tone === "error"
          ? "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500"
          : "bg-brand-50 text-brand-500 dark:bg-brand-500/12 dark:text-brand-400";

  return (
    <Card className="p-6 md:p-6">
      <span
        className={`inline-flex rounded-full px-3 py-1 type-caption font-medium ${toneClass}`}
      >
        {label}
      </span>
      <h3 className="mt-5 text-title-sm font-bold text-gray-800 dark:text-white/90">
        {value}
      </h3>
      <p className="mt-2 type-small text-gray-500 dark:text-gray-400">{sub}</p>
    </Card>
  );
}

function ChartHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h3 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
        {title}
      </h3>
      <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
        {subtitle}
      </p>
    </div>
  );
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={
            index < rating
              ? "text-brand-500"
              : "text-gray-300 dark:text-gray-700"
          }
          fill={index < rating ? "#465FFF" : "transparent"}
          size={14}
        />
      ))}
    </div>
  );
}

function RatingDistributionChart({
  distribution,
  isDark,
}: {
  distribution: Array<{ rating: number; count: number }>;
  isDark: boolean;
}) {
  const RATING_COLORS: Record<number, string> = {
    5: "#12B76A", // green — strongest
    4: "#6CE9A6", // less green
    3: "#FFE29A",
    2: "#F59E0B",
    1: "#F87171", // error-300
  };
  const colors = distribution.map(
    (item) => RATING_COLORS[item.rating] || "#465FFF",
  );

  const options: ApexOptions = {
    chart: {
      type: "donut",
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    colors,
    labels: distribution.map((item) => `${item.rating} star`),
    legend: { show: false },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    tooltip: { theme: isDark ? "dark" : "light" },
    plotOptions: { pie: { donut: { size: "72%" } } },
  };

  return (
    <Card className="p-6 sm:p-6">
      <ChartHeader
        title="Rating Distribution"
        subtitle="Star mix across the selected Google profile"
      />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-center">
        <ReactApexChart
          options={options}
          series={distribution.map((item) => item.count)}
          type="donut"
          height={220}
        />
        <div className="space-y-3">
          {distribution.map((item, index) => (
            <div key={item.rating}>
              <div className="mb-1 flex justify-between type-small">
                <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: colors[index] }}
                  />
                  {item.rating} star
                </span>
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {item.count}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(100, item.count * 12)}%`,
                    backgroundColor: colors[index],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
function KeywordSignalChart({
  keywordStats,
  isDark,
}: {
  keywordStats: Array<{ key: string; label: string; count: number }>;
  isDark: boolean;
}) {
  const KEYWORD_COLORS: Record<string, string> = {
    refund: "#D1E0FF",
    health: "#B2CCFF",
    complaint: "#FEDF89",
    delivery: "#FDB022",
    quality: "#FDA29B",
    service: "#A6F4C5",
    price: "#D9D6FE",
  };
  const colors = keywordStats.map(
    (item) => KEYWORD_COLORS[item.key] || "#B2CCFF",
  );

  const options: ApexOptions = {
    colors,
    chart: {
      type: "bar",
      toolbar: { show: false },
      fontFamily: "Outfit, sans-serif",
    },
    plotOptions: {
      bar: {
        borderRadius: 5,
        columnWidth: "42%",
        borderRadiusApplication: "end",
        distributed: true,
      },
    },
    legend: { show: false },
    dataLabels: { enabled: false },
    grid: {
      borderColor: isDark ? "#1D2939" : "#F2F4F7",
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
    xaxis: {
      categories: keywordStats.map((item) => item.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { colors: isDark ? "#98A2B3" : "#667085" } },
    },
    yaxis: {
      labels: { style: { colors: isDark ? "#98A2B3" : "#667085" } },
    },
    tooltip: { theme: isDark ? "dark" : "light" },
  };

  return (
    <Card className="p-6 sm:p-6">
      <ChartHeader
        title="Review Signals"
        subtitle="Recurring topics found in review text and replies"
      />
      {keywordStats.length > 0 ? (
        <ReactApexChart
          options={options}
          series={[
            { name: "Mentions", data: keywordStats.map((item) => item.count) },
          ]}
          type="bar"
          height={260}
        />
      ) : (
        <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed border-gray-200 type-small text-gray-500 dark:border-gray-800 dark:text-gray-400">
          No keyword signals detected
        </div>
      )}
    </Card>
  );
}
function ReviewRow({
  review,
  channelId,
  onRefresh,
  onMessage,
}: {
  review: GoogleReview;
  channelId: number;
  onRefresh: () => Promise<void>;
  onMessage: (message: string, kind: "success" | "error") => void;
}) {
  const rating = getRating(review);
  const replied = review.status === "replied";
  const lowRating = rating > 0 && rating <= 2;
  const needsManual = lowRating || review.is_critical === true;
  const [reply, setReply] = useState(review.ai_suggestion || "");
  const [publishing, setPublishing] = useState(false);
  const [aiProcessing, setAiProcessing] = useState(false);

  async function publishManualReply() {
    const clean = reply.trim();
    if (!clean) {
      onMessage("Write a reply before publishing.", "error");
      return;
    }

    setPublishing(true);
    try {
      await apiFetch<ReplyResponse>(
        `/admin/channels/google/${channelId}/reviews/${encodeURIComponent(review.google_review_id)}/reply`,
        { method: "POST", auth: true, body: { reply: clean } },
      );
      onMessage("Reply published to Google.", "success");
      await onRefresh();
    } catch (error: unknown) {
      onMessage(errorMessage(error, "Failed to publish reply."), "error");
    } finally {
      setPublishing(false);
    }
  }

  async function generateAiSuggestion() {
    setAiProcessing(true);
    try {
      const result = await apiFetch<AiSuggestionResponse>(
        `/admin/channels/google/review/${encodeURIComponent(review.google_review_id)}/ai-suggest`,
        { method: "POST", auth: true },
      );
      const suggestion = result.suggestion?.trim();
      if (!suggestion) throw new Error("AI returned an empty suggestion.");
      setReply(suggestion);
      onMessage("AI suggestion generated.", "success");
    } catch (error: unknown) {
      onMessage(
        errorMessage(error, "Failed to generate AI suggestion."),
        "error",
      );
    } finally {
      setAiProcessing(false);
    }
  }

  async function publishAiReply() {
    setAiProcessing(true);
    try {
      await apiFetch<AiPublishResponse>(
        `/admin/channels/google/review/${encodeURIComponent(review.google_review_id)}/ai-reply`,
        { method: "POST", auth: true },
      );
      onMessage("AI reply published to Google.", "success");
      await onRefresh();
    } catch (error: unknown) {
      onMessage(errorMessage(error, "Failed to publish AI reply."), "error");
    } finally {
      setAiProcessing(false);
    }
  }

  return (
    <>
      <tr className="align-top hover:bg-gray-50 dark:hover:bg-white/2">
        <td className="px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 type-small font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {initials(review.reviewer_name)}
            </div>
            <div className="min-w-0">
              <span className="group relative block max-w-full type-small font-medium text-gray-800 dark:text-white/90">
                <span className="block truncate">
                  {review.reviewer_name || "Google reviewer"}
                </span>
                <span className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden max-w-70 group-hover:block">
                  <span className="absolute -top-1 left-3 h-2 w-2 rotate-45 rounded-xs bg-gray-900" />
                  <span className="relative block rounded-(--radius-control) bg-gray-900 px-3 py-1.5 type-caption font-medium text-white shadow-lg">
                    {review.reviewer_name || "Google reviewer"}
                  </span>
                </span>
              </span>
              <div className="mt-1 flex items-center gap-2">
                <RatingStars rating={rating} />
                <span className="type-caption text-gray-500 dark:text-gray-400">
                  {formatDate(review.review_created_at)}
                </span>
              </div>
            </div>
          </div>
        </td>
        <td className="max-w-105 px-5 py-4">
          <p className="line-clamp-3 type-small text-gray-700 dark:text-gray-300">
            {review.comment ||
              `Rated ${rating || "unknown"} stars with no written review.`}
          </p>
          {review.critical_reasons && review.critical_reasons.length > 0 && (
            <p className="mt-2 type-caption text-gray-500 dark:text-gray-400">
              {review.critical_reasons.join(", ")}
            </p>
          )}
        </td>
        <td className="px-5 py-4">
          <span
            className={`inline-flex rounded-full px-3 py-1 type-caption font-medium ${
              replied
                ? "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500"
                : lowRating || review.is_critical
                  ? "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500"
                  : "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400"
            }`}
          >
            {replied
              ? "Replied"
              : lowRating || review.is_critical
                ? "Review needed"
                : "Needs reply"}
          </span>
        </td>
        <td className="px-5 py-4">
          {replied ? (
            <p className="max-w-80 type-small text-gray-500 dark:text-gray-400">
              {review.reply_text || "Reply published."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void generateAiSuggestion()}
                disabled={publishing || aiProcessing}
                className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) border border-gray-200 bg-white px-3 type-small font-medium text-gray-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {aiProcessing && needsManual ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Draft
              </button>
              <button
                type="button"
                onClick={() =>
                  void (needsManual ? publishManualReply() : publishAiReply())
                }
                disabled={
                  publishing || aiProcessing || (needsManual && !reply.trim())
                }
                className="inline-flex h-9 items-center gap-2 rounded-(--radius-control) bg-brand-500 px-3 type-small font-medium text-white disabled:opacity-50"
              >
                {publishing || (aiProcessing && !needsManual) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Publish
              </button>
            </div>
          )}
        </td>
      </tr>
      {!replied && needsManual && (
        <tr>
          <td
            colSpan={4}
            className="border-t border-gray-100 px-5 pb-5 dark:border-white/5 sm:px-6"
          >
            <textarea
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Write a reply or generate an AI draft"
              className="mt-2 min-h-24 w-full resize-y rounded-(--radius-control) border border-gray-200 bg-white px-3 py-2 type-small text-gray-700 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ReviewsInner() {
  const REVIEW_SYNC_INTERVAL_SECONDS =
    Number(process.env.NEXT_PUBLIC_REVIEW_SYNC_INTERVAL_SEC0NDS) || 60;

  const REVIEW_SYNC_INTERVAL_SEC = REVIEW_SYNC_INTERVAL_SECONDS * 1000;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const { isDark } = useTheme();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(
    null,
  );
  const [channelMenuOpen, setChannelMenuOpen] = useState(false);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{
    from: string;
    to: string;
  } | null>(null);
  const [datePreset, setDatePreset] = useState<number | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const dateFilterRef = useRef<HTMLDivElement>(null);
  useOutsideClick(dateFilterRef, () => setDateOpen(false), dateOpen);
  const channelMenuRef = useRef<HTMLDivElement>(null);
  const statusFilterRef = useRef<HTMLDivElement>(null);
  useOutsideClick(
    channelMenuRef,
    () => setChannelMenuOpen(false),
    channelMenuOpen,
  );
  useOutsideClick(
    statusFilterRef,
    () => setStatusFilterOpen(false),
    statusFilterOpen,
  );
  const [reviews, setReviews] = useState<GoogleReview[]>([]);
  const [criticalReviews, setCriticalReviews] = useState<GoogleReview[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [loadingCriticalReviews, setLoadingCriticalReviews] = useState(false);
  const [classifyingReviews, setClassifyingReviews] = useState(false);
  const [autoReplying, setAutoReplying] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("needs_reply");
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordKey | "all">(
    "all",
  );
  const [reviewsPage, setReviewsPage] = useState(1);
  const [search, setSearch] = useState("");
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [pendingCriticalCount, setPendingCriticalCount] = useState(0);
  const [needsHumanReviewCount, setNeedsHumanReviewCount] = useState(0);

  const showMessage = useCallback(
    (message: string, kind: "success" | "error") => {
      if (kind === "success") {
        setSuccess(message);
        setError("");
      } else {
        setError(message);
        setSuccess("");
      }
    },
    [],
  );

  const loadChannels = useCallback(async () => {
    setLoadingChannels(true);
    try {
      const result = await apiFetch<{ items: Channel[] }>("/admin/channels", {
        auth: true,
      });
      const googleChannels = (result.items || []).filter(
        (channel) =>
          channel.platform?.toLowerCase().trim() === "google" &&
          channel.is_active,
      );
      setChannels(googleChannels);
      setSelectedChannelId((current) =>
        current && googleChannels.some((channel) => channel.id === current)
          ? current
          : googleChannels[0]?.id || null,
      );
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load Google channels."));
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  const loadReviews = useCallback(async () => {
    if (!selectedChannelId) {
      setReviews([]);
      return;
    }

    setLoadingReviews(true);

    try {
      const data = await apiFetch<GoogleReview[]>(
        `/admin/channels/google/${selectedChannelId}/reviews`,
        { auth: true },
      );
      showMessage("Reviews auto pooled.", "success");

      setReviews(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load reviews."));
    } finally {
      setLoadingReviews(false);
    }
  }, [selectedChannelId]);

  const syncReviews = useCallback(async () => {
    if (!selectedChannelId) return;

    setLoadingReviews(true);

    try {
      await apiFetch(
        `/admin/channels/google/${selectedChannelId}/reviews/sync`,
        {
          method: "POST",
          auth: true,
        },
      );

      await loadReviews();

      showMessage("Reviews synced.", "success");
    } catch (err) {
      showMessage(errorMessage(err, "Failed to sync reviews."), "error");
    } finally {
      setLoadingReviews(false);
    }
  }, [loadReviews, selectedChannelId, showMessage]);

  const startAutoPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      void loadReviews();
    }, REVIEW_SYNC_INTERVAL_SEC);
  }, [loadReviews]);

  useEffect(() => {
    if (!selectedChannelId) return;

    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReviews();

    startAutoPolling();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [selectedChannelId, loadReviews, startAutoPolling]);

  // const startAutoSyncTimer = useCallback(() => {
  //   if (intervalRef.current) {
  //     clearInterval(intervalRef.current);
  //   }

  //   intervalRef.current = setInterval(() => {
  //     setSuccess("");
  //     void syncReviews(true); // Auto Sync
  //   }, REVIEW_SYNC_INTERVAL_SEC);
  // }, [syncReviews]);

  const loadCriticalReviews = useCallback(async () => {
    if (!selectedChannelId) {
      setCriticalReviews([]);
      setPendingCriticalCount(0);
      setNeedsHumanReviewCount(0);
      return;
    }
    setLoadingCriticalReviews(true);
    try {
      const data = await apiFetch<CriticalReviewsResponse>(
        `/admin/channels/google/reviews/critical?channel_id=${selectedChannelId}&limit=100&offset=0`,
        { auth: true },
      );
      setCriticalReviews(Array.isArray(data.items) ? data.items : []);
      setPendingCriticalCount(data.pending_count || 0);
      setNeedsHumanReviewCount(data.needs_review_count || 0);
    } catch (err: unknown) {
      setError(errorMessage(err, "Failed to load critical reviews."));
    } finally {
      setLoadingCriticalReviews(false);
    }
  }, [selectedChannelId]);

  const classifyPendingCriticalReviews = useCallback(async () => {
    if (!selectedChannelId) return;
    setClassifyingReviews(true);
    try {
      let remaining = 1;
      let processed = 0;
      let failed = 0;
      let needsReview = 0;
      while (remaining > 0) {
        const result = await apiFetch<ClassifyPendingResponse>(
          `/admin/channels/google/reviews/classify-pending?channel_id=${selectedChannelId}&batch_size=20`,
          { method: "POST", auth: true },
        );
        processed += result.processed || 0;
        failed += result.failed || 0;
        needsReview += result.needs_review || 0;
        remaining = result.remaining || 0;
        if (result.processed === 0 && remaining > 0) {
          throw new Error(
            `${remaining} reviews remain pending, but no reviews were processed.`,
          );
        }
      }
      await loadCriticalReviews();
      showMessage(
        failed > 0
          ? `${processed} reviews processed. ${failed} failed classification.`
          : `${processed} reviews classified. ${needsReview} need human review.`,
        failed > 0 ? "error" : "success",
      );
    } catch (err: unknown) {
      showMessage(
        errorMessage(err, "Failed to classify pending reviews."),
        "error",
      );
    } finally {
      setClassifyingReviews(false);
    }
  }, [loadCriticalReviews, selectedChannelId, showMessage]);

  async function autoReplyAll() {
    if (!selectedChannelId) return;
    setAutoReplying(true);
    try {
      const result = await apiFetch<AutoReplyResponse>(
        `/admin/channels/google/${selectedChannelId}/reviews/auto-reply-all`,
        { method: "POST", auth: true },
      );
      await loadReviews();
      showMessage(
        result.failed > 0
          ? `${result.replied} replies published. ${result.failed} failed.`
          : `${result.replied} AI replies published.`,
        result.failed > 0 ? "error" : "success",
      );
    } catch (err: unknown) {
      showMessage(errorMessage(err, "Failed to publish AI replies."), "error");
    } finally {
      setAutoReplying(false);
    }
  }

  // useEffect(() => {
  //   if (!selectedChannelId) return;

  //   void syncReviews(true);

  //   startAutoSyncTimer();

  //   return () => {
  //     if (intervalRef.current) {
  //       clearInterval(intervalRef.current);
  //     }
  //   };
  // }, [selectedChannelId, syncReviews, startAutoSyncTimer]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadChannels();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadChannels]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReviews();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadReviews]);

  useEffect(() => {
    if (filter !== "critical") return;
    const timer = window.setTimeout(() => {
      void loadCriticalReviews();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [filter, loadCriticalReviews]);

  const dateScopedReviews = useMemo(() => {
    if (!dateRange) return reviews;
    return reviews.filter((review) => {
      const raw = review.review_created_at;
      if (!raw) return false;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return false;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return key >= dateRange.from && key <= dateRange.to;
    });
  }, [reviews, dateRange]);

  const stats = useMemo(() => {
    const total = dateScopedReviews.length;
    const replied = dateScopedReviews.filter(
      (review) => review.status === "replied",
    ).length;
    const needsReply = total - replied;
    const ratingOnly = dateScopedReviews.filter(
      (review) => !review.comment?.trim(),
    ).length;
    const lowRating = dateScopedReviews.filter((review) => {
      const rating = getRating(review);
      return rating === 1 || rating === 2;
    }).length;
    const ratingTotal = dateScopedReviews.reduce(
      (sum, review) => sum + getRating(review),
      0,
    );
    const average = total > 0 ? ratingTotal / total : 0;
    const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;
    const distribution = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: dateScopedReviews.filter(
        (review) => review.rating === RATING_LABEL[rating],
      ).length,
    }));
    return {
      total,
      replied,
      needsReply,
      ratingOnly,
      lowRating,
      average,
      replyRate,
      distribution,
    };
  }, [dateScopedReviews]);

  const keywordStats = useMemo(
    () =>
      REVIEW_KEYWORDS.map((keyword) => ({
        key: keyword.key,
        label: keyword.label,
        count: dateScopedReviews.filter((review) =>
          reviewMatchesKeyword(review, keyword),
        ).length,
      })).filter((keyword) => keyword.count > 0),
    [dateScopedReviews],
  );

  const filteredReviews = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    // When a keyword signal or date range is active, search across ALL reviews
    // (ignore the status tab) so results aren't narrowed to the current subset.
    const keywordActive = selectedKeyword !== "all";
    const dateActive = dateRange !== null;
    const source =
      filter === "critical" && !keywordActive && !dateActive
        ? criticalReviews
        : reviews;

    return source.filter((review) => {
      const rating = getRating(review);
      const replied = review.status === "replied";

      // Client-side date filter on the review's creation date.
      if (dateRange) {
        const raw = review.review_created_at;
        if (!raw) return false;
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) return false;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (key < dateRange.from || key > dateRange.to) return false;
      }

      const matchesFilter =
        keywordActive || dateActive
          ? true
          : filter === "critical"
            ? true
            : filter === "needs_reply"
              ? !replied
              : filter === "replied"
                ? replied
                : filter === "rating_only"
                  ? !review.comment?.trim()
                  : rating === 1 || rating === 2;

      if (!matchesFilter) return false;

      const matchesKeyword =
        selectedKeyword === "all"
          ? true
          : REVIEW_KEYWORDS.some(
              (keyword) =>
                keyword.key === selectedKeyword &&
                reviewMatchesKeyword(review, keyword),
            );
      if (!matchesKeyword) return false;
      if (!normalizedSearch) return true;

      return (
        review.reviewer_name?.toLowerCase().includes(normalizedSearch) ||
        review.comment?.toLowerCase().includes(normalizedSearch) ||
        review.reply_text?.toLowerCase().includes(normalizedSearch) ||
        review.ai_suggestion?.toLowerCase().includes(normalizedSearch) ||
        review.critical_reasons?.some((reason) =>
          reason.toLowerCase().includes(normalizedSearch),
        )
      );
    });
  }, [criticalReviews, filter, reviews, search, selectedKeyword, dateRange]);
  const pagedReviews = getPageItems(filteredReviews, reviewsPage);

  useEffect(() => {
    const timer = window.setTimeout(() => setReviewsPage(1), 0);
    return () => window.clearTimeout(timer);
  }, [filter, filteredReviews.length, search, selectedKeyword, dateRange]);

  const filterCounts: Record<FilterKey, number> = {
    needs_reply: stats.needsReply,
    replied: stats.replied,
    rating_only: stats.ratingOnly,
    low_rating: stats.lowRating,
    critical: criticalReviews.length,
  };

  const activeStatusTab =
    REVIEW_STATUS_TABS.find((tab) => tab.key === filter) ??
    REVIEW_STATUS_TABS[0];

  const handleSeeAllReviews = () => {
    setFilter("needs_reply");
    setSelectedKeyword("all");
    setSearch("");
    setDateRange(null);
    setDatePreset(null);
    setStatusFilterOpen(false);
  };

  return (
    <div className="py-6">
      <div className="mb-6  flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="type-small font-medium text-brand-500 dark:text-brand-400">
            Google Reviews
          </p>
          <h1 className="mt-1 text-title-sm font-bold text-gray-800 dark:text-white/90">
            Google Review response workspace
          </h1>
          <p className="mt-2 max-w-2xl type-small text-gray-500 dark:text-gray-400">
            Track rating quality, urgent review signals, and reply coverage for
            connected Google profiles.
          </p>
        </div>

        <div className="flex  flex-col gap-3 sm:flex-row sm:items-center">
          <div ref={channelMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setChannelMenuOpen((value) => !value)}
              disabled={loadingChannels || channels.length === 0}
              className="inline-flex h-10 min-w-60 items-center justify-between rounded-(--radius-control) border border-gray-200 bg-white px-4 text-left type-small font-medium text-gray-700 disabled:opacity-60 dark:border-gray-800 dark:bg-white/3 dark:text-gray-300"
            >
              {loadingChannels ? (
                <span>Loading profile</span>
              ) : channels.length === 0 ? (
                <span>No Google profile</span>
              ) : (
                <span className="inline-flex min-w-0 items-center gap-2">
                  <img
                    src="/brand-logo/google-map.png"
                    alt="Google Reviews"
                    className="h-4 w-4 shrink-0 object-contain"
                  />

                  <span className="truncate">{"Google Reviews"}</span>

                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 type-caption font-medium text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                    Google Reviews
                  </span>
                </span>
              )}

              {channels.length > 1 && (
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-gray-400" />
              )}
            </button>

            {channelMenuOpen && channels.length > 1 && (
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-75 rounded-xl border border-gray-200 bg-white p-2 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
                {channels.map((channel) => {
                  const active = channel.id === selectedChannelId;

                  const profileName =
                    channel.account_name?.trim() ||
                    channel.display_name?.trim() ||
                    "Google Reviews";

                  return (
                    <button
                      key={channel.id}
                      type="button"
                      onClick={() => {
                        setSelectedChannelId(channel.id);
                        setChannelMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-(--radius-control) px-3 py-2 text-left type-small font-medium ${
                        active
                          ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                          : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5"
                      }`}
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <img
                          src="/brand-logo/google-map.png"
                          alt=""
                          className="h-4 w-4 shrink-0 object-contain"
                        />

                        <span className="truncate">{profileName}</span>
                      </span>

                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 type-caption text-gray-500 dark:bg-white/6 dark:text-gray-400">
                        Reviews
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div ref={dateFilterRef} className="relative">
            <DateFilter
              dateRange={dateRange}
              activePreset={datePreset}
              setDateRange={setDateRange}
              setActivePreset={setDatePreset}
              open={dateOpen}
              onToggle={() => setDateOpen((v) => !v)}
              onClose={() => setDateOpen(false)}
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setSuccess("");
              void syncReviews();
            }}
            disabled={!selectedChannelId || loadingReviews}
            className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-(--radius-control) border border-gray-200 bg-white px-4 type-small font-medium text-gray-700 disabled:opacity-60"
          >
            <RefreshCw
              className={`h-4 w-4 shrink-0 ${
                loadingReviews ? "animate-spin" : ""
              }`}
            />

            {loadingReviews ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-success-200 bg-success-50 px-4 py-3 type-small font-medium text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-500">
          <Check className="h-4 w-4" />
          <span className="flex-1">{success}</span>
          <button type="button" onClick={() => setSuccess("")}>
            Close
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 type-small font-medium text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => setError("")}>
            Close
          </button>
        </div>
      )}

      {channels.length === 0 && !loadingChannels ? (
        <Card className="p-12 text-center">
          <h2 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
            Google Reviews is not connected
          </h2>
          <p className="mt-2 type-small text-gray-500 dark:text-gray-400">
            Connect a Google Business profile from the Channels page first.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
            <MetricCard
              label="Average rating"
              value={stats.total ? stats.average.toFixed(1) : "0.0"}
              sub={`Across ${stats.total} reviews`}
            />
            <MetricCard
              label="Reply rate"
              value={`${stats.replyRate}%`}
              sub={`${stats.replied} answered, ${stats.needsReply} open`}
              tone="success"
            />
            <MetricCard
              label="Low rating"
              value={String(stats.lowRating)}
              sub="One and two star reviews"
              tone="error"
            />
            <MetricCard
              label="Needs action"
              value={String(stats.needsReply)}
              sub={`${stats.ratingOnly} rating-only reviews`}
              tone="warning"
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <RatingDistributionChart
              distribution={stats.distribution}
              isDark={isDark}
            />
            <KeywordSignalChart keywordStats={keywordStats} isDark={isDark} />
          </div>

          <div className="mt-6 min-w-0 max-w-full overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
            <div className="flex flex-col gap-2 border-b border-gray-100 px-5 py-5 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <h3 className="type-body font-semibold text-gray-800 dark:text-white/90">
                Reviews
              </h3>
              <div className="type-small font-medium text-gray-500 dark:text-gray-400">
                {filteredReviews.length} reviews
              </div>
            </div>

            <div className="min-w-0 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 rounded-t-xl border border-b-0 border-gray-200 bg-white px-5 py-4 dark:border-white/5 dark:bg-white/1 lg:flex-row lg:items-center lg:justify-between">
                <h4 className="type-card-title font-semibold text-gray-800 dark:text-white/90">
                  {activeStatusTab.label} reviews
                </h4>
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  <div className="relative w-full sm:w-(--control-width-search-sm)">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search reviewer or text"
                      className="h-10 w-full rounded-(--radius-control) border border-gray-300 bg-white py-2 pl-11 pr-4 type-small text-gray-800 shadow-theme-xs outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500"
                    />
                  </div>

                  <div ref={statusFilterRef} className="relative">
                    <Button
                      variant="outline"
                      onClick={() => setStatusFilterOpen((value) => !value)}
                    >
                      <SlidersHorizontal size={14} />
                      {filter === "needs_reply"
                        ? "Status"
                        : activeStatusTab.label}
                    </Button>
                    {statusFilterOpen && (
                      <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-800 dark:bg-gray-900">
                        {REVIEW_STATUS_TABS.map((tab) => {
                          const isActive = filter === tab.key;
                          const count = filterCounts[tab.key];
                          return (
                            <button
                              key={tab.key}
                              type="button"
                              onClick={() => {
                                setFilter(tab.key);
                                setStatusFilterOpen(false);
                              }}
                              className={cn(
                                "flex w-full items-center justify-between rounded-(--radius-control) px-3 py-2 text-left type-small font-medium transition",
                                isActive
                                  ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/4",
                              )}
                            >
                              <span className="inline-flex items-center gap-2">
                                {tab.icon}
                                {tab.label}
                              </span>
                              <span className="type-caption text-gray-400 dark:text-gray-500">
                                {count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedKeyword("all")}
                    className={`h-10 shrink-0 rounded-(--radius-control) px-4 type-small font-medium transition ${
                      selectedKeyword === "all"
                        ? "bg-brand-500 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5"
                    }`}
                  >
                    All signals
                  </button>
                  {keywordStats.map((keyword) => (
                    <button
                      key={keyword.key}
                      type="button"
                      onClick={() =>
                        setSelectedKeyword(
                          selectedKeyword === keyword.key ? "all" : keyword.key,
                        )
                      }
                      className={`h-10 shrink-0 rounded-(--radius-control) px-4 type-small font-medium transition ${
                        selectedKeyword === keyword.key
                          ? "bg-brand-500 text-white"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/5"
                      }`}
                    >
                      {keyword.label} {keyword.count}
                    </button>
                  ))}

                  <Button variant="outline" onClick={handleSeeAllReviews}>
                    See all
                  </Button>

                  <Button
                    onClick={() => void autoReplyAll()}
                    disabled={
                      autoReplying ||
                      stats.needsReply === 0 ||
                      !selectedChannelId
                    }
                  >
                    {autoReplying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4" />
                    )}
                    AI reply to all {stats.needsReply || ""}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-x border-gray-200 bg-white px-5 py-4 empty:hidden dark:border-white/5 dark:bg-white/1">
                {filter === "critical" && pendingCriticalCount > 0 && (
                  <div className="flex flex-col gap-3 rounded-xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-500/20 dark:bg-warning-500/10 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="type-small font-semibold text-gray-800 dark:text-white/90">
                        {pendingCriticalCount} reviews waiting for
                        classification
                      </p>
                      <p className="mt-1 type-caption text-gray-500 dark:text-gray-400">
                        {needsHumanReviewCount} currently need human review.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={classifyingReviews}
                      onClick={() => void classifyPendingCriticalReviews()}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-(--radius-control) bg-brand-500 px-4 type-small font-medium text-white disabled:opacity-60"
                    >
                      {classifyingReviews && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Classify pending
                    </button>
                  </div>
                )}
              </div>

              <div className="min-w-0 max-w-full overflow-hidden rounded-b-xl border border-gray-200 dark:border-white/5">
                <div className="w-full overflow-x-auto">
                  <table className="lashvae-column-dividers min-w-290 table-fixed">
                    <colgroup>
                      <col className="w-60" />
                      <col className="w-110" />
                      <col className="w-37.5" />
                      <col className="w-82.5" />
                    </colgroup>
                    <thead className="border-b border-gray-100 dark:border-white/5">
                      <tr>
                        {["Reviewer", "Review", "Status", "Action"].map(
                          (header) => (
                            <th
                              key={header}
                              className="px-5 py-3 text-left type-body font-medium text-gray-500 dark:text-gray-400"
                            >
                              {header}
                            </th>
                          ),
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {loadingReviews || loadingCriticalReviews ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-5 py-14 text-center type-small text-gray-500 dark:text-gray-400"
                          >
                            Loading reviews
                          </td>
                        </tr>
                      ) : filteredReviews.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="px-5 py-14 text-center type-small text-gray-500 dark:text-gray-400"
                          >
                            No reviews match this filter
                          </td>
                        </tr>
                      ) : (
                        pagedReviews.map((review) => (
                          <ReviewRow
                            key={review.google_review_id}
                            review={review}
                            channelId={selectedChannelId as number}
                            onRefresh={loadReviews}
                            onMessage={showMessage}
                          />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <TablePagination
                page={reviewsPage}
                totalItems={filteredReviews.length}
                onPageChange={setReviewsPage}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function ReviewsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <ReviewsInner />
      </Suspense>
    </RequireAuth>
  );
}