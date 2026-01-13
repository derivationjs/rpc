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

export const ResultMessageSchema = z.object({
  type: z.literal("result"),
  id: z.number(),
  success: z.boolean(),
  value: z.unknown().optional(),
  error: z.string().optional(),
});
export type ResultMessage = z.infer<typeof ResultMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion("type", [
  HeartbeatMessageSchema,
  SubscribedSchema,
  DeltaMessageSchema,
  ResultMessageSchema,
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
  resultSuccess: (id: number, value: unknown): ResultMessage => ({
    type: "result",
    id,
    success: true,
    value,
  }),
  resultError: (id: number, error: string): ResultMessage => ({
    type: "result",
    id,
    success: false,
    error,
  }),
};
