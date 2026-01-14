export class RateLimiter {
  private timestamps: bigint[] = [];
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

    // Remove expired timestamps from front
    const cutoff = now - this.windowNanos;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }

    // Return true if we've exceeded the limit
    return this.timestamps.length > this.maxOccurrences;
  }
}
