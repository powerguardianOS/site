"use client";

import { useRouter } from "next/navigation";

export default function LicenseActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();

  async function revoke() {
    if (!confirm("Revoke this license?")) return;
    await fetch(`/api/admin/licenses/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      onClick={revoke}
      disabled={status === "revoked"}
      className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      Revoke
    </button>
  );
}
