import { WebSocket, RawData } from "ws";
import { Transport } from "./transport";

/**
 * Transport implementation for Node.js WebSocket (server-side using 'ws' library).
 */
export class NodeWebSocketTransport implements Transport {
  private messageHandlerSet = false;
  private closeHandlerSet = false;

  constructor(private ws: WebSocket) {}

  send(data: string): void {
    this.ws.send(data);
  }

  onMessage(handler: (data: string) => void): void {
    if (!this.messageHandlerSet) {
      this.ws.on("message", (data: RawData) => {
        handler(data.toString());
      });
      this.messageHandlerSet = true;
    }
  }

  onClose(handler: () => void): void {
    if (!this.closeHandlerSet) {
      this.ws.on("close", handler);
      this.closeHandlerSet = true;
    }
  }

  close(): void {
    this.ws.close();
  }

  get bufferedAmount(): number {
    return this.ws.bufferedAmount;
  }
}

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
