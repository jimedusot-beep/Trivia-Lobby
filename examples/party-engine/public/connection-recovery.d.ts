export type RecoveringConnection = {
  readonly socket: WebSocket | undefined;
  ready(): void;
  refresh(): void;
  stop(): void;
};
export function createRecoveringConnection(url: string | (() => string), options?: {
  onOpen?: (socket: WebSocket, event: Event) => void;
  onMessage?: (event: MessageEvent, socket: WebSocket) => void;
  onStatus?: (status: "connecting" | "restoring" | "connected" | "closed") => void;
  onClose?: (event: CloseEvent, retrying: boolean) => void;
}): RecoveringConnection;
