import { WebSocket } from "ws";
import { RoomManager } from "../managers/roomManager.js";
import { UserManager } from "../managers/userManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { PersistenceService } from "../services/persistence.service.js";
import { SnapshotManager } from "../services/snapshotManager.service.js";
import { RoomActorManager } from "../services/roomActorManager.service.js";
import { safeSend } from "../utils/safeSend.js";

function joinRoom(ws: WebSocket, roomId: string, userId: string, username: string, displayName: string, avatar: string | undefined, camOn: boolean | undefined, micOn: boolean | undefined, roomManager: RoomManager, socketManager: SocketManager) {
  // Leave previous room if any
  const oldMeta = socketManager.getSocketMeta(ws);
  if (oldMeta) {
    roomManager.removeSocket(oldMeta.roomId, ws);
  }
  
  // Join new room
  roomManager.addSocket(roomId, ws);
  socketManager.setSocketMeta(ws, { userId, roomId, username, displayName, avatar, camOn, micOn });

  // Notify others in the room
  const sockets = roomManager.getSockets(roomId);
  if (sockets) {
    sockets.forEach((client) => {
      if (client !== ws) {
        const clientMeta = socketManager.getSocketMeta(client);
        if (clientMeta) {
          safeSend(client, {
            type: "user-joined",
            userId,
            username,
            displayName,
            avatar,
            camOn,
            micOn
          });
        }
      }
    });
  }

  // Send current users to the new joiner
  const usersInRoom = Array.from(sockets || [])
    .filter(c => c !== ws)
    .map(c => {
      const meta = socketManager.getSocketMeta(c);
      return meta ? {
        userId: meta.userId,
        username: meta.username,
        displayName: meta.displayName,
        avatar: meta.avatar,
        camOn: meta.camOn,
        micOn: meta.micOn
      } : null;
    })
    .filter(Boolean);

  safeSend(ws, {
    type: "room-users",
    users: usersInRoom
  });

  console.log(`User ${userId} joined room ${roomId}`);
}

export function handleJoin(ws: any, msg: any, roomManager: RoomManager, userManager: UserManager, socketManager: SocketManager, persistence: PersistenceService, snapshotManager: SnapshotManager, roomActorManager: RoomActorManager) {
  const { userId, username, displayName, avatar, isOwner, roomTag, camOn, micOn } = msg;
  const roomId = (msg.roomId as string || "").toLowerCase().trim();

  const user = userManager.getUser(username);
  if (user?.isBanned) {
    safeSend(ws, { type: "error", message: "You are banned." });
    ws.close();
    return;
  }

  // Get old meta BEFORE updating
  const oldMeta = socketManager.getSocketMeta(ws);
  if (oldMeta && oldMeta.roomId && oldMeta.roomId !== roomId) {
    roomManager.removeSocket(oldMeta.roomId, ws);
  }

  // Track user socket for direct calls
  socketManager.setSocketMeta(ws, { userId, roomId, username, displayName, avatar, camOn, micOn });

  // Handle room ownership
  const room = roomManager.getRoom(roomId);
  if (room && room.owner === username) {
    safeSend(ws, {
    type: "you-are-owner",
    roomId,
    ownerKey: room.ownerKey
  });
  }

  if (roomTag) {
    if (room) {
      room.tag = roomTag;
    }
    snapshotManager.forceSave();
  }

  const settings = room?.settings || { autoAccept: false, autoReject: false };

  // Handle auto-settings and Admin Bypass
  if (room && room.owner && room.owner !== userId) {
    // Admin (user 1) bypasses lobby
    if (username === '1') {
      joinRoom(ws, roomId, userId, username, displayName, avatar, camOn, micOn, roomManager, socketManager);
      return;
    }

    if (settings.autoReject) {
      safeSend(ws, { type: "lobby-rejected" });
      return;
    }
    if (settings.autoAccept) {
      joinRoom(ws, roomId, userId, username, displayName, avatar, camOn, micOn, roomManager, socketManager);
      safeSend(ws, { type: "room-info", roomId, roomTag: room.tag, autoAccept: settings.autoAccept, autoReject: settings.autoReject });
      return;
    }
  }

  // If room has an owner and joiner is not the owner, they go to lobby
  if (room && room.owner && room.owner !== username) {
    roomManager.addToLobby(roomId, ws);
    socketManager.setSocketMeta(ws, { userId, roomId, username, displayName, avatar, camOn, micOn });

    // Notify owner about waiting user
    const ownerSocket = socketManager.getSocketByUsername(room.owner);
    if (ownerSocket && ownerSocket.readyState === WebSocket.OPEN) {
      safeSend(ownerSocket, {
        type: "lobby-request",
        userId,
        username,
        displayName,
        avatar
      });
    }

    safeSend(ws, { type: "waiting-in-lobby" });
    return;
  }

  // Proceed with joining
  joinRoom(ws, roomId, userId, username, displayName, avatar, camOn, micOn, roomManager, socketManager);

  safeSend(ws, {
    type: "room-info",
    roomId,
    roomTag: room?.tag,
    autoAccept: settings.autoAccept,
    autoReject: settings.autoReject
  });
}