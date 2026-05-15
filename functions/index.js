const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');

admin.initializeApp();

const db = admin.firestore();
const app = express();

app.use(express.json());
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

const getUser = async (username) => {
  if (!username) return null;
  const doc = await db.collection('users').doc(username.toLowerCase()).get();
  return doc.exists ? { username: doc.id, ...doc.data() } : null;
};

const saveUser = async (user) => {
  const username = (user.username || '').toLowerCase();
  await db.collection('users').doc(username).set(user, { merge: true });
};

const getRoom = async (roomId) => {
  if (!roomId) return null;
  const doc = await db.collection('rooms').doc(roomId.toLowerCase()).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
};

const saveRoom = async (roomId, room) => {
  await db.collection('rooms').doc(roomId.toLowerCase()).set(room, { merge: true });
};

const deleteRoom = async (roomId) => {
  await db.collection('rooms').doc(roomId.toLowerCase()).delete();
};

const listUsers = async () => {
  const snapshot = await db.collection('users').get();
  return snapshot.docs.map(doc => ({ username: doc.id, ...doc.data() }));
};

const listRooms = async () => {
  const snapshot = await db.collection('rooms').get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const getOwnedRooms = async (username) => {
  const rooms = await listRooms();
  return rooms.filter(room => room.owner === username.toLowerCase());
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/users/search', async (req, res) => {
  const query = ((req.query.q || '') + '').toLowerCase();
  if (!query) return res.json([]);

  const users = await listUsers();
  const results = users.filter(user => {
    const username = (user.username || '').toLowerCase();
    const displayName = (user.displayName || '').toLowerCase();
    return username.includes(query) || displayName.includes(query);
  });
  res.json(results);
});

app.get('/api/rooms/search', async (req, res) => {
  const query = ((req.query.q || '') + '').toLowerCase();
  if (!query) return res.json([]);

  const rooms = await listRooms();
  const results = rooms.filter(room => {
    const roomId = (room.id || '').toLowerCase();
    const tag = (room.tag || '').toLowerCase();
    return roomId.includes(query) || tag.includes(query);
  });
  res.json(results);
});

app.post('/api/users/block', async (req, res) => {
  const { username, targetUsername } = req.body;
  const user = await getUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.blockedUsers = Array.isArray(user.blockedUsers) ? user.blockedUsers : [];
  if (!user.blockedUsers.includes(targetUsername)) {
    user.blockedUsers.push(targetUsername);
  }
  await saveUser(user);
  res.json(user);
});

app.post('/api/users/unblock', async (req, res) => {
  const { username, targetUsername } = req.body;
  const user = await getUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.blockedUsers = Array.isArray(user.blockedUsers) ? user.blockedUsers.filter(u => u !== targetUsername) : [];
  await saveUser(user);
  res.json(user);
});

app.post('/api/auth/login', async (req, res) => {
  const username = ((req.body.username || '') + '').toLowerCase();
  const { password, displayName, avatar } = req.body;
  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    return res.status(400).json({ error: 'Username must contain only English letters and numbers.' });
  }

  const existingUser = await getUser(username);
  if (existingUser) {
    if (existingUser.isBanned) return res.status(403).json({ error: 'Your account has been banned.' });
    if (existingUser.password && existingUser.password !== password) return res.status(401).json({ error: 'Incorrect password.' });
    const ownedRooms = await getOwnedRooms(username);
    return res.json({ ...existingUser, ownedRooms });
  }

  const newUser = {
    username,
    displayName: displayName || username,
    avatar: avatar || '',
    password: password || '',
    isBanned: false,
    blockedUsers: [],
    theme: 'light',
    language: 'en'
  };
  await saveUser(newUser);
  res.json({ ...newUser, ownedRooms: [] });
});

app.post('/api/users/update', async (req, res) => {
  const username = ((req.body.username || '') + '').toLowerCase();
  const { displayName, avatar, theme, language, password } = req.body;
  const user = await getUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const updatedUser = {
    ...user,
    displayName: displayName || user.displayName,
    avatar: avatar || user.avatar,
    theme: theme || user.theme,
    language: language || user.language,
  };
  if (password) updatedUser.password = password;
  await saveUser(updatedUser);
  const ownedRooms = await getOwnedRooms(username);
  res.json({ ...updatedUser, ownedRooms });
});

app.get('/api/admin/data', async (req, res) => {
  const users = await listUsers();
  const adminData = await Promise.all(users.map(async (user) => {
    const ownedRooms = await getOwnedRooms(user.username);
    return {
      username: user.username,
      displayName: user.displayName,
      avatar: user.avatar,
      isBanned: user.isBanned || false,
      ownedRooms
    };
  }));
  res.json(adminData);
});

app.post('/api/admin/toggle-ban', async (req, res) => {
  const { username, adminUsername, adminToken } = req.body;
  const adminSecret = process.env.ADMIN_SECRET || '1';
  const authToken = adminToken || adminUsername;
  if (!authToken || authToken !== adminSecret) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const user = await getUser(username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.isBanned = !user.isBanned;
  await saveUser(user);
  res.json({ success: true, isBanned: user.isBanned });
});

app.get('/api/rooms/settings', async (req, res) => {
  const roomId = ((req.query.roomId || '') + '').toLowerCase();
  const room = await getRoom(roomId);
  res.json(room?.settings || { autoAccept: false, autoReject: false });
});

app.post('/api/rooms/create', async (req, res) => {
  const username = (req.body.username || '').toLowerCase();
  const roomId = (req.body.roomId || '').toLowerCase().trim();
  const roomTag = req.body.roomTag || roomId;
  if (!username || !roomId) return res.status(400).json({ error: 'Username and roomId are required.' });
  const user = await getUser(username);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const existingRoom = await getRoom(roomId);
  if (existingRoom) {
    if (existingRoom.owner === username) return res.json({ success: true });
    return res.status(409).json({ error: 'Room already exists and is owned by another user.' });
  }
  await saveRoom(roomId, { owner: username, tag: roomTag, settings: { autoAccept: false, autoReject: false }, ownerKey: '' });
  res.json({ success: true });
});

app.get('/api/rooms/exists', async (req, res) => {
  const roomId = ((req.query.roomId || '') + '').toLowerCase();
  const room = await getRoom(roomId);
  res.json({ exists: !!room });
});

app.get('/api/rooms/details', async (req, res) => {
  const roomId = ((req.query.roomId || '') + '').toLowerCase();
  const room = await getRoom(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });
  const owner = await getUser(room.owner);
  res.json({
    id: roomId,
    tag: room.tag,
    owner: room.owner,
    ownerDisplayName: owner?.displayName || room.owner,
    ownerAvatar: owner?.avatar,
    createdAt: room.createdAt || Date.now()
  });
});

app.post('/api/rooms/settings', async (req, res) => {
  const username = (req.body.username || '').toLowerCase();
  const roomId = (req.body.roomId || '').toLowerCase();
  const settings = req.body.settings || {};
  const room = await getRoom(roomId);
  if (!room || room.owner !== username) return res.status(403).json({ error: 'Not owner' });
  room.settings = settings;
  await saveRoom(roomId, room);
  res.json({ success: true });
});

app.post('/api/rooms/delete', async (req, res) => {
  const username = (req.body.username || '').toLowerCase();
  const roomId = (req.body.roomId || '').toLowerCase();
  const room = await getRoom(roomId);
  if (!room || room.owner !== username) return res.status(403).json({ error: 'Not owner' });
  await deleteRoom(roomId);
  res.json({ success: true });
});

exports.api = functions.https.onRequest(app);
