export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { notFound, redirect } from 'next/navigation';
import { getAdminEmail } from '@/app/lib/admin';
import AdminOverview from '../sections/overview';
import AuditPage from '../sections/audit';
import CustomerPage from '../sections/customer';
import FeedbackPage from '../sections/feedback';
import LicensesPage from '../sections/licenses';
import NewLicensePage from '../sections/new-license';
import TenantsPage from '../sections/tenants';
import TestersPage from '../sections/testers';

// All admin pages live in this one route on purpose: on Cloudflare Pages
// every edge page route becomes its own ~1.4 MB function, and seven admin
// pages pushed the bundle over the 25 MiB limit. The URLs are unchanged.
type Query = Record<string, string | undefined>;

export default async function AdminPage({ params, searchParams }: {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Next may render a page without waiting for its layout, so the page checks the admin itself before loading anything.
  if (!(await getAdminEmail())) redirect('/login');

  const path = (await params).path ?? [];
  // A repeated param (?q=a&q=b) arrives as an array; the sections read one string, so take the first.
  const query: Query = {};
  for (const [k, v] of Object.entries(await searchParams)) query[k] = Array.isArray(v) ? v[0] : v;

  // Match on segments, not a joined string: a decoded %2F inside one segment must not reach another page.
  const [a, b, ...rest] = path;
  if (rest.length) notFound();
  if (b === undefined) {
    switch (a ?? '') {
      case '': return <AdminOverview />;
      case 'audit': return <AuditPage searchParams={query} />;
      case 'licenses': return <LicensesPage searchParams={query} />;
      case 'tenants': return <TenantsPage searchParams={query} />;
      case 'testers': return <TestersPage />;
      case 'feedback': return <FeedbackPage searchParams={query} />;
    }
  } else if (a === 'licenses' && b === 'new') {
    return <NewLicensePage searchParams={query} />;
  } else if (a === 'customers') {
    return <CustomerPage email={b} />;
  }
  notFound();
}
