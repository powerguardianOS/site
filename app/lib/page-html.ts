// Small server-rendered pages for the sign-in steps (no client JS, works with any browser). Phone first.
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const LOGO = '<svg width="28" height="32" viewBox="0 0 128 140" fill="none" aria-hidden="true"><path d="M64 8 L112 28 V72 C112 100 94 122 64 132 C34 122 16 100 16 72 V28 L64 8Z" stroke="#00C66F" stroke-width="10" stroke-linejoin="round"/><path d="M72 32 L48 72 H62 L52 108 L80 68 H66 L72 32Z" fill="#00C66F"/></svg>';

export const CSS = `*{box-sizing:border-box}body{margin:0;background:#060a14;color:#fafafa;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;-webkit-text-size-adjust:100%}
main{max-width:400px;margin:0 auto;padding:72px 16px 48px}.mark{display:flex;justify-content:center;margin-bottom:16px}
.mark span{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:16px;background:rgba(0,198,111,.1);border:1px solid rgba(0,198,111,.2)}
h1{font-size:24px;font-weight:600;letter-spacing:-.01em;text-align:center;margin:0 0 8px}p{color:#a1a1aa;font-size:15px;line-height:1.5;text-align:center;margin:0 0 8px}
b{color:#fafafa;font-weight:600}.card{margin-top:24px;border:1px solid #27272a;background:rgba(9,9,11,.7);border-radius:12px;padding:20px}
button,.btn{display:block;width:100%;min-height:48px;padding:14px;border:0;border-radius:10px;background:#00C66F;color:#04140b;font-size:16px;font-weight:600;text-align:center;text-decoration:none;cursor:pointer;font-family:inherit}
button.secondary{background:transparent;color:#a1a1aa;border:1px solid #3f3f46;margin-top:12px}
input{display:block;width:100%;min-height:48px;padding:12px 14px;margin:0 0 12px;background:#09090b;border:1px solid #27272a;border-radius:10px;color:#fafafa;font-size:16px;font-family:inherit}
input:focus{outline:none;border-color:#00C66F}.code{font-size:24px;letter-spacing:.3em;text-align:center;font-variant-numeric:tabular-nums}
.err{color:#f87171;font-size:14px;text-align:left;margin:0 0 12px}summary::-webkit-details-marker{display:none}
@media (hover:hover) and (pointer:fine){.phone-only{display:none}}.small{font-size:13px;color:#71717a}a{color:#00C66F}`;

export function page(status: number, title: string, body: string, extraHeaders: Record<string, string> = {}): Response {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>${esc(title)} · PowerGuardian</title><style>${CSS}</style></head>` +
    `<body><main><div class="mark"><span>${LOGO}</span></div><h1>${esc(title)}</h1>${body}</main></body></html>`,
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        // same-origin, not no-referrer: with no-referrer browsers send "Origin: null" on the form POST, and the POST
        // needs a real Origin to prove it came from this page. The URL never goes to another site either way.
        'Referrer-Policy': 'same-origin',
        'X-Frame-Options': 'DENY',
        'X-Robots-Tag': 'noindex',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        ...extraHeaders,
      },
    },
  );
}

// Same-origin check for form POSTs from these pages: the browser's Origin must be this host.
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin || origin === 'null') return false;
  try { return new URL(origin).host === new URL(request.url).host; } catch { return false; }
}
