import { WebSocket } from "ws";

export interface SocketMeta {
  userId: string;
  roomId: string;
  username: string;
  displayName: string;
  avatar?: string;
  camOn?: boolean;
  micOn?: boolean;
}

export type SocketWithMeta = WebSocket & {
  meta?: SocketMeta;
};