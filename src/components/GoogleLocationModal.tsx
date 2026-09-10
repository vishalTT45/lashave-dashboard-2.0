'use client';

import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, MapPin, RefreshCw, Search, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export type GoogleLocation = {
  location_id: string;
  location_name: string | null;
  phone: string | null;
  website: string | null;
};

type LocationsResponse = {
  account_id: string;
  locations: GoogleLocation[];
};

type SelectResponse = {
  success: boolean;
  channel_id: number;
  account_id: string;
  location_id: string;
};

function shortId(id: string) {
  return id.replace(/^locations\//, '');
}

export default function GoogleLocationModal({
  channelId,
  currentLocationId,
  onClose,
  onSaved,
}: {
  channelId: number;
  isDark: boolean;
  currentLocationId?: string | null;
  onClose: () => void;
  onSaved: (location: GoogleLocation) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [accountId, setAccountId] = useState('');
  const [locations, setLocations] = useState<GoogleLocation[]>([]);
  const [selected, setSelected] = useState<string | null>(
    currentLocationId ?? null,
  );
  const [query, setQuery] = useState('');

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setErr('');

    try {
      const data = await apiFetch<LocationsResponse>(
        `/admin/channels/google/${channelId}/locations`,
        { auth: true },
      );

      setAccountId(data.account_id || '');
      setLocations(data.locations || []);

      if (!currentLocationId && data.locations?.length === 1) {
        setSelected(data.locations[0].location_id);
      }
    } catch (error: unknown) {
      setErr(
        error instanceof Error
          ? error.message
          : 'Could not load locations. Google may be rate limiting. Try again in a moment.',
      );
    } finally {
      setLoading(false);
    }
  }, [channelId, currentLocationId]);

  useEffect(() => {
    // Fetch on mount / dependency change — the correct place for a
    // loading/data flag on an async fetch, not a derive-state-from-render
    // antipattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchLocations();
  }, [fetchLocations]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return locations;

    return locations.filter((location) =>
      [
        location.location_name,
        location.phone,
        location.website,
        location.location_id,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [locations, query]);

  async function save() {
    if (!selected) return;

    setSaving(true);
    setErr('');

    try {
      await apiFetch<SelectResponse>(
        `/admin/channels/google/${channelId}/select-location?location_id=${encodeURIComponent(selected)}`,
        { method: 'POST', auth: true },
      );

      const location =
        locations.find((item) => item.location_id === selected) ??
        ({
          location_id: selected,
          location_name: null,
          phone: null,
          website: null,
        } as GoogleLocation);

      onSaved(location);
      onClose();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : 'Could not save the location. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen
      onClose={() => !saving && onClose()}
      className="m-4 max-w-170"
      showCloseButton={false}
    >
      <div className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-(--radius-panel) bg-white dark:bg-gray-900">
        <div className="flex items-start justify-between gap-5 border-b border-gray-100 px-6 py-5 pr-5 dark:border-gray-800">
          <div className="min-w-0">
            <Badge
              color="primary"
              startIcon={
                <Image
                  src="/brand-logo/google-map.png"
                  alt="Google Reviews"
                  width={14}
                  height={14}
                  className="h-3.5 w-3.5 object-contain"
                />
              }
            >
              Google Reviews
            </Badge>
            <h2 className="mt-3 type-h4 font-bold text-gray-800 dark:text-white/90">
              Select business location
            </h2>
            <p className="mt-1.5 max-w-xl type-small leading-6 text-gray-500 dark:text-gray-400">
              Lashvae reads and replies to reviews for the Google Business
              Profile location you choose.
            </p>
            {accountId && (
              <p className="mt-2 type-caption text-gray-400 dark:text-gray-500">
                Account: {shortId(accountId)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => !saving && onClose()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400 transition hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Close location selector"
          >
            <X size={18} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
          {!loading && locations.length > 5 && (
            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by name, phone or website"
                className="h-10 w-full rounded-(--radius-control) border border-gray-300 bg-white py-2 pl-11 pr-4 type-small text-gray-800 shadow-theme-xs outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-gray-500"
              />
            </div>
          )}

          {loading ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="h-18.5 animate-pulse rounded-xl bg-gray-100 dark:bg-white/6"
                />
              ))}
            </div>
          ) : err && locations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center dark:border-gray-800 dark:bg-white/2">
              <p className="mx-auto max-w-md type-small leading-6 text-gray-500 dark:text-gray-400">
                {err}
              </p>
              <Button className="mt-5" variant="outline" onClick={fetchLocations}>
                <RefreshCw size={15} />
                Try again
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center dark:border-gray-800 dark:bg-white/2">
              <p className="mx-auto max-w-md type-small leading-6 text-gray-500 dark:text-gray-400">
                {query
                  ? 'No location matches that filter.'
                  : 'This Google account has no business locations. Add one in Google Business Profile, then reopen this window.'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((location) => {
                const isSelected = selected === location.location_id;
                const isCurrent = currentLocationId === location.location_id;

                return (
                  <button
                    key={location.location_id}
                    type="button"
                    onClick={() => setSelected(location.location_id)}
                    className={cn(
                      'grid grid-cols-[40px_1fr_auto] items-center gap-3 rounded-xl border p-4 text-left transition',
                      isSelected
                        ? 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-500/10'
                        : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-white/3 dark:hover:bg-white/5',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-full border',
                        isSelected
                          ? 'border-brand-500 bg-brand-500 text-white'
                          : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-800 dark:bg-gray-900',
                      )}
                    >
                      {isSelected ? <CheckCircle2 size={18} /> : <MapPin size={18} />}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate type-small font-semibold text-gray-800 dark:text-white/90">
                        {location.location_name || 'Unnamed location'}
                      </span>
                      <span className="mt-1 block truncate type-caption text-gray-500 dark:text-gray-400">
                        {[location.phone, location.website]
                          .filter(Boolean)
                          .join(' | ') || shortId(location.location_id)}
                      </span>
                    </span>

                    {isCurrent && (
                      <Badge color="light" className="shrink-0">
                        Current
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {err && locations.length > 0 && (
            <div className="mt-4 rounded-xl border border-error-200 bg-error-50 px-4 py-3 type-small font-medium text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-500">
              {err}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-6 py-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
          <p className="type-caption text-gray-500 dark:text-gray-400">
            You can switch locations later from the channel row.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={!selected || saving || loading}>
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save location'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
