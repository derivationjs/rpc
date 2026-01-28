import { describe, it, expect } from 'vitest';
import { Queue } from '../queue.js';

describe('Queue', () => {
  it('should start empty', () => {
    const q = new Queue<number>();
    expect(q.isEmpty()).toBe(true);
    expect(q.length).toBe(0);
  });

  it('should push and pop single item', () => {
    const q = new Queue<number>();
    q.push(1);
    expect(q.length).toBe(1);
    expect(q.pop()).toBe(1);
    expect(q.isEmpty()).toBe(true);
  });

  it('should maintain FIFO order', () => {
    const q = new Queue<number>();
    q.push(1);
    q.push(2);
    q.push(3);

    expect(q.pop()).toBe(1);
    expect(q.pop()).toBe(2);
    expect(q.pop()).toBe(3);
    expect(q.pop()).toBe(undefined);
  });

  it('should handle interleaved push and pop', () => {
    const q = new Queue<string>();
    q.push('a');
    q.push('b');
    expect(q.pop()).toBe('a');
    q.push('c');
    expect(q.pop()).toBe('b');
    expect(q.pop()).toBe('c');
    expect(q.isEmpty()).toBe(true);
  });

  it('should reverse front to back when back is empty', () => {
    const q = new Queue<number>();

    // Fill front
    q.push(1);
    q.push(2);
    q.push(3);

    // Pop empties back, triggers reverse
    expect(q.pop()).toBe(1);
    expect(q.pop()).toBe(2);

    // Add more to front
    q.push(4);
    q.push(5);

    // Continue popping - should get 3 (from back), then 4, 5 (after reverse)
    expect(q.pop()).toBe(3);
    expect(q.pop()).toBe(4);
    expect(q.pop()).toBe(5);
    expect(q.isEmpty()).toBe(true);
  });

  it('should handle large number of operations', () => {
    const q = new Queue<number>();
    const n = 1000;

    // Push n items
    for (let i = 0; i < n; i++) {
      q.push(i);
    }
    expect(q.length).toBe(n);

    // Pop n items in order
    for (let i = 0; i < n; i++) {
      expect(q.pop()).toBe(i);
    }
    expect(q.isEmpty()).toBe(true);
  });

  it('should maintain length correctly through operations', () => {
    const q = new Queue<number>();
    expect(q.length).toBe(0);

    q.push(1);
    expect(q.length).toBe(1);

    q.push(2);
    q.push(3);
    expect(q.length).toBe(3);

    q.pop();
    expect(q.length).toBe(2);

    q.pop();
    q.pop();
    expect(q.length).toBe(0);

    q.pop(); // Pop from empty
    expect(q.length).toBe(0);
  });
});
