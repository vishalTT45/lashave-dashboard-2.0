"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Search, X } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { AvatarText } from "@/components/ui/avatar";
import { getPageItems, getTotalPages, TablePagination } from "@/components/ui/table-pagination";

type Tenant = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

type TenantDetail = Tenant & {
  system_prompt: string;
  opening_message: string;
  temperature: number;
  max_tokens: number;
  ai_enabled: boolean;
  users: { id: number; email: string; role: string; is_active: boolean }[];
};

// Matches the edit form's fields exactly — temperature/max_tokens are
// kept as strings here since they're bound to text inputs (parsed back
// to numbers on save).
type TenantFormState = {
  name: string;
  is_active: boolean;
  ai_enabled: boolean;
  system_prompt: string;
  opening_message: string;
  temperature: string;
  max_tokens: string;
};

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function DeleteModal({
  tenant,
  onConfirm,
  onCancel,
  loading,
}: {
  tenant: Tenant;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <Modal isOpen onClose={onCancel} className="max-w-100 p-6">
      <AvatarText name={tenant.name} className="mx-auto mb-4 h-12 w-12 type-card-title" />
      <h3 className="mb-2 text-center type-small font-bold text-gray-900 dark:text-white/90">
        Delete &quot;{tenant.name}&quot;?
      </h3>
      <p className="mb-1 text-center type-caption text-error-500">
        This will permanently delete the tenant and <strong>all associated data</strong>:
      </p>
      <p className="mb-6 text-center type-caption leading-relaxed text-gray-400">
        conversations · messages · leads · channels · FAQs · admin users
      </p>
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel} disabled={loading}>
          Cancel
        </Button>
        <Button variant="destructive" className="flex-1" onClick={onConfirm} disabled={loading}>
          {loading ? "Deleting…" : "Delete Tenant"}
        </Button>
      </div>
    </Modal>
  );
}

function EditModal({
  tenant,
  onSave,
  onClose,
}: {
  tenant: TenantDetail;
  onSave: (updated: Partial<TenantDetail>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<TenantFormState>({
    name: tenant.name,
    is_active: tenant.is_active,
    ai_enabled: tenant.ai_enabled,
    system_prompt: tenant.system_prompt || "",
    opening_message: tenant.opening_message || "",
    temperature: String(tenant.temperature ?? 0.2),
    max_tokens: String(tenant.max_tokens ?? 200),
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof TenantFormState,>(k: K, v: TenantFormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setErr("");
    setLoading(true);
    try {
      await onSave({
        name: form.name,
        is_active: form.is_active,
        ai_enabled: form.ai_enabled,
        system_prompt: form.system_prompt,
        opening_message: form.opening_message,
        temperature: parseFloat(form.temperature),
        max_tokens: parseInt(form.max_tokens),
      });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} className="max-w-130" showCloseButton={false}>
      <div className="flex items-center justify-between border-b border-gray-200 p-6 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <AvatarText name={tenant.name} className="h-9 w-9" />
          <div>
            <div className="type-small font-bold text-gray-900 dark:text-white/90">Edit Tenant</div>
            <div className="font-mono type-caption text-gray-400">{tenant.id}</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-(--radius-control) bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-400"
        >
          <X className="icon-small" />
        </button>
      </div>

      <div className="max-h-[70vh] space-y-4 overflow-y-auto p-6">
        <div>
          <label className="mb-1.5 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Tenant Name
          </label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>

        <div className="flex gap-3">
          {(
            [
              { key: "is_active", label: "Active", color: "success" },
              { key: "ai_enabled", label: "AI Enabled", color: "primary" },
            ] as const
          ).map(({ key, label, color }) => (
            <button
              key={key}
              onClick={() => set(key, !form[key])}
              className={
                "flex flex-1 items-center justify-center gap-2 rounded-(--radius-control) border py-2 type-caption font-semibold transition-colors " +
                (form[key]
                  ? color === "success"
                    ? "border-success-300 bg-success-50 text-success-600 dark:border-success-500/30 dark:bg-success-500/10"
                    : "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/10"
                  : "border-gray-200 bg-transparent text-gray-400 dark:border-gray-700")
              }
            >
              <span
                className={
                  "size-2 rounded-full " +
                  (form[key] ? (color === "success" ? "bg-success-500" : "bg-brand-500") : "bg-gray-300 dark:bg-gray-600")
                }
              />
              {label}: {form[key] ? "On" : "Off"}
            </button>
          ))}
        </div>

        <div>
          <label className="mb-1.5 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            System Prompt
          </label>
          <Textarea
            className="min-h-20"
            value={form.system_prompt}
            onChange={(e) => set("system_prompt", e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1.5 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Opening Message
          </label>
          <Input value={form.opening_message} onChange={(e) => set("opening_message", e.target.value)} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Temperature
            </label>
            <Input
              type="number"
              min="0"
              max="2"
              step="0.1"
              value={form.temperature}
              onChange={(e) => set("temperature", e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Max Tokens
            </label>
            <Input
              type="number"
              min="50"
              max="4000"
              value={form.max_tokens}
              onChange={(e) => set("max_tokens", e.target.value)}
            />
          </div>
        </div>

        {tenant.users.length > 0 && (
          <div>
            <label className="mb-2 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Admin Users
            </label>
            <div className="space-y-1.5">
              {tenant.users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-(--radius-control) border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/3"
                >
                  <span className="font-mono type-caption text-gray-600 dark:text-gray-400">{u.email}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="light" color="light">
                      {u.role}
                    </Badge>
                    <span className={`size-1.5 rounded-full ${u.is_active ? "bg-success-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {err && <Alert variant="error" title="Error" message={err} />}

        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-2" onClick={save} disabled={loading}>
            {loading ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function TenantsList() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [delTarget, setDelTarget] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editTarget, setEditTarget] = useState<TenantDetail | null>(null);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const showToast = (type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3000);
  };

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ items: Tenant[] }>("/admin/tenants", { auth: true });
      setTenants(d.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // Resets local UI-only state (a flag, warning, or preview value)
    // when the relevant prop/dependency changes — not deriving render
    // output from state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1);
  }, [search]);

  async function openEdit(tenant: Tenant) {
    setLoadingEdit(true);
    try {
      const d = await apiFetch<TenantDetail>(`/admin/tenants/${tenant.id}`, { auth: true });
      setEditTarget(d);
    } catch (e: unknown) {
      showToast("err", e instanceof Error ? e.message : "Failed to load tenant");
    } finally {
      setLoadingEdit(false);
    }
  }

  async function handleSave(id: string, updates: Partial<TenantDetail>) {
    await apiFetch(`/admin/tenants/${id}`, { method: "PUT", auth: true, body: updates });
    await load();
    showToast("ok", "Tenant updated successfully");
  }

  async function handleDelete(tenant: Tenant) {
    setDeleting(true);
    try {
      await apiFetch(`/admin/tenants/${tenant.id}`, { method: "DELETE", auth: true });
      setDelTarget(null);
      await load();
      showToast("ok", `"${tenant.name}" deleted`);
    } catch (e: unknown) {
      showToast("err", e instanceof Error ? e.message : "Failed to delete");
      setDelTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  const filtered = tenants.filter(
    (t) => t.id.toLowerCase().includes(search.toLowerCase()) || t.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = getTotalPages(filtered.length, 8);
  const currentPage = Math.min(page, totalPages);
  const pageItems = getPageItems(filtered, currentPage, 8);
  const activeCount = tenants.filter((t) => t.is_active).length;

  return (
    <div className="mx-auto max-w-4xl">
      {toast && (
        <div
          className={
            "fixed bottom-6 left-1/2 z-200 -translate-x-1/2 whitespace-nowrap rounded-xl border px-5 py-3 type-small font-medium shadow-theme-lg " +
            (toast.type === "ok"
              ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400"
              : "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400")
          }
        >
          {toast.text}
        </div>
      )}

      {delTarget && (
        <DeleteModal
          tenant={delTarget}
          loading={deleting}
          onConfirm={() => handleDelete(delTarget)}
          onCancel={() => setDelTarget(null)}
        />
      )}
      {editTarget && (
        <EditModal tenant={editTarget} onSave={(updates) => handleSave(editTarget.id, updates)} onClose={() => setEditTarget(null)} />
      )}

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge variant="light" color="primary" className="mb-2">
            Super Admin
          </Badge>
          <h1 className="text-title-sm font-bold text-gray-900 dark:text-white/90">Tenants</h1>
          <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
            {tenants.length} total · {activeCount} active
          </p>
        </div>
        <Button asChild>
          <Link href="/super-admin/create-tenant">
            <Plus className="icon-small" /> New Tenant
          </Link>
        </Button>
      </div>

      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-1/2 icon-small -translate-y-1/2 text-gray-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or ID…" className="pl-10" />
      </div>

      {!loading && tenants.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: tenants.length },
            { label: "Active", value: activeCount },
            { label: "Inactive", value: tenants.length - activeCount },
          ].map(({ label, value }) => (
            <Card key={label} className="items-center py-4 text-center">
              <div className="text-title-sm font-bold text-gray-900 dark:text-white/90">{value}</div>
              <div className="mt-0.5 type-caption font-medium uppercase tracking-wide text-gray-400">{label}</div>
            </Card>
          ))}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-18 animate-pulse rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-white/3" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 py-16 text-center type-small text-gray-400 dark:border-gray-800 dark:bg-white/2">
          {search ? `No tenants matching "${search}"` : "No tenants yet"}
        </div>
      ) : (
        <div className="space-y-2">
          {pageItems.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-brand-200 hover:bg-brand-25 dark:border-gray-800 dark:bg-white/3 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/5"
            >
              <div className="flex items-center gap-3.5">
                <AvatarText name={t.name} className="h-10 w-10" />
                <div>
                  <div className="type-small font-semibold text-gray-900 dark:text-white/90">{t.name}</div>
                  <div className="font-mono type-caption text-gray-400">{t.id}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="light" color={t.is_active ? "success" : "light"}>
                  {t.is_active ? "Active" : "Inactive"}
                </Badge>
                <span className="type-caption text-gray-400">{timeAgo(t.created_at)}</span>
                <Button size="sm" variant="outline" onClick={() => openEdit(t)} disabled={loadingEdit}>
                  <Pencil className="icon-tiny" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/30 dark:text-error-400 dark:hover:bg-error-500/10"
                  onClick={() => setDelTarget(t)}
                >
                  <Trash2 className="icon-tiny" /> Delete
                </Button>
              </div>
            </div>
          ))}
          <TablePagination page={currentPage} totalItems={filtered.length} onPageChange={setPage} pageSize={8} />
        </div>
      )}
    </div>
  );
}

export default function TenantsPage() {
  return (
    <RequireAuth>
      <TenantsList />
    </RequireAuth>
  );
}
