import { WebSocket } from "ws";
import { EventEmitter } from "events";

export interface RoomEvent {
  type: string;
  data: any;
  timestamp: number;
}

export class RoomActor extends EventEmitter {
  private eventQueue: RoomEvent[] = [];
  private isProcessing = false;
  private state: any = {};

  constructor(private roomId: string) {
    super();
  }

  /**
   * Queue an event for processing in this room
   * Ensures sequential execution - no race conditions
   */
  async enqueueEvent(event: RoomEvent): Promise<any> {
    return new Promise((resolve) => {
      this.eventQueue.push(event);
      this.emit("event:queued", { roomId: this.roomId, event });
      
      // Trigger processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }
      
      resolve(null);
    });
  }

  /**
   * Process queued events sequentially
   */
  private async processQueue() {
    if (this.isProcessing || this.eventQueue.length === 0) return;

    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      
      try {
        // Execute event handler
        this.emit("event:processing", { roomId: this.roomId, event });
        
        // Let listeners handle the event
        // They should call actor.setState() to update state
        await new Promise((resolve) => {
          this.emit("event:execute", { roomId: this.roomId, event }, resolve);
        });
        
        this.emit("event:completed", { roomId: this.roomId, event });
      } catch (error) {
        console.error(`Error processing event in room ${this.roomId}:`, error);
        this.emit("event:error", { roomId: this.roomId, event, error });
      }
    }

    this.isProcessing = false;
  }

  /**
   * Get current state (safely)
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Update state (only during event processing)
   */
  setState(updates: any) {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Check if actor is currently processing
   */
  isLocked() {
    return this.isProcessing;
  }

  /**
   * Get queue size
   */
  getQueueSize() {
    return this.eventQueue.length;
  }
}
