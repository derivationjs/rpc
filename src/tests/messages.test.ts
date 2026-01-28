import { describe, it, expect } from 'vitest';
import {
  ClientMessage,
  parseClientMessage,
  SubscribeMessageSchema,
  UnsubscribeMessageSchema,
  HeartbeatMessageSchema as ClientHeartbeatMessageSchema,
} from '../client-message.js';
import {
  ServerMessage,
  HeartbeatMessageSchema as ServerHeartbeatMessageSchema,
  SubscribedSchema,
  DeltaMessageSchema,
} from '../server-message.js';

describe('ClientMessage', () => {
  describe('subscribe', () => {
    it('should create a valid subscribe message', () => {
      const msg = ClientMessage.subscribe(1, 'testStream', { foo: 'bar' });

      expect(msg).toEqual({
        type: 'subscribe',
        id: 1,
        name: 'testStream',
        args: { foo: 'bar' },
      });
    });

    it('should validate against schema', () => {
      const msg = ClientMessage.subscribe(42, 'myStream', { x: 10 });
      expect(() => SubscribeMessageSchema.parse(msg)).not.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('should create a valid unsubscribe message', () => {
      const msg = ClientMessage.unsubscribe(5);

      expect(msg).toEqual({
        type: 'unsubscribe',
        id: 5,
      });
    });

    it('should validate against schema', () => {
      const msg = ClientMessage.unsubscribe(99);
      expect(() => UnsubscribeMessageSchema.parse(msg)).not.toThrow();
    });
  });

  describe('heartbeat', () => {
    it('should create a valid heartbeat message', () => {
      const msg = ClientMessage.heartbeat();

      expect(msg).toEqual({
        type: 'heartbeat',
      });
    });

    it('should validate against schema', () => {
      const msg = ClientMessage.heartbeat();
      expect(() => ClientHeartbeatMessageSchema.parse(msg)).not.toThrow();
    });
  });

  describe('parseClientMessage', () => {
    it('should parse valid subscribe messages', () => {
      const data = {
        type: 'subscribe',
        id: 1,
        name: 'stream1',
        args: { key: 'value' },
      };

      const result = parseClientMessage(data);
      expect(result).toEqual(data);
      expect(result.type).toBe('subscribe');
    });

    it('should parse valid unsubscribe messages', () => {
      const data = {
        type: 'unsubscribe',
        id: 10,
      };

      const result = parseClientMessage(data);
      expect(result).toEqual(data);
      expect(result.type).toBe('unsubscribe');
    });

    it('should parse valid heartbeat messages', () => {
      const data = {
        type: 'heartbeat',
      };

      const result = parseClientMessage(data);
      expect(result).toEqual(data);
      expect(result.type).toBe('heartbeat');
    });

    it('should reject invalid messages', () => {
      const invalidData = {
        type: 'invalid',
        foo: 'bar',
      };

      expect(() => parseClientMessage(invalidData)).toThrow();
    });

    it('should reject subscribe without required fields', () => {
      const invalidData = {
        type: 'subscribe',
        id: 1,
        // missing name and args
      };

      expect(() => parseClientMessage(invalidData)).toThrow();
    });

    it('should reject unsubscribe without id', () => {
      const invalidData = {
        type: 'unsubscribe',
      };

      expect(() => parseClientMessage(invalidData)).toThrow();
    });
  });
});

describe('ServerMessage', () => {
  describe('heartbeat', () => {
    it('should create a valid heartbeat message', () => {
      const msg = ServerMessage.heartbeat();

      expect(msg).toEqual({
        type: 'heartbeat',
      });
    });

    it('should validate against schema', () => {
      const msg = ServerMessage.heartbeat();
      expect(() => ServerHeartbeatMessageSchema.parse(msg)).not.toThrow();
    });
  });

  describe('subscribed', () => {
    it('should create a valid subscribed message with snapshot', () => {
      const snapshot = { data: [1, 2, 3] };
      const msg = ServerMessage.subscribed(7, snapshot);

      expect(msg).toEqual({
        type: 'snapshot',
        id: 7,
        snapshot,
      });
    });

    it('should validate against schema', () => {
      const msg = ServerMessage.subscribed(1, { foo: 'bar' });
      expect(() => SubscribedSchema.parse(msg)).not.toThrow();
    });

    it('should handle null snapshot', () => {
      const msg = ServerMessage.subscribed(1, null);
      expect(msg.snapshot).toBe(null);
      expect(() => SubscribedSchema.parse(msg)).not.toThrow();
    });
  });

  describe('delta', () => {
    it('should create a valid delta message', () => {
      const changes = {
        1: { add: ['a', 'b'] },
        2: { remove: ['c'] },
      };
      const msg = ServerMessage.delta(changes);

      expect(msg).toEqual({
        type: 'delta',
        changes,
      });
    });

    it('should validate against schema', () => {
      const msg = ServerMessage.delta({ 1: { x: 10 }, 2: { y: 20 } });
      expect(() => DeltaMessageSchema.parse(msg)).not.toThrow();
    });

    it('should handle empty changes', () => {
      const msg = ServerMessage.delta({});
      expect(msg.changes).toEqual({});
      expect(() => DeltaMessageSchema.parse(msg)).not.toThrow();
    });
  });
});
