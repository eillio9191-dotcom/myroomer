import { UserManager } from "../managers/userManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { safeSend } from "../utils/safeSend.js";

export function handleDirectCall(ws: any, msg: any, userManager: UserManager, socketManager: SocketManager) {
  const { targetId, callerId, callerDisplayName, callerAvatar, roomId: providedRoomId } = msg;

  const targetSocket = socketManager.getUserSocket(targetId);
  if (!targetSocket) return;

  const targetMeta = socketManager.getSocketMeta(targetSocket);
  if (!targetMeta) return;

  const targetUser = userManager.getUser(targetMeta.username);
  if (targetUser?.blockedUsers && targetUser.blockedUsers.includes(callerId)) {
    console.log(`Call from ${callerId} to ${targetId} blocked.`);
    return;
  }
  if (targetSocket.readyState === WebSocket.OPEN) {
    safeSend(targetSocket, {
      type: "incoming-call",
      callerId,
      callerDisplayName,
      callerAvatar,
      roomId: providedRoomId || `call-${callerId}-${Date.now()}`
    });
  }
}