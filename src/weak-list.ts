export default class WeakList<T extends object> implements Iterable<T> {
  private items: WeakRef<T>[] = [];

  add(value: T): void {
    this.items.push(new WeakRef(value));
  }

  *[Symbol.iterator](): Iterator<T> {
    const newItems: WeakRef<T>[] = [];

    for (const ref of this.items) {
      const value = ref.deref();
      if (value !== undefined) {
        yield value;
        newItems.push(ref);
      }
    }

    this.items = newItems;
  }
}
