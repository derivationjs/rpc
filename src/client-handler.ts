import { parseClientMessage, ClientMessage } from "./client-message.js";
import { ServerMessage } from "./server-message.js";
import {
  Source,
  StreamEndpoints,
  MutationEndpoints,
  RPCDefinition,
} from "./stream-types.js";
import { RateLimiter } from "./rate-limiter.js";
import { PresenceHandler } from "./presence-manager.js";
import { Transport } from "./transport.js";

export class ClientHandler<Defs extends RPCDefinition, Ctx = void> {
  private readonly transport: Transport;
  private readonly context: Ctx;
  private readonly streamEndpoints: StreamEndpoints<Defs["streams"], Ctx>;
  private readonly mutationEndpoints: MutationEndpoints<Defs["mutations"], Ctx>;
  private readonly presenceHandler?: PresenceHandler;
  private currentPresence?: Record<string, unknown>;
  private closed = false;
  private readonly streams = new Map<number, Source<unknown>>();
  private heartbeatTimeout: NodeJS.Timeout | undefined;
  private inactivityTimeout: NodeJS.Timeout | undefined;
  private readonly rateLimiter: RateLimiter;

  constructor(
    transport: Transport,
    context: Ctx,
    streamEndpoints: StreamEndpoints<Defs["streams"], Ctx>,
    mutationEndpoints: MutationEndpoints<Defs["mutations"], Ctx>,
    presenceHandler?: PresenceHandler,
  ) {
    this.transport = transport;
    this.context = context;
    this.streamEndpoints = streamEndpoints;
    this.mutationEndpoints = mutationEndpoints;
    this.presenceHandler = presenceHandler;
    this.rateLimiter = new RateLimiter(100, 300); // 100 messages over 5 minutes

    console.log("new client connected");

    // Set up transport handlers
    this.transport.onMessage((data: string) => this.handleMessage(data));
    this.transport.onClose(() => this.handleDisconnect());

    this.resetHeartbeat();
    this.resetInactivity();
  }

  private resetHeartbeat() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
      this.sendMessage(ServerMessage.heartbeat());
    }, 10_000);
  }

  private resetInactivity() {
    if (this.inactivityTimeout) {
      clearTimeout(this.inactivityTimeout);
    }

    this.inactivityTimeout = setTimeout(() => {
      this.close();
    }, 30_000);
  }

  handleMessage(message: string) {
    this.resetInactivity();

    // Check rate limit
    if (this.rateLimiter.trigger()) {
      console.log("Rate limit exceeded, closing connection");
      this.close();
      return;
    }

    let data: object;
    try {
      data = JSON.parse(message);
    } catch {
      console.error("Invalid JSON received:", message);
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

  async handleClientMessage(message: ClientMessage) {
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
          const source = await endpoint(
            args as Defs["streams"][keyof Defs["streams"]]["args"],
            this.context,
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

        endpoint(
          args as Defs["mutations"][keyof Defs["mutations"]]["args"],
          this.context,
        )
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

      case "presence": {
        if (!this.presenceHandler) {
          console.error("Presence not configured");
          this.close();
          return;
        }

        const { data } = message;

        if (this.currentPresence !== undefined) {
          this.presenceHandler.update(this.currentPresence, data);
        } else {
          this.presenceHandler.add(data);
        }

        this.currentPresence = data;
        break;
      }
    }
  }

  handleStep() {
    if (this.closed) return;
    const changes: Record<number, unknown> = {};

    for (const [id, source] of this.streams) {
      const change = source.LastChange;
      if (change === null) continue;
      changes[id] = change;
    }

    if (Object.keys(changes).length > 0) {
      this.sendMessage(ServerMessage.delta(changes));
    }
  }

  sendMessage(message: ServerMessage) {
    this.resetHeartbeat();

    if (!this.closed) {
      // Check buffer if available (WebSocket provides this, MessagePort doesn't)
      if (
        this.transport.bufferedAmount !== undefined &&
        this.transport.bufferedAmount > 100 * 1024
      ) {
        console.log("Send buffer exceeded 100KB, closing connection");
        this.close();
        return;
      }

      try {
        this.transport.send(JSON.stringify(message));
      } catch (err) {
        console.error("Failed to send message:", err);
        this.close();
      }
    }
  }

  private handleDisconnect() {
    console.log("client disconnected");
    this.close();
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.heartbeatTimeout);
    clearTimeout(this.inactivityTimeout);

    if (this.presenceHandler && this.currentPresence !== undefined) {
      this.presenceHandler.remove(this.currentPresence);
    }

    try {
      this.transport.close();
    } catch {}
  }
}
