import { PersistenceService, PersistedData } from "./persistence.service.js";
import { UserManager } from "../managers/userManager.js";
import { RoomManager } from "../managers/roomManager.js";
import { EventBus } from "./eventBus.service.js";

export class SnapshotManager {
  private snapshotInterval: NodeJS.Timeout | null = null;
  private lastSnapshot = Date.now();

  constructor(
    private persistence: PersistenceService,
    private userManager: UserManager,
    private roomManager: RoomManager,
    private eventBus: EventBus
  ) {
    this.setupEventListeners();
    this.startSnapshotInterval();
  }

  private setupEventListeners() {
    this.eventBus.on("room:deleted", (data: { roomId: string }) => {
      // Deletion is handled in roomManager, but we should handle it in firestore too if needed
      // For now we just focus on saves
    });

    this.eventBus.on("user:created", (user: any) => {
      this.persistence.saveUser(user.username, user);
    });

    this.eventBus.on("user:updated", (data: { username: string; updates: any }) => {
      const user = this.userManager.getUser(data.username);
      if (user) {
        this.persistence.saveUser(data.username, user);
      }
    });

    this.eventBus.on("room:created", (room: any) => {
      this.persistence.saveRoom(room.roomId, {
        owner: room.owner,
        tag: room.tag,
        settings: { autoAccept: false, autoReject: false }
      });
    });

    this.eventBus.on("room:settings-changed", (data: { roomId: string; settings: any }) => {
      const room = this.roomManager.getRoom(data.roomId);
      if (room) {
        this.persistence.saveRoom(data.roomId, {
          owner: room.owner,
          tag: room.tag, 
          settings: room.settings
        });
      }
    });
  }

  private startSnapshotInterval() {
    // We still take a full snapshot periodically for safety, but less often
    this.snapshotInterval = setInterval(() => {
      this.saveSnapshot();
    }, 300000); // Every 5 minutes instead of 30 seconds
  }

  private async saveSnapshot() {
    try {
      const data: PersistedData = {
        users: {},
        roomOwners: {},
        roomTags: {},
        roomSettings: {},
        roomOwnerKeys: {}
      };

      // Collect users data
      const users = this.userManager.getAllUsers();
      users.forEach(user => {
        data.users[user.username] = user;
      });

      // Collect rooms data
      const rooms = this.roomManager.getAllRooms();
      rooms.forEach(room => {
        data.roomOwners[room.id] = room.owner;
        data.roomTags[room.id] = room.tag;
        data.roomSettings[room.id] = room.settings;
        data.roomOwnerKeys[room.id] = room.ownerKey || '';
      });

      await this.persistence.saveData(data);
      this.lastSnapshot = Date.now();
      console.log("Snapshot saved");
    } catch (error) {
      console.error("Failed to save snapshot:", error);
    }
  }

  async forceSave() {
    await this.saveSnapshot();
  }

  destroy() {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }
}