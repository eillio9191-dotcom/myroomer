const functions = require('firebase-functions');
const admin = require('firebase-admin');
const express = require('express');
const { createServer } = require('http');
const path = require('path');

// Initialize Firebase Admin
admin.initializeApp();

// Import your existing server logic
// Note: We'll need to adapt the server code to work with Firebase Functions
const app = express();

// CORS middleware for Firebase Functions
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

// Basic health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket will need to be handled differently in Firebase Functions
// For now, we'll create a basic HTTP API

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

// For WebSocket functionality, we'll need to use Firebase Realtime Database
// or implement a different approach for real-time communication