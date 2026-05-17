import { Socket } from "socket.io";

export function handleChat(socket: Socket, payload: any, io: any) {
  const { roomId, message } = payload;
  
  if (!roomId || !message) {
    console.error("Invalid chat payload:", payload);
    return;
  }

  const { text, senderId, username, displayName, avatar, timestamp } = message;

  if (!text || !senderId) {
    console.error("Invalid chat message:", message);
    return;
  }

  // Broadcast to all users in the room
  io.to(roomId).emit('chat', {
    id: `${senderId}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    text,
    senderId,
    username: username || 'Unknown',
    displayName: displayName || 'User',
    avatar: avatar || undefined,
    timestamp: timestamp || Date.now()
  });

  console.log(`Chat message from ${senderId} in room ${roomId}: ${text}`);
}
