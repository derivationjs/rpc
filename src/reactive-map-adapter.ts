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
  private readonly initialMap: ZMap<K, V>;

  constructor(private readonly graph: Graph, keyIso: Iso<K, unknown>, valueIso: Iso<V, unknown>, snapshot: object) {
    this.iso = zmap(keyIso, valueIso);
    this.initialMap = this.iso.from(snapshot as Array<[K, V, number]>);
  }

  apply(change: object, stream: ReactiveMapSource<K, V>): void {
    const zmapChange = this.iso.from(change);
    for (const [key, value, weight] of zmapChange.getEntries()) {
      stream.add(key, value, weight);
    }
  }

  build(): ReactiveMapSource<K, V> {
    return this.graph.inputMap(this.initialMap);
  }
}

export function sink<K, V>(
  graph: Graph,
  keyIso: Iso<K, unknown>,
  valueIso: Iso<V, unknown>,
): (snapshot: object) => Sink<ReactiveMapSource<K, V>> {
  return (snapshot: object) => {
    return new ReactiveMapSinkAdapter<K, V>(graph, keyIso, valueIso, snapshot);
  };
}
