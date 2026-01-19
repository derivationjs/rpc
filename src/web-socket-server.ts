import { parse } from "url";
import { Server, IncomingMessage } from "http";
import { WebSocketServer, WebSocket, RawData } from "ws";
import { ClientHandler } from "./client-handler";
import WeakList from "./weak-list";
import { StreamEndpoints, MutationEndpoints, RPCDefinition } from "./stream-types";
import { Graph } from "derivation";
import { PresenceHandler } from "./presence-manager";
import { NodeWebSocketTransport } from "./node-web-socket-transport";

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
      const messageBuffer: RawData[] = [];
      let client: ClientHandler<Defs, Ctx> | null = null;

      // Set up temporary message handler to buffer messages
      const tempMessageHandler = (msg: RawData) => {
        messageBuffer.push(msg);
      };
      ws.on("message", tempMessageHandler);

      // Create context (handle both sync and async)
      Promise.resolve(createContext(ws, req))
        .then((context) => {
          // Remove temporary handler
          ws.removeListener("message", tempMessageHandler);

          // Create transport and client handler
          const transport = new NodeWebSocketTransport(ws);
          client = new ClientHandler<Defs, Ctx>(
            transport,
            context,
            streamEndpoints,
            mutationEndpoints,
            presenceHandler,
          );
          clients.add(client);

          // Process buffered messages
          for (const msg of messageBuffer) {
            client.handleMessage(msg.toString());
          }
          messageBuffer.length = 0;
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
