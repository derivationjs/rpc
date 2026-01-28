import { Graph } from "derivation";
import { ZMap, Reactive, ZMapOperations, ZMapChangeInput } from "@derivation/composable";
import { Source, Sink } from "./stream-types.js";
import { Iso, zmap } from "./iso.js";

export class ReactiveMapSourceAdapter<K, V>
  implements Source<Reactive<ZMap<K, V>>>
{
  private readonly iso: Iso<ZMap<K, V>, [unknown, unknown, unknown][]>;

  constructor(
    private readonly map: Reactive<ZMap<K, V>>,
    keyIso: Iso<K, unknown>,
    valueIso: Iso<V, unknown>,
  ) {
    this.iso = zmap(keyIso, valueIso);
  }

  get Snapshot(): object {
    return this.iso.to(this.map.snapshot);
  }

  get LastChange(): object | null {
    const change = this.iso.to(this.map.changes.value as ZMap<K, V>);
    if (change.length === 0) return null;
    return change;
  }

  get Stream(): Reactive<ZMap<K, V>> {
    return this.map;
  }
}

export class ReactiveMapSinkAdapter<K, V>
  implements Sink<Reactive<ZMap<K, V>>, ZMapChangeInput<K, V>>
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

  build(): { stream: Reactive<ZMap<K, V>>; input: ZMapChangeInput<K, V> } {
    const input = new ZMapChangeInput<K, V>(this.graph);
    const stream = Reactive.create(this.graph, new ZMapOperations<K, V>(), input, this.initialMap);
    return { stream, input };
  }
}

export function sink<K, V>(
  graph: Graph,
  keyIso: Iso<K, unknown>,
  valueIso: Iso<V, unknown>,
): (snapshot: object) => Sink<Reactive<ZMap<K, V>>, ZMapChangeInput<K, V>> {
  return (snapshot: object) => {
    return new ReactiveMapSinkAdapter<K, V>(graph, keyIso, valueIso, snapshot);
  };
}
