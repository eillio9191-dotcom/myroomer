import { WebSocket } from "ws";

export interface HeartbeatConfig {
  interval: number; // ms between ping/pong checks
  timeout: number; // ms to wait for pong response
  maxMissed: number; // max consecutive missed pongs before dead
}

export class HeartbeatService {
  private activeConnections = new Map<WebSocket, {
    lastPong: number;
    missedPongs: number;
    pingTimer?: NodeJS.Timeout;
  }>();

  private config: HeartbeatConfig;

  constructor(config: Partial<HeartbeatConfig> = {}) {
    this.config = {
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 second timeout
      maxMissed: 2, // 2 missed pongs = dead
      ...config
    };
  }

  /**
   * Register a socket for heartbeat monitoring
   */
  register(ws: WebSocket, onDead?: (ws: WebSocket) => void) {
    if (this.activeConnections.has(ws)) {
      return; // Already registered
    }

    const heartbeat = {
      lastPong: Date.now(),
      missedPongs: 0,
      pingTimer: undefined as NodeJS.Timeout | undefined
    };

    this.activeConnections.set(ws, heartbeat);

    // Send initial ping
    this.sendPing(ws, heartbeat, onDead);
  }

  /**
   * Unregister a socket
   */
  unregister(ws: WebSocket) {
    const heartbeat = this.activeConnections.get(ws);
    if (heartbeat?.pingTimer) {
      clearTimeout(heartbeat.pingTimer);
    }
    this.activeConnections.delete(ws);
  }

  /**
   * Acknowledge pong from socket
   */
  pong(ws: WebSocket) {
    const heartbeat = this.activeConnections.get(ws);
    if (heartbeat) {
      heartbeat.lastPong = Date.now();
      heartbeat.missedPongs = 0; // Reset counter
    }
  }

  /**
   * Send ping and wait for pong
   */
  private sendPing(
    ws: WebSocket,
    heartbeat: any,
    onDead?: (ws: WebSocket) => void
  ) {
    // Clear existing timer
    if (heartbeat.pingTimer) {
      clearTimeout(heartbeat.pingTimer);
    }

    // Check if already dead
    if (heartbeat.missedPongs >= this.config.maxMissed) {
      if (onDead) {
        onDead(ws);
      }
      this.unregister(ws);
      return;
    }

    // Send ping if socket is open
    if (ws.readyState === ws.OPEN) {
      try {
        ws.ping();
      } catch (error) {
        console.error("Failed to send ping:", error);
        if (onDead) onDead(ws);
        this.unregister(ws);
        return;
      }
    }

    // Wait for pong
    heartbeat.pingTimer = setTimeout(() => {
      heartbeat.missedPongs++;
      // Schedule next ping
      this.sendPing(ws, heartbeat, onDead);
    }, this.config.timeout);

    // Schedule next ping after interval
    heartbeat.pingTimer = setTimeout(() => {
      this.sendPing(ws, heartbeat, onDead);
    }, this.config.interval);
  }

  /**
   * Get health status of a socket
   */
  getHealth(ws: WebSocket) {
    const heartbeat = this.activeConnections.get(ws);
    if (!heartbeat) return null;

    return {
      isAlive: heartbeat.missedPongs < this.config.maxMissed,
      missedPongs: heartbeat.missedPongs,
      lastPongTime: heartbeat.lastPong,
      timeSinceLastPong: Date.now() - heartbeat.lastPong
    };
  }

  /**
   * Get all dead sockets
   */
  getDeadSockets(): WebSocket[] {
    const dead: WebSocket[] = [];
    this.activeConnections.forEach((heartbeat, ws) => {
      if (heartbeat.missedPongs >= this.config.maxMissed) {
        dead.push(ws);
      }
    });
    return dead;
  }
}
