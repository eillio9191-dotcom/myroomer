import { RoomManager } from "../managers/roomManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { safeSend } from "../utils/safeSend.js";

export function handleChat(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager) {
  const { text, senderId, username, displayName, avatar, timestamp } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const sockets = roomManager.getSockets(meta.roomId);
  if (!sockets) return;

  sockets.forEach(client => {
    safeSend(client, {
      type: "chat",
      text,
      senderId,
      username,
      displayName,
      avatar,
      timestamp
    });
  });
}