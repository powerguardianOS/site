export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { listAudit } from '@/app/lib/audit';

const ROLE: Record<string, string> = { admin: 'text-green-300', owner: 'text-zinc-200', system: 'text-zinc-500', controller: 'text-sky-300' };

export default async function AuditPage() {
  const entries = await listAudit(200);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-zinc-400">Every change to sites, controllers and licenses made by you, by customers and by controllers. Newest first, kept 400 days.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950/50 text-left text-xs uppercase tracking-wider text-zinc-500">
            <tr>{['When', 'Who', 'Action', 'Tenant', 'Detail'].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {entries.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-zinc-500">Nothing logged yet.</td></tr>
            ) : entries.map((e, i) => (
              <tr key={i} className="align-top hover:bg-zinc-900/40">
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-zinc-400">{new Date(e.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td className={`px-4 py-2.5 text-xs ${ROLE[e.role] ?? ''}`}>{e.actor}<span className="ml-1 text-zinc-600">· {e.role}</span></td>
                <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">{e.action}</td>
                <td className="px-4 py-2.5 text-xs">{e.email ? <Link href={`/admin/customers/${encodeURIComponent(e.email)}`} className="text-zinc-200 hover:text-[#00C66F]">{e.email}</Link> : '—'}</td>
                <td className="px-4 py-2.5 text-xs text-zinc-400">{e.detail ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
