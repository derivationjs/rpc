import { describe, it, expect } from 'vitest';
import { Graph, ZSet } from 'derivation';
import { ReactiveSetSourceAdapter, ReactiveSetSinkAdapter, sink } from '../reactive-set-adapter';
import * as iso from '../iso';

describe('ReactiveSetSourceAdapter', () => {
  it('should provide snapshot as array of [item, weight] tuples', () => {
    const graph = new Graph();
    let zset = new ZSet<string>();
    zset = zset.add('a', 1).add('b', 2);
    const reactiveSet = graph.inputSet(zset);

    const adapter = new ReactiveSetSourceAdapter(reactiveSet, iso.id<string>());

    const snapshot = adapter.Snapshot as Array<[string, number]>;
    expect(snapshot).toEqual([['a', 1], ['b', 2]]);
  });

  it('should transform elements using isomorphism', () => {
    const graph = new Graph();
    let zset = new ZSet<number>();
    zset = zset.add(1, 2).add(3, 4);
    const reactiveSet = graph.inputSet(zset);

    const numToString: iso.Iso<number, string> = {
      to: (n) => n.toString(),
      from: (s) => parseInt(s, 10),
    };

    const adapter = new ReactiveSetSourceAdapter(reactiveSet, numToString);
    const snapshot = adapter.Snapshot as Array<[string, number]>;

    expect(snapshot).toEqual([['1', 2], ['3', 4]]);
  });

  it('should provide last change after modifications', () => {
    const graph = new Graph();
    const reactiveSet = graph.inputSet(new ZSet<string>());

    const adapter = new ReactiveSetSourceAdapter(reactiveSet, iso.id<string>());

    // Push a change
    let zset = new ZSet<string>();
    zset = zset.add('x', 1);
    reactiveSet.push(zset);
    graph.step();

    const lastChange = adapter.LastChange as Array<[string, number]>;
    expect(lastChange).toEqual([['x', 1]]);
  });

  it('should return the underlying reactive set', () => {
    const graph = new Graph();
    const reactiveSet = graph.inputSet(new ZSet<number>());
    const adapter = new ReactiveSetSourceAdapter(reactiveSet, iso.id<number>());

    expect(adapter.Stream).toBe(reactiveSet);
  });

  it('should handle empty sets', () => {
    const graph = new Graph();
    const reactiveSet = graph.inputSet(new ZSet<string>());
    const adapter = new ReactiveSetSourceAdapter(reactiveSet, iso.id<string>());

    expect(adapter.Snapshot).toEqual([]);
  });
});

describe('ReactiveSetSinkAdapter', () => {
  it('should build a reactive set source', () => {
    const graph = new Graph();
    const adapter = new ReactiveSetSinkAdapter(graph, iso.compose(iso.zset(iso.id<string>()), iso.zsetToArray()), []);

    const source = adapter.build();
    expect(source).toBeDefined();
    expect([...source.snapshot.getEntries()]).toEqual([]);
  });

  it('should apply changes to a reactive set', () => {
    const graph = new Graph();
    const isoComposed = iso.compose(iso.zset(iso.id<string>()), iso.zsetToArray());
    const adapter = new ReactiveSetSinkAdapter(graph, isoComposed, []);
    const source = adapter.build();

    // Apply a change to add items
    const change = [['a', 1], ['b', 2]];
    adapter.apply(change, source);

    graph.step();

    // Check snapshot after change
    const entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual(['a', 1]);
    expect(entries).toContainEqual(['b', 2]);
  });

  it('should transform elements using isomorphism', () => {
    const graph = new Graph();
    const numToString: iso.Iso<number, string> = {
      to: (n) => n.toString(),
      from: (s) => parseInt(s, 10),
    };
    const isoComposed = iso.compose(iso.zset(numToString), iso.zsetToArray());

    const adapter = new ReactiveSetSinkAdapter(graph, isoComposed, []);
    const source = adapter.build();

    // Apply change with string values
    const change = [['5', 1], ['10', 2]];
    adapter.apply(change, source);

    graph.step();

    // Should be converted to numbers
    const entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual([5, 1]);
    expect(entries).toContainEqual([10, 2]);
  });
});

describe('sink function', () => {
  it('should create a sink initialized with snapshot', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<string>());

    const snapshot = [['item1', 1], ['item2', 2]];
    const sinkAdapter = sinkFn(snapshot);
    const source = sinkAdapter.build();

    const entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual(['item1', 1]);
    expect(entries).toContainEqual(['item2', 2]);
  });

  it('should allow applying changes after initialization', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<string>());

    const snapshot = [['a', 1]];
    const sinkAdapter = sinkFn(snapshot);
    const source = sinkAdapter.build();

    // Apply a change
    const change = [['b', 2], ['c', 3]];
    sinkAdapter.apply(change, source);

    graph.step();

    const entries = [...source.snapshot.getEntries()];
    expect(entries.length).toBeGreaterThan(1);
    expect(entries).toContainEqual(['b', 2]);
    expect(entries).toContainEqual(['c', 3]);
  });

  it('should transform snapshot using isomorphism', () => {
    const graph = new Graph();

    const stringToNum: iso.Iso<number, string> = {
      to: (n) => n.toString(),
      from: (s) => parseInt(s, 10),
    };

    const sinkFn = sink(graph, stringToNum);

    // Snapshot with string values
    const snapshot = [['42', 1], ['99', 2]];
    const sinkAdapter = sinkFn(snapshot);
    const source = sinkAdapter.build();

    // Should be converted to numbers
    const entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual([42, 1]);
    expect(entries).toContainEqual([99, 2]);
  });

  it('should handle empty snapshot', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<number>());

    const sinkAdapter = sinkFn([]);
    const source = sinkAdapter.build();

    expect([...source.snapshot.getEntries()]).toEqual([]);
  });

  it('should create new source instances on each build call', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<string>());
    const sinkAdapter = sinkFn([['test', 1]]);

    const source1 = sinkAdapter.build();
    const source2 = sinkAdapter.build();

    // Each build creates a new instance
    expect(source1).not.toBe(source2);
    // But both have the same initial snapshot
    expect([...source1.snapshot.getEntries()]).toEqual([['test', 1]]);
    expect([...source2.snapshot.getEntries()]).toEqual([['test', 1]]);
  });
});
