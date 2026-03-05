import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

  // Room state: roomId -> Set of WebSockets
  const rooms = new Map<string, Set<WebSocket>>();
  // Socket metadata: WebSocket -> { roomId, userId, username }
  const socketInfo = new Map<WebSocket, { roomId: string; userId: string; username: string }>();

  wss.on("connection", (ws) => {
    console.log("New connection");

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "join": {
          const { roomId, userId, username } = message;
          
          // Leave previous room if any
          const oldInfo = socketInfo.get(ws);
          if (oldInfo) {
            rooms.get(oldInfo.roomId)?.delete(ws);
          }

          // Join new room
          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Set());
          }
          rooms.get(roomId)!.add(ws);
          socketInfo.set(ws, { roomId, userId, username });

          // Notify others in the room
          rooms.get(roomId)!.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "user-joined",
                userId,
                username
              }));
            }
          });

          // Send current users to the new joiner
          const usersInRoom = Array.from(rooms.get(roomId)!)
            .filter(c => c !== ws)
            .map(c => socketInfo.get(c)!);
          
          ws.send(JSON.stringify({
            type: "room-users",
            users: usersInRoom
          }));

          console.log(`User ${userId} joined room ${roomId}`);
          break;
        }

        case "signal": {
          const { targetId, signal, senderId } = message;
          const info = socketInfo.get(ws);
          if (!info) return;

          // Find target socket
          const targetSocket = Array.from(rooms.get(info.roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
            targetSocket.send(JSON.stringify({
              type: "signal",
              senderId,
              signal
            }));
          }
          break;
        }
      }
    });

    ws.on("close", () => {
      const info = socketInfo.get(ws);
      if (info) {
        const room = rooms.get(info.roomId);
        if (room) {
          room.delete(ws);
          // Notify others
          room.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "user-left",
                userId: info.userId
              }));
            }
          });
          if (room.size === 0) {
            rooms.delete(info.roomId);
          }
        }
        socketInfo.delete(ws);
      }
      console.log("Connection closed");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
