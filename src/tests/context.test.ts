import { describe, it, expect, beforeEach } from 'vitest';
import { createServer, IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { Graph, Input } from 'derivation';
import { setupWebSocketServer, StreamSourceAdapter, StreamEndpoints, MutationEndpoints, type RPCDefinition, type MutationResult } from '../index';
import { id } from '../iso';

// Define test context type
type TestContext = {
  userId: string;
  role: 'user' | 'admin';
};

// Define test RPC
type TestRPCDefinition = RPCDefinition & {
  streams: {
    testStream: {
      args: {};
      returnType: Input<{ value: string }>;
      sinkType: Input<{ value: string }>;
      inputType: Input<{ value: string }>;
    };
  };
  mutations: {
    testMutation: {
      args: { input: string };
      result: { output: string; userId: string; role: string };
    };
  };
};

describe('Context', () => {
  let server: ReturnType<typeof createServer>;
  let graph: Graph;
  let port: number;
  let receivedContexts: TestContext[] = [];

  beforeEach((ctx) => {
    return new Promise<void>((resolve) => {
      graph = new Graph();
      server = createServer();
      receivedContexts = [];

      // Create test endpoints that capture context
      const streamEndpoints: StreamEndpoints<TestRPCDefinition['streams'], TestContext> = {
        testStream: async (args, ctx) => {
          receivedContexts.push(ctx);
          const input = graph.inputValue({ value: `Hello from ${ctx.userId}` });
          return new StreamSourceAdapter(input, id());
        },
      };

      const mutationEndpoints: MutationEndpoints<TestRPCDefinition['mutations'], TestContext> = {
        testMutation: async ({ input }, ctx): Promise<MutationResult<{ output: string; userId: string; role: string }>> => {
          receivedContexts.push(ctx);
          return {
            success: true,
            value: {
              output: `Processed: ${input}`,
              userId: ctx.userId,
              role: ctx.role,
            },
          };
        },
      };

      // Setup server with createContext
      setupWebSocketServer<TestRPCDefinition, TestContext>(
        graph,
        server,
        streamEndpoints,
        mutationEndpoints,
        {
          createContext: (ws, req) => {
            // Parse userId from query params
            const url = new URL(req.url!, `http://${req.headers.host}`);
            const userId = url.searchParams.get('userId') || 'anonymous';
            const role = url.searchParams.get('role') as 'user' | 'admin' || 'user';

            return { userId, role };
          },
        }
      );

      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          port = addr.port;
          resolve();
        }
      });
    });
  });

  it('should pass context to stream endpoints', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/api/ws?userId=test-user&role=admin`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          id: 1,
          name: 'testStream',
          args: {},
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'snapshot') {
          expect(receivedContexts).toHaveLength(1);
          expect(receivedContexts[0]).toEqual({
            userId: 'test-user',
            role: 'admin',
          });
          ws.close();
          resolve();
        }
      });
    });

    server.close();
  });

  it('should pass context to mutation endpoints', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/api/ws?userId=alice&role=user`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'call',
          id: 1,
          name: 'testMutation',
          args: { input: 'test data' },
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'result') {
          expect(msg.success).toBe(true);
          expect(msg.value).toEqual({
            output: 'Processed: test data',
            userId: 'alice',
            role: 'user',
          });

          expect(receivedContexts).toHaveLength(1);
          expect(receivedContexts[0]).toEqual({
            userId: 'alice',
            role: 'user',
          });

          ws.close();
          resolve();
        }
      });
    });

    server.close();
  });

  it('should use default context when no query params', async () => {
    const ws = new WebSocket(`ws://localhost:${port}/api/ws`);

    await new Promise<void>((resolve) => {
      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          id: 1,
          name: 'testStream',
          args: {},
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'snapshot') {
          expect(receivedContexts).toHaveLength(1);
          expect(receivedContexts[0]).toEqual({
            userId: 'anonymous',
            role: 'user',
          });
          ws.close();
          resolve();
        }
      });
    });

    server.close();
  });

  it('should create separate context for each connection', async () => {
    const ws1 = new WebSocket(`ws://localhost:${port}/api/ws?userId=user1`);
    const ws2 = new WebSocket(`ws://localhost:${port}/api/ws?userId=user2`);

    const contexts = await Promise.all([
      new Promise<TestContext>((resolve) => {
        ws1.on('open', () => {
          ws1.send(JSON.stringify({
            type: 'call',
            id: 1,
            name: 'testMutation',
            args: { input: 'from user1' },
          }));
        });

        ws1.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'result') {
            ws1.close();
            resolve({ userId: msg.value.userId, role: msg.value.role });
          }
        });
      }),
      new Promise<TestContext>((resolve) => {
        ws2.on('open', () => {
          ws2.send(JSON.stringify({
            type: 'call',
            id: 1,
            name: 'testMutation',
            args: { input: 'from user2' },
          }));
        });

        ws2.on('message', (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'result') {
            ws2.close();
            resolve({ userId: msg.value.userId, role: msg.value.role });
          }
        });
      }),
    ]);

    expect(contexts[0]).toEqual({ userId: 'user1', role: 'user' });
    expect(contexts[1]).toEqual({ userId: 'user2', role: 'user' });
    expect(receivedContexts).toHaveLength(2);

    server.close();
  });

  it('should handle async createContext and process messages', async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Create new server with async context creation
    const newServer = createServer();
    const newGraph = new Graph();
    let capturedContext: TestContext | null = null;

    const streamEndpoints: StreamEndpoints<TestRPCDefinition['streams'], TestContext> = {
      testStream: async (args, ctx) => {
        capturedContext = ctx;
        const input = newGraph.inputValue({ value: 'test' });
        return new StreamSourceAdapter(input, id());
      },
    };

    const mutationEndpoints: MutationEndpoints<TestRPCDefinition['mutations'], TestContext> = {
      testMutation: async ({ input }, ctx) => ({
        success: true,
        value: { output: input, userId: ctx.userId, role: ctx.role },
      }),
    };

    setupWebSocketServer<TestRPCDefinition, TestContext>(
      newGraph,
      newServer,
      streamEndpoints,
      mutationEndpoints,
      {
        createContext: async (ws, req) => {
          // Simulate async auth validation (e.g., database lookup)
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { userId: 'async-user', role: 'admin' };
        },
      }
    );

    const newPort = await new Promise<number>((resolve) => {
      newServer.listen(0, () => {
        const addr = newServer.address();
        if (addr && typeof addr === 'object') {
          resolve(addr.port);
        }
      });
    });

    const ws = new WebSocket(`ws://localhost:${newPort}/api/ws`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Test timed out - async context creation may have race condition'));
      }, 2000);

      ws.on('open', () => {
        // Send subscribe message immediately - this tests if async context works
        ws.send(JSON.stringify({
          type: 'subscribe',
          id: 1,
          name: 'testStream',
          args: {},
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'snapshot') {
          clearTimeout(timeout);

          // Verify the async context was actually used
          expect(capturedContext).not.toBeNull();
          expect(capturedContext?.userId).toBe('async-user');
          expect(capturedContext?.role).toBe('admin');

          ws.close();
          newServer.close(() => resolve());
        }
      });

      ws.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });
});
