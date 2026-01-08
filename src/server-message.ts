import { z } from "zod";

export const HeartbeatMessageSchema = z.object({
  type: z.literal("heartbeat"),
});
export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;

export const SubscribedSchema = z.object({
  type: z.literal("snapshot"),
  id: z.number(),
  snapshot: z.unknown(),
});
export type SubscribedMessage = z.infer<typeof SubscribedSchema>;

export const DeltaMessageSchema = z.object({
  type: z.literal("delta"),
  changes: z.record(z.number(), z.unknown()),
});
export type DeltaMessage = z.infer<typeof DeltaMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  HeartbeatMessageSchema,
  SubscribedSchema,
  DeltaMessageSchema,
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export const ServerMessage = {
  heartbeat: (): HeartbeatMessage => ({
    type: "heartbeat",
  }),
  subscribed: (id: number, snapshot: unknown): SubscribedMessage => ({
    type: "snapshot",
    id,
    snapshot,
  }),
  delta: (changes: Record<string, unknown>): DeltaMessage => ({
    type: "delta",
    changes: changes,
  }),
};
