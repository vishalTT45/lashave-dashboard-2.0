"use client";

import { useState } from "react";
import { RequireAuth } from "@/components/require-auth";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block type-caption font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 type-caption text-gray-400 dark:text-gray-500">{hint}</p>}
    </div>
  );
}

function CreateTenantForm() {
  const { me } = useAuth();
  const [form, setForm] = useState({
    tenant_id: "",
    tenant_name: "",
    admin_email: "",
    admin_password: "",
    system_prompt: "",
    opening_message: "",
    temperature: "0.2",
    max_tokens: "200",
  });
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (!me) return null;
  if (!isSuperAdmin(me.user.role)) {
    return (
      <div className="mx-auto max-w-lg py-16">
        <Alert variant="error" title="Access denied" message="You don't have permission to view this page." />
      </div>
    );
  }

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      await apiFetch("/admin/tenants", {
        method: "POST",
        auth: true,
        body: {
          ...form,
          temperature: parseFloat(form.temperature),
          max_tokens: parseInt(form.max_tokens),
        },
      });
      setMsg({ type: "ok", text: "Tenant created successfully!" });
      setForm({
        tenant_id: "",
        tenant_name: "",
        admin_email: "",
        admin_password: "",
        system_prompt: "",
        opening_message: "",
        temperature: "0.2",
        max_tokens: "200",
      });
    } catch (err: unknown) {
      setMsg({ type: "err", text: err instanceof Error ? err.message : "Failed to create tenant" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <Badge variant="light" color="primary" className="mb-2">
          Super Admin
        </Badge>
        <h1 className="text-title-sm font-bold text-gray-900 dark:text-white/90">Create Tenant</h1>
        <p className="mt-1 type-small text-gray-500 dark:text-gray-400">
          Provision a new tenant with an admin account
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        <Card>
          <CardContent className="space-y-4 pt-0">
            <p className="type-caption font-semibold uppercase tracking-wide text-gray-400">Identity</p>
            <Field label="Tenant ID" hint="Lowercase, underscores only — cannot be changed later">
              <Input
                placeholder="acme_corp"
                value={form.tenant_id}
                onChange={(e) => set("tenant_id", e.target.value)}
                required
              />
            </Field>
            <Field label="Tenant Name">
              <Input
                placeholder="Acme Corporation"
                value={form.tenant_name}
                onChange={(e) => set("tenant_name", e.target.value)}
                required
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-0">
            <p className="type-caption font-semibold uppercase tracking-wide text-gray-400">Admin Account</p>
            <Field label="Admin Email">
              <Input
                type="email"
                placeholder="admin@acme.com"
                value={form.admin_email}
                onChange={(e) => set("admin_email", e.target.value)}
                required
              />
            </Field>
            <Field label="Admin Password">
              <Input
                type="password"
                placeholder="••••••••"
                value={form.admin_password}
                onChange={(e) => set("admin_password", e.target.value)}
                required
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 pt-0">
            <p className="type-caption font-semibold uppercase tracking-wide text-gray-400">
              Bot Config <span className="normal-case text-gray-300">(optional)</span>
            </p>
            <Field label="System Prompt">
              <Textarea
                placeholder="You are a helpful assistant for…"
                value={form.system_prompt}
                onChange={(e) => set("system_prompt", e.target.value)}
                className="min-h-20"
              />
            </Field>
            <Field label="Opening Message">
              <Input
                placeholder="Hi! How can I help you today?"
                value={form.opening_message}
                onChange={(e) => set("opening_message", e.target.value)}
              />
            </Field>
            <div className="flex gap-3">
              <Field label="Temperature">
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={form.temperature}
                  onChange={(e) => set("temperature", e.target.value)}
                />
              </Field>
              <Field label="Max Tokens">
                <Input
                  type="number"
                  min="50"
                  max="4000"
                  value={form.max_tokens}
                  onChange={(e) => set("max_tokens", e.target.value)}
                />
              </Field>
            </div>
          </CardContent>
        </Card>

        {msg && (
          <Alert
            variant={msg.type === "ok" ? "success" : "error"}
            title={msg.type === "ok" ? "Success" : "Error"}
            message={msg.text}
          />
        )}

        <Button type="submit" disabled={loading} className="w-full" size="lg">
          {loading ? "Creating…" : "Create Tenant →"}
        </Button>
      </form>
    </div>
  );
}

export default function CreateTenantPage() {
  return (
    <RequireAuth>
      <CreateTenantForm />
    </RequireAuth>
  );
}
