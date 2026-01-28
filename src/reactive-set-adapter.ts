import { Graph } from "derivation";
import { ZSet, Reactive, ZSetOperations, ZSetChangeInput } from "@derivation/composable";
import { Source, Sink } from "./stream-types.js";
import { Iso, zset, zsetToArray, compose } from "./iso.js";

export class ReactiveSetSourceAdapter<T> implements Source<Reactive<ZSet<T>>> {
  private readonly iso: Iso<ZSet<T>, [unknown, number][]>;

  constructor(
    private readonly set: Reactive<ZSet<T>>,
    iso: Iso<T, unknown>,
  ) {
    this.iso = compose(zset(iso), zsetToArray());
  }

  get Snapshot(): object {
    return this.iso.to(this.set.snapshot);
  }

  get LastChange(): object | null {
    const change = this.iso.to(this.set.changes.value as ZSet<T>);
    if (change.length === 0) return null;
    return change;
  }

  get Stream(): Reactive<ZSet<T>> {
    return this.set;
  }
}

export class ReactiveSetSinkAdapter<T>
  implements Sink<Reactive<ZSet<T>>, ZSetChangeInput<T>>
{
  private readonly initialSet: ZSet<T>;

  constructor(
    private readonly graph: Graph,
    private readonly iso: Iso<ZSet<T>, unknown>,
    snapshot: object,
  ) {
    this.initialSet = iso.from(snapshot as Array<[T, number]>);
  }

  apply(change: object, input: ZSetChangeInput<T>): void {
    input.push(this.iso.from(change as Array<[unknown, number]>));
  }

  build(): { stream: Reactive<ZSet<T>>; input: ZSetChangeInput<T> } {
    const input = new ZSetChangeInput<T>(this.graph);
    const stream = Reactive.create(this.graph, new ZSetOperations<T>(), input, this.initialSet);
    return { stream, input };
  }
}

export function sink<T>(
  graph: Graph,
  iso: Iso<T, unknown>,
): (snapshot: object) => Sink<Reactive<ZSet<T>>, ZSetChangeInput<T>> {
  const wholeIso = compose(zset(iso), zsetToArray());
  return (snapshot: object) => {
    return new ReactiveSetSinkAdapter<T>(graph, wholeIso, snapshot);
  };
}
