import { collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase.js';

export interface PersistedData {
  users: Record<string, any>;
  roomOwners: Record<string, string>;
  roomTags: Record<string, string>;
  roomSettings: Record<string, any>;
  roomOwnerKeys: Record<string, string>;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
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
