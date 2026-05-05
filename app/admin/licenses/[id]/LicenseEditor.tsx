"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type License = {
  id: string;
  email: string;
  plan: string;
  connector_limit: number;
  expires_at: string | null;
  status: string;
  notes: string;
  created_at: string;
  token: string;
};

const PLAN_LIMITS: Record<string, number> = {
  home: 10, pro: 0, enterprise: 0, lifetime: 0, founder: 0,
};

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="space-y-1">
      <label className="text-xs text-zinc-400">{label}</label>
      <div className="flex items-center gap-2 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-sm text-zinc-200 break-all">{value}</span>
        <button onClick={copy} className="shrink-0 text-xs text-zinc-500 hover:text-[#00C66F] transition-colors px-2 py-0.5 rounded border border-zinc-700 hover:border-[#00C66F]">
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export default function LicenseEditor({ license }: { license: License }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [saved, setSaved] = useState(false);

  const [plan, setPlan] = useState(license.plan);
  const [limit, setLimit] = useState(license.connector_limit);
  const [expires, setExpires] = useState(license.expires_at ? license.expires_at.slice(0, 10) : "");
  const [notes, setNotes] = useState(license.notes || "");

  function onPlanChange(p: string) {
    setPlan(p);
    setLimit(PLAN_LIMITS[p] ?? 0);
  }

  async function save() {
    setSaving(true);
    setErr("");
    setSaved(false);
    const r = await fetch(`/api/admin/licenses/${license.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan,
        connector_limit: limit,
        expires_at: expires || null,
        notes,
      }),
    });
    if (r.ok) {
      setSaved(true);
      router.refresh();
    } else {
      const d = await r.json().catch(() => ({}));
      setErr(d.error ?? "Save failed");
    }
    setSaving(false);
  }

  async function revoke() {
    if (!confirm("Revoke this license? The controller will lose access.")) return;
    await fetch(`/api/admin/licenses/${license.id}`, { method: "DELETE" });
    router.push("/admin/licenses");
  }

  const mailtoHref = `mailto:${license.email}?subject=${encodeURIComponent("Your PowerGuardian license key")}&body=${encodeURIComponent(
    `Hi,\n\nHere is your PowerGuardian license key:\n\n  ${license.token}\n\nTo activate:\n1. Open your controller → Settings → License\n2. Enter your email address\n3. Enter the verification code sent to this email\n4. Your license will be activated automatically\n\nPlan: ${license.plan}\nConnectors: ${license.connector_limit === 0 ? 'Unlimited' : license.connector_limit}\n\nThanks,\nPowerGuardian`
  )}`;

  const expState = (() => {
    if (!license.expires_at) return 'never';
    const diff = new Date(license.expires_at).getTime() - Date.now();
    if (diff < 0) return 'expired';
    if (diff < 30 * 86400_000) return 'soon';
    return 'ok';
  })();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/licenses" className="text-zinc-500 hover:text-white transition-colors text-sm">← Licenses</Link>
          <span className="text-zinc-700">/</span>
          <span className="text-sm text-zinc-300 font-mono">{license.email}</span>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs ${license.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
          {license.status}
        </span>
      </div>

      {expState === 'expired' && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          This license has expired.
        </div>
      )}
      {expState === 'soon' && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          This license expires within 30 days.
        </div>
      )}

      {/* Token section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
        <h2 className="text-sm font-medium">License key</h2>
        <CopyField label="Token (send this to the customer)" value={license.token} />
        <a
          href={mailtoHref}
          className="inline-flex items-center gap-2 text-sm border border-zinc-700 hover:border-[#00C66F] text-zinc-300 hover:text-white px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
          Email key to customer
        </a>
        <p className="text-xs text-zinc-600">Created {new Date(license.created_at).toLocaleString()}</p>
      </div>

      {/* Edit section */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-4">
        <h2 className="text-sm font-medium">Edit license</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Plan</label>
            <select
              value={plan}
              onChange={e => onPlanChange(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
            >
              {['home', 'pro', 'enterprise', 'lifetime', 'founder'].map(p => (
                <option key={p} value={p} className="capitalize">{p}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Connector limit (0 = ∞)</label>
            <input
              type="number" min="0"
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Expires (leave blank = never)</label>
          <input
            type="date"
            value={expires}
            onChange={e => setExpires(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Notes</label>
          <textarea
            rows={3}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F] resize-none"
          />
        </div>

        {err && <p className="text-red-400 text-xs">{err}</p>}
        {saved && <p className="text-[#00C66F] text-xs">Saved.</p>}

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={revoke}
            disabled={license.status === "revoked"}
            className="text-sm text-red-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Revoke license
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-[#00C66F] text-black px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#00b564] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
