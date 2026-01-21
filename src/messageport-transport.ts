import { Transport } from "./transport.js";

/**
 * Transport implementation for MessagePort (SharedWorker communication).
 */
export class MessagePortTransport implements Transport {
  constructor(private port: MessagePort) {}

  send(data: string): void {
    this.port.postMessage(data);
  }

  onMessage(handler: (data: string) => void): void {
    this.port.onmessage = (event: MessageEvent) => {
      handler(event.data);
    };
  }

  onClose(handler: () => void): void {
    // MessagePort doesn't have a reliable close event
    // We'll use messageerror as a signal, though it's not perfect
    this.port.onmessageerror = handler;
  }

  close(): void {
    this.port.close();
  }

  // MessagePort doesn't provide bufferedAmount
  get bufferedAmount(): undefined {
    return undefined;
  }
}
