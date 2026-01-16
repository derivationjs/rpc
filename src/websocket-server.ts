import { parse } from "url";
import { Server, IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { ClientHandler } from "./client-handler";
import WeakList from "./weak-list";
import { StreamEndpoints, MutationEndpoints, RPCDefinition } from "./stream-types";
import { Graph } from "derivation";
import { PresenceHandler } from "./presence-manager";

export type WebSocketServerOptions<Ctx> = {
  createContext: (ws: WebSocket, req: IncomingMessage) => Ctx | Promise<Ctx>;
  presenceHandler?: PresenceHandler;
  path?: string;
};

export function setupWebSocketServer<Defs extends RPCDefinition, Ctx = void>(
  graph: Graph,
  server: Server,
  streamEndpoints: StreamEndpoints<Defs["streams"], Ctx>,
  mutationEndpoints: MutationEndpoints<Defs["mutations"], Ctx>,
  options: WebSocketServerOptions<Ctx>,
) {
  const { createContext, presenceHandler, path = "/api/ws" } = options;
  const clients = new WeakList<ClientHandler<Defs, Ctx>>();

  graph.afterStep(() => {
    for (const client of clients) {
      client.handleStep();
    }
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 100 * 1024 });

  // Handle WebSocket connections for reactive streams
  wss.on("connection", (ws, req) => {
    const { pathname } = parse(req.url || "/", true);
    if (pathname === path) {
      let client: ClientHandler<Defs, Ctx> | null = null;
      const messageBuffer: any[] = [];

      // Set up message handler immediately to buffer messages
      ws.on("message", (msg) => {
        if (client) {
          client.handleMessage(msg);
        } else {
          // Buffer messages until context is created
          messageBuffer.push(msg);
        }
      });

      // Create context (handle both sync and async)
      Promise.resolve(createContext(ws, req))
        .then((context) => {
          client = new ClientHandler<Defs, Ctx>(
            ws,
            context,
            streamEndpoints,
            mutationEndpoints,
            presenceHandler,
          );
          clients.add(client);

          // Process buffered messages
          for (const msg of messageBuffer) {
            client.handleMessage(msg);
          }
          messageBuffer.length = 0;

          ws.on("close", () => client?.handleDisconnect());
        })
        .catch((err) => {
          console.error("Error creating context:", err);
          ws.close();
        });
    }
  });

  // Handle HTTP upgrade (for /api/ws)
  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "/", true);

    if (pathname === "/api/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });
}
