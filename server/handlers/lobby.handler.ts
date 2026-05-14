import { RoomManager } from "../managers/roomManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { RoomActorManager } from "../services/roomActorManager.service.js";
import { safeSend } from "../utils/safeSend.js";

export function handleLobbyApprove(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager, roomActorManager: RoomActorManager) {
  const { targetId, roomId } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room || room.owner !== meta.username) return;

  // Use actor to prevent race conditions
  roomActorManager.enqueueEvent(roomId, {
    type: "lobby-approve",
    data: { targetId, approverId: meta.username },
    timestamp: Date.now()
  }).then(() => {
    // Event processed successfully
  }).catch(error => {
    console.error("Error processing lobby approve:", error);
  });
}

export function handleLobbyReject(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager, roomActorManager: RoomActorManager) {
  const { targetId, roomId } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const room = roomManager.getRoom(roomId);
  if (!room || room.owner !== meta.username) return;

  // Use actor to prevent race conditions
  roomActorManager.enqueueEvent(roomId, {
    type: "lobby-reject",
    data: { targetId, rejectorId: meta.username },
    timestamp: Date.now()
  }).then(() => {
    // Event processed successfully
  }).catch(error => {
    console.error("Error processing lobby reject:", error);
  });
}