import { WebSocketServer } from "ws";
import { Server } from "http";
import { handleMessage } from "./handlers/message.router.js";
import { RoomManager } from "./managers/roomManager.js";
import { UserManager } from "./managers/userManager.js";
import { SocketManager } from "./managers/socketManager.js";
import { PersistenceService } from "./services/persistence.service.js";
import { SnapshotManager } from "./services/snapshotManager.service.js";
import { HeartbeatService } from "./services/heartbeat.service.js";
import { RateLimiter } from "./services/rateLimiter.service.js";
import { RoomActorManager } from "./services/roomActorManager.service.js";

export function initWebSocket(server: Server, roomManager: RoomManager, userManager: UserManager, socketManager: SocketManager, persistence: PersistenceService, snapshotManager: SnapshotManager, roomActorManager: RoomActorManager) {
  const wss = new WebSocketServer({ server });
  const heartbeat = new HeartbeatService();
  const rateLimiter = new RateLimiter();

  wss.on("connection", (ws) => {
    // Register for heartbeat monitoring
    heartbeat.register(ws, (deadSocket) => {
      console.log("Dead socket detected, closing...");
      deadSocket.close(1000, "Dead connection");
    });

    ws.on("pong", () => {
      // Acknowledge pong from heartbeat
      heartbeat.pong(ws);
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const messageType = msg.type || "unknown";

        // Check rate limiting
        if (!rateLimiter.check(ws, messageType)) {
          ws.send(JSON.stringify({
            type: "error",
            message: "Rate limit exceeded"
          }));
          return;
        }

        handleMessage(ws, data.toString(), roomManager, userManager, socketManager, persistence, snapshotManager, roomActorManager);
      } catch (error) {
        console.error("Message handling error:", error);
      }
    });

    ws.on("close", () => {
      // Unregister from heartbeat
      heartbeat.unregister(ws);
      
      // Remove from rate limiter tracking
      rateLimiter.removeSocket(ws);
      
      // Get metadata before removal
      const meta = socketManager.getSocketMeta(ws);
      
      // Remove from room if the user was in one
      if (meta && meta.roomId) {
        roomManager.removeSocket(meta.roomId, ws);
        // Also remove from lobby if waiting
        roomManager.removeFromLobby(meta.roomId, ws);
      }
      
      // Clean up socket metadata
      socketManager.removeSocket(ws);
    });

    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
    });
  });

  // Return services for shutdown/monitoring
  return { heartbeat, rateLimiter };
}