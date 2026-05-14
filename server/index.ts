import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initWebSocket } from "./websocket.js";
import { initHttp } from "./http.js";
import { UserManager } from "./managers/userManager.js";
import { RoomManager } from "./managers/roomManager.js";
import { SocketManager } from "./managers/socketManager.js";
import { SnapshotManager } from "./services/snapshotManager.service.js";
import { EventBus } from "./services/eventBus.service.js";
import { PersistenceService } from "./services/persistence.service.js";
import { RoomActorManager } from "./services/roomActorManager.service.js";

dotenv.config();

async function startServer() {
  const app = express();
  const server = createServer(app);
  const PORT = parseInt(process.env.PORT || "3002", 10) || 3002;
  const distPath = path.join(process.cwd(), "dist");

  // Initialize Event Bus
  const eventBus = new EventBus();

  // Initialize managers with Event Bus
  const persistence = new PersistenceService();
  const data = await persistence.loadData();

  const userManager = new UserManager(eventBus);
  const roomManager = new RoomManager(eventBus);
  const socketManager = new SocketManager(eventBus);

  // Initialize Snapshot Manager
  const snapshotManager = new SnapshotManager(persistence, userManager, roomManager, eventBus);

  // Initialize Room Actor Manager (for race condition prevention)
  const roomActorManager = new RoomActorManager(roomManager, socketManager);

  // Load data into managers
  Object.entries(data.users).forEach(([username, userData]) => {
    userManager.setUser(username, userData as any);
  });

  Object.entries(data.roomOwners).forEach(([roomId, owner]) => {
    const tag = data.roomTags[roomId] || roomId;
    const settings = data.roomSettings[roomId] || { autoAccept: false, autoReject: false };
    const ownerKey = data.roomOwnerKeys[roomId];
    roomManager.createRoom(roomId, owner, tag, ownerKey);
    roomManager.setSettings(roomId, settings);
  });

  // Setup HTTP APIs
  initHttp(app, userManager, roomManager, persistence, snapshotManager);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Setup static files
    app.use(express.static(distPath));
    // SPA Fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // Setup WebSocket
  initWebSocket(server, roomManager, userManager, socketManager, persistence, snapshotManager, roomActorManager);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
