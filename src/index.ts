// Main index only exports isomorphic code that works in both browser and Node.js
export * from "./client";
export * from "./stream-types";
export {
  ReactiveSetSourceAdapter,
  ReactiveSetSinkAdapter,
  sink as setSink,
} from "./reactive-set-adapter";
export {
  ReactiveMapSourceAdapter,
  ReactiveMapSinkAdapter,
  sink as mapSink,
} from "./reactive-map-adapter";
export {
  StreamSourceAdapter,
  StreamSinkAdapter,
  sink as streamSink,
} from "./stream-adapter";
export type { Transport } from "./transport";
export type { PresenceHandler } from "./presence-manager";
