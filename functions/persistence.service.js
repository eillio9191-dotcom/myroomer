const admin = require('firebase-admin');

class PersistenceService {
  constructor() {
    this.db = admin.firestore();
  }

  async loadData() {
    try {
      const users = {};
      const roomOwners = {};
      const roomTags = {};
      const roomSettings = {};
      const roomOwnerKeys = {};

      // Load Users
      const usersSnapshot = await this.db.collection('users').get();
      usersSnapshot.forEach(doc => {
        users[doc.id] = doc.data();
      });

      // Load Rooms
      const roomsSnapshot = await this.db.collection('rooms').get();
      roomsSnapshot.forEach(doc => {
        const data = doc.data();
        roomOwners[doc.id] = data.owner;
        roomTags[doc.id] = data.tag;
        roomSettings[doc.id] = data.settings;
        roomOwnerKeys[doc.id] = data.ownerKey;
      });

      return { users, roomOwners, roomTags, roomSettings, roomOwnerKeys };
    } catch (error) {
      console.error('Initial load failed, starting with empty data:', error);
      return {
        users: {},
        roomOwners: {},
        roomTags: {},
        roomSettings: {},
        roomOwnerKeys: {}
      };
    }
  }

  sanitize(data) {
    if (!data) return data;
    // JSON.stringify removes undefined values from objects
    return JSON.parse(JSON.stringify(data));
  }

  async saveUser(username, userData) {
    try {
      await this.db.collection('users').doc(username).set(this.sanitize(userData));
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  }

  async saveRoom(roomId, data) {
    try {
      await this.db.collection('rooms').doc(roomId).set(this.sanitize(data));
    } catch (error) {
      console.error('Error saving room:', error);
      throw error;
    }
  }

  // Deprecated for atomic saves
  async saveData(data) {
    console.log("saveData called - should move to individual saves for better performance");
    for (const [username, userData] of Object.entries(data.users)) {
      await this.saveUser(username, userData);
    }
    for (const [roomId, owner] of Object.entries(data.roomOwners)) {
      await this.saveRoom(roomId, {
        owner,
        tag: data.roomTags[roomId] || roomId,
        settings: data.roomSettings[roomId] || {},
        ownerKey: data.roomOwnerKeys[roomId]
      });
    }
  }
}

module.exports = { PersistenceService };
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export class PersistenceService {
  async loadData(): Promise<PersistedData> {
    try {
      const users: Record<string, any> = {};
      const roomOwners: Record<string, string> = {};
      const roomTags: Record<string, string> = {};
      const roomSettings: Record<string, any> = {};
      const roomOwnerKeys: Record<string, string> = {};

      // Load Users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      usersSnapshot.forEach(doc => {
        users[doc.id] = doc.data();
      });

      // Load Rooms
      const roomsSnapshot = await getDocs(collection(db, 'rooms'));
      roomsSnapshot.forEach(doc => {
        const data = doc.data();
        roomOwners[doc.id] = data.owner;
        roomTags[doc.id] = data.tag;
        roomSettings[doc.id] = data.settings;
        roomOwnerKeys[doc.id] = data.ownerKey;
      });

      return { users, roomOwners, roomTags, roomSettings, roomOwnerKeys };
    } catch (error) {
      console.error('Initial load failed, starting with empty data:', error);
      return {
        users: {},
        roomOwners: {},
        roomTags: {},
        roomSettings: {},
        roomOwnerKeys: {}
      };
    }
  }

  private sanitize(data: any): any {
    if (!data) return data;
    // JSON.stringify removes undefined values from objects
    return JSON.parse(JSON.stringify(data));
  }

  async saveUser(username: string, userData: any) {
    try {
      await setDoc(doc(db, 'users', username), this.sanitize(userData));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${username}`);
    }
  }

  async saveRoom(roomId: string, data: { owner: string, tag: string, settings: any, ownerKey?: string }) {
    try {
      await setDoc(doc(db, 'rooms', roomId), this.sanitize(data));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `rooms/${roomId}`);
    }
  }

  // Deprecated for atomic saves
  async saveData(data: PersistedData) {
    // This was used for full snapshot saves, now we save individual entities
    console.log("saveData called - should move to individual saves for better performance");
    for (const [username, userData] of Object.entries(data.users)) {
      await this.saveUser(username, userData);
    }
    for (const [roomId, owner] of Object.entries(data.roomOwners)) {
      await this.saveRoom(roomId, {
        owner,
        tag: data.roomTags[roomId] || roomId,
        settings: data.roomSettings[roomId] || {},
        ownerKey: data.roomOwnerKeys[roomId]
      });
    }
  }
}
