export interface PresenceHandler {
  add(value: Record<string, unknown>): void;
  remove(value: Record<string, unknown>): void;
  update(oldValue: Record<string, unknown>, newValue: Record<string, unknown>): void;
}
