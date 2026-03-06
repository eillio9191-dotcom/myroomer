import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

  // Room state: roomId -> Set of WebSockets
  const rooms = new Map<string, Set<WebSocket>>();
  // Socket metadata: WebSocket -> { roomId, userId, username, displayName, avatar }
  const socketInfo = new Map<WebSocket, { roomId: string; userId: string; username: string; displayName: string; avatar?: string }>();

  // Data structures for persistence and features
  const users = new Map<string, { username: string; displayName: string; avatar?: string; theme: string; language: string; password?: string }>();
  const roomOwners = new Map<string, string>(); // roomId -> userId (owner)
  const roomLobbies = new Map<string, Set<WebSocket>>(); // roomId -> Set of waiting WebSockets
  const roomTags = new Map<string, string>(); // roomId -> tag
  const userSockets = new Map<string, WebSocket>(); // userId -> WebSocket (for direct calls)
  const roomSettings = new Map<string, { autoAccept: boolean; autoReject: boolean }>(); // roomId -> settings

  app.use(express.json());

  // User Search API
  app.get("/api/users/search", (req, res) => {
    const query = (req.query.q as string || "").toLowerCase();
    if (!query) return res.json([]);
    
    const results = Array.from(users.values())
      .filter(u => u.username.toLowerCase().includes(query) || u.displayName.toLowerCase().includes(query))
      .map(u => ({ username: u.username, displayName: u.displayName, avatar: u.avatar }))
      .slice(0, 10);
    
    res.json(results);
  });

  // Login/Register API
  app.post("/api/auth/login", (req, res) => {
    const { username, password, displayName, avatar } = req.body;
    
    // Validation: English letters and numbers only for username
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return res.status(400).json({ error: "Username must contain only English letters and numbers." });
    }

    const existingUser = users.get(username);
    if (existingUser) {
      if (existingUser.password && existingUser.password !== password) {
        return res.status(401).json({ error: "Incorrect password." });
      }
      return res.json(existingUser);
    }

    // Create new user
    const newUser = { 
      username, 
      displayName: displayName || username, 
      avatar, 
      password,
      theme: 'dark', 
      language: 'en' 
    };
    users.set(username, newUser);
    res.json(newUser);
  });

  app.post('/api/rooms/delete', (req, res) => {
    const { roomId, username } = req.body;
    if (roomOwners.get(roomId) === username) {
      roomOwners.delete(roomId);
      roomLobbies.delete(roomId);
      // Notify users in room if any
      const roomClients = rooms.get(roomId);
      if (roomClients) {
        roomClients.forEach(client => {
          client.send(JSON.stringify({ type: "room-deleted" }));
          client.close();
        });
        rooms.delete(roomId);
      }
      res.json({ success: true });
    } else {
      res.status(403).json({ error: 'Not owner' });
    }
  });

  const joinRoom = (ws: WebSocket, roomId: string, userId: string, username: string, displayName: string, avatar?: string) => {
    // Leave previous room if any
    const oldInfo = socketInfo.get(ws);
    if (oldInfo) {
      rooms.get(oldInfo.roomId)?.delete(ws);
    }

    // Join new room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }
    rooms.get(roomId)!.add(ws);
    socketInfo.set(ws, { roomId, userId, username, displayName, avatar });

    // Notify others in the room
    rooms.get(roomId)!.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: "user-joined",
          userId,
          username,
          displayName,
          avatar
        }));
      }
    });

    // Send current users to the new joiner
    const usersInRoom = Array.from(rooms.get(roomId)!)
      .filter(c => c !== ws)
      .map(c => socketInfo.get(c)!);
    
    ws.send(JSON.stringify({
      type: "room-users",
      users: usersInRoom
    }));

    console.log(`User ${userId} joined room ${roomId}`);
  };

  wss.on("connection", (ws) => {
    console.log("New connection");

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "join": {
          const { roomId, userId, username, displayName, avatar, isOwner, roomTag } = message;
          
          // Track user socket for direct calls
          userSockets.set(userId, ws);

          // Handle room ownership
          if (isOwner && !roomOwners.has(roomId)) {
            roomOwners.set(roomId, userId);
          }

          if (roomTag) {
            roomTags.set(roomId, roomTag);
          }

          const ownerId = roomOwners.get(roomId);
          const settings = roomSettings.get(roomId) || { autoAccept: false, autoReject: false };
          
          // Handle auto-settings
          if (ownerId && ownerId !== userId) {
            if (settings.autoReject) {
              ws.send(JSON.stringify({ type: "lobby-rejected" }));
              return;
            }
            if (settings.autoAccept) {
              joinRoom(ws, roomId, userId, username, displayName, avatar);
              ws.send(JSON.stringify({ type: "room-info", roomId, roomTag: roomTags.get(roomId) }));
              return;
            }
          }

          // If room has an owner and joiner is not the owner, they go to lobby
          if (ownerId && ownerId !== userId) {
            if (!roomLobbies.has(roomId)) roomLobbies.set(roomId, new Set());
            roomLobbies.get(roomId)!.add(ws);
            socketInfo.set(ws, { roomId, userId, username, displayName, avatar });

            // Notify owner about waiting user
            const ownerSocket = userSockets.get(ownerId);
            if (ownerSocket && ownerSocket.readyState === WebSocket.OPEN) {
              ownerSocket.send(JSON.stringify({
                type: "lobby-request",
                userId,
                username,
                displayName,
                avatar
              }));
            }

            ws.send(JSON.stringify({ type: "waiting-in-lobby" }));
            return;
          }

          // Proceed with joining
          joinRoom(ws, roomId, userId, username, displayName, avatar);

          // Send room info (tag)
          ws.send(JSON.stringify({
            type: "room-info",
            roomId,
            roomTag: roomTags.get(roomId)
          }));
          break;
        }

        case "lobby-approve": {
          const { roomId, targetId } = message;
          const info = socketInfo.get(ws);
          if (!info || roomOwners.get(roomId) !== info.userId) return;

          const waitingWs = Array.from(roomLobbies.get(roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (waitingWs) {
            roomLobbies.get(roomId)!.delete(waitingWs);
            const wInfo = socketInfo.get(waitingWs)!;
            joinRoom(waitingWs, roomId, wInfo.userId, wInfo.username, wInfo.displayName, wInfo.avatar);
            
            // Notify the approved user
            waitingWs.send(JSON.stringify({
              type: "room-info",
              roomId,
              roomTag: roomTags.get(roomId)
            }));
          }
          break;
        }

        case "room-settings": {
          const { roomId, autoAccept, autoReject } = message;
          const info = socketInfo.get(ws);
          if (!info || roomOwners.get(roomId) !== info.userId) return;

          roomSettings.set(roomId, { autoAccept, autoReject });
          
          // If auto-accept is turned on, approve all currently waiting
          if (autoAccept) {
            const waiting = roomLobbies.get(roomId);
            if (waiting) {
              waiting.forEach(waitingWs => {
                roomLobbies.get(roomId)!.delete(waitingWs);
                const wInfo = socketInfo.get(waitingWs)!;
                joinRoom(waitingWs, roomId, wInfo.userId, wInfo.username, wInfo.displayName, wInfo.avatar);
                waitingWs.send(JSON.stringify({ type: "room-info", roomId, roomTag: roomTags.get(roomId) }));
              });
            }
          }
          // If auto-reject is turned on, reject all currently waiting
          if (autoReject) {
            const waiting = roomLobbies.get(roomId);
            if (waiting) {
              waiting.forEach(waitingWs => {
                roomLobbies.get(roomId)!.delete(waitingWs);
                waitingWs.send(JSON.stringify({ type: "lobby-rejected" }));
              });
            }
          }
          break;
        }

        case "lobby-reject": {
          const { roomId, targetId } = message;
          const info = socketInfo.get(ws);
          if (!info || roomOwners.get(roomId) !== info.userId) return;

          const waitingWs = Array.from(roomLobbies.get(roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (waitingWs) {
            roomLobbies.get(roomId)!.delete(waitingWs);
            waitingWs.send(JSON.stringify({ type: "lobby-rejected" }));
          }
          break;
        }

        case "kick-user": {
          const { roomId, targetId } = message;
          const info = socketInfo.get(ws);
          if (!info || roomOwners.get(roomId) !== info.userId) return;

          const targetSocket = Array.from(rooms.get(roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (targetSocket) {
            targetSocket.send(JSON.stringify({ type: "kicked" }));
            targetSocket.close();
          }
          break;
        }

        case "delete-room": {
          const { roomId } = message;
          const info = socketInfo.get(ws);
          if (!info || roomOwners.get(roomId) !== info.userId) return;

          // Notify everyone and close room
          rooms.get(roomId)?.forEach(client => {
            client.send(JSON.stringify({ type: "room-deleted" }));
            client.close();
          });

          rooms.delete(roomId);
          roomOwners.delete(roomId);
          roomLobbies.delete(roomId);
          break;
        }

        case "update-room-tag": {
          const { roomId, roomTag } = message;
          const info = socketInfo.get(ws);
          if (!info || roomOwners.get(roomId) !== info.userId) return;

          roomTags.set(roomId, roomTag);
          
          // Notify everyone in the room
          rooms.get(roomId)?.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "room-info",
                roomId,
                roomTag
              }));
            }
          });
          break;
        }

        case "direct-call": {
          const { targetUsername, callerId, callerDisplayName, callerAvatar, roomId: providedRoomId } = message;
          const targetUser = users.get(targetUsername);
          if (!targetUser) return;

          const targetSocket = userSockets.get(targetUsername); // Using username as ID for simplicity in search
          if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
            targetSocket.send(JSON.stringify({
              type: "incoming-call",
              callerId,
              callerDisplayName,
              callerAvatar,
              roomId: providedRoomId || `call-${callerId}-${Date.now()}`
            }));
          }
          break;
        }

        case "signal": {
          const { targetId, signal, senderId } = message;
          const info = socketInfo.get(ws);
          if (!info) return;

          // Find target socket
          const targetSocket = Array.from(rooms.get(info.roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
            targetSocket.send(JSON.stringify({
              type: "signal",
              senderId,
              signal
            }));
          }
          break;
        }

        case "chat": {
          const { text, senderId, username, displayName, avatar, timestamp } = message;
          const info = socketInfo.get(ws);
          if (!info) return;

          // Broadcast to everyone in the room
          rooms.get(info.roomId)?.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "chat",
                text,
                senderId,
                username,
                displayName,
                avatar,
                timestamp
              }));
            }
          });
          break;
        }

        case "mute-status": {
          const { senderId, isMuted } = message;
          const info = socketInfo.get(ws);
          if (!info) return;

          // Broadcast to everyone in the room
          rooms.get(info.roomId)?.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "mute-status",
                senderId,
                isMuted
              }));
            }
          });
          break;
        }

        case "profile-update": {
          const { senderId, displayName, avatar } = message;
          const info = socketInfo.get(ws);
          if (!info) return;

          // Update local state
          info.displayName = displayName;
          info.avatar = avatar;

          // Broadcast to everyone in the room
          rooms.get(info.roomId)?.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "profile-update",
                senderId,
                displayName,
                avatar
              }));
            }
          });
          break;
        }
      }
    });

    ws.on("close", () => {
      const info = socketInfo.get(ws);
      if (info) {
        // Remove from userSockets
        userSockets.delete(info.userId);

        // Remove from lobbies
        roomLobbies.get(info.roomId)?.delete(ws);

        const room = rooms.get(info.roomId);
        if (room) {
          room.delete(ws);
          // Notify others
          room.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "user-left",
                userId: info.userId
              }));
            }
          });
          if (room.size === 0) {
            rooms.delete(info.roomId);
            // If room is empty, we don't necessarily delete owner, 
            // but the user requested "cancel room" which we handle in delete-room
          }
        }
        socketInfo.delete(ws);
      }
      console.log("Connection closed");
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
