import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

interface RoomSettings {
  autoAccept: boolean;
  autoReject: boolean;
  roomTag?: string;
}

interface RoomUser {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  camOn?: boolean;
  micOn?: boolean;
  joinedAt?: number;
  socketId?: string;
}

interface RoomState {
  ownerId: string;
  users: Map<string, RoomUser>;
  mutedUsers: Set<string>;
  bannedUsers: Set<string>;
  lobbyUsers: Map<string, RoomUser>;
  settings: RoomSettings;
}

interface RoomStateMessage {
  type: string;
  [key: string]: any;
}

interface ControlMessage {
  type: string;
  targetId?: string;
  [key: string]: any;
}

const rooms = new Map<string, RoomState>();
const userSocketMap = new Map<string, string>();
const userRoomMap = new Map<string, string>();
const lastControlAction = new Map<string, number>();

const getUserId = (socket: Socket) => socket.data.userId as string | undefined;

const getRoom = (roomId: string) => rooms.get(roomId);

const sendToUser = (userId: string, event: string, payload: any) => {
  const socketId = userSocketMap.get(userId);
  if (!socketId) return;
  io.to(socketId).emit(event, payload);
};

const broadcastRoom = (roomId: string, event: string, payload: any) => {
  io.to(roomId).emit(event, payload);
};

const buildUserPayload = (user: RoomUser) => ({
  userId: user.userId,
  username: user.username,
  displayName: user.displayName,
  avatar: user.avatar,
  camOn: user.camOn,
  micOn: user.micOn,
  joinedAt: user.joinedAt
});

const createRoomState = (ownerId: string, roomTag?: string): RoomState => ({
  ownerId,
  users: new Map(),
  mutedUsers: new Set(),
  bannedUsers: new Set(),
  lobbyUsers: new Map(),
  settings: {
    autoAccept: false,
    autoReject: false,
    roomTag: roomTag ?? undefined
  }
});

const acceptUserIntoRoom = (socket: Socket, roomId: string, user: RoomUser, room: RoomState) => {
  const userId = user.userId;
  room.lobbyUsers.delete(userId);
  room.users.set(userId, { ...user, socketId: socket.id });
  socket.join(roomId);
  userRoomMap.set(userId, roomId);

  const existingUsers = Array.from(room.users.values())
    .filter((existing) => existing.userId !== userId)
    .map(buildUserPayload);

  socket.emit('existing-users', { users: existingUsers });
  socket.to(roomId).emit('user-joined', { user: buildUserPayload(user) });

  if (room.ownerId === userId) {
    socket.emit('room-state', {
      message: {
        type: 'you-are-owner',
        ownerId: room.ownerId
      }
    });
  }

  if (room.mutedUsers.has(userId)) {
    socket.emit('control', { message: { type: 'force-mute' } });
  }
};

const removeUserFromRoom = (roomId: string, userId: string) => {
  const room = getRoom(roomId);
  if (!room) return;
  if (room.users.has(userId)) {
    room.users.delete(userId);
    userRoomMap.delete(userId);
    broadcastRoom(roomId, 'user-left', { userId });
  }
};

const updateRoomSettings = (room: RoomState, message: RoomStateMessage) => {
  if (message.autoAccept !== undefined) room.settings.autoAccept = !!message.autoAccept;
  if (message.autoReject !== undefined) room.settings.autoReject = !!message.autoReject;
  if (message.roomTag !== undefined) room.settings.roomTag = message.roomTag;
};

io.on('connection', (socket: Socket) => {
  console.log('user connected:', socket.id);

  socket.on('join-room', ({ roomId, user }: { roomId: string; user: RoomUser }) => {
    const userId = user.userId;
    if (!roomId || !userId) return;

    if (rooms.has(roomId) && rooms.get(roomId)!.bannedUsers.has(userId)) {
      return socket.emit('room-state', {
        message: {
          type: 'kicked',
          reason: 'banned'
        }
      });
    }

    socket.data.userId = userId;
    userSocketMap.set(userId, socket.id);

    let room = getRoom(roomId);
    const isRoomOwner = room ? room.ownerId === userId : false;

    if (!room) {
      room = createRoomState(userId, roomId);
      room.users.set(userId, { ...user, userId, socketId: socket.id });
      rooms.set(roomId, room);
      acceptUserIntoRoom(socket, roomId, { ...user, userId, socketId: socket.id }, room);
      return;
    }

    if (room.users.has(userId)) {
      room.users.set(userId, { ...user, userId, socketId: socket.id });
      socket.join(roomId);
      if (room.ownerId !== userId) {
        socket.emit('room-state', {
          message: {
            type: 'room-info',
            ownerId: room.ownerId,
            roomTag: room.settings.roomTag,
            autoAccept: room.settings.autoAccept,
            autoReject: room.settings.autoReject
          }
        });
      }
      acceptUserIntoRoom(socket, roomId, { ...user, userId, socketId: socket.id }, room);
      return;
    }

    if (room.settings.autoReject && !isRoomOwner) {
      return socket.emit('room-state', {
        message: {
          type: 'lobby-rejected'
        }
      });
    }

    if (!room.settings.autoAccept && !isRoomOwner) {
      room.lobbyUsers.set(userId, { ...user, userId, socketId: socket.id });
      const ownerSocketId = userSocketMap.get(room.ownerId);
      if (ownerSocketId) {
        io.to(ownerSocketId).emit('room-state', {
          message: {
            type: 'lobby-request',
            userId,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar
          }
        });
      }

      return socket.emit('room-state', {
        message: {
          type: 'waiting-in-lobby'
        }
      });
    }

    acceptUserIntoRoom(socket, roomId, { ...user, userId, socketId: socket.id }, room);
  });

  socket.on('signal', ({ targetId, signal }: { targetId: string; signal: any }, ack?: (response: any) => void) => {
    const senderId = getUserId(socket);
    if (!senderId || !targetId || !signal) {
      ack?.({ status: 'error', reason: 'invalid-payload' });
      return;
    }

    const roomId = userRoomMap.get(senderId);
    if (!roomId) {
      ack?.({ status: 'error', reason: 'room-not-found' });
      return;
    }

    const room = getRoom(roomId);
    if (!room || !room.users.has(targetId)) {
      ack?.({ status: 'error', reason: 'target-not-in-room' });
      return;
    }

    const targetSocketId = userSocketMap.get(targetId);
    if (!targetSocketId) {
      ack?.({ status: 'error', reason: 'target-offline' });
      return;
    }

    io.to(targetSocketId).emit('signal', {
      senderId,
      signal
    });
    ack?.({ status: 'ok' });
  });

  socket.on('chat', ({ roomId, message }: { roomId: string; message: any }) => {
    const userId = getUserId(socket);
    const room = getRoom(roomId);
    if (!room || !userId || !room.users.has(userId)) return;

    broadcastRoom(roomId, 'chat', message);
  });

  socket.on('room-state', ({ roomId, message }: { roomId: string; message: RoomStateMessage }) => {
    const userId = getUserId(socket);
    const room = getRoom(roomId);
    if (!room || !userId) return;

    if (message.type === 'room-info' && room.ownerId === userId) {
      updateRoomSettings(room, message);
      broadcastRoom(roomId, 'room-state', {
        message: {
          type: 'room-info',
          ownerId: room.ownerId,
          roomTag: room.settings.roomTag,
          autoAccept: room.settings.autoAccept,
          autoReject: room.settings.autoReject
        }
      });
      return;
    }

    if (!room.users.has(userId)) return;

    if (message.type === 'mute-status' || message.type === 'cam-status' || message.type === 'profile-update') {
      broadcastRoom(roomId, 'room-state', { message });
    }
  });

  socket.on('control', ({ roomId, targetId, message }: { roomId: string; targetId?: string; message: ControlMessage }) => {
    const userId = getUserId(socket);
    if (!userId) return;

    const lastAction = lastControlAction.get(userId) ?? 0;
    if (Date.now() - lastAction < 1000) return;
    lastControlAction.set(userId, Date.now());

    const room = getRoom(roomId);
    if (!room) return;

    const isOwner = room.ownerId === userId;
    const targetUserId = targetId || message.targetId;

    switch (message.type) {
      case 'lobby-approve':
        if (!isOwner || !targetUserId || !room.lobbyUsers.has(targetUserId)) return;
        const pendingUser = room.lobbyUsers.get(targetUserId);
        if (!pendingUser) return;
        room.lobbyUsers.delete(targetUserId);
        const targetSocketId = userSocketMap.get(targetUserId);
        if (!targetSocketId) return;
        const targetSocket = io.sockets.sockets.get(targetSocketId) as Socket | undefined;
        if (!targetSocket) return;
        acceptUserIntoRoom(targetSocket, roomId, pendingUser, room);
        sendToUser(targetUserId, 'control', { message: { type: 'lobby-approve' } });
        break;
      case 'lobby-reject':
        if (!isOwner || !targetUserId || !room.lobbyUsers.has(targetUserId)) return;
        room.lobbyUsers.delete(targetUserId);
        sendToUser(targetUserId, 'control', { message: { type: 'lobby-reject' } });
        break;
      case 'kicked':
        if (!isOwner || !targetUserId || !room.users.has(targetUserId)) return;
        removeUserFromRoom(roomId, targetUserId);
        sendToUser(targetUserId, 'control', { message: { type: 'kicked' } });
        break;
      case 'ban-user':
        if (!isOwner || !targetUserId) return;
        room.bannedUsers.add(targetUserId);
        if (room.users.has(targetUserId)) {
          removeUserFromRoom(roomId, targetUserId);
          sendToUser(targetUserId, 'control', { message: { type: 'kicked' } });
        }
        break;
      case 'force-mute':
        if (!isOwner || !targetUserId || !room.users.has(targetUserId)) return;
        room.mutedUsers.add(targetUserId);
        sendToUser(targetUserId, 'control', { message: { type: 'force-mute' } });
        break;
      case 'force-unmute':
        if (!isOwner || !targetUserId || !room.users.has(targetUserId)) return;
        room.mutedUsers.delete(targetUserId);
        sendToUser(targetUserId, 'control', { message: { type: 'force-unmute' } });
        break;
      case 'delete-room':
        if (!isOwner) return;
        broadcastRoom(roomId, 'room-state', { message: { type: 'room-deleted' } });
        rooms.delete(roomId);
        break;
      case 'transfer-ownership':
        if (!isOwner || !targetUserId || !room.users.has(targetUserId)) return;
        room.ownerId = targetUserId;
        sendToUser(targetUserId, 'room-state', { message: { type: 'you-are-owner', ownerId: targetUserId } });
        broadcastRoom(roomId, 'room-state', { message: { type: 'room-info', ownerId: targetUserId, roomTag: room.settings.roomTag, autoAccept: room.settings.autoAccept, autoReject: room.settings.autoReject } });
        break;
      case 'update-settings':
        if (!isOwner) return;
        updateRoomSettings(room, message);
        broadcastRoom(roomId, 'room-state', {
          message: {
            type: 'room-info',
            ownerId: room.ownerId,
            roomTag: room.settings.roomTag,
            autoAccept: room.settings.autoAccept,
            autoReject: room.settings.autoReject
          }
        });
        break;
      default:
        break;
    }
  });

  socket.on('leave-room', ({ roomId }: { roomId: string }) => {
    const userId = getUserId(socket);
    if (!roomId || !userId) return;

    const room = getRoom(roomId);
    if (room) {
      room.lobbyUsers.delete(userId);
      broadcastRoom(roomId, 'room-state', { message: { type: 'lobby-update' } });
    }

    removeUserFromRoom(roomId, userId);
    socket.leave(roomId);
    userSocketMap.delete(userId);
    socket.data.userId = undefined;
  });

  socket.on('disconnect', () => {
    console.log('user disconnected:', socket.id);
    const userId = getUserId(socket);
    if (!userId) return;

    userSocketMap.delete(userId);

    rooms.forEach((room, roomId) => {
      if (room.users.has(userId)) {
        room.users.delete(userId);
        socket.to(roomId).emit('user-left', { userId });
      }
      if (room.lobbyUsers.delete(userId)) {
        const ownerSocketId = userSocketMap.get(room.ownerId);
        if (ownerSocketId) {
          io.to(ownerSocketId).emit('room-state', { message: { type: 'lobby-update' } });
        }
      }
    });
  });
});

server.listen(3000, () => {
  console.log('Socket.IO server listening on http://localhost:3000');
});
