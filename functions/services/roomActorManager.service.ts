import { RoomActor, RoomEvent } from "./roomActor.service.js";
import { RoomEventHandler } from "./roomEventHandler.service.js";
import { RoomManager } from "../managers/roomManager.js";
import { SocketManager } from "../managers/socketManager.js";

export class RoomActorManager {
  private actors = new Map<string, RoomActor>();
  private eventHandler: RoomEventHandler;

  constructor(roomManager: RoomManager, socketManager: SocketManager) {
    this.eventHandler = new RoomEventHandler(roomManager, socketManager);
  }

  /**
   * Get or create a room actor
   */
  getActor(roomId: string): RoomActor {
    const normalized = roomId.toLowerCase().trim();
    
    if (!this.actors.has(normalized)) {
      const actor = new RoomActor(normalized);
      this.eventHandler.setupActorListeners(actor);
      this.actors.set(normalized, actor);
    }

    return this.actors.get(normalized)!;
  }

  /**
   * Queue an event in a room's actor
   * Ensures sequential processing and no race conditions
   */
  async enqueueEvent(roomId: string, event: RoomEvent): Promise<any> {
    const actor = this.getActor(roomId);
    return actor.enqueueEvent(event);
  }

  /**
   * Remove a room actor (when room is deleted)
   */
  removeActor(roomId: string) {
    const normalized = roomId.toLowerCase().trim();
    this.actors.delete(normalized);
  }

  /**
   * Get all active room actors
   */
  getAllActors() {
    return Array.from(this.actors.entries());
  }

  /**
   * Get stats about actor system
   */
  getStats() {
    const stats = {
      totalRooms: this.actors.size,
      activeRooms: 0,
      totalQueuedEvents: 0
    };

    this.actors.forEach(actor => {
      if (actor.getQueueSize() > 0) {
        stats.activeRooms++;
      }
      stats.totalQueuedEvents += actor.getQueueSize();
    });

    return stats;
  }
}
