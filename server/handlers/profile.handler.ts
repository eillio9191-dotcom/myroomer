import { RoomManager } from "../managers/roomManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { UserManager } from "../managers/userManager.js";
import { safeSend } from "../utils/safeSend.js";

export function handleProfileUpdate(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager, userManager: UserManager) {
  const { senderId, displayName, avatar } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  // Update local socket state
  meta.displayName = displayName;
  meta.avatar = avatar;

  // Update user manager state (this will trigger persistence via event bus)
  userManager.updateUser(meta.userId, { displayName, avatar });

  // Broadcast to everyone in the room
  const sockets = roomManager.getSockets(meta.roomId);
  if (sockets) {
    sockets.forEach(client => {
      safeSend(client, {
        type: "profile-update",
        senderId,
        displayName,
        avatar
      });
    });
  }
}

export function handleMuteStatus(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager) {
  const { senderId, isMuted } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  // Broadcast to everyone in the room
  const sockets = roomManager.getSockets(meta.roomId);
  if (sockets) {
    sockets.forEach(client => {
      safeSend(client, {
        type: "mute-status",
        senderId,
        isMuted
      });
    });
  }
}

export function handleCamStatus(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager) {
  const { senderId, camOn } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  // Broadcast to everyone in the room
  const sockets = roomManager.getSockets(meta.roomId);
  if (sockets) {
    sockets.forEach(client => {
      safeSend(client, {
        type: "cam-status",
        senderId,
        camOn
      });
    });
  }
}

export function handleQualityRequest(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager) {
  const { targetId, senderId, level } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  // Find target socket
  const sockets = roomManager.getSockets(meta.roomId);
  if (!sockets) return;

  const targetSocket = Array.from(sockets).find(client => {
    const clientMeta = socketManager.getSocketMeta(client);
    return clientMeta?.userId === targetId;
  });

  if (targetSocket) {
    safeSend(targetSocket, {
      type: "quality-request",
      senderId,
      level
    });
  }
}