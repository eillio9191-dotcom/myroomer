import { WebSocket } from "ws";
import { Room, RoomSettings } from "../types/room.types.js";
import { EventBus } from "../services/eventBus.service.js";

export class RoomManager {
  private rooms = new Map<string, Room>();
  private sockets = new Map<string, Set<WebSocket>>();
  private lobbies = new Map<string, Set<WebSocket>>();

  constructor(private eventBus: EventBus) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for user join events
    this.eventBus.on("user:joined", (data) => {
      this.handleUserJoined(data);
    });

    // Listen for user left events
    this.eventBus.on("user:left", (data) => {
      this.handleUserLeft(data);
    });

    // Listen for room deletion
    this.eventBus.on("room:deleted", (data) => {
      this.handleRoomDeleted(data);
    });
  }

  private handleUserJoined(data: { userId: string; roomId: string; ws: WebSocket }) {
    this.addSocket(data.roomId, data.ws);
  }

  private handleUserLeft(data: { userId: string; roomId: string; ws: WebSocket }) {
    this.removeSocket(data.roomId, data.ws);
  }

  private handleRoomDeleted(data: { roomId: string }) {
    this.deleteRoom(data.roomId);
  }

  normalize(roomId: string) {
    return roomId.toLowerCase().trim();
  }

  createRoom(roomId: string, owner: string, tag: string, ownerKey?: string) {
    const id = this.normalize(roomId);

    if (this.rooms.has(id)) return false;

    const key = ownerKey || Math.random().toString(36).substring(2, 10).toUpperCase();

    this.rooms.set(id, {
      owner,
      tag,
      ownerKey: key,
      settings: { autoAccept: false, autoReject: false },
      createdAt: Date.now()
    });

    this.eventBus.emit("room:created", { roomId: id, owner, tag, ownerKey: key });
    return true;
  }

  getRoom(roomId: string) {
    return this.rooms.get(this.normalize(roomId));
  }

  setSettings(roomId: string, settings: Partial<RoomSettings>) {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.settings = {
      ...room.settings,
      ...settings
    };

    this.eventBus.emit("room:settings-changed", { roomId, settings });
  }

  deleteRoom(roomId: string) {
    const id = this.normalize(roomId);
    this.rooms.delete(id);
    this.sockets.delete(id);
    this.lobbies.delete(id);

    this.eventBus.emit("room:deleted", { roomId: id });
  }

  addSocket(roomId: string, ws: WebSocket) {
    const id = this.normalize(roomId);

    if (!this.sockets.has(id)) {
      this.sockets.set(id, new Set());
    }

    this.sockets.get(id)!.add(ws);
  }

  removeSocket(roomId: string, ws: WebSocket) {
    const id = this.normalize(roomId);

    const set = this.sockets.get(id);
    if (!set) return;

    set.delete(ws);

    if (set.size === 0) {
      this.sockets.delete(id);
    }
  }

  getSockets(roomId: string) {
    return this.sockets.get(this.normalize(roomId));
  }

  addToLobby(roomId: string, ws: WebSocket) {
    const id = this.normalize(roomId);

    if (!this.lobbies.has(id)) {
      this.lobbies.set(id, new Set());
    }

    this.lobbies.get(id)!.add(ws);
  }

  removeFromLobby(roomId: string, ws: WebSocket) {
    const id = this.normalize(roomId);

    const set = this.lobbies.get(id);
    if (!set) return;

    set.delete(ws);

    if (set.size === 0) {
      this.lobbies.delete(id);
    }
  }

  getAllRooms() {
    return Array.from(this.rooms.entries()).map(([id, room]) => ({
      id,
      ...room
    }));
  }

  searchRooms(query: string) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.rooms.entries())
      .filter(([id, room]) =>
        id.includes(lowerQuery) ||
        room.tag.toLowerCase().includes(lowerQuery) ||
        room.owner.toLowerCase().includes(lowerQuery)
      )
      .map(([id, room]) => ({
        id,
        tag: room.tag,
        owner: room.owner,
        ownerKey: room.ownerKey
      }))
      .slice(0, 10);
  }

  getOwnedRooms(owner: string) {
    return Array.from(this.rooms.entries())
      .filter(([id, room]) => room.owner === owner)
      .map(([id, room]) => ({
        id,
        tag: room.tag || id
      }));
  }

  getLobby(roomId: string) {
    return this.lobbies.get(this.normalize(roomId));
  }

  onUpdate() {
    // Called when room state changes
    // Can be used to trigger events or persistence
  }
}