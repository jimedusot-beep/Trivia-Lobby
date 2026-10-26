/** Browser-native connection lifecycle shared by the guest and private quiz clients. */
export function createRecoveringConnection(url, {
  onOpen = () => {}, onMessage = () => {}, onStatus = () => {}, onClose = () => {},
  createSocket = address => new WebSocket(address),
  setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random,
  lifecycle = globalThis.window, visibility = globalThis.document,
  isVisible = () => globalThis.document?.visibilityState !== "hidden",
} = {}) {
  let socket, stopped = false, delay = 500, retry, connectDeadline, pingTimer, pongDeadline;
  const clearConnectionTimers = () => {
    clearTimer(connectDeadline); clearTimer(pingTimer); clearTimer(pongDeadline);
  };
  const ping = current => {
    if (stopped || socket !== current || current.readyState !== 1) return;
    current.send(JSON.stringify({ type: "ping" }));
    clearTimer(pongDeadline);
    pongDeadline = setTimer(() => { if (socket === current) current.close(4000, "Connection check timed out"); }, 10000);
    pingTimer = setTimer(() => ping(current), 25000);
  };
  const connect = () => {
    if (stopped) return;
    clearTimer(retry); clearConnectionTimers(); onStatus("connecting");
    const current = createSocket(typeof url === "function" ? url() : url);
    socket = current;
    connectDeadline = setTimer(() => current.close(4000, "Connection timed out"), 10000);
    current.onopen = event => {
      if (stopped || socket !== current) return;
      clearTimer(connectDeadline); onStatus("restoring"); ping(current); onOpen(current, event);
    };
    current.onmessage = event => {
      if (stopped || socket !== current) return;
      try {
        const message = JSON.parse(event.data);
        if (message?.type === "pong" && Number.isFinite(message.serverNow)) { clearTimer(pongDeadline); return; }
      } catch { /* The protocol-specific caller validates other frames. */ }
      onMessage(event, current);
    };
    current.onclose = event => {
      if (stopped || socket !== current) return;
      clearConnectionTimers();
      const terminal = [1000, 1008, 1009].includes(event.code);
      if (terminal) stopped = true;
      onStatus(terminal ? "closed" : "connecting"); onClose(event, !terminal);
      if (stopped) return;
      retry = setTimer(connect, Math.round(delay * (0.8 + random() * 0.4)));
      delay = Math.min(delay * 2, 15000);
    };
    current.onerror = () => { /* A close event owns retry scheduling. */ };
  };
  const refresh = () => {
    if (stopped || !isVisible()) return;
    if (!socket || socket.readyState === 3) connect();
    else if (socket.readyState === 1) socket.close(4000, "Refreshing connection");
  };
  lifecycle?.addEventListener("online", refresh);
  visibility?.addEventListener("visibilitychange", refresh);
  connect();
  return {
    get socket() { return socket; },
    ready() { if (!stopped && socket?.readyState === 1) { delay = 500; onStatus("connected"); } },
    refresh,
    stop() {
      stopped = true; clearTimer(retry); clearConnectionTimers();
      lifecycle?.removeEventListener("online", refresh);
      visibility?.removeEventListener("visibilitychange", refresh);
      if (socket && socket.readyState < 2) socket.close(1000, "Connection stopped");
    },
  };
}
