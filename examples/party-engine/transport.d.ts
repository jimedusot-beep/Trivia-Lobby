import type { Server } from "node:http";
import type { WebSocketServer } from "ws";

export function attachPartySocket(server: Server, options?: {
  socketPath?: string;
  expectedOrigin?: string;
}): {
  wss: WebSocketServer;
  close(): Promise<void>;
};
