import { z } from "zod";

export const SubscribeMessageSchema = z.object({
  type: z.literal("subscribe"),
  id: z.number(),
  name: z.string(),
  args: z.looseObject({}),
});
export type SubscribeMessage = z.infer<typeof SubscribeMessageSchema>;

export const UnsubscribeMessageSchema = z.object({
  type: z.literal("unsubscribe"),
  id: z.number(),
});
export type UnsubscribeMessage = z.infer<typeof UnsubscribeMessageSchema>;

export const HeartbeatMessageSchema = z.object({
  type: z.literal("heartbeat"),
});
export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;

export const CallMessageSchema = z.object({
  type: z.literal("call"),
  id: z.number(),
  name: z.string(),
  args: z.looseObject({}),
});
export type CallMessage = z.infer<typeof CallMessageSchema>;

export const PresenceMessageSchema = z.object({
  type: z.literal("presence"),
  data: z.looseObject({}),
});
export type PresenceMessage = z.infer<typeof PresenceMessageSchema>;

export const ClientMessageSchema = z.discriminatedUnion("type", [
  SubscribeMessageSchema,
  UnsubscribeMessageSchema,
  HeartbeatMessageSchema,
  CallMessageSchema,
  PresenceMessageSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export function parseClientMessage(data: unknown): ClientMessage {
  return ClientMessageSchema.parse(data);
}

export const ClientMessage = {
  subscribe: (
    id: number,
    name: string,
    args: object,
  ): SubscribeMessage => ({
    type: "subscribe",
    id,
    name,
    args: args as Record<string, unknown>,
  }),
  unsubscribe: (id: number): UnsubscribeMessage => ({
    type: "unsubscribe",
    id,
  }),
  call: (
    id: number,
    name: string,
    args: object,
  ): CallMessage => ({
    type: "call",
    id,
    name,
    args: args as Record<string, unknown>,
  }),
  heartbeat: (): HeartbeatMessage => ({
    type: "heartbeat",
  }),
  presence: (data: object): PresenceMessage => ({
    type: "presence",
    data: data as Record<string, unknown>,
  }),
};
