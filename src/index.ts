// Main index only exports isomorphic code that works in both browser and Node.js
export * from "./client.js";
export * from "./stream-types.js";
export {
  ReactiveSetSourceAdapter,
  ReactiveSetSinkAdapter,
  sink as setSink,
} from "./reactive-set-adapter.js";
export {
  ReactiveMapSourceAdapter,
  ReactiveMapSinkAdapter,
  sink as mapSink,
} from "./reactive-map-adapter.js";
export {
  StreamSourceAdapter,
  StreamSinkAdapter,
  sink as streamSink,
} from "./stream-adapter.js";
export type { Transport } from "./transport.js";
export type { PresenceHandler } from "./presence-manager.js";
