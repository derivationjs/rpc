// Main index only exports isomorphic code that works in both browser and Node.js
export * from "./client.js";
export * from "./stream-types.js";
export {
  ReactiveSourceAdapter,
  ReactiveSinkAdapter,
  sink as reactiveSink,
} from "./reactive-adapter.js";
export {
  StreamSourceAdapter,
  StreamSinkAdapter,
  sink as streamSink,
} from "./stream-adapter.js";
export type { Transport } from "./transport.js";
export type { PresenceHandler } from "./presence-manager.js";
