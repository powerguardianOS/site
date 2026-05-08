export class ControllerRelay implements DurableObject {
  private controllerSocket: WebSocket | null = null;
  private browserSockets: Set<WebSocket> = new Set();

  constructor(private state: DurableObjectState, private env: unknown) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    if (!type) {
      return new Response('missing type param', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    if (type === 'controller') {
      this.controllerSocket = server;
      server.accept();

      server.addEventListener('message', (evt) => {
        for (const browser of this.browserSockets) {
          try { browser.send(evt.data as string); } catch { /* ignore closed */ }
        }
      });

      server.addEventListener('close', () => {
        this.controllerSocket = null;
      });

      server.addEventListener('error', () => {
        this.controllerSocket = null;
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    if (type === 'browser') {
      this.browserSockets.add(server);
      server.accept();

      server.addEventListener('message', (evt) => {
        if (this.controllerSocket && this.controllerSocket.readyState === WebSocket.OPEN) {
          this.controllerSocket.send(evt.data as string);
        }
      });

      server.addEventListener('close', () => {
        this.browserSockets.delete(server);
      });

      server.addEventListener('error', () => {
        this.browserSockets.delete(server);
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('invalid type', { status: 400 });
  }
}
