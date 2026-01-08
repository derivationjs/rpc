import { ClientMessage } from "./client-message";
import { ServerMessage } from "./server-message";
import type { Graph } from "derivation";
import type { Sink, StreamDefinitions, StreamSinks } from "./stream-types";

function changer<T extends object>(
  sink: Sink<T>,
  stream: WeakRef<T>,
): (change: object) => void {
  return (change) => {
    const s = stream.deref();
    if (s) {
      sink.apply(change, s);
    }
  };
}

export class Client<Defs extends StreamDefinitions> {
  private nextId = 1;
  private pending = new Map<number, (snapshot: object) => void>();
  private activeStreams = new Map<number, (change: object) => void>();
  private registry = new FinalizationRegistry<[number, string]>(
    ([id, name]) => {
      console.log(`🧹 Stream ${id} (${name}) collected — unsubscribing`);
      this.send(ClientMessage.unsubscribe(id));
      this.activeStreams.delete(id);
    },
  );

  constructor(
    private ws: WebSocket,
    private sinks: StreamSinks<Defs>,
    private graph: Graph,
  ) {
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      this.handleMessage(message);
    };
  }

  private handleMessage(message: ServerMessage) {
    switch (message.type) {
      case "snapshot": {
        const resolve = this.pending.get(message.id);
        if (resolve) {
          resolve(message.snapshot as object);
          this.pending.delete(message.id);
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
            console.log(`🧹 Sink ${id} GC’d — auto-unsubscribing`);
            this.send(ClientMessage.unsubscribe(id));
            this.activeStreams.delete(id);
          }
        }
        this.graph.step();
        break;
      }
      case "heartbeat":
        break;
    }
  }

  private send(message: ClientMessage) {
    this.ws.send(JSON.stringify(message));
  }

  async run<Key extends keyof Defs>(
    key: Key,
    args: Defs[Key]["args"],
  ): Promise<Defs[Key]["returnType"]> {
    console.log(
      `Running stream ${String(key)} with args ${JSON.stringify(args)}`,
    );
    const id = this.nextId++;

    this.send(ClientMessage.subscribe(id, String(key), args));

    const snapshot = await new Promise<object>((resolve) => {
      this.pending.set(id, resolve);
    });

    const endpoint = this.sinks[key];
    const sink = endpoint(snapshot);
    const stream = sink.build();
    const ref = new WeakRef(stream);
    this.activeStreams.set(id, changer(sink, ref));
    this.registry.register(stream, [id, String(key)]);

    return stream;
  }
}
