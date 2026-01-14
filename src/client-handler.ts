import { RawData, WebSocket } from "ws";
import { parseClientMessage, ClientMessage } from "./client-message";
import { ServerMessage } from "./server-message";
import {
  Source,
  StreamEndpoints,
  MutationEndpoints,
  RPCDefinition,
} from "./stream-types";

export class ClientHandler<Defs extends RPCDefinition> {
  private readonly ws: WebSocket;
  private readonly streamEndpoints: StreamEndpoints<Defs["streams"]>;
  private readonly mutationEndpoints: MutationEndpoints<Defs["mutations"]>;
  private closed = false;
  private readonly streams = new Map<number, Source<unknown>>();
  private heartbeatTimeout: NodeJS.Timeout | undefined;

  constructor(
    ws: WebSocket,
    streamEndpoints: StreamEndpoints<Defs["streams"]>,
    mutationEndpoints: MutationEndpoints<Defs["mutations"]>,
  ) {
    this.ws = ws;
    this.streamEndpoints = streamEndpoints;
    this.mutationEndpoints = mutationEndpoints;

    console.log("new client connected");

    this.resetHeartbeat();
  }

  private resetHeartbeat() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
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

        if (!(name in this.streamEndpoints)) {
          console.error(`Unknown stream: ${name}`);
          this.close();
          return;
        }

        const endpoint = this.streamEndpoints[name as keyof Defs["streams"]];

        try {
          const source = endpoint(
            args as Defs["streams"][keyof Defs["streams"]]["args"],
          );
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

      case "call": {
        const { id, name, args } = message;

        if (!(name in this.mutationEndpoints)) {
          console.error(`Unknown mutation: ${name}`);
          this.close();
          return;
        }

        const endpoint =
          this.mutationEndpoints[name as keyof Defs["mutations"]];

        endpoint(args as Defs["mutations"][keyof Defs["mutations"]]["args"])
          .then((result) => {
            if (result.success) {
              this.sendMessage(ServerMessage.resultSuccess(id, result.value));
              console.log(
                `Mutation \"${name}\" (${id}) completed successfully`,
              );
            } else {
              this.sendMessage(ServerMessage.resultError(id, result.error));
              console.log(
                `Mutation \"${name}\" (${id}) returned error: ${result.error}`,
              );
            }
          })
          .catch((err) => {
            console.error(
              `Unhandled exception in mutation \"${name}\" (${id}):`,
              err,
            );
            this.close();
          });
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
    clearTimeout(this.heartbeatTimeout);
    try {
      this.ws.close();
    } catch {}
  }
}
