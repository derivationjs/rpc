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

    // Add current timestamp
    this.timestamps.push(now);

    // Remove expired timestamps from front (O(1) amortized with Queue)
    const cutoff = now - this.windowNanos;
    while (!this.timestamps.isEmpty()) {
      const oldest = this.timestamps.peek();
      if (oldest === undefined || oldest >= cutoff) {
        // Not expired, stop
        break;
      }
      // Otherwise, oldest was expired, remove it
      this.timestamps.pop();
    }

    // Return true if we've exceeded the limit
    return this.timestamps.length > this.maxOccurrences;
  }
}
