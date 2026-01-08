import { RawData, WebSocket } from "ws";
import { parseClientMessage, ClientMessage } from "./client-message";
import { ServerMessage } from "./server-message";
import { Source, StreamEndpoints, StreamDefinitions } from "./stream-types";

export class ClientHandler<Defs extends StreamDefinitions> {
  private readonly ws: WebSocket;
  private readonly endpoints: StreamEndpoints<Defs>;
  private closed = false;
  private readonly streams = new Map<number, Source<unknown>>();
  private interval: NodeJS.Timeout | undefined;

  constructor(ws: WebSocket, endpoints: StreamEndpoints<Defs>) {
    this.ws = ws;
    this.endpoints = endpoints;

    console.log("new client connected");

    this.resetHeartbeat();
  }

  private resetHeartbeat() {
    if (this.interval) {
      clearInterval(this.interval);
    }

    this.interval = setInterval(() => {
      this.sendMessage(ServerMessage.heartbeat());
    }, 10_000);
  }

  handleMessage(message: RawData) {
    let data: object;
    try {
      data = JSON.parse(message.toString());
    } catch {
      console.error("Invalid JSON received:", message.toString());
      return this.close();
    }

    let parsed: ClientMessage;
    try {
      parsed = parseClientMessage(data);
    } catch (err) {
      console.error("Invalid client message:", err);
      return this.close();
    }

    this.handleClientMessage(parsed);
  }

  handleClientMessage(message: ClientMessage) {
    switch (message.type) {
      case "subscribe": {
        const { id, name, args } = message;

        if (!(name in this.endpoints)) {
          console.error(`Unknown stream: ${name}`);
          this.close();
          return;
        }

        const endpoint = this.endpoints[name as keyof Defs];

        try {
          const source = endpoint(args as Defs[keyof Defs]["args"]);
          this.streams.set(id, source);
          this.sendMessage(ServerMessage.subscribed(id, source.Snapshot));
          console.log(`Client subscribed to \"${name}\" (${id})`);
        } catch (err) {
          console.error(`Error building stream ${name}:`, err);
          this.close();
        }
        break;
      }

      case "unsubscribe": {
        const { id } = message;
        this.streams.delete(id);
        console.log(`Client unsubscribed from ${id}`);
        break;
      }

      case "heartbeat":
        break;
    }
  }

  handleStep() {
    if (this.closed) return;
    const changes: Record<number, unknown> = {};

    for (const [id, source] of this.streams) {
      changes[id] = source.LastChange;
    }

    if (Object.keys(changes).length > 0) {
      this.sendMessage(ServerMessage.delta(changes));
    }
  }

  sendMessage(message: ServerMessage) {
    this.resetHeartbeat();

    if (!this.closed) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (err) {
        console.error("Failed to send message:", err);
        this.close();
      }
    }
  }

  handleDisconnect() {
    console.log("client disconnected");
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.interval);
    try {
      this.ws.close();
    } catch {}
  }
}
