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
 *     todos: async (args, ctx) => new ReactiveSetSourceAdapter(source),
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
    for (const client of clients) {
      client.handleStep();
    }
  });

  // Handle SharedWorker connections
  const globalScope = self as unknown as SharedWorkerGlobalScope;
  globalScope.onconnect = (event: MessageEvent) => {
    const port = event.ports[0];
    const messageBuffer: string[] = [];
    let client: SharedWorkerClientHandler<Defs, Ctx> | null = null;

    // Set up temporary message handler to buffer messages
    const tempMessageHandler = (e: MessageEvent) => {
      messageBuffer.push(e.data);
    };
    port.onmessage = tempMessageHandler;

    // Create context (handle both sync and async)
    Promise.resolve(createContext(port))
      .then((context) => {
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

        // Process buffered messages
        for (const msg of messageBuffer) {
          client.handleMessage(msg);
        }
        messageBuffer.length = 0;

        // Start the port
        port.start();
      })
      .catch((err) => {
        console.error("Error creating context:", err);
        port.close();
      });
  };
}
