/**
 * Transport abstraction for RPC communication.
 * Allows the same RPC system to work over WebSocket or MessagePort.
 */
export interface Transport {
  /**
   * Send a string message through the transport.
   */
  send(data: string): void;

  /**
   * Register a handler for incoming messages.
   */
  onMessage(handler: (data: string) => void): void;

  /**
   * Register a handler for transport closure/disconnection.
   */
  onClose(handler: () => void): void;

  /**
   * Close the transport connection.
   */
  close(): void;

  /**
   * Number of bytes buffered to be sent (optional, used for flow control).
   * MessagePort doesn't provide this, so it's optional.
   */
  readonly bufferedAmount?: number;
}
