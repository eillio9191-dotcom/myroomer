import { WebSocket } from "ws";

export function safeSend(ws: WebSocket, message: any) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (e) {
      console.error("Error sending message:", e);
    }
  }
}