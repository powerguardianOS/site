"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

function TokenBadge({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  const masked = token.slice(0, 6) + "…" + token.slice(-4);
  return (
    <button
      onClick={copy}
      title={token}
      className="inline-flex items-center gap-1.5 font-mono text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded transition-colors"
    >
      {copied ? <span className="text-[#00C66F]">Copied!</span> : <span className="text-zinc-300">{masked}</span>}
      <svg className="w-3 h-3 text-zinc-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
    </button>
  );
}

function expiryState(expires_at: string | null): 'never' | 'ok' | 'soon' | 'expired' {
  if (!expires_at) return 'never';
  const diff = new Date(expires_at).getTime() - Date.now();
  if (diff < 0) return 'expired';
  if (diff < 30 * 86400_000) return 'soon';
  return 'ok';
}

export default function LicenseTable({ licenses }: { licenses: License[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filtered = useMemo(() => {
    return licenses.filter(l => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterPlan !== "all" && l.plan !== filterPlan) return false;
      if (search && !l.email.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [licenses, search, filterPlan, filterStatus]);

  async function revoke(id: string) {
    if (!confirm("Revoke this license?")) return;
    await fetch(`/api/admin/licenses/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const plans = [...new Set(licenses.map(l => l.plan))];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F] w-56"
        />
        <select
          value={filterPlan}
          onChange={e => setFilterPlan(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
        >
          <option value="all">All plans</option>
          {plans.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#00C66F]"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="revoked">Revoked</option>
        </select>
        <span className="ml-auto text-xs text-zinc-500 self-center">{filtered.length} of {licenses.length}</span>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs text-zinc-400 border-b border-zinc-800 bg-zinc-800/30">
            <tr>
              <th className="text-left px-5 py-3">Email</th>
              <th className="text-left px-5 py-3">Plan</th>
              <th className="text-left px-5 py-3">Token</th>
              <th className="text-left px-5 py-3">Connectors</th>
              <th className="text-left px-5 py-3">Expires</th>
              <th className="text-left px-5 py-3">Status</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filtered.map(l => {
              const exp = expiryState(l.expires_at);
              const rowClass = exp === 'expired' ? 'bg-red-500/5' : exp === 'soon' ? 'bg-amber-500/5' : '';
              return (
                <tr key={l.id} className={`hover:bg-zinc-800/20 ${rowClass}`}>
                  <td className="px-5 py-3">
                    <Link href={`/admin/licenses/${l.id}`} className="hover:text-[#00C66F] transition-colors font-mono text-xs">
                      {l.email}
                    </Link>
                  </td>
                  <td className="px-5 py-3 capitalize">{l.plan}</td>
                  <td className="px-5 py-3">
                    <TokenBadge token={l.token} />
                  </td>
                  <td className="px-5 py-3">{l.connector_limit === 0 ? '∞' : l.connector_limit}</td>
                  <td className="px-5 py-3">
                    {l.expires_at ? (
                      <span className={exp === 'expired' ? 'text-red-400' : exp === 'soon' ? 'text-amber-400' : 'text-zinc-400'}>
                        {new Date(l.expires_at).toLocaleDateString()}
                        {exp === 'soon' && ' ⚠'}
                        {exp === 'expired' && ' ✗'}
                      </span>
                    ) : <span className="text-zinc-600">Never</span>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${l.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 flex items-center gap-3 justify-end">
                    <Link href={`/admin/licenses/${l.id}`} className="text-xs text-zinc-500 hover:text-white transition-colors">
                      Edit
                    </Link>
                    <button
                      onClick={() => revoke(l.id)}
                      disabled={l.status === "revoked"}
                      className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-zinc-500">No licenses match</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
