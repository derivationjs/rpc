import { describe, it, expect } from 'vitest';
import { Graph } from 'derivation';
import { List } from 'immutable';
import { Reactive, ListOperations, PrimitiveOperations, ChangeInput, type ListCommand } from '@derivation/composable';
import { ReactiveSourceAdapter, ReactiveSinkAdapter, sink } from '../reactive-adapter.js';
import * as iso from '../iso.js';

describe('ReactiveAdapter with List (different snapshot and change types)', () => {
  const snapshotIso: iso.Iso<List<number>, object> = {
    to: (list) => list.toArray(),
    from: (arr) => List(arr as number[]),
  };

  const changeIso: iso.Iso<unknown, object> = {
    to: (cmds) => cmds as object,
    from: (obj) => obj,
  };

  it('should serialize snapshot as array', () => {
    const graph = new Graph();
    const ops = new ListOperations<number>(new PrimitiveOperations<number>());
    const input = new ChangeInput<List<number>>(graph, ops);
    const reactiveList = Reactive.create(graph, ops, input, List([1, 2, 3]));

    const adapter = new ReactiveSourceAdapter(reactiveList, snapshotIso, changeIso);

    expect(adapter.Snapshot).toEqual([1, 2, 3]);
  });

  it('should serialize changes as ListCommand', () => {
    const graph = new Graph();
    const ops = new ListOperations<number>(new PrimitiveOperations<number>());
    const input = new ChangeInput<List<number>>(graph, ops);
    const reactiveList = Reactive.create(graph, ops, input, List([1, 2, 3]));

    const adapter = new ReactiveSourceAdapter(reactiveList, snapshotIso, changeIso);

    const cmd: ListCommand<number>[] = [{ type: 'insert', index: 3, value: 4 }];
    input.push(cmd);
    graph.step();

    const lastChange = adapter.LastChange as ListCommand<number>[];
    expect(lastChange).toEqual([{ type: 'insert', index: 3, value: 4 }]);
    expect(adapter.Snapshot).toEqual([1, 2, 3, 4]);
  });

  it('should return null for empty changes', () => {
    const graph = new Graph();
    const ops = new ListOperations<number>(new PrimitiveOperations<number>());
    const input = new ChangeInput<List<number>>(graph, ops);
    const reactiveList = Reactive.create(graph, ops, input, List<number>());

    const adapter = new ReactiveSourceAdapter(reactiveList, snapshotIso, changeIso);

    expect(adapter.LastChange).toBeNull();
  });

  it('should apply changes via sink adapter', () => {
    const graph = new Graph();
    const ops = new ListOperations<number>(new PrimitiveOperations<number>());

    const adapter = new ReactiveSinkAdapter(graph, snapshotIso, changeIso, ops, [10, 20, 30]);
    const { stream, input } = adapter.build();

    expect(stream.snapshot.toArray()).toEqual([10, 20, 30]);

    const cmd: ListCommand<number>[] = [{ type: 'insert', index: 0, value: 5 }];
    adapter.apply(cmd, input);
    graph.step();

    expect(stream.snapshot.toArray()).toEqual([5, 10, 20, 30]);
  });

  it('should work with sink factory', () => {
    const graph = new Graph();
    const ops = new ListOperations<number>(new PrimitiveOperations<number>());

    const sinkFn = sink(graph, snapshotIso, changeIso, ops);
    const sinkAdapter = sinkFn([1, 2, 3]);
    const { stream, input } = sinkAdapter.build();

    expect(stream.snapshot.toArray()).toEqual([1, 2, 3]);

    const cmd: ListCommand<number>[] = [{ type: 'remove', index: 1 }];
    sinkAdapter.apply(cmd, input);
    graph.step();

    expect(stream.snapshot.toArray()).toEqual([1, 3]);
  });
});
