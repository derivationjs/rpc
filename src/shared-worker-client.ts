import { Graph } from "derivation";
import { Client } from "./client.js";
import { MessagePortTransport } from "./messageport-transport.js";
import { StreamSinks, RPCDefinition } from "./stream-types.js";

/**
 * Create a client connected to a SharedWorker.
 *
 * @example
 * ```typescript
 * // main.ts
 * const graph = new Graph();
 * const worker = new SharedWorker('/worker.js');
 *
 * const client = createSharedWorkerClient(worker.port, {
 *   streams: {
 *     todos: setSink(graph, todoIso),
 *   },
 * }, graph);
 *
 * const todos = await client.run('todos', { filter: 'active' });
 * ```
 */
export function createSharedWorkerClient<Defs extends RPCDefinition>(
  port: MessagePort,
  sinks: StreamSinks<Defs["streams"]>,
  graph: Graph,
): Client<Defs> {
  const transport = new MessagePortTransport(port);
  port.start();
  return new Client<Defs>(transport, sinks, graph);
}
