import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";
import fs from "fs/promises";
import { roomService } from "./roomService.js";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;
  const DATA_FILE = path.join(process.cwd(), "data.json");
  const distPath = path.join(process.cwd(), "dist");

  // Room state: roomId -> Set of WebSockets
  const rooms = new Map<string, Set<WebSocket>>();
  // Socket metadata: WebSocket -> { roomId, userId, username, displayName, avatar }
  const socketInfo = new Map<WebSocket, { roomId: string; userId: string; username: string; displayName: string; avatar?: string }>();

  // Data structures for persistence and features
  let users = new Map<string, { username: string; displayName: string; avatar?: string; theme: string; language: string; password?: string; isBanned?: boolean; blockedUsers?: string[] }>();
  const roomLobbies = new Map<string, Set<WebSocket>>(); // roomId -> Set of waiting WebSockets
  const userSockets = new Map<string, WebSocket>(); // userId -> WebSocket (for direct calls)

  // Persistence logic
  const loadData = async () => {
    try {
      const data = await fs.readFile(DATA_FILE, "utf-8");
      const json = JSON.parse(data);
      users = new Map(Object.entries(json.users || {}));
      console.log("User data loaded from disk");
    } catch (e) {
      console.log("No existing user data found, starting fresh");
    }
    await roomService.loadRoomData();
  };

  const saveData = async () => {
    const data = {
      users: Object.fromEntries(users),
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    await roomService.saveRoomData();
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

    const results = roomService.getRoomSearchResults()
      .filter(({ id, tag }) => {
        return id.toLowerCase().includes(query) || tag.toLowerCase().includes(query);
      })
      .map(({ id, tag, owner }) => ({
        id,
        tag,
        owner: users.get(owner)?.displayName || owner
      }))
      .slice(0, 10);

    res.json(results);
  });

  // Block/Unblock API
  app.post("/api/users/block", async (req, res) => {
    const { username, targetUsername } = req.body;
    const user = users.get(username);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.blockedUsers) user.blockedUsers = [];
    if (!user.blockedUsers.includes(targetUsername)) {
      user.blockedUsers.push(targetUsername);
      await saveData();
    }
    res.json(user);
  });

  app.post("/api/users/unblock", async (req, res) => {
    const { username, targetUsername } = req.body;
    const user = users.get(username);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.blockedUsers) {
      user.blockedUsers = user.blockedUsers.filter(u => u !== targetUsername);
      await saveData();
    }
    res.json(user);
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
      const ownedRooms = roomService.getOwnedRooms(username);
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
    
    const ownedRooms = roomService.getOwnedRooms(username);
      
    res.json({ ...updatedUser, ownedRooms });
  });

  // Admin API: Get all users and their rooms (requires authentication as admin)
  app.get("/api/admin/data", (req, res) => {
    const adminUsername = (req.query.admin as string || "");
    if (adminUsername !== '1') {
      return res.status(403).json({ error: "Unauthorized. Admin access only." });
    }
    
    const allData = Array.from(users.values()).map(user => {
      const ownedRooms = roomService.getAllRoomsForAdmin()
        .filter(({ room }) => room.owner === user.username)
        .map(({ id, room }) => ({
          id,
          tag: room.tag
        }));
      return {
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        password: user.password, // Available for admin '1' only
        isBanned: user.isBanned || false,
        ownedRooms
      };
    });
    res.json(allData);
  });

  // Admin API: Ban/Unban user (requires authentication as admin)
  app.post("/api/admin/toggle-ban", async (req, res) => {
    const { username, adminUsername } = req.body;
    if (adminUsername !== '1') {
      return res.status(403).json({ error: "Unauthorized. Admin access only." });
    }
    
    const user = users.get(username);
    if (!user) return res.status(404).json({ error: "User not found" });
    
    if (username === '1') {
      return res.status(403).json({ error: "Cannot ban the admin user." });
    }
    
    user.isBanned = !user.isBanned;
    await saveData();
    res.json({ success: true, isBanned: user.isBanned });
  });

  // Room Settings API
  app.get("/api/rooms/settings", (req, res) => {
    const roomId = req.query.roomId as string;
    if (!roomId) return res.status(400).json({ error: "roomId required" });

    const settings = roomService.getRoomSettings(roomId);
    res.json(settings);
  });

  app.post("/api/rooms/create", async (req, res) => {
    const { username, roomTag } = req.body;
    const roomId = (req.body.roomId as string || "").toLowerCase();
    try {
      roomService.createRoom(roomId, username, roomTag);
      await roomService.saveRoomData();
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
    }
  });

  app.get("/api/rooms/exists", (req, res) => {
    const roomId = (req.query.roomId as string || "").toLowerCase();
    res.json({ exists: roomService.roomExists(roomId) });
  });

  app.post("/api/rooms/settings", async (req, res) => {
    const { username, settings } = req.body;
    const roomId = (req.body.roomId as string || "").toLowerCase();
    if (!roomService.canModifySettings(roomId, username)) return res.status(403).json({ error: "Not owner" });

    roomService.updateRoomSettings(roomId, settings);
    await roomService.saveRoomData();
    res.json({ success: true });
  });
  app.post('/api/rooms/delete', async (req, res) => {
    const { username } = req.body;
    const roomId = (req.body.roomId as string || "").toLowerCase();
    if (!roomService.canDeleteRoom(roomId, username)) return res.status(403).json({ error: "Not owner or admin" });

    roomService.deleteRoom(roomId);
    await roomService.saveRoomData();
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
          const { userId, username, displayName, avatar, isOwner, roomTag } = message;
          const roomId = (message.roomId as string || "").toLowerCase();
          
          console.log(`Join attempt: userId=${userId}, username=${username}, roomId=${roomId}, isOwner=${isOwner}`);
          
          const user = users.get(username);
          if (user?.isBanned) {
            ws.send(JSON.stringify({ type: "error", message: "You are banned." }));
            ws.close();
            return;
          }

          // Track user socket for direct calls (using username as key for consistency)
          userSockets.set(username, ws);

          // Handle room ownership
          let ownerId = roomService.getRoomOwner(roomId);
          const isFreshRoom = !rooms.has(roomId) || rooms.get(roomId)!.size === 0;
          console.log(`Room ${roomId}: ownerId=${ownerId}, isFreshRoom=${isFreshRoom}`);

          if (!ownerId && isFreshRoom) {
            roomService.setOwner(roomId, userId);
            ownerId = userId;
            ws.send(JSON.stringify({ type: "you-are-owner", roomId }));
            console.log(`Set ${userId} as owner for fresh room ${roomId}`);
          } else if (ownerId === userId) {
            ws.send(JSON.stringify({ type: "you-are-owner", roomId }));
            console.log(`${userId} is owner of ${roomId}`);
          }

          if (roomTag) {
            roomService.updateRoomTag(roomId, roomTag);
            await roomService.saveRoomData();
          }

          const settings = roomService.getRoomSettings(roomId);
          // Handle auto-settings and Admin Bypass
          if (ownerId && ownerId !== userId) {
            // Admin (user 1) bypasses lobby and gains owner privileges
            if (username === '1') {
              joinRoom(ws, roomId, userId, username, displayName, avatar);
              ws.send(JSON.stringify({ type: "you-are-owner", roomId }));
              ws.send(JSON.stringify({ type: "room-info", roomId, roomTag: roomService.getRoomTag(roomId), autoAccept: settings.autoAccept, autoReject: settings.autoReject }));
              console.log(`Admin ${username} joined ${roomId} directly`);
              return;
            }

            if (settings.autoReject) {
              ws.send(JSON.stringify({ type: "lobby-rejected" }));
              console.log(`User ${userId} rejected from ${roomId} due to autoReject`);
              return;
            }

            if (settings.autoAccept) {
              joinRoom(ws, roomId, userId, username, displayName, avatar);
              ws.send(JSON.stringify({ type: "room-info", roomId, roomTag: roomService.getRoomTag(roomId), autoAccept: settings.autoAccept, autoReject: settings.autoReject }));
              console.log(`User ${userId} auto-accepted into ${roomId}`);
              return;
            }

            // Manual lobby flow for owner review
            if (!roomLobbies.has(roomId)) {
              roomLobbies.set(roomId, new Set());
            }
            roomLobbies.get(roomId)!.add(ws);
            socketInfo.set(ws, { roomId, userId, username, displayName, avatar });
            ws.send(JSON.stringify({ type: "waiting-in-lobby" }));
            console.log(`User ${userId} is waiting in lobby for ${roomId}`);

            const ownerSocket = Array.from(rooms.get(roomId) || [])
              .find(c => socketInfo.get(c)?.userId === ownerId);
            if (ownerSocket?.readyState === WebSocket.OPEN) {
              ownerSocket.send(JSON.stringify({
                type: "lobby-request",
                userId,
                username,
                displayName,
                avatar
              }));
            }
            return;
          }

          // Join room directly when lobby is not required
          joinRoom(ws, roomId, userId, username, displayName, avatar);
          ws.send(JSON.stringify({
            type: "room-info",
            roomId,
            roomTag: roomService.getRoomTag(roomId),
            autoAccept: settings.autoAccept,
            autoReject: settings.autoReject
          }));
          console.log(`User ${userId} joined ${roomId} directly`);
          break;
        }

        case "lobby-approve": {
          const { targetId } = message;
          const roomId = (message.roomId as string || "").toLowerCase();
          const info = socketInfo.get(ws);
          if (!info || !roomService.isOwner(roomId, info.username)) return;

          const waitingWs = Array.from(roomLobbies.get(roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (waitingWs) {
            roomLobbies.get(roomId)!.delete(waitingWs);
            const wInfo = socketInfo.get(waitingWs)!;
            joinRoom(waitingWs, roomId, wInfo.userId, wInfo.username, wInfo.displayName, wInfo.avatar);
            socketInfo.set(waitingWs, {
              roomId,
              userId: wInfo.userId,
              username: wInfo.username,
              displayName: wInfo.displayName,
              avatar: wInfo.avatar
            });
            
            // Notify all users in the room (including owner) that the user joined
            rooms.get(roomId)!.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({
                  type: "user-joined",
                  userId: wInfo.userId,
                  username: wInfo.username,
                  displayName: wInfo.displayName,
                  avatar: wInfo.avatar
                }));
              }
            });
            
            // Notify the approved user
            waitingWs.send(JSON.stringify({
              type: "room-info",
              roomId,
              roomTag: roomService.getRoomTag(roomId)
            }));
          }
          break;
        }

        case "room-settings": {
          const { autoAccept, autoReject } = message;
          const roomId = (message.roomId as string || "").toLowerCase();
          const info = socketInfo.get(ws);
          if (!info || !roomService.canModifySettings(roomId, info.userId)) return;

          roomService.updateRoomSettings(roomId, { autoAccept, autoReject });
          await roomService.saveRoomData();

          // Broadcast updated settings to everyone in the room
          rooms.get(roomId)?.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: "room-info",
                roomId,
                roomTag: roomService.getRoomTag(roomId),
                autoAccept,
                autoReject
              }));
            }
          });

          // If auto-accept is turned on, approve all currently waiting
          if (autoAccept) {
            const waiting = roomLobbies.get(roomId);
            if (waiting) {
              waiting.forEach(waitingWs => {
                roomLobbies.get(roomId)!.delete(waitingWs);
                const wInfo = socketInfo.get(waitingWs)!;
                joinRoom(waitingWs, roomId, wInfo.userId, wInfo.username, wInfo.displayName, wInfo.avatar);
                waitingWs.send(JSON.stringify({ type: "room-info", roomId, roomTag: roomService.getRoomTag(roomId), autoAccept, autoReject }));
              });
            }
          }

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
          const { targetId } = message;
          const roomId = (message.roomId as string || "").toLowerCase();
          const info = socketInfo.get(ws);
          if (!info || !roomService.isOwner(roomId, info.username)) return;

          const waitingWs = Array.from(roomLobbies.get(roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (waitingWs) {
            roomLobbies.get(roomId)!.delete(waitingWs);
            waitingWs.send(JSON.stringify({ type: "lobby-rejected" }));
          }
          break;
        }

        case "kick-user": {
          const { targetId } = message;
          const roomId = (message.roomId as string || "").toLowerCase();
          const info = socketInfo.get(ws);
          if (!info || !roomService.canKick(roomId, info.username)) return;

          const targetSocket = Array.from(rooms.get(roomId) || [])
            .find(c => socketInfo.get(c)?.userId === targetId);

          if (targetSocket) {
            targetSocket.send(JSON.stringify({ type: "kicked" }));
            targetSocket.close();
          }
          break;
        }

        case "delete-room": {
          const roomId = (message.roomId as string || "").toLowerCase();
          const info = socketInfo.get(ws);
          if (!info || !roomService.canDeleteRoom(roomId, info.username)) return;

          // Notify everyone and close room
          rooms.get(roomId)?.forEach(client => {
            client.send(JSON.stringify({ type: "room-deleted" }));
            client.close();
          });

          rooms.delete(roomId);
          roomService.deleteRoom(roomId);
          await roomService.saveRoomData();
          break;
        }

        case "update-room-tag": {
          const { roomId, roomTag } = message;
          const info = socketInfo.get(ws);
          if (!info || !roomService.isOwner(roomId, info.username)) return;

          roomService.updateRoomTag(roomId, roomTag);
          await roomService.saveRoomData();

          // Notify all clients in the room
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

          // Check if target has blocked the caller
          if (targetUser.blockedUsers && targetUser.blockedUsers.includes(callerId)) {
            console.log(`Call from ${callerId} to ${targetUsername} blocked.`);
            return;
          }

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
          const { targetId, signal, senderId, roomId } = message;
          const info = socketInfo.get(ws);
          if (!info) return;

          const normalizedRoomId = (roomId as string || "").toLowerCase();
          const targetSocket = Array.from(rooms.get(normalizedRoomId) || [])
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
        // Remove from userSockets (using username as key)
        userSockets.delete(info.username);

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

  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
