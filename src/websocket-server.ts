import { parse } from "url";
import { Server } from "http";
import { WebSocketServer } from "ws";
import { ClientHandler } from "./client-handler";
import WeakList from "./weak-list";
import { StreamEndpoints, StreamDefinitions } from "./stream-types";
import { Graph } from "derivation";

export function setupWebSocketServer<Defs extends StreamDefinitions>(graph: Graph, server: Server, endpoints: StreamEndpoints<Defs>, path = "/api/ws") {
  const clients = new WeakList<ClientHandler<StreamDefinitions>>();
  graph.afterStep(() => {
    for (const client of clients) {
      client.handleStep();
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket connections for reactive streams
  wss.on("connection", (ws, req) => {
    const { pathname } = parse(req.url || "/", true);
    if (pathname === path) {
      const client = new ClientHandler<StreamDefinitions>(ws, endpoints);
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
