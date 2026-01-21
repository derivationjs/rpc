import { describe, it, expect } from 'vitest';
import { Record as ImmutableRecord } from 'immutable';
import { ZSet, ZMap } from '@derivation/relational';
import * as iso from '../iso';

describe('iso', () => {
  describe('id', () => {
    it('should return the same value for to and from', () => {
      const identity = iso.id<number>();
      expect(identity.to(42)).toBe(42);
      expect(identity.from(42)).toBe(42);
    });

    it('should work with objects', () => {
      const identity = iso.id<{ x: number }>();
      const obj = { x: 10 };
      expect(identity.to(obj)).toBe(obj);
      expect(identity.from(obj)).toBe(obj);
    });
  });

  describe('unknown', () => {
    it('should convert to unknown and back', () => {
      const unknownIso = iso.unknown<string>();
      expect(unknownIso.to('hello')).toBe('hello');
      expect(unknownIso.from('world')).toBe('world');
    });
  });

  describe('flip', () => {
    it('should reverse the direction of an isomorphism', () => {
      const original: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };
      const flipped = iso.flip(original);

      expect(flipped.to('42')).toBe(42);
      expect(flipped.from(42)).toBe('42');
    });
  });

  describe('compose', () => {
    it('should compose two isomorphisms', () => {
      const numToString: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };
      const stringToUpper: iso.Iso<string, string> = {
        to: (s) => s.toUpperCase(),
        from: (s) => s.toLowerCase(),
      };

      const composed = iso.compose(numToString, stringToUpper);
      expect(composed.to(42)).toBe('42');
      expect(composed.from('42')).toBe(42);
    });
  });

  describe('array', () => {
    it('should map over array elements', () => {
      const numToString: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };
      const arrayIso = iso.array(numToString);

      expect(arrayIso.to([1, 2, 3])).toEqual(['1', '2', '3']);
      expect(arrayIso.from(['1', '2', '3'])).toEqual([1, 2, 3]);
    });

    it('should work with empty arrays', () => {
      const arrayIso = iso.array(iso.id<number>());
      expect(arrayIso.to([])).toEqual([]);
      expect(arrayIso.from([])).toEqual([]);
    });
  });

  describe('zset', () => {
    it('should convert ZSet elements', () => {
      const numToString: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };
      const zsetIso = iso.zset(numToString);

      let inputZSet = new ZSet<number>();
      inputZSet = inputZSet.add(1, 2).add(2, 3);

      const outputZSet = zsetIso.to(inputZSet);
      expect([...outputZSet.getEntries()]).toEqual([['1', 2], ['2', 3]]);

      const roundTrip = zsetIso.from(outputZSet);
      expect([...roundTrip.getEntries()]).toEqual([...inputZSet.getEntries()]);
    });
  });

  describe('zsetToArray', () => {
    it('should convert ZSet to array of [item, weight] tuples', () => {
      const zsetToArrayIso = iso.zsetToArray<string>();

      let zset = new ZSet<string>();
      zset = zset.add('a', 1).add('b', 2);

      const array = zsetToArrayIso.to(zset);
      expect(array).toEqual([['a', 1], ['b', 2]]);

      const backToZSet = zsetToArrayIso.from(array);
      expect([...backToZSet.getEntries()]).toEqual([...zset.getEntries()]);
    });
  });

  describe('object', () => {
    it('should convert object properties', () => {
      const objIso = iso.object({
        x: iso.id<number>(),
        y: iso.id<string>(),
      });

      const result = objIso.to({ x: 42, y: 'hello' });
      expect(result).toEqual({ x: 42, y: 'hello' });

      const reverse = objIso.from({ x: 42, y: 'hello' });
      expect(reverse).toEqual({ x: 42, y: 'hello' });
    });

    it('should transform object properties', () => {
      const numToString: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };

      const objIso = iso.object({
        age: numToString,
        name: iso.id<string>(),
      });

      expect(objIso.to({ age: 30, name: 'Alice' })).toEqual({ age: '30', name: 'Alice' });
      expect(objIso.from({ age: '30', name: 'Alice' })).toEqual({ age: 30, name: 'Alice' });
    });
  });

  describe('shallowRecord', () => {
    it('should convert between Immutable Record and plain object', () => {
      type Person = { name: string; age: number };
      const recordIso = iso.shallowRecord<Person>();

      const plain: Person = { name: 'Bob', age: 25 };
      const record = recordIso.from(plain);

      expect(record.get('name')).toBe('Bob');
      expect(record.get('age')).toBe(25);

      const backToPlain = recordIso.to(record);
      expect(backToPlain).toEqual(plain);
    });
  });

  describe('record', () => {
    it('should convert Immutable Record with property transformations', () => {
      type Person = { name: string; age: number };
      const numToString: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };

      const recordIso = iso.record({
        name: iso.id<string>(),
        age: numToString,
      });

      const plain = { name: 'Charlie', age: 35 };
      const record = recordIso.from(plain);

      expect(record.get('name')).toBe('Charlie');
      expect(record.get('age')).toBe(35);

      const serialized = recordIso.to(record);
      expect(serialized).toEqual({ name: 'Charlie', age: '35' });
    });
  });

  describe('tuple', () => {
    it('should convert tuple elements', () => {
      const numToString: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };

      const tupleIso = iso.tuple(numToString, iso.id<boolean>(), iso.id<string>());

      expect(tupleIso.to([42, true, 'test'])).toEqual(['42', true, 'test']);
      expect(tupleIso.from(['42', true, 'test'])).toEqual([42, true, 'test']);
    });
  });

  describe('map', () => {
    it('should convert Map to array of entries with transformed keys and values', () => {
      const numToString: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };

      const mapIso = iso.map(numToString, iso.id<string>());

      const inputMap = new Map<number, string>([[1, 'one'], [2, 'two']]);
      const array = mapIso.to(inputMap);
      expect(array).toEqual([['1', 'one'], ['2', 'two']]);

      const backToMap = mapIso.from(array);
      expect([...backToMap.entries()]).toEqual([...inputMap.entries()]);
    });
  });

  describe('zmap', () => {
    it('should convert ZMap to array with weights', () => {
      const numToString: iso.Iso<number, string> = {
        to: (n) => n.toString(),
        from: (s) => parseInt(s, 10),
      };

      const zmapIso = iso.zmap(numToString, iso.id<string>());

      let zmap = new ZMap<number, string>();
      zmap = zmap.add(1, 'one', 5).add(2, 'two', 3);

      const array = zmapIso.to(zmap);
      expect(array).toEqual([['1', 'one', 5], ['2', 'two', 3]]);

      const backToZMap = zmapIso.from(array);
      expect([...backToZMap.getEntries()]).toEqual([...zmap.getEntries()]);
    });
  });
});
