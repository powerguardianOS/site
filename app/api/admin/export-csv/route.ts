import { NextRequest } from 'next/server';
import { getAccounts } from '@/app/lib/accounts';
import { getLicenses } from '@/app/lib/license-db';
import type { LicenseRecord } from '@/app/lib/license-db';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const [accounts, licenses] = await Promise.all([getAccounts(), getLicenses()]);

    // Build license map: email → active license (or first if multiple, but we only care about active)
    const licenseMap = new Map<string, LicenseRecord | undefined>();
    for (const lic of licenses) {
      const key = lic.email.toLowerCase();
      if (!licenseMap.has(key) && lic.status === 'active') {
        licenseMap.set(key, lic);
      }
    }

    // Build CSV rows
    const rows = accounts.map(account => {
      const license = licenseMap.get(account.email.toLowerCase());
      const plan = license?.plan || '';
      const status = license?.status === 'active' ? 'active' : 'no license';
      const registered = new Date(account.created_at).toISOString().split('T')[0];

      // Escape fields for CSV (simple: wrap in quotes and double any quotes)
      const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
      return [
        escape(account.email),
        escape(registered),
        escape(plan),
        escape(status)
      ].join(',');
    });

    // CSV header + rows
    const csvContent = [
      'email,registered,plan,status',
      ...rows
    ].join('\n');

    // Set headers for download
    const headers = new Headers({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="accounts.csv"',
    });

    return new Response(csvContent, { headers });
  } catch (error) {
    console.error('Error generating CSV:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}