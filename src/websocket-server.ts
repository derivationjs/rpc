import { parse } from "url";
import { Server } from "http";
import { WebSocketServer } from "ws";
import { ClientHandler } from "./client-handler";
import WeakList from "./weak-list";
import { StreamEndpoints, MutationEndpoints, RPCDefinition } from "./stream-types";
import { Graph } from "derivation";
import { PresenceHandler } from "./presence-manager";

export function setupWebSocketServer<Defs extends RPCDefinition>(
  graph: Graph,
  server: Server,
  streamEndpoints: StreamEndpoints<Defs["streams"]>,
  mutationEndpoints: MutationEndpoints<Defs["mutations"]>,
  presenceHandler?: PresenceHandler,
  path = "/api/ws",
) {
  const clients = new WeakList<ClientHandler<Defs>>();
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
      const client = new ClientHandler<Defs>(ws, streamEndpoints, mutationEndpoints, presenceHandler);
      clients.add(client);
      ws.on("message", (msg) => client.handleMessage(msg));
      ws.on("close", () => client.handleDisconnect());
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
