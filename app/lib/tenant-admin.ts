import { deleteAccount, getAccount } from '@/app/lib/accounts';
import { deleteLicense } from '@/app/lib/license-db';
import { deleteSiteStatus } from '@/app/lib/site-status';
import { deleteBlocker, loadTenants } from '@/app/lib/tenants';

export type DeleteResult =
  | { ok: true; licenses: number }
  | { ok: false; status: number; error: string; message: string };

// Removes a tenant's account, licenses (with their token index) and stored site
// status. Refuses while anything is still in use, and never deletes the admin's
// own account. Order: licenses first (they hold the secrets), account last, so a
// failure half-way leaves a tenant that can simply be deleted again.
export async function deleteTenant(email: string, confirm: unknown, adminEmail: string | undefined): Promise<DeleteResult> {
  const target = email.trim().toLowerCase();
  if (typeof confirm !== 'string' || confirm.trim().toLowerCase() !== target) {
    return { ok: false, status: 400, error: 'confirmation_mismatch', message: 'Type the exact e-mail address to confirm.' };
  }
  if (adminEmail && target === adminEmail.toLowerCase()) {
    return { ok: false, status: 403, error: 'protected', message: 'The global admin account cannot be deleted.' };
  }

  const tenant = (await loadTenants()).find((t) => t.email === target);
  if (!tenant && !(await getAccount(target))) {
    return { ok: false, status: 404, error: 'not_found', message: 'No such tenant.' };
  }
  if (tenant) {
    const blocker = deleteBlocker(tenant);
    if (blocker) return { ok: false, status: 409, error: 'in_use', message: blocker };
    for (const l of tenant.licenses) {
      await deleteSiteStatus(l.id);
      await deleteLicense(l.id);
    }
  }
  await deleteAccount(target);
  return { ok: true, licenses: tenant?.licenses.length ?? 0 };
}
