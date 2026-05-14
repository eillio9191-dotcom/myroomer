import * as fs from "fs";

interface RoomData {
  owner: string;
  tag: string;
  settings: {
    autoAccept: boolean;
    autoReject: boolean;
  };
}

export class RoomService {
  private rooms: Map<string, RoomData> = new Map();
  private dataFile = "data.json";

  async loadRoomData() {
    try {
      const data = await fs.promises.readFile(this.dataFile, "utf-8");
      const json = JSON.parse(data);
      this.rooms = new Map(Object.entries(json.rooms || {}));
      console.log("Room data loaded from disk");
    } catch (e) {
      console.log("No existing room data found, starting fresh");
    }
  }

  async saveRoomData() {
    const data = {
      users: {}, // This will be handled by server.ts
      rooms: Object.fromEntries(this.rooms),
    };
    await fs.promises.writeFile(this.dataFile, JSON.stringify(data, null, 2));
  }

  createRoom(roomId: string, owner: string, tag: string) {
    if (this.rooms.has(roomId)) {
      throw new Error("Room already exists");
    }
    this.rooms.set(roomId, {
      owner,
      tag,
      settings: { autoAccept: true, autoReject: false },
    });
  }

  deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }

  roomExists(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  isOwner(roomId: string, username: string): boolean {
    const room = this.rooms.get(roomId);
    return room?.owner === username;
  }

  canKick(roomId: string, username: string): boolean {
    return this.isOwner(roomId, username) || username === '1'; // Admin can kick
  }

  canModifySettings(roomId: string, username: string): boolean {
    return this.isOwner(roomId, username) || username === '1'; // Admin can modify
  }

  canDeleteRoom(roomId: string, username: string): boolean {
    return this.isOwner(roomId, username) || username === '1'; // Admin can delete
  }

  getRoomTag(roomId: string): string {
    return this.rooms.get(roomId)?.tag || "";
  }

  updateRoomTag(roomId: string, tag: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.tag = tag;
    }
  }

  getRoomSettings(roomId: string) {
    return this.rooms.get(roomId)?.settings || { autoAccept: true, autoReject: false };
  }

  updateRoomSettings(roomId: string, settings: any) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.settings = { ...room.settings, ...settings };
    }
  }

  getOwnedRooms(username: string): string[] {
    return Array.from(this.rooms.entries())
      .filter(([_, room]) => room.owner === username)
      .map(([id, _]) => id);
  }

  getAllRoomsForAdmin(): { id: string; room: RoomData }[] {
    return Array.from(this.rooms.entries()).map(([id, room]) => ({ id, room }));
  }

  getRoomOwner(roomId: string): string {
    return this.rooms.get(roomId)?.owner || "";
  }

  setOwner(roomId: string, owner: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.owner = owner;
    }
  }

  getRoomSearchResults(): { id: string; tag: string; owner: string }[] {
    return Array.from(this.rooms.entries()).map(([id, room]) => ({
      id,
      tag: room.tag,
      owner: room.owner,
    }));
  }
}

export const roomService = new RoomService();