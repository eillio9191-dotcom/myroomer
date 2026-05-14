import express from "express";
import { UserManager } from "./managers/userManager.js";
import { RoomManager } from "./managers/roomManager.js";
import { PersistenceService } from "./services/persistence.service.js";
import { SnapshotManager } from "./services/snapshotManager.service.js";

export function initHttp(app: express.Application, userManager: UserManager, roomManager: RoomManager, persistence: PersistenceService, snapshotManager: SnapshotManager) {
  app.use(express.json());

  // User Search API
  app.get("/api/users/search", (req, res) => {
    const query = (req.query.q as string || "").toLowerCase();
    if (!query) return res.json([]);
    
    const results = userManager.searchUsers(query);
    res.json(results);
  });

  // Room Search API
  app.get("/api/rooms/search", (req, res) => {
    const query = (req.query.q as string || "").toLowerCase();
    if (!query) return res.json([]);

    const results = roomManager.searchRooms(query);
    res.json(results);
  });

  // Block/Unblock API
  app.post("/api/users/block", async (req, res) => {
    const { username, targetUsername } = req.body;
    const user = userManager.getUser(username);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.blockedUsers) user.blockedUsers = [];
    if (!user.blockedUsers.includes(targetUsername)) {
      user.blockedUsers.push(targetUsername);
      snapshotManager.forceSave();
    }
    res.json(user);
  });

  app.post("/api/users/unblock", async (req, res) => {
    const { username, targetUsername } = req.body;
    const user = userManager.getUser(username);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.blockedUsers) {
      user.blockedUsers = user.blockedUsers.filter(u => u !== targetUsername);
      snapshotManager.forceSave();
    }
    res.json(user);
  });

  // Login/Register API
  app.post("/api/auth/login", async (req, res) => {
    const { password, displayName, avatar } = req.body;
    const username = (req.body.username as string || "").toLowerCase();
    
    // Validation: English letters and numbers only for username
    if (!/^[a-zA-Z0-9]+$/.test(username)) {
      return res.status(400).json({ error: "Username must contain only English letters and numbers." });
    }

    const existingUser = userManager.getUser(username);
    if (existingUser) {
      if (existingUser.isBanned) {
        return res.status(403).json({ error: "Your account has been banned." });
      }
      if (existingUser.password && existingUser.password !== password) {
        return res.status(401).json({ error: "Incorrect password." });
      }
      // Get owned rooms
      const ownedRooms = roomManager.getOwnedRooms(existingUser.username);
      return res.json({ ...existingUser, ownedRooms });
    }

    // Create new user
    userManager.createUser(username, displayName, avatar, password);
    snapshotManager.forceSave();
    res.json({ ...userManager.getUser(username), ownedRooms: [] });
  });

  // Update User Profile API
  app.post("/api/users/update", async (req, res) => {
  const { displayName, avatar, theme, language, password } = req.body;
    const username = (req.body.username as string || "").toLowerCase();
    const user = userManager.getUser(username);
    if (!user) return res.status(404).json({ error: "User not found" });

    const updatedUser = { ...user, displayName, avatar, theme, language };
    if (password) updatedUser.password = password;
    
    userManager.updateUser(username, updatedUser);
    snapshotManager.forceSave();
    
    const ownedRooms = roomManager.getOwnedRooms(username);
    res.json({ ...updatedUser, ownedRooms });
  });

  // Admin API: Get all users and their rooms
  app.get("/api/admin/data", (req, res) => {
    const allData = userManager.getAllUsers().map(user => {
      const ownedRooms = roomManager.getOwnedRooms(user.username);
      return {
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isBanned: user.isBanned || false,
        ownedRooms: ownedRooms
      };
    });
    res.json(allData);
  });

  // Admin API: Ban/Unban user
  app.post("/api/admin/toggle-ban", async (req, res) => {
    const { username, adminUsername, adminToken } = req.body;
    const adminSecret = process.env.ADMIN_SECRET || "1";
    const authToken = adminToken || adminUsername;

    if (!authToken || authToken !== adminSecret) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const success = userManager.banUser(username);
    if (!success) {
      return res.status(404).json({ error: "User not found" });
    }

    snapshotManager.forceSave();
    res.json({ success: true, isBanned: userManager.getUser(username)?.isBanned });
  });

  // Room Settings API
  app.get("/api/rooms/settings", (req, res) => {
    const roomId = (req.query.roomId as string || "").toLowerCase();
    const room = roomManager.getRoom(roomId);
    const settings = room?.settings || { autoAccept: false, autoReject: false };
    res.json(settings);
  });

  app.post("/api/rooms/create", async (req, res) => {
    const { username, roomTag } = req.body;
    const roomId = (req.body.roomId as string || "").toLowerCase().trim();

    if (!username || !roomId) {
      return res.status(400).json({ error: "Username and roomId are required." });
    }

    const user = userManager.getUser(username);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const existingRoom = roomManager.getRoom(roomId);
    if (existingRoom) {
      if (existingRoom.owner === username) {
        return res.json({ success: true });
      }
      return res.status(409).json({ error: "Room already exists and is owned by another user." });
    }

    roomManager.createRoom(roomId, username, roomTag || roomId);
    snapshotManager.forceSave();
    res.json({ success: true });
  });

  app.get("/api/rooms/exists", (req, res) => {
    const roomId = (req.query.roomId as string || "").toLowerCase();
    res.json({ exists: !!roomManager.getRoom(roomId) });
  });

  app.get("/api/rooms/details", (req, res) => {
    const roomId = (req.query.roomId as string || "").toLowerCase();
    const room = roomManager.getRoom(roomId);
    if (!room) return res.status(404).json({ error: "Room not found" });
    
    const owner = userManager.getUser(room.owner);
    res.json({
      id: roomId,
      tag: room.tag,
      owner: room.owner,
      ownerDisplayName: owner?.displayName || room.owner,
      ownerAvatar: owner?.avatar,
      createdAt: room.createdAt || Date.now()
    });
  });

  app.post("/api/rooms/settings", async (req, res) => {
    const { username, settings } = req.body;
    const roomId = (req.body.roomId as string || "").toLowerCase();
    const room = roomManager.getRoom(roomId);
    if (!room || room.owner !== username) return res.status(403).json({ error: "Not owner" });
    
    roomManager.setSettings(roomId, settings);
    snapshotManager.forceSave();
    res.json({ success: true });
  });

  app.post('/api/rooms/delete', async (req, res) => {
    const { username } = req.body;
    const roomId = (req.body.roomId as string || "").toLowerCase();
    const room = roomManager.getRoom(roomId);
    if (!room || room.owner !== username) return res.status(403).json({ error: 'Not owner' });
    
    roomManager.deleteRoom(roomId);
    snapshotManager.forceSave();
    // TODO: Notify users
    res.json({ success: true });
  });
}