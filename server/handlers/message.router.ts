import { handleJoin } from "./join.handler.js";
import { handleChat } from "./chat.handler.js";
import { handleSignal } from "./signal.handler.js";
import { handleLobbyApprove, handleLobbyReject } from "./lobby.handler.js";
import { handleKickUser, handleDeleteRoom, handleUpdateRoomTag, handleRoomSettings, handleClaimOwnership, handleForceMute, handlePermitSpeak } from "./owner.handler.js";
import { handleProfileUpdate, handleMuteStatus, handleQualityRequest, handleCamStatus } from "./profile.handler.js";
import { handleDirectCall } from "./call.handler.js";
import { RoomManager } from "../managers/roomManager.js";
import { UserManager } from "../managers/userManager.js";
import { SocketManager } from "../managers/socketManager.js";
import { PersistenceService } from "../services/persistence.service.js";
import { SnapshotManager } from "../services/snapshotManager.service.js";
import { RoomActorManager } from "../services/roomActorManager.service.js";

export function handleMessage(ws: any, raw: string, roomManager: RoomManager, userManager: UserManager, socketManager: SocketManager, persistence: PersistenceService, snapshotManager: SnapshotManager, roomActorManager: RoomActorManager) {
  const msg = JSON.parse(raw);

  switch (msg.type) {
    case "join":
      return handleJoin(ws, msg, roomManager, userManager, socketManager, persistence, snapshotManager, roomActorManager);

    case "chat":
      return handleChat(ws, msg, roomManager, socketManager);

    case "signal":
      return handleSignal(ws, msg, roomManager, socketManager);

    case "lobby-approve":
      return handleLobbyApprove(ws, msg, roomManager, socketManager, roomActorManager);

    case "lobby-reject":
      return handleLobbyReject(ws, msg, roomManager, socketManager, roomActorManager);

    case "kick-user":
      return handleKickUser(ws, msg, roomManager, socketManager);

    case "delete-room":
      return handleDeleteRoom(ws, msg, roomManager, socketManager, persistence, snapshotManager);

    case "update-room-tag":
      return handleUpdateRoomTag(ws, msg, roomManager, socketManager, persistence, snapshotManager);

    case "room-settings":
      return handleRoomSettings(ws, msg, roomManager, socketManager, persistence, snapshotManager);

    case "claim-ownership":
      return handleClaimOwnership(ws, msg, roomManager, socketManager, persistence, snapshotManager);

    case "force-mute":
      return handleForceMute(ws, msg, roomManager, socketManager);

    case "permit-speak":
      return handlePermitSpeak(ws, msg, roomManager, socketManager);

    case "direct-call":
      return handleDirectCall(ws, msg, userManager, socketManager);

    case "quality-request":
      return handleQualityRequest(ws, msg, roomManager, socketManager);

    case "mute-status":
      return handleMuteStatus(ws, msg, roomManager, socketManager);

    case "cam-status":
      return handleCamStatus(ws, msg, roomManager, socketManager);

    case "profile-update":
      return handleProfileUpdate(ws, msg, roomManager, socketManager, userManager);
  }
}