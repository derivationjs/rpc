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

export const ClientMessageSchema = z.discriminatedUnion("type", [
  SubscribeMessageSchema,
  UnsubscribeMessageSchema,
  HeartbeatMessageSchema,
  CallMessageSchema,
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export function parseClientMessage(data: unknown): ClientMessage {
  return ClientMessageSchema.parse(data);
}

export const ClientMessage = {
  subscribe: (
    id: number,
    name: string,
    args: Record<string, unknown>,
  ): SubscribeMessage => ({
    type: "subscribe",
    id,
    name,
    args,
  }),
  unsubscribe: (id: number): UnsubscribeMessage => ({
    type: "unsubscribe",
    id,
  }),
  call: (
    id: number,
    name: string,
    args: Record<string, unknown>,
  ): CallMessage => ({
    type: "call",
    id,
    name,
    args,
  }),
  heartbeat: (): HeartbeatMessage => ({
    type: "heartbeat",
  }),
};
