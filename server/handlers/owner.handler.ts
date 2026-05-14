import { RoomManager } from "../managers/roomManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { PersistenceService } from "../services/persistence.service.js";
import { SnapshotManager } from "../services/snapshotManager.service.js";
import { safeSend } from "../utils/safeSend.js";

export function handleKickUser(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager) {
  const { targetId, roomId } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room || room.owner !== meta.username) return;

  const sockets = roomManager.getSockets(roomId);
  if (!sockets) return;

  const targetSocket = Array.from(sockets).find(client => {
    const clientMeta = socketManager.getSocketMeta(client);
    return clientMeta?.userId === targetId;
  });

  if (targetSocket) {
    safeSend(targetSocket, { type: "kicked" });
    targetSocket.close();
    roomManager.removeSocket(roomId, targetSocket);
    socketManager.removeSocket(targetSocket);
  }
}

export function handleDeleteRoom(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager, persistence: PersistenceService, snapshotManager: SnapshotManager) {
  const { roomId } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room || room.owner !== meta.username) return;

  // Notify everyone and close room
  const sockets = roomManager.getSockets(roomId);
  if (sockets) {
    sockets.forEach(client => {
      safeSend(client, { type: "room-deleted" });
      client.close();
    });
  }

  roomManager.deleteRoom(roomId);

  snapshotManager.forceSave();
}

export function handleUpdateRoomTag(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager, persistence: PersistenceService, snapshotManager: SnapshotManager) {
  const { roomId, roomTag } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room || room.owner !== meta.username) return;

  room.tag = roomTag;
  roomManager.onUpdate();

  // Notify everyone in the room
  const sockets = roomManager.getSockets(roomId);
  if (sockets) {
    sockets.forEach(client => {
      safeSend(client, {
        type: "room-info",
        roomId,
        roomTag
      });
    });
  }

  snapshotManager.forceSave();
}

export function handleRoomSettings(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager, persistence: PersistenceService, snapshotManager: SnapshotManager) {
  const { roomId, autoAccept, autoReject } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room || room.owner !== meta.username) return;

  roomManager.setSettings(roomId, { autoAccept, autoReject });

  // If auto-accept is turned on, approve all currently waiting
  if (autoAccept) {
    const lobby = roomManager.getLobby(roomId);
    if (lobby) {
      lobby.forEach(waitingWs => {
        roomManager.removeFromLobby(roomId, waitingWs);
        roomManager.addSocket(roomId, waitingWs);

        const waitingMeta = socketManager.getSocketMeta(waitingWs);
        if (waitingMeta) {
          waitingMeta.roomId = roomId;
        }

        safeSend(waitingWs, { type: "room-info", roomId, roomTag: room.tag });
      });
    }
  }

  // If auto-reject is turned on, reject all currently waiting
  if (autoReject) {
    const lobby = roomManager.getLobby(roomId);
    if (lobby) {
      lobby.forEach(waitingWs => {
        roomManager.removeFromLobby(roomId, waitingWs);
        safeSend(waitingWs, { type: "lobby-rejected" });
      });
    }
  }

  snapshotManager.forceSave();
}

/**
 * Handle claiming ownership of a room using a secret code
 */
export function handleClaimOwnership(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager, persistence: PersistenceService, snapshotManager: SnapshotManager) {
  const { roomId, ownerKey } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room) return;

  if (room.ownerKey === ownerKey) {
    room.owner = meta.username;
    roomManager.onUpdate();

    safeSend(ws, { 
      type: "you-are-owner", 
      roomId, 
      ownerKey: room.ownerKey 
    });

    snapshotManager.forceSave();
  } else {
    safeSend(ws, { type: "error", message: "Invalid ownership code" });
  }
}

export function handleForceMute(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager) {
  const { targetId, roomId, muteAll } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room || room.owner !== meta.username) return;

  const sockets = roomManager.getSockets(roomId);
  if (!sockets) return;

  if (muteAll !== undefined) {
    sockets.forEach(client => {
      const clientMeta = socketManager.getSocketMeta(client);
      if (clientMeta && clientMeta.username !== meta.username) {
        safeSend(client, { type: muteAll ? "force-mute" : "force-unmute", roomId });
      }
    });
  } else if (targetId) {
    const targetSocket = Array.from(sockets).find(client => {
      const clientMeta = socketManager.getSocketMeta(client);
      return clientMeta?.userId === targetId;
    });
    if (targetSocket) {
      safeSend(targetSocket, { type: "force-mute", roomId });
    }
  }
}

export function handlePermitSpeak(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager) {
  const { targetId, roomId } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room || room.owner !== meta.username) return;

  const sockets = roomManager.getSockets(roomId);
  if (!sockets) return;

  const targetSocket = Array.from(sockets).find(client => {
    const clientMeta = socketManager.getSocketMeta(client);
    return clientMeta?.userId === targetId;
  });

  if (targetSocket) {
    safeSend(targetSocket, { type: "force-unmute", roomId });
  }
}
