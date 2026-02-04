import { Record as ImmutableRecord, RecordOf } from "immutable";
import { List, Set as ImmutableSet, Map as ImmutableMap } from "immutable";

export interface Iso<In, Out> {
  to(x: In): Out;
  from(x: Out): In;
}

export function id<A>(): Iso<A, A> {
  return {
    to: (x: A) => x,
    from: (x: A) => x,
  };
}

export function unknown<A>(): Iso<A, unknown> {
  return {
    to: (x: A) => x,
    from: (x: unknown) => x as A,
  };
}

export function flip<A, B>(iso: Iso<A, B>): Iso<B, A> {
  return {
    to: (x: B) => iso.from(x),
    from: (x: A) => iso.to(x),
  };
}

export function compose<A, B, C>(
  first: Iso<A, B>,
  second: Iso<B, C>,
): Iso<A, C> {
  return {
    to: (x: A) => second.to(first.to(x)),
    from: (x: C) => first.from(second.from(x)),
  };
}

export function array<A, B>(itemIso: Iso<A, B>): Iso<Array<A>, Array<B>> {
  return {
    to: (xs: Array<A>) => xs.map(itemIso.to),
    from: (xs: Array<B>) => xs.map(itemIso.from),
  };
}


export type IsoIn<T> = T extends Iso<infer A, unknown> ? A : never;
export type IsoOut<T> = T extends Iso<unknown, infer B> ? B : never;

type ObjectIsos = Record<string, Iso<unknown, unknown>>;
type ObjectIn<T extends ObjectIsos> = { [K in keyof T]: IsoIn<T[K]> };
type ObjectOut<T extends ObjectIsos> = { [K in keyof T]: IsoOut<T[K]> };

export function object<T extends ObjectIsos>(
  spec: T,
): Iso<ObjectIn<T>, ObjectOut<T>> {
  return {
    to: (x) => {
      const result = {} as ObjectOut<T>;
      for (const key in spec) {
        result[key] = spec[key].to(x[key]) as IsoOut<
          T[Extract<keyof T, string>]
        >;
      }
      return result;
    },
    from: (x) => {
      const result = {} as ObjectIn<T>;
      for (const key in spec) {
        result[key] = spec[key].from(x[key]) as IsoIn<
          T[Extract<keyof T, string>]
        >;
      }
      return result;
    },
  };
}

export function shallowRecord<T extends Record<string, unknown>>(): Iso<
  RecordOf<T>,
  T
> {
  return {
    to: (x: RecordOf<T>): T => x.toObject(),
    from: (x: T): RecordOf<T> => ImmutableRecord<T>(x)(x),
  };
}

export function record<T extends ObjectIsos>(
  spec: T,
): Iso<RecordOf<ObjectIn<T>>, ObjectOut<T>> {
  return compose(shallowRecord(), object(spec));
}

type TupleIsos = Array<Iso<unknown, unknown>>;
type TupleIn<T extends TupleIsos> = { [K in keyof T]: IsoIn<T[K]> };
type TupleOut<T extends TupleIsos> = { [K in keyof T]: IsoOut<T[K]> };

export function tuple<T extends TupleIsos>(
  ...isos: T
): Iso<TupleIn<T>, TupleOut<T>> {
  return {
    to: (x) => x.map((xi, i) => isos[i].to(xi)) as TupleOut<T>,
    from: (x) => x.map((xi, i) => isos[i].from(xi)) as TupleIn<T>,
  };
}

export function map<K, V, K2, V2>(
  keyIso: Iso<K, K2>,
  valueIso: Iso<V, V2>,
): Iso<Map<K, V>, Array<[K2, V2]>> {
  return {
    to: (m) => [...m.entries()].map(([k, v]) => [keyIso.to(k), valueIso.to(v)]),
    from: (entries) =>
      new Map(entries.map(([k, v]) => [keyIso.from(k), valueIso.from(v)])),
  };
}


/**
 * A shallow isomorphism between an Immutable.js List and a standard Array.
 */
export function shallowList<A>(): Iso<List<A>, Array<A>> {
  return {
    to: (x: List<A>): Array<A> => x.toArray(),
    from: (x: Array<A>): List<A> => List(x),
  };
}

/**
 * A deep isomorphism that converts a List to an Array and
 * applies an itemIso to every element.
 */
export function list<A, B>(itemIso: Iso<A, B>): Iso<List<A>, Array<B>> {
  return compose(shallowList<A>(), array(itemIso));
}

/**
 * Deep conversion: ImmutableSet<A> <-> Array<B>
 * Note: Converting to Array is usually safer for serialization than native Set.
 */
export function immutableSet<A, B>(
  itemIso: Iso<A, B>,
): Iso<ImmutableSet<A>, Array<B>> {
  return {
    to: (xs: ImmutableSet<A>) => xs.toArray().map(itemIso.to),
    from: (xs: Array<B>) => ImmutableSet(xs.map(itemIso.from)),
  };
}

/**
 * Deep conversion: ImmutableMap<K, V> <-> Array<[K2, V2]>
 */
export function immutableMap<K, V, K2, V2>(
  keyIso: Iso<K, K2>,
  valueIso: Iso<V, V2>,
): Iso<ImmutableMap<K, V>, Array<[K2, V2]>> {
  const entryIso = tuple(keyIso, valueIso);
  return {
    to: (m) =>
      m
        .entrySeq()
        .toArray()
        .map((e) => entryIso.to([...e] as [K, V])),
    from: (entries) => {
      return ImmutableMap(entries.map((e) => entryIso.from(e)));
    },
  };
}
