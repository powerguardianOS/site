export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { getSession } from '@/app/lib/session';
import FeedbackCard from '@/app/account/components/FeedbackCard';

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Report a problem or send an idea to the PowerGuardian team.',
  robots: { index: false, follow: false },
};

// FEEDBACK-1: the form for people without a controller yet. Signed in only (no anonymous feedback): signed out, the
// page shows the normal sign-in link.
export default async function FeedbackPage() {
  const sid = (await cookies()).get('pg_session')?.value;
  const email = sid ? await getSession(sid) : null;
  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 pb-24 pt-10 md:px-6 md:pt-16">
      <div className="space-y-3">
        <h1 className="pg-display text-4xl text-white md:text-5xl">Feedback</h1>
        <p className="text-sm leading-relaxed text-zinc-400">Found a problem or have an idea? Tell us. We read everything and reply right here.</p>
      </div>
      {email ? (
        <FeedbackCard startOpen />
      ) : (
        <div id="fb-signin" className="space-y-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 text-sm">
          <p className="text-white/70">Sign in to send feedback. We&apos;ll e-mail you a sign-in link.</p>
          <Link href="/login" className="inline-flex min-h-[44px] items-center rounded-lg bg-[#00C66F] px-5 font-medium text-black hover:bg-[#00b564] sm:min-h-[36px]">
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}
