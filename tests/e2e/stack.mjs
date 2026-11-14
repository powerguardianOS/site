// Browser test stack: scripts/cloud-dev.mjs (fake KV + Brevo on 127.0.0.1, next dev) served over HTTPS with a
// throwaway self-signed certificate, so the real cookie flags (Secure) and same-origin checks apply exactly as on
// powerguardian.cloud. 127.0.0.1 only; nothing live is touched.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startDev, SITE_PORT } from '../../scripts/cloud-dev.mjs';

export const BASE = `https://localhost:${SITE_PORT}`;
export const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1';

function selfSigned() {
  const dir = mkdtempSync(path.join(tmpdir(), 'pg-e2e-'));
  const key = path.join(dir, 'k.pem'), cert = path.join(dir, 'c.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', '/CN=localhost',
    '-keyout', key, '-out', cert], { stdio: 'ignore' });
  return { key, cert };
}

export async function startStack() {
  const dev = await startDev({ https: selfSigned() });
  const linkIn = (text) => text.match(/https?:\/\/\S+\/api\/auth\/verify\?token=[0-9a-f]+/)?.[0];
  const lastLink = async (to, n = 1) => {
    for (let i = 0; i < 100; i++) {
      const m = dev.mails.filter((x) => x.to === to);
      if (m.length >= n) return linkIn(m.at(-1).text);
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('no mail for ' + to);
  };
  return { ...dev, lastLink };
}

// next dev hydrates late: typing before that is lost.
export const hydrated = (page, sel = 'input[type=email]') => page.waitForFunction(
  (s) => { const el = document.querySelector(s); return !!el && Object.keys(el).some((k) => k.startsWith('__react')); }, sel);
export const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

let passed = 0, failed = 0;
export function check(label, ok, extra = '') {
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${extra ? '  → ' + extra : ''}`);
  ok ? passed++ : failed++;
  return ok;
}
export const result = () => ({ passed, failed });
