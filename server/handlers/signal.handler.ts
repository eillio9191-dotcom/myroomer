import { RoomManager } from "../managers/roomManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { safeSend } from "../utils/safeSend.js";

export function handleSignal(ws: any, msg: any, roomManager: RoomManager, socketManager: SocketManager) {
  const { targetId, signal, senderId, roomId } = msg;
  const meta = socketManager.getSocketMeta(ws);
  if (!meta) return;

  const targetSocket = socketManager.getUserSocket(targetId);
  if (!targetSocket) return;

  safeSend(targetSocket, {
    type: "signal",
    senderId,
    signal
  });
}