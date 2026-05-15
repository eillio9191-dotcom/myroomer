import { WebSocket } from "ws";
import { SocketMeta } from "../types/socket.types.js";
import { EventBus } from "../services/eventBus.service.js";

export class SocketManager {
  private socketInfo = new Map<WebSocket, SocketMeta>();
  private userSockets = new Map<string, WebSocket>(); // userId -> WebSocket
  private usernameSockets = new Map<string, WebSocket>(); // username -> WebSocket

  constructor(private eventBus: EventBus) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for socket join events
    this.eventBus.on("socket:joined", (data) => {
      this.handleSocketJoined(data);
    });

    // Listen for socket leave events
    this.eventBus.on("socket:left", (data) => {
      this.handleSocketLeft(data);
    });
  }

  private handleSocketJoined(data: { ws: WebSocket; meta: SocketMeta }) {
    // Already handled in setSocketMeta
  }

  private handleSocketLeft(data: { ws: WebSocket; meta?: SocketMeta }) {
    // Already handled in removeSocket
  }

  setSocketMeta(ws: WebSocket, meta: SocketMeta) {
    this.socketInfo.set(ws, meta);
    this.userSockets.set(meta.userId, ws);
    this.usernameSockets.set(meta.username, ws);
    this.eventBus.emit("socket:joined", { ws, meta });
  }

  getSocketMeta(ws: WebSocket) {
    return this.socketInfo.get(ws);
  }

  getUserSocket(userId: string) {
    return this.userSockets.get(userId);
  }

  getSocketByUsername(username: string) {
    return this.usernameSockets.get(username);
  }

  getSocketByUserId(userId: string) {
    return this.getUserSocket(userId);
  }

  removeSocket(ws: WebSocket) {
    const meta = this.socketInfo.get(ws);
    if (meta) {
      if (this.userSockets.get(meta.userId) === ws) {
        this.userSockets.delete(meta.userId);
      }
      if (this.usernameSockets.get(meta.username) === ws) {
        this.usernameSockets.delete(meta.username);
      }
      this.eventBus.emit("socket:left", { ws, meta });
    }
    this.socketInfo.delete(ws);
  }

  getAllSockets() {
    return Array.from(this.socketInfo.keys());
  }
}