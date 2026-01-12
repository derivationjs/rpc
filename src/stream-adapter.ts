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

export class StreamSinkAdapter<T extends object> implements Sink<Input<T>, Input<T>> {
  private readonly graph: Graph;
  private readonly iso: Iso<T, object>;
  private readonly initialValue: T;

  constructor(graph: Graph, iso: Iso<T, object>, snapshot: object) {
    this.graph = graph;
    this.iso = iso;
    this.initialValue = iso.from(snapshot);
  }

  apply(change: object, input: Input<T>): void {
    input.push(this.iso.from(change));
  }

  build(): { stream: Input<T>; input: Input<T> } {
    const stream = this.graph.inputValue(this.initialValue);
    return { stream, input: stream };
  }
}

export function sink<T extends object>(graph: Graph, iso: Iso<T, object>): (snapshot: object) => Sink<Input<T>, Input<T>> {
  return (snapshot: object) => {
    return new StreamSinkAdapter<T>(graph, iso, snapshot);
  };
}
