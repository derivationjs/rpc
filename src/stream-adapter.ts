import { Graph, ReactiveValue, Input } from "derivation";
import { Source, Sink } from "./stream-types";
import { Iso } from "./iso";

export class StreamSourceAdapter<T extends object> implements Source<ReactiveValue<T>> {
  private readonly iso: Iso<T, object>;

  constructor(private readonly stream: ReactiveValue<T>, iso: Iso<T, object>) {
    this.iso = iso;
  }

  get Snapshot(): object {
    return this.iso.to(this.stream.value);
  }

  get LastChange(): object {
    return this.iso.to(this.stream.value);
  }

  get Stream(): ReactiveValue<T> {
    return this.stream;
  }
}

export class StreamSinkAdapter<T extends object> implements Sink<Input<T>> {
  private readonly graph: Graph;
  private readonly iso: Iso<T, object>;

  constructor(graph: Graph, iso: Iso<T, object>) {
    this.graph = graph;
    this.iso = iso;
  }

  apply(change: object, stream: Input<T>): void {
    stream.push(this.iso.from(change));
  }

  build(): Input<T> {
    return this.graph.inputValue({} as T);
  }
}

export function sink<T extends object>(graph: Graph, iso: Iso<T, object>): (snapshot: object) => Sink<Input<T>> {
  return (snapshot: object) => {
    const g = graph;
    const adapter = new StreamSinkAdapter<T>(g, iso);
    const initialValue = iso.from(snapshot);
    const input = g.inputValue(initialValue);
    return {
      apply: adapter.apply.bind(adapter),
      build: () => input,
    };
  };
}
