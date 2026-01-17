import { Queue } from "./queue.js";

export class RateLimiter {
  private readonly timestamps = new Queue<bigint>();
  private readonly maxOccurrences: number;
  private readonly windowNanos: bigint;

  constructor(maxOccurrences: number, windowSeconds: number) {
    this.maxOccurrences = maxOccurrences;
    this.windowNanos = BigInt(windowSeconds) * BigInt(1_000_000_000);
  }

  trigger(): boolean {
    const now = process.hrtime.bigint();

    const cutoff = now - this.windowNanos;
    while (!this.timestamps.isEmpty()) {
      const oldest = this.timestamps.peek();
      if (oldest === undefined || oldest >= cutoff) {
        break;
      }
      this.timestamps.pop();
    }

    if (this.timestamps.length >= this.maxOccurrences) {
      return true;
    }

    this.timestamps.push(now);

    return false;
  }
}
