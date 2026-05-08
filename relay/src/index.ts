import { ControllerRelay } from './relay';

export { ControllerRelay };

export interface Env {
  RELAY: DurableObjectNamespace;
  CLOUD_BASE: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    // /connect/{token} — WebSocket relay endpoint
    if (parts[0] === 'connect' && parts[1]) {
      const token = parts[1];
      const upgrade = request.headers.get('Upgrade');

      if (!upgrade || upgrade.toLowerCase() !== 'websocket') {
        return new Response(JSON.stringify({ ok: true, status: 'relay online' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const id = env.RELAY.idFromName(token);
      const stub = env.RELAY.get(id);
      return stub.fetch(request);
    }

    // /console/{token} — browser terminal UI
    if (parts[0] === 'console' && parts[1]) {
      const token = parts[1];
      const wsUrl = `wss://${url.hostname}/connect/${token}?type=browser`;
      return new Response(consoleHtml(token, wsUrl), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    return new Response(JSON.stringify({ ok: true, status: 'relay online' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

function consoleHtml(token: string, wsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PowerGuardian Console</title>
<style>
  body { margin: 0; background: #0a0a0a; color: #e0e0e0; font-family: monospace; display: flex; flex-direction: column; height: 100vh; }
  #status { padding: 8px 12px; font-size: 12px; background: #111; border-bottom: 1px solid #222; color: #888; }
  #status.connected { color: #00C66F; }
  #log { flex: 1; overflow-y: auto; padding: 12px; font-size: 13px; white-space: pre-wrap; }
  #input-row { display: flex; border-top: 1px solid #222; }
  #cmd { flex: 1; background: #111; border: none; color: #e0e0e0; padding: 10px 12px; font-family: monospace; font-size: 13px; outline: none; }
  #send { background: #00C66F; color: #000; border: none; padding: 10px 16px; cursor: pointer; font-weight: 600; }
</style>
</head>
<body>
<div id="status">Connecting…</div>
<div id="log"></div>
<div id="input-row">
  <input id="cmd" placeholder="Send command…" />
  <button id="send">Send</button>
</div>
<script>
  const token = ${JSON.stringify(token)};
  const wsUrl = ${JSON.stringify(wsUrl)};
  const log = document.getElementById('log');
  const status = document.getElementById('status');
  let ws;

  function append(text, cls) {
    const line = document.createElement('div');
    if (cls) line.style.color = cls;
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  function connect() {
    ws = new WebSocket(wsUrl);
    ws.onopen = () => { status.textContent = 'Connected'; status.className = 'connected'; append('-- connected --', '#00C66F'); };
    ws.onclose = () => { status.textContent = 'Disconnected — reconnecting…'; status.className = ''; append('-- disconnected --', '#888'); setTimeout(connect, 3000); };
    ws.onerror = () => append('-- error --', '#f66');
    ws.onmessage = (e) => { try { const d = JSON.parse(e.data); append(JSON.stringify(d, null, 2)); } catch { append(e.data); } };
  }

  document.getElementById('send').onclick = () => {
    const v = document.getElementById('cmd').value.trim();
    if (v && ws && ws.readyState === WebSocket.OPEN) { ws.send(v); document.getElementById('cmd').value = ''; }
  };
  document.getElementById('cmd').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('send').click(); });

  connect();
</script>
</body>
</html>`;
}
