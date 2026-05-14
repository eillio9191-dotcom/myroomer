import { EventBus } from "../services/eventBus.service.js";

export interface User {
  username: string;
  displayName: string;
  avatar?: string;
  theme: string;
  language: string;
  password?: string;
  isBanned?: boolean;
  blockedUsers?: string[];
}

export class UserManager {
  private users = new Map<string, User>();

  constructor(private eventBus: EventBus) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for user creation
    this.eventBus.on("user:created", (data) => {
      this.handleUserCreated(data);
    });

    // Listen for user updates
    this.eventBus.on("user:updated", (data) => {
      this.handleUserUpdated(data);
    });
  }

  private handleUserCreated(data: User) {
    this.users.set(data.username, data);
  }

  private handleUserUpdated(data: { username: string; updates: Partial<User> }) {
    const user = this.users.get(data.username);
    if (user) {
      Object.assign(user, data.updates);
    }
  }

  getUser(username: string) {
    return this.users.get(username);
  }

  createUser(username: string, displayName: string, avatar?: string, password?: string) {
    if (this.users.has(username)) return false;

    const user: User = {
      username,
      displayName: displayName || username,
      avatar,
      password,
      theme: 'dark',
      language: 'en'
    };

    this.users.set(username, user);
    this.eventBus.emit("user:created", user);
    return true;
  }

  updateUser(username: string, updates: Partial<User>) {
    let user = this.users.get(username);
    if (!user) {
      // If user doesn't exist, this might be an initial load or a forced creation
      // We'll trust the caller if they provide enough data for a User, 
      // but usually updates should only happen to existing users.
      // During initial load from server/index.ts, we should use a proper setter.
      return false;
    }

    Object.assign(user, updates);
    this.eventBus.emit("user:updated", { username, updates });
    return true;
  }

  setUser(username: string, user: User) {
    this.users.set(username, user);
    this.eventBus.emit("user:created", user);
  }

  banUser(username: string) {
    const user = this.users.get(username);
    if (!user) return false;

    user.isBanned = !user.isBanned;
    this.eventBus.emit("user:updated", { username, updates: { isBanned: user.isBanned } });
    return true;
  }

  searchUsers(query: string) {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.users.values())
      .filter(u => u.username.toLowerCase().includes(lowerQuery) || u.displayName.toLowerCase().includes(lowerQuery))
      .map(u => ({ userId: u.username, username: u.username, displayName: u.displayName, avatar: u.avatar }))
      .slice(0, 10);
  }

  getAllUsers() {
    return Array.from(this.users.values());
  }
}