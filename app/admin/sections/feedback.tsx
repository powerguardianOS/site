import { adminRows, listAll, OPEN } from '@/app/lib/feedback';
import type { FbStatus, Kind } from '@/app/lib/feedback';
import { CARD, Chips, PageHeader } from '../ui';
import { FeedbackRow } from './FeedbackRow';

// FEEDBACK-1: what customers sent, in two channels (Bugs, Ideas). One row per item; duplicates are merged into one,
// and the count (1 + merged) is the vote. Actions are inline (FeedbackRow → /api/admin/feedback).
const TABS: { kind: Kind; label: string }[] = [{ kind: 'bug', label: 'Bugs' }, { kind: 'idea', label: 'Ideas' }];
const FILTERS: { key: 'open' | FbStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' }, { key: 'new', label: 'New' }, { key: 'seen', label: 'Seen' }, { key: 'planned', label: 'Planned' },
  { key: 'fixed', label: 'Fixed' }, { key: 'rejected', label: 'Rejected' }, { key: 'all', label: 'All' },
];

export default async function FeedbackPage({ searchParams }: { searchParams: { kind?: string; status?: string } }) {
  const kind: Kind = searchParams.kind === 'idea' ? 'idea' : 'bug';
  const status = FILTERS.some((f) => f.key === searchParams.status) ? (searchParams.status as (typeof FILTERS)[number]['key']) : 'open';
  const { items, truncated } = await listAll();
  const rows = adminRows(items);
  const ofKind = rows.filter((r) => r.kind === kind && !r.merged_into);
  const open = (k: Kind) => rows.filter((r) => r.kind === k && !r.merged_into && OPEN.includes(r.status)).length;
  const count = (key: (typeof FILTERS)[number]['key']) =>
    key === 'all' ? ofKind.length : key === 'open' ? open(kind) : ofKind.filter((r) => r.status === key).length;
  const shown = ofKind.filter((r) => status === 'all' || (status === 'open' ? OPEN.includes(r.status) : r.status === status));
  const href = (k: Kind, s: string) => `/admin/feedback?kind=${k}${s === 'open' ? '' : `&status=${s}`}`;
  const targets = ofKind.map((r) => ({ id: r.id, text: r.text.slice(0, 80) }));

  return (
    <div className="space-y-4">
      <PageHeader title="Feedback" sub="Problems and ideas from customers. Merge duplicates: the count is how many reported the same thing. Replies show up for every reporter." />
      <Chips label="Channel" items={TABS.map((t) => ({ key: t.kind, label: t.label, count: open(t.kind), href: href(t.kind, 'open'), on: t.kind === kind }))} />
      {truncated && <p id="feedback-truncated" className="text-sm text-amber-300">Showing the first {items.length} items; there are more. Counts are for these only.</p>}
      <Chips label="Status" items={FILTERS.map((f) => ({ key: f.key, label: f.label, count: count(f.key), href: href(kind, f.key), on: f.key === status }))} />
      {shown.length === 0 ? (
        <p className={`${CARD} px-4 py-10 text-center text-sm text-zinc-500`}>{ofKind.length ? 'Nothing matches this filter.' : `No ${kind === 'bug' ? 'problems' : 'ideas'} yet.`}</p>
      ) : (
        <ol id="feedback-list" className={`${CARD} divide-y divide-zinc-800/70`}>
          {shown.map((r) => <FeedbackRow key={r.id} row={r} targets={targets.filter((t) => t.id !== r.id)} />)}
        </ol>
      )}
    </div>
  );
}
