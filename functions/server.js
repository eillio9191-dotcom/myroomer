const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const { createServer } = require('http');
const path = require('path');

// Initialize Firebase Admin
admin.initializeApp();

const app = express();
const server = createServer(app);

// Import managers and services (adapted for Firebase)
const { UserManager } = require('./managers/userManager.js');
const { RoomManager } = require('./managers/roomManager.js');
const { SocketManager } = require('./managers/socketManager.js');
const { SnapshotManager } = require('./services/snapshotManager.service.js');
const { EventBus } = require('./services/eventBus.service.js');
const { PersistenceService } = require('./services/persistence.service.js');
const { RoomActorManager } = require('./services/roomActorManager.service.js');

// CORS middleware
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// Initialize services
async function initializeServices() {
  const eventBus = new EventBus();
  const persistence = new PersistenceService();
  const data = await persistence.loadData();

  const userManager = new UserManager(eventBus);
  const roomManager = new RoomManager(eventBus);
  const socketManager = new SocketManager(eventBus);

  const snapshotManager = new SnapshotManager(persistence, userManager, roomManager, eventBus);
  const roomActorManager = new RoomActorManager(roomManager, socketManager);

  // Load data into managers
  Object.entries(data.users).forEach(([username, userData]) => {
    userManager.setUser(username, userData);
  });

  Object.entries(data.roomOwners).forEach(([roomId, owner]) => {
    const tag = data.roomTags[roomId] || roomId;
    const settings = data.roomSettings[roomId] || { autoAccept: false, autoReject: false };
    const ownerKey = data.roomOwnerKeys[roomId];
    roomManager.createRoom(roomId, owner, tag, ownerKey);
  });

  return { userManager, roomManager, socketManager, persistence };
}

// API Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Room API
app.get('/api/rooms', async (req, res) => {
  try {
    const services = await initializeServices();
    const rooms = services.roomManager.getAllRooms();
    res.json({ rooms });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// User API
app.get('/api/users', async (req, res) => {
  try {
    const services = await initializeServices();
    const users = services.userManager.getAllUsers();
    res.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// For WebSocket functionality, we'll use Firebase Realtime Database
// This is a simplified version - full WebSocket support would require
// a different architecture in Firebase Functions

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);