import { describe, it, expect } from 'vitest';
import {
  ClientMessage,
  CallMessageSchema,
  parseClientMessage,
} from '../client-message.js';
import {
  ServerMessage,
  ResultMessageSchema,
} from '../server-message.js';
import type { MutationResult } from '../stream-types';

describe('Mutation Messages', () => {
  describe('ClientMessage.call', () => {
    it('should create a valid call message', () => {
      const msg = ClientMessage.call(1, 'addUser', { name: 'Alice', age: 30 });

      expect(msg).toEqual({
        type: 'call',
        id: 1,
        name: 'addUser',
        args: { name: 'Alice', age: 30 },
      });
    });

    it('should validate against schema', () => {
      const msg = ClientMessage.call(42, 'myMutation', { x: 10 });
      expect(() => CallMessageSchema.parse(msg)).not.toThrow();
    });

    it('should be parseable by parseClientMessage', () => {
      const data = {
        type: 'call',
        id: 5,
        name: 'updateUser',
        args: { id: 123, name: 'Bob' },
      };

      const result = parseClientMessage(data);
      expect(result).toEqual(data);
      expect(result.type).toBe('call');
    });

    it('should reject call without required fields', () => {
      const invalidData = {
        type: 'call',
        id: 1,
        // missing name and args
      };

      expect(() => parseClientMessage(invalidData)).toThrow();
    });
  });

  describe('ServerMessage.resultSuccess', () => {
    it('should create a valid success result message', () => {
      const value = { userId: 42, status: 'created' };
      const msg = ServerMessage.resultSuccess(1, value);

      expect(msg).toEqual({
        type: 'result',
        id: 1,
        success: true,
        value,
      });
    });

    it('should validate against schema', () => {
      const msg = ServerMessage.resultSuccess(1, { data: 'test' });
      expect(() => ResultMessageSchema.parse(msg)).not.toThrow();
    });

    it('should handle null values', () => {
      const msg = ServerMessage.resultSuccess(1, null);
      expect(msg.value).toBe(null);
      expect(() => ResultMessageSchema.parse(msg)).not.toThrow();
    });

    it('should handle primitive values', () => {
      const msgString = ServerMessage.resultSuccess(1, 'hello');
      expect(msgString.value).toBe('hello');

      const msgNumber = ServerMessage.resultSuccess(2, 42);
      expect(msgNumber.value).toBe(42);

      const msgBoolean = ServerMessage.resultSuccess(3, true);
      expect(msgBoolean.value).toBe(true);
    });
  });

  describe('ServerMessage.resultError', () => {
    it('should create a valid error result message', () => {
      const msg = ServerMessage.resultError(1, 'User not found');

      expect(msg).toEqual({
        type: 'result',
        id: 1,
        success: false,
        error: 'User not found',
      });
    });

    it('should validate against schema', () => {
      const msg = ServerMessage.resultError(1, 'Something went wrong');
      expect(() => ResultMessageSchema.parse(msg)).not.toThrow();
    });

    it('should handle empty error messages', () => {
      const msg = ServerMessage.resultError(1, '');
      expect(msg.error).toBe('');
      expect(() => ResultMessageSchema.parse(msg)).not.toThrow();
    });
  });
});

describe('MutationResult type', () => {
  it('should represent successful results', () => {
    const result: MutationResult<number> = {
      success: true,
      value: 42,
    };

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBe(42);
    }
  });

  it('should represent error results', () => {
    const result: MutationResult<number> = {
      success: false,
      error: 'Failed to compute',
    };

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Failed to compute');
    }
  });

  it('should work with complex types', () => {
    type User = { id: number; name: string };

    const successResult: MutationResult<User> = {
      success: true,
      value: { id: 1, name: 'Alice' },
    };

    const errorResult: MutationResult<User> = {
      success: false,
      error: 'User creation failed',
    };

    expect(successResult.success).toBe(true);
    expect(errorResult.success).toBe(false);
  });
});
