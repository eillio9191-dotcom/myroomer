import { WebSocket } from "ws";

export interface RateLimitConfig {
  global: number; // max messages per second globally
  perSocket: number; // max messages per socket per second
  byType: {
    [key: string]: number; // max messages of specific type per second
  };
}

export class RateLimiter {
  private socketLimits = new Map<WebSocket, Map<string, number[]>>();
  private globalTimestamps: number[] = [];
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      global: 1000, // 1000 msg/sec globally
      perSocket: 20, // 20 msg/sec per socket
      byType: {
        signal: 10, // 10 signal/sec
        join: 3, // 3 join/sec
        chat: 5 // 5 chat/sec
      },
      ...config
    };
  }

  /**
   * Check if message should be allowed
   * Returns true if allowed, false if rate limited
   */
  check(ws: WebSocket, messageType: string): boolean {
    const now = Date.now();
    const oneSecondAgo = now - 1000;

    // Check global rate limit
    this.globalTimestamps = this.globalTimestamps.filter(t => t > oneSecondAgo);
    if (this.globalTimestamps.length >= this.config.global) {
      console.warn("Global rate limit exceeded");
      return false;
    }

    // Get or create socket limits
    if (!this.socketLimits.has(ws)) {
      this.socketLimits.set(ws, new Map());
    }
    const limits = this.socketLimits.get(ws)!;

    // Check per-socket rate limit
    if (!limits.has("__total")) {
      limits.set("__total", []);
    }
    let total = limits.get("__total")!;
    total = total.filter(t => t > oneSecondAgo);
    limits.set("__total", total);

    if (total.length >= this.config.perSocket) {
      console.warn(`Socket rate limit exceeded: ${total.length} messages in 1s`);
      return false;
    }

    // Check message-type-specific rate limit
    const typeLimit = this.config.byType[messageType];
    if (typeLimit) {
      if (!limits.has(messageType)) {
        limits.set(messageType, []);
      }
      let typeMessages = limits.get(messageType)!;
      typeMessages = typeMessages.filter(t => t > oneSecondAgo);
      limits.set(messageType, typeMessages);

      if (typeMessages.length >= typeLimit) {
        console.warn(`Type rate limit exceeded: ${messageType} (${typeMessages.length}/${typeLimit})`);
        return false;
      }

      typeMessages.push(now);
    }

    // Record timestamps
    this.globalTimestamps.push(now);
    total.push(now);

    return true;
  }

  /**
   * Remove socket from tracking (on disconnect)
   */
  removeSocket(ws: WebSocket) {
    this.socketLimits.delete(ws);
  }

  /**
   * Get current rate for a socket
   */
  getSocketRate(ws: WebSocket): number {
    const limits = this.socketLimits.get(ws);
    if (!limits) return 0;

    const total = limits.get("__total") || [];
    const oneSecondAgo = Date.now() - 1000;
    return total.filter(t => t > oneSecondAgo).length;
  }

  /**
   * Get current global rate
   */
  getGlobalRate(): number {
    const oneSecondAgo = Date.now() - 1000;
    return this.globalTimestamps.filter(t => t > oneSecondAgo).length;
  }
}
