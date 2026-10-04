// Branded HTML for every transactional email. Table layout + inline styles
// because mail clients ignore most modern CSS; no remote images (clients block
// them by default), so the logo is a pure-CSS mark. All dynamic text is escaped.

export type EmailOptions = {
  button?: { label: string; url: string };
  code?: string;
};

const GREEN = '#00C66F';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Only http(s) URLs become links; everything else stays text.
function linkify(escaped: string): string {
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (u) => `<a href="${u}" class="pg-link" style="color:#0a7a46;word-break:break-all;">${u}</a>`,
  );
}

function paragraphs(text: string, skipUrl?: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && p !== skipUrl && !/^[—–-]\s*PowerGuardian$/i.test(p));
}

export function renderEmailHtml(subject: string, text: string, opts: EmailOptions = {}): string {
  const { button, code } = opts;
  const body = paragraphs(text, button?.url);

  // When a code box is shown, drop the plain "code is: 123456" line — the
  // box carries it; keep the surrounding instructions.
  const shown = code ? body.filter((p) => !p.includes(code)) : body;
  const intro = shown.map(
    (p) =>
      `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#1f2933;" class="pg-text">${linkify(esc(p)).replace(/\n/g, '<br>')}</p>`,
  );
  const preheader = esc((shown[0] ?? subject).slice(0, 110));

  const codeBlock = code
    ? `<div style="margin:8px 0 24px;padding:18px 12px;text-align:center;background:#effcf5;border:1px solid #b7ebcf;border-radius:10px;font-family:SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;letter-spacing:8px;font-weight:700;color:#0a2a1a;" class="pg-code">${esc(code)}</div>`
    : '';

  const buttonBlock = button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr><td style="border-radius:8px;background:${GREEN};">
         <a href="${esc(button.url)}" style="display:inline-block;padding:14px 30px;font-size:16px;font-weight:600;color:#04150c;text-decoration:none;border-radius:8px;">${esc(button.label)}</a>
       </td></tr></table>
       <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#6b7280;" class="pg-muted">Button not working? Paste this link into your browser:<br>
         <a href="${esc(button.url)}" class="pg-link" style="color:#0a7a46;word-break:break-all;">${esc(button.url)}</a></p>`
    : '';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${esc(subject)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    .pg-bg { background:#0b0d0c !important; }
    .pg-card { background:#151918 !important; border-color:#262b29 !important; }
    .pg-text { color:#e6ebe8 !important; }
    .pg-muted { color:#98a29d !important; }
    .pg-foot { border-top-color:#262b29 !important; }
    .pg-link { color:#4ade80 !important; }
    .pg-code { background:#10261b !important; border-color:#1d5a3a !important; color:#d9fbe8 !important; }
  }
  @media only screen and (max-width:620px) { .pg-pad { padding:24px 20px !important; } }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;" class="pg-bg">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;" class="pg-bg"><tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;" class="pg-card">
    <tr><td style="background:#0a0f0d;padding:20px 32px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:22px;height:22px;background:${GREEN};border-radius:6px;font-size:0;line-height:0;">&nbsp;</td>
        <td style="padding-left:10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;letter-spacing:.2px;color:#ffffff;">PowerGuardian</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;" class="pg-pad">
      <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#0a0f0d;" class="pg-text">${esc(subject)}</h1>
      ${intro.slice(0, 1).join('')}
      ${buttonBlock}${codeBlock}
      ${intro.slice(1).join('')}
    </td></tr>
    <tr><td style="padding:18px 32px 26px;border-top:1px solid #eceff1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:#8a949e;" class="pg-muted pg-foot">
      PowerGuardian · <a href="https://powerguardian.cloud" style="color:#8a949e;">powerguardian.cloud</a><br>
      This is an automated message — please do not reply.
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}
