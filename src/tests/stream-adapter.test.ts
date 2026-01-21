import { describe, it, expect } from 'vitest';
import { Graph, inputValue } from 'derivation';
import { StreamSourceAdapter, StreamSinkAdapter, sink } from '../stream-adapter';
import * as iso from '../iso';

describe('StreamSourceAdapter', () => {
  it('should provide snapshot of the stream value', () => {
    const graph = new Graph();
    const stream = inputValue(graph,{ x: 10, y: 20 });
    const adapter = new StreamSourceAdapter(stream, iso.id());

    expect(adapter.Snapshot).toEqual({ x: 10, y: 20 });
  });

  it('should transform snapshot using isomorphism', () => {
    const graph = new Graph();
    const stream = inputValue(graph,{ count: 42 });

    const countToString: iso.Iso<{ count: number }, object> = {
      to: (obj) => ({ count: obj.count.toString() }),
      from: (obj: any) => ({ count: parseInt(obj.count, 10) }),
    };

    const adapter = new StreamSourceAdapter(stream, countToString);
    expect(adapter.Snapshot).toEqual({ count: '42' });
  });

  it('should provide last change as the current value', () => {
    const graph = new Graph();
    const stream = inputValue(graph,{ a: 1 });
    const adapter = new StreamSourceAdapter(stream, iso.id());

    expect(adapter.LastChange).toEqual({ a: 1 });

    stream.push({ a: 2 });
    graph.step();
    expect(adapter.LastChange).toEqual({ a: 2 });
  });

  it('should return the underlying stream', () => {
    const graph = new Graph();
    const stream = inputValue(graph,{ test: true });
    const adapter = new StreamSourceAdapter(stream, iso.id());

    expect(adapter.Stream).toBe(stream);
  });
});

describe('StreamSinkAdapter', () => {
  it('should apply changes to a stream', () => {
    const graph = new Graph();
    const adapter = new StreamSinkAdapter(graph, iso.id<{ x: number }>(), { x: 0 });
    const { stream, input } = adapter.build();

    adapter.apply({ x: 5 }, input);
    graph.step();
    expect(stream.value).toEqual({ x: 5 });

    adapter.apply({ x: 10 }, input);
    graph.step();
    expect(stream.value).toEqual({ x: 10 });
  });

  it('should transform changes using isomorphism', () => {
    const graph = new Graph();

    const stringToNum: iso.Iso<{ val: number }, object> = {
      to: (obj) => ({ val: obj.val.toString() }),
      from: (obj: any) => ({ val: parseInt(obj.val, 10) }),
    };

    const adapter = new StreamSinkAdapter(graph, stringToNum, { val: '0' });
    const { stream, input } = adapter.build();

    // Apply change with string, should be converted to number
    adapter.apply({ val: '42' }, input);
    graph.step();
    expect(stream.value).toEqual({ val: 42 });
  });

  it('should build a new input stream each time', () => {
    const graph = new Graph();
    const adapter = new StreamSinkAdapter(graph, iso.id<{ id: string }>(), { id: 'test' });

    const { stream: stream1 } = adapter.build();
    const { stream: stream2 } = adapter.build();

    expect(stream1).toBeDefined();
    expect(stream2).toBeDefined();
    expect(stream1).not.toBe(stream2);
  });
});

describe('sink function', () => {
  it('should create a sink that initializes with snapshot', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<{ name: string }>());

    const snapshot = { name: 'initial' };
    const sinkAdapter = sinkFn(snapshot);
    const { stream } = sinkAdapter.build();

    expect(stream.value).toEqual({ name: 'initial' });
  });

  it('should allow applying changes after initialization', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<{ count: number }>());

    const sinkAdapter = sinkFn({ count: 0 });
    const { stream, input } = sinkAdapter.build();

    expect(stream.value).toEqual({ count: 0 });

    sinkAdapter.apply({ count: 5 }, input);
    graph.step();
    expect(stream.value).toEqual({ count: 5 });

    sinkAdapter.apply({ count: 10 }, input);
    graph.step();
    expect(stream.value).toEqual({ count: 10 });
  });

  it('should transform snapshot using isomorphism', () => {
    const graph = new Graph();

    const strToNum: iso.Iso<{ value: number }, object> = {
      to: (obj) => ({ value: obj.value.toString() }),
      from: (obj: any) => ({ value: parseInt(obj.value, 10) }),
    };

    const sinkFn = sink(graph, strToNum);
    const sinkAdapter = sinkFn({ value: '99' });
    const { stream } = sinkAdapter.build();

    // Should be converted from string to number
    expect(stream.value).toEqual({ value: 99 });
  });

  it('should create new stream instances on each build call', () => {
    const graph = new Graph();
    const sinkFn = sink(graph, iso.id<{ data: string }>());
    const sinkAdapter = sinkFn({ data: 'test' });

    const { stream: stream1 } = sinkAdapter.build();
    const { stream: stream2 } = sinkAdapter.build();

    // Each build creates a new instance
    expect(stream1).not.toBe(stream2);
    // But both have the same initial value
    expect(stream1.value).toEqual({ data: 'test' });
    expect(stream2.value).toEqual({ data: 'test' });
  });
});
