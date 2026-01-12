import { describe, it, expect } from 'vitest';
import { Graph, ZMap } from 'derivation';
import { ReactiveMapSourceAdapter, ReactiveMapSinkAdapter, sink } from '../reactive-map-adapter';
import * as iso from '../iso';

describe('ReactiveMapSourceAdapter', () => {
  it('should provide snapshot as array of [key, value, weight] tuples', () => {
    const graph = new Graph();
    let zmap = new ZMap<string, number>();
    zmap = zmap.add('a', 1, 10).add('b', 2, 20);
    const reactiveMap = graph.inputMap(zmap);

    const adapter = new ReactiveMapSourceAdapter(
      reactiveMap,
      iso.id<string>(),
      iso.id<number>()
    );

    const snapshot = adapter.Snapshot as Array<[string, number, number]>;
    expect(snapshot).toEqual([['a', 1, 10], ['b', 2, 20]]);
  });

  it('should transform keys and values using isomorphisms', () => {
    const graph = new Graph();
    let zmap = new ZMap<number, number>();
    zmap = zmap.add(1, 10, 5).add(2, 20, 15);
    const reactiveMap = graph.inputMap(zmap);

    const numToString: iso.Iso<number, string> = {
      to: (n) => n.toString(),
      from: (s) => parseInt(s, 10),
    };

    const adapter = new ReactiveMapSourceAdapter(
      reactiveMap,
      numToString,
      numToString
    );

    const snapshot = adapter.Snapshot as Array<[string, string, number]>;
    expect(snapshot).toEqual([['1', '10', 5], ['2', '20', 15]]);
  });

  it('should provide last change after modifications', () => {
    const graph = new Graph();
    const reactiveMap = graph.inputMap(new ZMap<string, string>());

    const adapter = new ReactiveMapSourceAdapter(
      reactiveMap,
      iso.id<string>(),
      iso.id<string>()
    );

    // Push a change
    let zmap = new ZMap<string, string>();
    zmap = zmap.add('key', 'value', 1);
    reactiveMap.add('key', 'value', 1);
    graph.step();

    const lastChange = adapter.LastChange as Array<[string, string, number]>;
    expect(lastChange).toEqual([['key', 'value', 1]]);
  });

  it('should return the underlying reactive map', () => {
    const graph = new Graph();
    const reactiveMap = graph.inputMap(new ZMap<string, number>());

    const adapter = new ReactiveMapSourceAdapter(
      reactiveMap,
      iso.id<string>(),
      iso.id<number>()
    );

    expect(adapter.Stream).toBe(reactiveMap);
  });

  it('should handle empty maps', () => {
    const graph = new Graph();
    const reactiveMap = graph.inputMap(new ZMap<string, string>());

    const adapter = new ReactiveMapSourceAdapter(
      reactiveMap,
      iso.id<string>(),
      iso.id<string>()
    );

    expect(adapter.Snapshot).toEqual([]);
  });
});

describe('ReactiveMapSinkAdapter', () => {
  it('should build a reactive map source', () => {
    const graph = new Graph();
    const adapter = new ReactiveMapSinkAdapter(
      graph,
      iso.id<string>(),
      iso.id<number>(),
      []
    );

    const source = adapter.build();
    expect(source).toBeDefined();
    expect([...source.snapshot.getEntries()]).toEqual([]);
  });

  it('should apply changes to a reactive map', () => {
    const graph = new Graph();
    const adapter = new ReactiveMapSinkAdapter(
      graph,
      iso.id<string>(),
      iso.id<number>(),
      []
    );
    const source = adapter.build();

    // Apply changes
    const change = [['a', 1, 5], ['b', 2, 10]];
    adapter.apply(change, source);

    graph.step();

    // Check snapshot
    const entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual(['a', 1, 5]);
    expect(entries).toContainEqual(['b', 2, 10]);
  });

  it('should transform keys and values using isomorphisms', () => {
    const graph = new Graph();

    const strToNum: iso.Iso<number, string> = {
      to: (n) => n.toString(),
      from: (s) => parseInt(s, 10),
    };

    const adapter = new ReactiveMapSinkAdapter(graph, strToNum, strToNum, []);
    const source = adapter.build();

    // Apply change with string keys and values
    const change = [['5', '10', 1], ['15', '20', 2]];
    adapter.apply(change, source);

    graph.step();

    // Should be converted to numbers
    const entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual([5, 10, 1]);
    expect(entries).toContainEqual([15, 20, 2]);
  });

  it('should handle adding entries with different weights', () => {
    const graph = new Graph();
    const adapter = new ReactiveMapSinkAdapter(
      graph,
      iso.id<string>(),
      iso.id<string>(),
      []
    );
    const source = adapter.build();

    // Add same key with different weights
    adapter.apply([['key', 'value1', 5]], source);
    graph.step();

    adapter.apply([['key', 'value2', 3]], source);
    graph.step();

    const entries = [...source.snapshot.getEntries()];
    // Should contain both entries with their weights
    expect(entries.length).toBeGreaterThan(0);
  });
});

describe('sink function', () => {
  it('should create a sink initialized with snapshot', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<string>(), iso.id<number>());

    const snapshot = [['a', 1, 10], ['b', 2, 20]];
    const sinkAdapter = sinkFn(snapshot);
    const source = sinkAdapter.build();

    const entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual(['a', 1, 10]);
    expect(entries).toContainEqual(['b', 2, 20]);
  });

  it('should allow applying changes after initialization', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<string>(), iso.id<string>());

    const snapshot = [['x', 'y', 1]];
    const sinkAdapter = sinkFn(snapshot);
    const source = sinkAdapter.build();

    // Initial check
    let entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual(['x', 'y', 1]);

    // Apply a change
    const change = [['a', 'b', 2], ['c', 'd', 3]];
    sinkAdapter.apply(change, source);

    graph.step();

    entries = [...source.snapshot.getEntries()];
    expect(entries.length).toBeGreaterThan(1);
    expect(entries).toContainEqual(['a', 'b', 2]);
    expect(entries).toContainEqual(['c', 'd', 3]);
  });

  it('should transform snapshot using isomorphisms', () => {
    const graph = new Graph();

    const strToNum: iso.Iso<number, string> = {
      to: (n) => n.toString(),
      from: (s) => parseInt(s, 10),
    };

    const sinkFn = sink(graph, strToNum, strToNum);

    // Snapshot with string keys and values
    const snapshot = [['10', '20', 5], ['30', '40', 10]];
    const sinkAdapter = sinkFn(snapshot);
    const source = sinkAdapter.build();

    // Should be converted to numbers
    const entries = [...source.snapshot.getEntries()];
    expect(entries).toContainEqual([10, 20, 5]);
    expect(entries).toContainEqual([30, 40, 10]);
  });

  it('should handle empty snapshot', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<string>(), iso.id<number>());

    const sinkAdapter = sinkFn([]);
    const source = sinkAdapter.build();

    expect([...source.snapshot.getEntries()]).toEqual([]);
  });

  it('should create new source instances on each build call', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<string>(), iso.id<number>());
    const sinkAdapter = sinkFn([['test', 1, 1]]);

    const source1 = sinkAdapter.build();
    const source2 = sinkAdapter.build();

    // Each build creates a new instance
    expect(source1).not.toBe(source2);
    // But both have the same initial snapshot
    expect([...source1.snapshot.getEntries()]).toEqual([['test', 1, 1]]);
    expect([...source2.snapshot.getEntries()]).toEqual([['test', 1, 1]]);
  });

  it('should work with complex key and value types', () => {
    const graph = new Graph();

    type ComplexKey = { id: number };
    type ComplexValue = { data: string };

    const keyIso = iso.object({
      id: iso.id<number>(),
    });

    const valueIso = iso.object({
      data: iso.id<string>(),
    });

    const sinkFn = sink(graph, keyIso, valueIso);

    const snapshot = [
      [{ id: 1 }, { data: 'first' }, 5],
      [{ id: 2 }, { data: 'second' }, 10],
    ];

    const sinkAdapter = sinkFn(snapshot);
    const source = sinkAdapter.build();

    const entries = [...source.snapshot.getEntries()];
    expect(entries.length).toBe(2);
    expect(entries[0][0]).toEqual({ id: 1 });
    expect(entries[0][1]).toEqual({ data: 'first' });
    expect(entries[0][2]).toBe(5);
  });
});
