import { ZMap, Graph, ReactiveMap, ReactiveMapSource } from "derivation";
import { Source, Sink } from "./stream-types";
import { Iso, zmap } from "./iso";

export class ReactiveMapSourceAdapter<K, V> implements Source<ReactiveMap<K, V>> {
  private readonly iso: Iso<ZMap<K, V>, object>;

  constructor(private readonly map: ReactiveMap<K, V>, keyIso: Iso<K, unknown>, valueIso: Iso<V, unknown>) {
    this.iso = zmap(keyIso, valueIso);
  }

  get Snapshot(): object {
    return this.iso.to(this.map.snapshot);
  }

  get LastChange(): object {
    return this.iso.to(this.map.changes.value);
  }

  get Stream(): ReactiveMap<K, V> {
    return this.map;
  }
}

export class ReactiveMapSinkAdapter<K, V> implements Sink<ReactiveMapSource<K, V>> {
  private readonly iso: Iso<ZMap<K, V>, object>;

  constructor(private readonly graph: Graph, keyIso: Iso<K, unknown>, valueIso: Iso<V, unknown>) {
    this.iso = zmap(keyIso, valueIso);
  }

  apply(change: object, stream: ReactiveMapSource<K, V>): void {
    const zmapChange = this.iso.from(change);
    for (const [key, value, weight] of zmapChange.getEntries()) {
      stream.add(key, value, weight);
    }
  }

  build(): ReactiveMapSource<K, V> {
    return this.graph.inputMap(new ZMap<K, V>());
  }
}

export function sink<K, V>(
  graph: Graph,
  keyIso: Iso<K, unknown>,
  valueIso: Iso<V, unknown>,
): (snapshot: object) => Sink<ReactiveMapSource<K, V>> {
  const wholeIso = zmap(keyIso, valueIso);
  return (snapshot: object) => {
    const initial = wholeIso.from(snapshot as Array<[K, V, number]>);
    const g = graph;
    const adapter = new ReactiveMapSinkAdapter<K, V>(g, keyIso, valueIso);
    const stream = g.inputMap(initial);
    return {
      apply: adapter.apply.bind(adapter),
      build: () => stream,
    };
  };
}
