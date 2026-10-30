export const runtime = 'edge';

import { requestSignIn } from '@/app/lib/signin';

export async function POST(request: Request) {
  return requestSignIn(request, 'magic');
}
