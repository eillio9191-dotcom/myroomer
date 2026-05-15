import { RoomActor } from "./roomActor.service.js";
import { RoomManager } from "../managers/roomManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { safeSend } from "../utils/safeSend.js";

export class RoomEventHandler {
  constructor(
    private roomManager: RoomManager,
    private socketManager: SocketManager
  ) {}

  /**
   * Setup event listeners for a room actor
   */
  setupActorListeners(actor: RoomActor) {
    actor.on("event:execute", async ({ roomId, event }, resolve) => {
      try {
        await this.handleEvent(roomId, event);
        resolve();
      } catch (error) {
        console.error(`Error handling event in room ${roomId}:`, error);
        resolve(); // Still resolve to continue processing
      }
    });
  }

  /**
   * Handle room events sequentially
   */
  private async handleEvent(roomId: string, event: any) {
    switch (event.type) {
      case "lobby-approve":
        await this.handleLobbyApprove(roomId, event.data);
        break;
      case "lobby-reject":
        await this.handleLobbyReject(roomId, event.data);
        break;
      default:
        console.warn(`Unknown event type: ${event.type}`);
    }
  }

  private async handleLobbyApprove(roomId: string, data: { targetId: string; approverId: string }) {
    const { targetId } = data;

    const lobby = this.roomManager.getLobby(roomId);
    if (!lobby) return;

    const targetSocket = Array.from(lobby).find(client => {
      const clientMeta = this.socketManager.getSocketMeta(client);
      return clientMeta?.userId === targetId;
    });

    if (targetSocket) {
      this.roomManager.removeFromLobby(roomId, targetSocket);
      this.roomManager.addSocket(roomId, targetSocket);

      const sockets = this.roomManager.getSockets(roomId) || [];
      const usersInRoom = Array.from(sockets)
        .filter(c => c !== targetSocket)
        .map(c => {
          const meta = this.socketManager.getSocketMeta(c);

          return meta
            ? {
                userId: meta.userId,
                username: meta.username,
                displayName: meta.displayName,
                avatar: meta.avatar,
              }
            : null;
        })
        .filter(Boolean);

      safeSend(targetSocket, {
        type: "room-users",
        users: usersInRoom,
      });

      // Update meta to reflect room join
      const targetMeta = this.socketManager.getSocketMeta(targetSocket);
      if (targetMeta) {
        targetMeta.roomId = roomId;
      }

      const room = this.roomManager.getRoom(roomId);
      if (!room) return;

      // Notify the approved user
      safeSend(targetSocket, {
        type: "room-info",
        roomId,
        roomTag: room.tag,
        autoAccept: room.settings.autoAccept,
        autoReject: room.settings.autoReject,
      });

      // Notify all users in room
      sockets.forEach(client => {
        if (client !== targetSocket) {
          safeSend(client, {
            type: "user-joined",
            userId: targetId,
            username: targetMeta?.username,
            displayName: targetMeta?.displayName,
            avatar: targetMeta?.avatar,
          });
        }
      });
    }
  }

  private async handleLobbyReject(roomId: string, data: { targetId: string; rejectorId: string }) {
    const { targetId } = data;

    const lobby = this.roomManager.getLobby(roomId);
    if (!lobby) return;

    const targetSocket = Array.from(lobby).find(client => {
      const clientMeta = this.socketManager.getSocketMeta(client);
      return clientMeta?.userId === targetId;
    });

    if (targetSocket) {
      this.roomManager.removeFromLobby(roomId, targetSocket);
      safeSend(targetSocket, { type: "lobby-rejected" });
    }
  }
}