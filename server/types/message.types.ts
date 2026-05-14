// Message types for WebSocket communication
export interface BaseMessage {
  type: string;
}

export interface JoinMessage extends BaseMessage {
  type: 'join';
  roomId: string;
  userId: string;
  username: string;
  displayName: string;
  avatar?: string;
  isOwner?: boolean;
  roomTag?: string;
}

export interface ChatMessage extends BaseMessage {
  type: 'chat';
  text: string;
  senderId: string;
  username: string;
  displayName: string;
  avatar?: string;
  timestamp: number;
}

export interface SignalMessage extends BaseMessage {
  type: 'signal';
  targetId: string;
  senderId: string;
  roomId: string;
  signal: any;
}

export type Message = JoinMessage | ChatMessage | SignalMessage | BaseMessage;