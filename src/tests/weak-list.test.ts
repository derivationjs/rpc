import { describe, it, expect } from 'vitest';
import WeakList from '../weak-list.js';

describe('WeakList', () => {
  it('should store and iterate over objects', () => {
    const list = new WeakList<{ id: number }>();
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const obj3 = { id: 3 };

    list.add(obj1);
    list.add(obj2);
    list.add(obj3);

    const items = [...list];
    expect(items).toHaveLength(3);
    expect(items).toContain(obj1);
    expect(items).toContain(obj2);
    expect(items).toContain(obj3);
  });

  it('should automatically clean up collected references', () => {
    const list = new WeakList<{ id: number }>();

    // Add objects in a scope
    {
      const obj1 = { id: 1 };
      const obj2 = { id: 2 };
      list.add(obj1);
      list.add(obj2);
    }

    // Keep one object alive
    const obj3 = { id: 3 };
    list.add(obj3);

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Iterate - this should clean up dead references
    const items = [...list];

    // obj3 should still be present
    expect(items).toContain(obj3);

    // Note: We can't reliably test that obj1 and obj2 are gone
    // because GC timing is non-deterministic
  });

  it('should handle empty list', () => {
    const list = new WeakList<{ id: number }>();
    const items = [...list];
    expect(items).toHaveLength(0);
  });

  it('should allow multiple iterations', () => {
    const list = new WeakList<{ id: number }>();
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };

    list.add(obj1);
    list.add(obj2);

    const items1 = [...list];
    expect(items1).toHaveLength(2);

    const items2 = [...list];
    expect(items2).toHaveLength(2);
    expect(items2).toEqual(items1);
  });

  it('should work with different object types', () => {
    class MyClass {
      constructor(public value: string) {}
    }

    const list = new WeakList<MyClass>();
    const obj1 = new MyClass('test1');
    const obj2 = new MyClass('test2');

    list.add(obj1);
    list.add(obj2);

    const items = [...list];
    expect(items).toHaveLength(2);
    expect(items[0]).toBeInstanceOf(MyClass);
    expect(items[1]).toBeInstanceOf(MyClass);
  });

  it('should maintain insertion order for live objects', () => {
    const list = new WeakList<{ id: number }>();
    const obj1 = { id: 1 };
    const obj2 = { id: 2 };
    const obj3 = { id: 3 };

    list.add(obj1);
    list.add(obj2);
    list.add(obj3);

    const items = [...list];
    expect(items[0]).toBe(obj1);
    expect(items[1]).toBe(obj2);
    expect(items[2]).toBe(obj3);
  });

  it('should handle adding the same object multiple times', () => {
    const list = new WeakList<{ id: number }>();
    const obj1 = { id: 1 };

    list.add(obj1);
    list.add(obj1);
    list.add(obj1);

    const items = [...list];
    // Should have 3 references to the same object
    expect(items).toHaveLength(3);
    expect(items[0]).toBe(obj1);
    expect(items[1]).toBe(obj1);
    expect(items[2]).toBe(obj1);
  });
});
