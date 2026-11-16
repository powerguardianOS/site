"use client";
import { useState } from "react";
import Link from "next/link";

// Tester waitlist form. The server checks everything again (app/lib/testers.ts); this page only helps.
const PROTECTS = [
  ["nas", "NAS"],
  ["servers", "Servers"],
  ["network", "Network"],
  ["other", "Other"],
] as const;

const INPUT = "w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-base text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors";
const LABEL = "block text-sm text-zinc-300 mb-1.5";

export default function TesterPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [sent, setSent] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      email: String(f.get("email") ?? ""),
      name: String(f.get("name") ?? ""),
      country: String(f.get("country") ?? ""),
      ups: String(f.get("ups") ?? ""),
      protects: f.getAll("protects").map(String),
      ups_count: Number(f.get("ups_count")),
      heard: String(f.get("heard") ?? ""),
      consent: f.get("consent") === "on",
      website: String(f.get("website") ?? ""),
    };
    setBusy(true); setError(null);
    try {
      const r = await fetch("/api/tester", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.ok) setSent(body.email);
      else setError({ field: d.field, text: d.error ?? "Something went wrong — please try again." });
    } catch {
      setError({ text: "No connection — please try again." });
    } finally { setBusy(false); }
  }

  const bad = (field: string) => (error?.field === field ? " !border-red-500/60" : "");

  return (
    <div className="mx-auto max-w-xl px-4 md:px-6 pt-10 md:pt-16 pb-24 space-y-8">
      <div className="space-y-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-[#00C66F]/60 font-mono">Beta</div>
        <h1 className="pg-display text-4xl md:text-5xl text-white">Become a tester</h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          PowerGuardian Pro, free during the beta, and a direct line to the maker. In return: install it on your own
          hardware, tell us your UPS and devices, and give honest feedback. Join the waitlist: we invite in small groups
          and read every sign-up ourselves.
        </p>
      </div>

      {sent ? (
        <div role="status" id="tester-done" className="rounded-xl border border-[#00C66F]/25 bg-[#00C66F]/[0.05] p-6 space-y-2">
          <p className="text-white font-medium">Thanks — you&apos;re on the waitlist.</p>
          <p className="text-sm text-zinc-400">We invite in small groups. We&apos;ll e-mail <span className="text-zinc-200 break-all">{sent}</span> when it&apos;s your turn.</p>
          <Link href="/" className="inline-block pt-2 text-sm text-[#00C66F] hover:underline">Back to the home page</Link>
        </div>
      ) : (
        <form onSubmit={submit} onChange={() => error && setError(null)} noValidate className="space-y-5" id="tester-form">
          <div>
            <label htmlFor="t-email" className={LABEL}>E-mail</label>
            <input id="t-email" name="email" type="email" autoComplete="email" required maxLength={320} className={INPUT + bad("email")} placeholder="you@example.com" />
          </div>
          <div>
            <label htmlFor="t-name" className={LABEL}>Name <span className="text-zinc-500">(optional)</span></label>
            <input id="t-name" name="name" autoComplete="name" maxLength={100} className={INPUT} />
          </div>
          <div>
            <label htmlFor="t-country" className={LABEL}>Country</label>
            <input id="t-country" name="country" autoComplete="country-name" required maxLength={60} className={INPUT + bad("country")} placeholder="Netherlands" />
          </div>
          <div>
            <label htmlFor="t-ups" className={LABEL}>UPS brand and model</label>
            <input id="t-ups" name="ups" required maxLength={200} className={INPUT + bad("ups")} placeholder="Eaton 5PX 1500, APC Smart-UPS 1000…" />
          </div>
          <fieldset>
            <legend className={LABEL}>What should it protect?</legend>
            <div className={`grid grid-cols-2 gap-2 rounded-lg${error?.field === "protects" ? " ring-1 ring-red-500/60" : ""}`}>
              {PROTECTS.map(([v, label]) => (
                <label key={v} className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300 has-[:checked]:border-[#00C66F]/40 has-[:checked]:text-white cursor-pointer">
                  <input type="checkbox" name="protects" value={v} className="h-4 w-4 accent-[#00C66F]" /> {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="t-count" className={LABEL}>How many UPSes?</label>
            <input id="t-count" name="ups_count" type="number" inputMode="numeric" min={1} max={100} defaultValue={1} required className={INPUT + bad("ups_count")} />
          </div>
          <div>
            <label htmlFor="t-heard" className={LABEL}>How did you hear about us? <span className="text-zinc-500">(optional)</span></label>
            <input id="t-heard" name="heard" maxLength={200} className={INPUT} />
          </div>
          {/* Honeypot: hidden from people and screen readers; bots fill it. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
            <label htmlFor="t-website">Website</label>
            <input id="t-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <label className={`flex items-start gap-3 text-sm text-zinc-300 rounded-lg p-1${error?.field === "consent" ? " ring-1 ring-red-500/60" : ""}`}>
            <input type="checkbox" name="consent" className="mt-0.5 h-4 w-4 accent-[#00C66F]" />
            <span>PowerGuardian may contact me by e-mail about the beta. Nothing else, and I can stop it any time.</span>
          </label>

          {error && <p role="alert" id="tester-error" className="text-sm text-red-400">{error.text}</p>}

          <button type="submit" disabled={busy}
            className="w-full bg-[#00C66F] text-black font-medium py-3 rounded-lg text-base hover:bg-[#00b564] transition-colors disabled:opacity-50">
            {busy ? "Sending…" : "Join the waitlist"}
          </button>
        </form>
      )}
    </div>
  );
}
