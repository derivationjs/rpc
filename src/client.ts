import { ClientMessage } from "./client-message";
import { ServerMessage } from "./server-message";
import type { Graph } from "derivation";
import type {
  Sink,
  StreamSinks,
  RPCDefinition,
  MutationResult,
} from "./stream-types";

function changer<T extends object, I extends object>(
  sink: Sink<T, I>,
  input: WeakRef<I>,
): (change: object) => void {
  return (change) => {
    const i = input.deref();
    if (i) {
      sink.apply(change, i);
    }
  };
}

export class Client<Defs extends RPCDefinition> {
  private nextId = 1;
  private pendingStreams = new Map<number, (snapshot: object) => void>();
  private pendingMutations = new Map<
    number,
    (result: MutationResult<unknown>) => void
  >();
  private activeStreams = new Map<number, (change: object) => void>();
  private heartbeatTimeout: NodeJS.Timeout | undefined;

  private registry = new FinalizationRegistry<[number, string]>(
    ([id, name]) => {
      console.log(`🧹 Stream ${id} (${name}) collected — unsubscribing`);
      this.sendMessage(ClientMessage.unsubscribe(id));
      this.activeStreams.delete(id);
    },
  );

  private resetHeartbeat() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(() => {
      this.sendMessage(ClientMessage.heartbeat());
    }, 10_000);
  }

  constructor(
    private ws: WebSocket,
    private sinks: StreamSinks<Defs["streams"]>,
    private graph: Graph,
  ) {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      this.ws.send(JSON.stringify(message));
    };
    this.resetHeartbeat();
  }

  private handleMessage(message: ServerMessage) {
    switch (message.type) {
      case "snapshot": {
        const resolve = this.pendingStreams.get(message.id);
        if (resolve) {
          resolve(message.snapshot as object);
          this.pendingStreams.delete(message.id);
        }
        break;
      }
      case "delta": {
        for (const [idStr, change] of Object.entries(message.changes)) {
          const id = Number(idStr);
          const sink = this.activeStreams.get(id);

          if (sink && change && typeof change === "object") {
            sink(change);
          } else if (!sink) {
            console.log(`🧹 Sink ${id} GC'd — auto-unsubscribing`);
            this.sendMessage(ClientMessage.unsubscribe(id));
            this.activeStreams.delete(id);
          }
        }
        this.graph.step();
        break;
      }
      case "result": {
        const resolve = this.pendingMutations.get(message.id);
        if (resolve) {
          if (message.success) {
            resolve({ success: true, value: message.value });
          } else {
            resolve({
              success: false,
              error: message.error || "Unknown error",
            });
          }
          this.pendingMutations.delete(message.id);
        }
        break;
      }
      case "heartbeat":
        break;
    }
  }

  private sendMessage(message: ClientMessage) {
    this.resetHeartbeat();
    this.ws.send(JSON.stringify(message));
  }

  async run<Key extends keyof Defs["streams"]>(
    key: Key,
    args: Defs["streams"][Key]["args"],
  ): Promise<Defs["streams"][Key]["returnType"]> {
    console.log(
      `Running stream ${String(key)} with args ${JSON.stringify(args)}`,
    );
    const id = this.nextId++;

    this.sendMessage(ClientMessage.subscribe(id, String(key), args));

    const snapshot = await new Promise<object>((resolve) => {
      this.pendingStreams.set(id, resolve);
    });

    const endpoint = this.sinks[key];
    const sinkAdapter = endpoint(snapshot);
    const { stream, input } = sinkAdapter.build();
    const inputRef = new WeakRef(input);
    this.activeStreams.set(id, changer(sinkAdapter, inputRef));
    this.registry.register(input, [id, String(key)]);

    return stream;
  }

  async call<Key extends keyof Defs["mutations"]>(
    key: Key,
    args: Defs["mutations"][Key]["args"],
  ): Promise<MutationResult<Defs["mutations"][Key]["result"]>> {
    console.log(
      `Calling mutation ${String(key)} with args ${JSON.stringify(args)}`,
    );
    const id = this.nextId++;

    this.sendMessage(
      ClientMessage.call(id, String(key), args as Record<string, unknown>),
    );

    const result = await new Promise<
      MutationResult<Defs["mutations"][Key]["result"]>
    >((resolve) => {
      this.pendingMutations.set(
        id,
        resolve as (result: MutationResult<unknown>) => void,
      );
    });

    return result;
  }
}
