import { Graph } from "derivation";
import { SharedWorkerClientHandler } from "./shared-worker-client-handler.js";
import WeakList from "./weak-list.js";
import {
  StreamEndpoints,
  MutationEndpoints,
  RPCDefinition,
} from "./stream-types.js";
import { PresenceHandler } from "./presence-manager.js";
import { MessagePortTransport } from "./messageport-transport.js";

export type SharedWorkerServerOptions<
  Defs extends RPCDefinition,
  Ctx = void,
> = {
  streams: StreamEndpoints<Defs["streams"], Ctx>;
  mutations: MutationEndpoints<Defs["mutations"], Ctx>;
  createContext: (port: MessagePort) => Ctx | Promise<Ctx>;
  presenceHandler?: PresenceHandler;
};

/**
 * Set up a SharedWorker server for RPC communication.
 * This creates a shared Graph that all connected tabs can interact with.
 *
 * @example
 * ```typescript
 * // worker.ts
 * const { graph } = setupSharedWorker({
 *   streams: {
 *     todos: async (args, ctx) => new ReactiveSourceAdapter(source, iso),
 *   },
 *   mutations: {
 *     addTodo: async (args, ctx) => ({ success: true, value: newTodo }),
 *   },
 *   createContext: (port) => ({ portId: crypto.randomUUID() }),
 * });
 * ```
 */
export function setupSharedWorker<Defs extends RPCDefinition, Ctx = void>(
  options: SharedWorkerServerOptions<Defs, Ctx>,
  graph: Graph,
) {
  const { streams, mutations, createContext, presenceHandler } = options;

  const clients = new WeakList<SharedWorkerClientHandler<Defs, Ctx>>();

  // After each graph step, broadcast deltas to all connected clients
  graph.afterStep(() => {
    console.log("[SharedWorker] Broadcasting deltas to clients");
    for (const client of clients) {
      client.handleStep();
    }
  });

  // Handle SharedWorker connections
  const globalScope = self as unknown as SharedWorkerGlobalScope;
  globalScope.onconnect = (event: MessageEvent) => {
    console.log("[SharedWorker] New client connecting...");
    const port = event.ports[0];
    const messageBuffer: string[] = [];
    let client: SharedWorkerClientHandler<Defs, Ctx> | null = null;

    // Set up temporary message handler to buffer messages
    const tempMessageHandler = (e: MessageEvent) => {
      console.log("[SharedWorker] Buffering message during setup:", e.data);
      messageBuffer.push(e.data);
    };
    port.onmessage = tempMessageHandler;

    // Create context (handle both sync and async)
    Promise.resolve(createContext(port))
      .then((context) => {
        console.log("[SharedWorker] Context created, setting up client handler");
        // Create transport and client handler
        const transport = new MessagePortTransport(port);
        client = new SharedWorkerClientHandler<Defs, Ctx>(
          transport,
          context,
          streams,
          mutations,
          presenceHandler,
        );
        clients.add(client);
        console.log("[SharedWorker] Client handler registered");

        // Process buffered messages
        console.log(`[SharedWorker] Processing ${messageBuffer.length} buffered messages`);
        for (const msg of messageBuffer) {
          client.handleMessage(msg);
        }
        messageBuffer.length = 0;

        // Start the port
        port.start();
        console.log("[SharedWorker] Client connection ready");
      })
      .catch((err) => {
        console.error("[SharedWorker] Error creating context:", err);
        port.close();
      });
  };
}
