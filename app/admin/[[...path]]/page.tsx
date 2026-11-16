export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import AdminOverview from '../sections/overview';
import AuditPage from '../sections/audit';
import CustomerPage from '../sections/customer';
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
  const path = (await params).path ?? [];
  const query = (await searchParams) as Query;

  switch (path.join('/')) {
    case '': return <AdminOverview />;
    case 'audit': return <AuditPage searchParams={query} />;
    case 'licenses': return <LicensesPage searchParams={query} />;
    case 'licenses/new': return <NewLicensePage searchParams={query} />;
    case 'tenants': return <TenantsPage searchParams={query} />;
    case 'testers': return <TestersPage />;
  }
  if (path.length === 2 && path[0] === 'customers') return <CustomerPage email={path[1]} />;
  notFound();
}
