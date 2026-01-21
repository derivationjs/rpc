import { Transport } from "./transport.js";

/**
 * Transport implementation for browser WebSocket (client-side).
 */
export class WebSocketTransport implements Transport {
  constructor(private ws: globalThis.WebSocket) {}

  send(data: string): void {
    this.ws.send(data);
  }

  onMessage(handler: (data: string) => void): void {
    this.ws.onmessage = (event: MessageEvent) => {
      handler(event.data);
    };
  }

  onClose(handler: () => void): void {
    this.ws.onclose = handler;
  }

  close(): void {
    this.ws.close();
  }

  get bufferedAmount(): number {
    return this.ws.bufferedAmount;
  }
}
