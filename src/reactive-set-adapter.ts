import { ZSet, Graph, ReactiveSet, ReactiveSetSource } from "derivation";
import { Source, Sink } from "./stream-types";
import { Iso, zset, zsetToArray, compose } from "./iso";

export class ReactiveSetSourceAdapter<T> implements Source<ReactiveSet<T>> {
  private readonly iso: Iso<ZSet<T>, Array<[unknown, number]>>;

  constructor(private readonly set: ReactiveSet<T>, iso: Iso<T, unknown>) {
    this.iso = compose(zset(iso), zsetToArray());
  }

  get Snapshot(): object {
    return this.iso.to(this.set.snapshot);
  }

  get LastChange(): object {
    return this.iso.to(this.set.changes.value)
  }

  get Stream(): ReactiveSet<T> {
    return this.set;
  }
}

export class ReactiveSetSinkAdapter<T> implements Sink<ReactiveSetSource<T>> {
  private readonly initialSet: ZSet<T>;

  constructor(private readonly graph: Graph, private readonly iso: Iso<ZSet<T>, unknown>, snapshot: object) {
    this.initialSet = iso.from(snapshot as Array<[T, number]>);
  }

  apply(change: object, stream: ReactiveSetSource<T>): void {
    stream.push(this.iso.from(change as Array<[unknown, number]>));
  }

  build(): ReactiveSetSource<T> {
    return this.graph.inputSet(this.initialSet);
  }
}

export function sink<T>(graph: Graph, iso: Iso<T, unknown>): (snapshot: object) => Sink<ReactiveSetSource<T>> {
  const wholeIso = compose(zset(iso), zsetToArray());
  return (snapshot: object) => {
    return new ReactiveSetSinkAdapter<T>(graph, wholeIso, snapshot);
  };
}
