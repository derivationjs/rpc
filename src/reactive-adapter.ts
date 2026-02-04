import { Graph } from "derivation";
import {
  Reactive,
  ChangeInput,
  Changes,
  OperationsBase,
  Operations,
  asBase,
} from "@derivation/composable";
import { Source, Sink } from "./stream-types.js";
import { Iso } from "./iso.js";

export class ReactiveSourceAdapter<T> implements Source<Reactive<T>> {
  constructor(
    private readonly stream: Reactive<T>,
    private readonly snapshotIso: Iso<T, object>,
    private readonly changeIso: Iso<Changes<T>, object>,
  ) {}

  get Snapshot(): object {
    return this.snapshotIso.to(this.stream.snapshot);
  }

  get LastChange(): object | null {
    const change = this.stream.changes.value;
    if (asBase(this.stream.operations).isEmpty(change)) return null;
    return this.changeIso.to(change);
  }

  get Stream(): Reactive<T> {
    return this.stream;
  }
}

export class ReactiveSinkAdapter<T>
  implements Sink<Reactive<T>, ChangeInput<T>>
{
  private readonly initialValue: T;

  constructor(
    private readonly graph: Graph,
    snapshotIso: Iso<T, object>,
    private readonly changeIso: Iso<Changes<T>, object>,
    private readonly ops: Operations<T>,
    snapshot: object,
  ) {
    this.initialValue = snapshotIso.from(snapshot);
  }

  apply(change: object, input: ChangeInput<T>): void {
    input.push(this.changeIso.from(change));
  }

  build(): { stream: Reactive<T>; input: ChangeInput<T> } {
    const ops = this.ops;
    const input = new ChangeInput<T>(this.graph, ops);
    const stream = Reactive.create(this.graph, ops, input, this.initialValue);
    return { stream, input };
  }
}

export function sink<T>(
  graph: Graph,
  snapshotIso: Iso<T, object>,
  changeIso: Iso<Changes<T>, object>,
  ops: Operations<T>,
): (snapshot: object) => Sink<Reactive<T>, ChangeInput<T>> {
  return (snapshot: object) => {
    return new ReactiveSinkAdapter<T>(
      graph,
      snapshotIso,
      changeIso,
      ops,
      snapshot,
    );
  };
}
