"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PLAN_LIMITS: Record<string, number> = {
  home: 10, pro: 0, enterprise: 0, lifetime: 0, founder: 0,
};

const PLAN_LABELS: Record<string, string> = {
  home: "Home — max 10 connectors · €5/mo",
  pro: "Pro — unlimited connectors · €15/mo",
  enterprise: "Enterprise — custom",
  lifetime: "Lifetime — one-time",
  founder: "Founder — internal",
};

export default function NewLicensePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [plan, setPlan] = useState("pro");
  const [limit, setLimit] = useState(0);

  function onPlanChange(p: string) {
    setPlan(p);
    setLimit(PLAN_LIMITS[p] ?? 0);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    const fd = new FormData(e.currentTarget);
    const body = {
      email: fd.get("email") as string,
      plan,
      connector_limit: limit,
      expires_at: (fd.get("expires_at") as string) || null,
      notes: fd.get("notes") as string,
    };
    const r = await fetch("/api/admin/licenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      router.push("/admin/licenses");
    } else {
      const d = await r.json().catch(() => ({}));
      setErr(d.error ?? "Failed to create license");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <a href="/admin/licenses" className="text-zinc-500 hover:text-white transition-colors text-sm">← Licenses</a>
        <span className="text-zinc-700">/</span>
        <span className="text-sm text-zinc-300">New license</span>
      </div>

      <form onSubmit={submit} className="space-y-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Email address</label>
          <input
            name="email" type="email" required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Plan</label>
          <select
            value={plan}
            onChange={e => onPlanChange(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
          >
            {Object.entries(PLAN_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
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
          {plan === 'home' && <p className="text-xs text-zinc-600">Home plan default: 10</p>}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Expires (leave blank = never)</label>
          <input
            name="expires_at" type="date"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Notes</label>
          <textarea
            name="notes" rows={2}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F] resize-none"
          />
        </div>

        {err && <p className="text-red-400 text-xs">{err}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <a href="/admin/licenses" className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</a>
          <button
            type="submit" disabled={saving}
            className="bg-[#00C66F] text-black px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#00b564] disabled:opacity-50 transition-colors"
          >
            {saving ? "Creating…" : "Create license"}
          </button>
        </div>
      </form>
    </div>
  );
}
