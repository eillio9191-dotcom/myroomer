import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import fs from "fs/promises";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;
  const DATA_FILE = path.join(process.cwd(), "data.json");

  // Room state: roomId -> Set of WebSockets
  const rooms = new Map<string, Set<WebSocket>>();
  // Socket metadata: WebSocket -> { roomId, userId, username, displayName, avatar }
  const socketInfo = new Map<WebSocket, { roomId: string; userId: string; username: string; displayName: string; avatar?: string }>();

  // Data structures for persistence and features
  let users = new Map<string, { username: string; displayName: string; avatar?: string; theme: string; language: string; password?: string; isBanned?: boolean }>();
  let roomOwners = new Map<string, string>(); // roomId -> userId (owner)
  const roomLobbies = new Map<string, Set<WebSocket>>(); // roomId -> Set of waiting WebSockets
  let roomTags = new Map<string, string>(); // roomId -> tag
  const userSockets = new Map<string, WebSocket>(); // userId -> WebSocket (for direct calls)
  let roomSettings = new Map<string, { autoAccept: boolean; autoReject: boolean }>(); // roomId -> settings

  // Persistence logic
  const loadData = async () => {
    try {
      const data = await fs.readFile(DATA_FILE, "utf-8");
      const json = JSON.parse(data);
      users = new Map(Object.entries(json.users || {}));
      roomOwners = new Map(Object.entries(json.roomOwners || {}));
      roomTags = new Map(Object.entries(json.roomTags || {}));
      roomSettings = new Map(Object.entries(json.roomSettings || {}));
      console.log("Data loaded from disk");
    } catch (e) {
      console.log("No existing data found, starting fresh");
    }
  };

  const saveData = async () => {
    const data = {
      users: Object.fromEntries(users),
      roomOwners: Object.fromEntries(roomOwners),
      roomTags: Object.fromEntries(roomTags),
      roomSettings: Object.fromEntries(roomSettings),
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  };

  await loadData();

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

  // Room Search API
  app.get("/api/rooms/search", (req, res) => {
    const query = (req.query.q as string || "").toLowerCase();
    if (!query) return res.json([]);
    
    const results = Array.from(roomOwners.entries())
      .filter(([id, _]) => {
        const tag = (roomTags.get(id) || "").toLowerCase();
        return id.toLowerCase().includes(query) || tag.includes(query);
      })
      .map(([id, owner]) => ({
        id,
        tag: roomTags.get(id),
        owner: users.get(owner)?.displayName || owner
      }))
      .slice(0, 10);
    
    res.json(results);
  });

  // Login/Register API
  app.post("/api/auth/login", async (req, res) => {
    const { username, password, displayName, avatar } = req.body;
    
    // Validation: English letters and numbers only for username
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return res.status(400).json({ error: "Username must contain only English letters and numbers." });
    }

    const existingUser = users.get(username);
    if (existingUser) {
      if (existingUser.isBanned) {
        return res.status(403).json({ error: "Your account has been banned." });
      }
      if (existingUser.password && existingUser.password !== password) {
        return res.status(401).json({ error: "Incorrect password." });
      }
      // Get owned rooms
      const ownedRooms = Array.from(roomOwners.entries())
        .filter(([_, owner]) => owner === username)
        .map(([id, _]) => id);
      return res.json({ ...existingUser, ownedRooms });
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
    await saveData();
    res.json({ ...newUser, ownedRooms: [] });
  });

  // Update User Profile API
  app.post("/api/users/update", async (req, res) => {
    const { username, displayName, avatar, theme, language, password } = req.body;
    const user = users.get(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const updatedUser = { ...user, displayName, avatar, theme, language };
    if (password) updatedUser.password = password;
    
    users.set(username, updatedUser);
    await saveData();
    
    const ownedRooms = Array.from(roomOwners.entries())
      .filter(([_, owner]) => owner === username)
      .map(([id, _]) => id);
      
    res.json({ ...updatedUser, ownedRooms });
  });

  // Admin API: Get all users and their rooms
  app.get("/api/admin/data", (req, res) => {
    const allData = Array.from(users.values()).map(user => {
      const ownedRooms = Array.from(roomOwners.entries())
        .filter(([_, owner]) => owner === user.username)
        .map(([id, _]) => ({
          id,
          tag: roomTags.get(id) || "No Tag"
        }));
      return {
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        password: user.password, // Added password for admin
        isBanned: user.isBanned || false,
        ownedRooms
      };
    });
    res.json(allData);
  });

  // Admin API: Ban/Unban user
  app.post("/api/admin/toggle-ban", async (req, res) => {
    const { username, adminUsername } = req.body;
    if (adminUsername !== '1') return res.status(403).json({ error: "Unauthorized" });
    
    const user = users.get(username);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    user.isBanned = !user.isBanned;
    await saveData();
    res.json({ success: true, isBanned: user.isBanned });
  });

  // Room Settings API
  app.get("/api/rooms/settings", (req, res) => {
    const roomId = req.query.roomId as string;
    const settings = roomSettings.get(roomId) || { autoAccept: false, autoReject: false };
    res.json(settings);
  });

  app.post("/api/rooms/create", async (req, res) => {
    const { roomId, username, roomTag } = req.body;
    if (roomOwners.has(roomId)) {
      return res.status(400).json({ error: "Room already exists and is owned by someone else." });
    }
    roomOwners.set(roomId, username);
    roomTags.set(roomId, roomTag || roomId);
    await saveData();
    res.json({ success: true });
  });

  app.get("/api/rooms/exists", (req, res) => {
    const roomId = req.query.roomId as string;
    res.json({ exists: roomOwners.has(roomId) });
  });

  app.post("/api/rooms/settings", async (req, res) => {
    const { roomId, username, settings } = req.body;
    if (roomOwners.get(roomId) !== username) return res.status(403).json({ error: "Not owner" });
    
    roomSettings.set(roomId, settings);
    await saveData();
    res.json({ success: true });
  });

  app.post('/api/rooms/delete', async (req, res) => {
    const { roomId, username } = req.body;
    if (roomOwners.get(roomId) === username) {
      roomOwners.delete(roomId);
      roomLobbies.delete(roomId);
      roomTags.delete(roomId);
      roomSettings.delete(roomId);
      await saveData();
      // Notify users in room if any
      const roomClients = rooms.get(roomId);
      if (roomClients) {
        roomClients.forEach(client => {
          try {
            client.send(JSON.stringify({ type: "room-deleted" }));
            client.close();
          } catch (e) {}
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

    ws.on("message", async (data) => {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "join": {
          const { roomId, userId, username, displayName, avatar, isOwner, roomTag } = message;
          
          const user = users.get(username);
          if (user?.isBanned) {
            ws.send(JSON.stringify({ type: "error", message: "You are banned." }));
            ws.close();
            return;
          }

          // Track user socket for direct calls
          userSockets.set(userId, ws);

          // Handle room ownership
          let ownerId = roomOwners.get(roomId);
          if (ownerId === userId) {
            ws.send(JSON.stringify({ type: "you-are-owner", roomId }));
          }

          if (roomTag) {
            roomTags.set(roomId, roomTag);
            await saveData();
          }

          const settings = roomSettings.get(roomId) || { autoAccept: false, autoReject: false };
          
          // Handle auto-settings and Admin Bypass
          if (ownerId && ownerId !== userId) {
            // Admin (user 1) bypasses lobby
            if (username === '1') {
              joinRoom(ws, roomId, userId, username, displayName, avatar);
              return;
            }

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
          await saveData();
          
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
          await saveData();
          break;
        }

        case "update-room-tag": {
          const { roomId, roomTag } = message;
          const info = socketInfo.get(ws);
          if (!info || roomOwners.get(roomId) !== info.userId) return;

          roomTags.set(roomId, roomTag);
          await saveData();
          
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

        case "quality-request": {
          const { targetId, senderId, level } = message;
          const info = socketInfo.get(ws);
          if (!info) return;

          // Find target socket
          const targetSocket = Array.from(rooms.get(info.roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
            targetSocket.send(JSON.stringify({
              type: "quality-request",
              senderId,
              level
            }));
          }
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
