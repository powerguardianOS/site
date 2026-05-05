import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export type LicenseRecord = {
  id: string;
  email: string;
  plan: "home" | "pro" | "enterprise" | "lifetime" | "founder";
  connector_limit: number;
  expires_at: string | null;
  status: "active" | "revoked" | "expired";
  notes: string;
  created_at: string;
  token: string;
};

const DB_PATH = process.env.LICENSE_DB_PATH || path.join(process.cwd(), 'data/licenses.json');

async function readDb(): Promise<LicenseRecord[]> {
  try {
    const data = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeDb(licenses: LicenseRecord[]) {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(licenses, null, 2));
}

export async function getLicenses(): Promise<LicenseRecord[]> {
  return readDb();
}

export async function getLicenseByToken(token: string): Promise<LicenseRecord | null> {
  const licenses = await readDb();
  return licenses.find(l => l.token.toLowerCase() === token.toLowerCase()) ?? null;
}

export async function createLicense(data: Omit<LicenseRecord, 'id' | 'created_at' | 'token' | 'status'>): Promise<LicenseRecord> {
  const licenses = await readDb();
  const record: LicenseRecord = {
    ...data,
    id: uuidv4(),
    status: 'active',
    created_at: new Date().toISOString(),
    token: crypto.randomBytes(16).toString('hex'),
  };
  licenses.push(record);
  await writeDb(licenses);
  return record;
}

export async function updateLicense(id: string, patch: Partial<LicenseRecord>): Promise<LicenseRecord | null> {
  const licenses = await readDb();
  const idx = licenses.findIndex(l => l.id === id);
  if (idx === -1) return null;
  licenses[idx] = { ...licenses[idx], ...patch };
  await writeDb(licenses);
  return licenses[idx];
}

export async function revokeLicense(id: string): Promise<boolean> {
  const licenses = await readDb();
  const idx = licenses.findIndex(l => l.id === id);
  if (idx === -1) return false;
  licenses[idx].status = 'revoked';
  await writeDb(licenses);
  return true;
}
