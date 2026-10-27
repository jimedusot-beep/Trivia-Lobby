import type { Server } from "node:http";
import type { WebSocketServer } from "ws";
import type { RoomCheckpointStore } from "../../server/room-checkpoints";

export function attachPartySocket(server: Server, options?: {
  socketPath?: string;
  expectedOrigin?: string;
  checkpointStore?: RoomCheckpointStore;
  partyOptions?: Record<string, unknown>;
}): {
  wss: WebSocketServer;
  close(): Promise<void>;
};
