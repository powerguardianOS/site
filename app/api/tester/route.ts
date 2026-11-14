export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { signUpTester } from '@/app/lib/testers';

// "Become a tester" sign-up (public). See app/lib/testers.ts.
export async function POST(request: Request) {
  const r = await signUpTester(request);
  return NextResponse.json(r.body, { status: r.status });
}
