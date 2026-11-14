export const runtime = 'edge';

export type AccountRecord = { email: string; created_at: string; verified: boolean };

import { kvGet, kvPut, kvDel, kvList } from '@/app/lib/kv';

export async function createAccount(email: string): Promise<AccountRecord> {
  const record: AccountRecord = { email: email.toLowerCase(), created_at: new Date().toISOString(), verified: false };
  await kvPut(`account:${email.toLowerCase()}`, JSON.stringify(record));
  return record;
}

export async function getAccount(email: string): Promise<AccountRecord | null> {
  const raw = await kvGet(`account:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

export async function getAccounts(): Promise<AccountRecord[]> {
  const names = await kvList('account:', 1000).catch(() => null);
  if (!names) return [];
  const records = await Promise.all(names.map(k => kvGet(k).then(v => v ? JSON.parse(v) as AccountRecord : null)));
  return records.filter(Boolean) as AccountRecord[];
}

export async function deleteAccount(email: string): Promise<void> {
  await kvDel(`account:${email.toLowerCase()}`);
}
