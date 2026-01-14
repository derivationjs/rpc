import {
  ZMap,
  Graph,
  ReactiveMap,
  ReactiveMapSource,
  ZMapChangeInput,
} from "derivation";
import { Source, Sink } from "./stream-types";
import { Iso, zmap } from "./iso";

export class ReactiveMapSourceAdapter<K, V>
  implements Source<ReactiveMap<K, V>>
{
  private readonly iso: Iso<ZMap<K, V>, [unknown, unknown, unknown][]>;

  constructor(
    private readonly map: ReactiveMap<K, V>,
    keyIso: Iso<K, unknown>,
    valueIso: Iso<V, unknown>,
  ) {
    this.iso = zmap(keyIso, valueIso);
  }

  get Snapshot(): object {
    return this.iso.to(this.map.snapshot);
  }

  get LastChange(): object | null {
    const change = this.iso.to(this.map.changes.value);
    if (change.length === 0) return null;
    return change;
  }

  get Stream(): ReactiveMap<K, V> {
    return this.map;
  }
}

export class ReactiveMapSinkAdapter<K, V>
  implements Sink<ReactiveMapSource<K, V>, ZMapChangeInput<K, V>>
{
  private readonly iso: Iso<ZMap<K, V>, object>;
  private readonly initialMap: ZMap<K, V>;

  constructor(
    private readonly graph: Graph,
    keyIso: Iso<K, unknown>,
    valueIso: Iso<V, unknown>,
    snapshot: object,
  ) {
    this.iso = zmap(keyIso, valueIso);
    this.initialMap = this.iso.from(snapshot as Array<[K, V, number]>);
  }

  apply(change: object, input: ZMapChangeInput<K, V>): void {
    const zmapChange = this.iso.from(change);
    for (const [key, value, weight] of zmapChange.getEntries()) {
      input.add(key, value, weight);
    }
  }

  build(): { stream: ReactiveMapSource<K, V>; input: ZMapChangeInput<K, V> } {
    const stream = this.graph.inputMap(this.initialMap);
    return { stream, input: stream.changes as ZMapChangeInput<K, V> };
  }
}

export function sink<K, V>(
  graph: Graph,
  keyIso: Iso<K, unknown>,
  valueIso: Iso<V, unknown>,
): (snapshot: object) => Sink<ReactiveMapSource<K, V>, ZMapChangeInput<K, V>> {
  return (snapshot: object) => {
    return new ReactiveMapSinkAdapter<K, V>(graph, keyIso, valueIso, snapshot);
  };
}
