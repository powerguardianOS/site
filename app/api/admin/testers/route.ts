export const runtime = 'edge';

import { adminFromRequest } from '@/app/lib/admin';
import { listTesters, testersCsv } from '@/app/lib/testers';

// Tester sign-ups, admin only: JSON, or ?format=csv for a download.
export async function GET(request: Request) {
  if (!(await adminFromRequest(request))) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const list = await listTesters();
  if (new URL(request.url).searchParams.get('format') === 'csv') {
    return new Response(testersCsv(list), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="testers-${new Date().toISOString().slice(0, 10)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  }
  return Response.json({ testers: list }, { headers: { 'Cache-Control': 'no-store' } });
}
