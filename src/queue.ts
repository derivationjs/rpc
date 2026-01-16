export class Queue<T> {
  private front: T[] = [];
  private back: T[] = [];

  get length(): number {
    return this.front.length + this.back.length;
  }

  isEmpty(): boolean {
    return this.front.length === 0 && this.back.length === 0;
  }

  push(item: T): void {
    this.front.push(item);
  }

  peek(): T | undefined {
    if (this.back.length === 0) {
      if (this.front.length === 0) {
        return undefined;
      }
      return this.front[0];
    }
    return this.back[this.back.length - 1];
  }

  pop(): T | undefined {
    if (this.back.length === 0) {
      // Reverse front and swap to back
      this.back = this.front.reverse();
      this.front = [];
    }
    return this.back.pop();
  }
}
