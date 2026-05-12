import { NextRequest, NextResponse } from 'next/server';
import { createLicense, getLicenses, getLicenseByEmail, updateLicense } from '@/app/lib/license-db';
import { sendEmail } from '@/app/lib/email';

export const runtime = 'edge';

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!WEBHOOK_SECRET) {
  throw new Error('STRIPE_WEBHOOK_SECRET is not set');
}

// Parse Stripe signature header: "t=...,v1=..."
function parseSignature(header: string | null): { timestamp: string; signature: string } {
  if (!header) {
    throw new Error('Missing stripe-signature header');
  }

  const parts = header.split(',').map(part => part.trim());
  const tPart = parts.find(p => p.startsWith('t='));
  const v1Part = parts.find(p => p.startsWith('v1='));

  if (!tPart || !v1Part) {
    throw new Error('Invalid stripe-signature format');
  }

  return {
    timestamp: tPart.substring(2),
    signature: v1Part.substring(4),
  };
}

// Compute HMAC-SHA256 signature using Web Crypto API
async function computeSignature(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    messageData
  );

  const signatureArray = new Uint8Array(signatureBuffer);
  const hexBytes = Array.from(signatureArray).map(b => b.toString(16).padStart(2, '0')).join('');
  return hexBytes;
}

// Verify Stripe webhook signature
async function verifySignature(rawBody: Uint8Array, signatureHeader: string | null): Promise<boolean> {
  try {
    const { timestamp, signature } = parseSignature(signatureHeader);
    const message = `${timestamp}.${new TextDecoder().decode(rawBody)}`;
    const expectedSignature = await computeSignature(WEBHOOK_SECRET, message);

    // Constant-time comparison to prevent timing attacks
    if (expectedSignature.length !== signature.length) {
      return false;
    }

    let diff = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
      diff |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    return diff === 0;
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.arrayBuffer();
    const signatureHeader = request.headers.get('stripe-signature');

    if (!signatureHeader) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const isValid = await verifySignature(new Uint8Array(rawBody), signatureHeader);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const payload = JSON.parse(new TextDecoder().decode(rawBody));
    const event = payload;

    // Handle events
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { plan, annual } = session.metadata || {};
      const email = session.customer_details?.email;

      if (!email || !plan) {
        console.warn('Missing email or plan in session metadata');
        return NextResponse.json({ received: true });
      }

      const isSubscription = session.mode === 'subscription';
      const notes = isSubscription
        ? `stripe-sub:${session.subscription}`
        : `stripe:${session.id}`;

      if (plan === 'addon_connector') {
        const existing = await getLicenseByEmail(email);
        if (existing) {
          await updateLicense(existing.id, {
            connector_limit: existing.connector_limit + 1,
            notes: existing.notes ? `${existing.notes} ${notes}` : notes,
          });
        }
      } else {
        await createLicense({
          email,
          plan,
          site_id: 'default-site',
          connector_limit: plan === 'home' ? 1 : 5,
          expires_at: null,
          notes,
        });
      }

      await sendEmail(
        email,
        'Your PowerGuardian license is active',
        `Welcome to PowerGuardian!\n\nYour license is now active. To get started:\n\n1. Log in to your dashboard\n2. Go to Settings → License\n3. Click "Link License"\n4. Enter your email: ${email}\n5. Enter the 6-digit code sent to your inbox\n\nBest regards,\nThe PowerGuardian Team`
      );

      return NextResponse.json({ received: true });
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const subscriptionId = subscription.id;

      const licenses = await getLicenses();
      const matchingLicense = licenses.find(l => l.notes?.includes(`stripe-sub:${subscriptionId}`));

      if (!matchingLicense) {
        console.warn(`No license found for subscription ${subscriptionId}`);
        return NextResponse.json({ received: true });
      }

      await updateLicense(matchingLicense.id, { status: 'expired' });

      await sendEmail(
        matchingLicense.email,
        'Your PowerGuardian license has expired',
        `Hello,\n\nYour PowerGuardian license has expired. If this was a mistake or you'd like to re-activate, please visit powerguardian.cloud/pricing.\n\nBest regards,\nThe PowerGuardian Team`
      );

      return NextResponse.json({ received: true });
    }

    // Unhandled event
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}