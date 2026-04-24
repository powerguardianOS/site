"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewLicensePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    const fd = new FormData(e.currentTarget);
    const body = {
      email: fd.get("email") as string,
      plan: fd.get("plan") as string,
      connector_limit: Number(fd.get("connector_limit") ?? 0),
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
      <h1 className="text-xl font-semibold">New license</h1>

      <form onSubmit={submit} className="space-y-4 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Email address</label>
          <input name="email" type="email" required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Plan</label>
            <select name="plan" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]">
              <option value="home">Home (≤10 connectors)</option>
              <option value="pro">Pro (unlimited)</option>
              <option value="enterprise">Enterprise</option>
              <option value="lifetime">Lifetime</option>
              <option value="founder">Founder</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-zinc-400">Connector limit (0 = ∞)</label>
            <input name="connector_limit" type="number" min="0" defaultValue="0"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Expires (leave blank = never)</label>
          <input name="expires_at" type="date"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-zinc-400">Notes</label>
          <textarea name="notes" rows={3}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F] resize-none" />
        </div>

        {err && <p className="text-red-400 text-xs">{err}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <a href="/admin/licenses" className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</a>
          <button type="submit" disabled={saving}
            className="bg-[#00C66F] text-black px-5 py-2 rounded-lg text-sm font-medium hover:bg-[#00b564] disabled:opacity-50 transition-colors">
            {saving ? "Creating…" : "Create license"}
          </button>
        </div>
      </form>
    </div>
  );
}
