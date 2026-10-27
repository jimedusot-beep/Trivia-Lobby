"""Opt-in synthetic Grand Prix probe; requires Python 3.11+ and websockets==16.0.

Example: python script/measure-racing.py --players 10 --seconds 45
Creates one temporary guest room. Never prints credentials or game payloads.
"""
import argparse
import asyncio
import collections
import contextlib
import json
import math
import time
import uuid
from urllib.parse import urlparse


def distribution(values):
    values = sorted(values)
    def rank(q):
        return round(values[max(0, math.ceil(len(values) * q) - 1)], 2) if values else None
    return {"count": len(values), "p50": rank(.5), "p95": rank(.95), "max": rank(1)}


class RacingMetrics:
    def __init__(self):
        self.pending = {}
        self.echoes, self.batches, self.gaps = [], [], []
        self.frames = self.superseded = self.unobserved = 0
        self.previous = None

    def sent(self, seq, now):
        self.pending[seq] = now
        if len(self.pending) > 256:
            del self.pending[next(iter(self.pending))]
            self.unobserved += 1

    def frame(self, now, seq=None):
        self.frames += 1
        if self.previous is not None:
            self.gaps.append((now - self.previous) * 1000)
        self.previous = now
        if seq in self.pending:
            self.echoes.append((now - self.pending[seq]) * 1000)
            covered = [key for key in self.pending if key <= seq]
            self.batches.append((now - self.pending[covered[0]]) * 1000)
            self.superseded += len(covered) - 1
            for key in covered:
                del self.pending[key]

    def summary(self):
        return {"frames": self.frames, "frameGapMs": distribution(self.gaps),
                "inputEchoMs": distribution(self.echoes), "batchWaitMs": distribution(self.batches),
                "supersededInputs": self.superseded, "pendingInputs": len(self.pending),
                "unobservedInputs": self.unobserved}


class Peer:
    def __init__(self):
        self.ws = self.task = None
        self.state = self.credential = None
        self.frames = collections.deque(maxlen=128)
        self.changed = asyncio.Condition()
        self.metrics, self.pings = RacingMetrics(), []
        self.errors = self.disconnects = 0
        self.server_errors = {}
        self.measuring = self.closing = self.closed = False

    async def connect(self, url, origin):
        from websockets.asyncio.client import connect
        self.ws = await connect(url, origin=origin, open_timeout=20, max_size=1024 * 1024)
        self.task = asyncio.create_task(self.read())
        return self

    async def read(self):
        try:
            async for raw in self.ws:
                message = json.loads(raw)
                now = time.monotonic()
                if message.get("type") == "state":
                    self.state = message["state"]
                if message.get("type") == "credential":
                    self.credential = {key: message[key] for key in ["code", "actor", "token"]}
                if message.get("type") == "error":
                    self.note_error(message.get("message"))
                if self.measuring and message.get("type") == "race_frame":
                    self.metrics.frame(now, (message.get("own") or {}).get("seq"))
                async with self.changed:
                    self.frames.append(message)
                    self.changed.notify_all()
        except Exception:
            if not self.closing:
                self.errors += 1
        finally:
            self.closed = True
            if not self.closing:
                self.disconnects += 1
            async with self.changed:
                self.changed.notify_all()

    def note_error(self, message):
        category = {"Unknown action.": "unknown_action",
                    "These controls belong to an old race.": "stale_race_input",
                    "Racing input limit": "input_limit"}.get(message, "other")
        self.server_errors[category] = self.server_errors.get(category, 0) + 1
        self.errors += 1

    async def wait(self, predicate, timeout=20):
        async with asyncio.timeout(timeout):
            async with self.changed:
                while True:
                    for message in list(self.frames):
                        if message.get("type") == "error":
                            raise RuntimeError("server_error")
                        if predicate(message):
                            self.frames.remove(message)
                            return message
                    if self.closed:
                        raise RuntimeError("socket_closed")
                    await self.changed.wait()

    async def send(self, message):
        await self.ws.send(json.dumps(message))

    async def action(self, kind, value=None):
        message = {"v": 1, "type": kind, "requestId": str(uuid.uuid4()),
                   "matchId": self.state["matchId"], "revision": self.state["revision"]}
        if value is not None:
            message["value"] = value
        await self.send(message)
        await self.wait(lambda m: m.get("type") == "ack" and m.get("requestId") == message["requestId"])

    async def close(self):
        self.closing = True
        if self.ws:
            await self.ws.close()
        if self.task:
            await self.task


def parse_args(arguments=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="https://trivia-lobby.onrender.com")
    parser.add_argument("--players", type=int, default=3)
    parser.add_argument("--seconds", type=int, default=30)
    parser.add_argument("--hz", type=int, default=20)
    args = parser.parse_args(arguments)
    if not 2 <= args.players <= 20 or not 1 <= args.seconds <= 60 or not 1 <= args.hz <= 20:
        parser.error("Use 2–20 players, 1–60 seconds and 1–20 inputs/sec.")
    url = urlparse(args.url)
    if url.scheme not in ["http", "https"] or not url.hostname or url.username or url.password or url.query or url.fragment:
        parser.error("Use an HTTP(S) app URL without credentials, query or fragment.")
    return args


async def finish_result(peers, result):
    # Closing can deliver an already queued error. Await readers before claiming
    # success, while keeping intentional shutdown out of disconnect counts.
    closed = await asyncio.gather(*(asyncio.wait_for(peer.close(), 15) for peer in peers), return_exceptions=True)
    if any(isinstance(outcome, BaseException) for outcome in closed):
        result["failure"] = "SocketCleanupError"
        for peer in peers:
            if peer.task and not peer.task.done():
                peer.task.cancel()
        await asyncio.gather(*(peer.task for peer in peers if peer.task), return_exceptions=True)
    result["host"] = dict(**peers[0].metrics.summary(), errors=peers[0].errors,
                          serverErrors=peers[0].server_errors) if peers else None
    result["controllers"] = [dict(index=index + 1, **peer.metrics.summary(), pingRttMs=distribution(peer.pings),
                                   errors=peer.errors, serverErrors=peer.server_errors,
                                   disconnects=peer.disconnects) for index, peer in enumerate(peers[1:])]
    result["errors"] = sum(peer.errors for peer in peers)
    result["unexpectedDisconnects"] = sum(peer.disconnects for peer in peers)
    result["complete"] = bool(result.get("complete") and not result.get("failure")
                              and not result["errors"] and not result["unexpectedDisconnects"])


async def measure(args):
    url = urlparse(args.url)
    origin = f"{url.scheme}://{url.netloc}"
    socket_url = ("wss" if url.scheme == "https" else "ws") + f"://{url.netloc}/party/socket"
    peers, joins, connect_times = [], [], []
    writers = []
    result = {"target": origin, "players": args.players, "requestedSeconds": args.seconds,
              "inputsPerSecondPerPlayer": args.hz, "complete": False,
              "environment": "synthetic WebSocket clients; excludes physical phone/browser rendering"}

    async def open_peer():
        peer = Peer()
        peers.append(peer)
        start = time.monotonic()
        await peer.connect(socket_url, origin)
        connect_times.append((time.monotonic() - start) * 1000)
        return peer

    try:
        host = await open_peer()
        await host.send({"type": "create"})
        await host.wait(lambda m: m.get("type") == "state")
        for index in range(args.players):
            player = await open_peer()
            start = time.monotonic()
            await player.send({"type": "join", "code": host.credential["code"], "name": f"Race probe {index + 1}"})
            await player.wait(lambda m: m.get("type") == "state")
            joins.append((time.monotonic() - start) * 1000)
        await host.wait(lambda m: m.get("type") == "state" and len(m["state"]["players"]) == args.players)
        await host.action("start", "race")
        await asyncio.gather(*(peer.wait(lambda m: m.get("type") == "state" and m["state"]["phase"] == "playing") for peer in peers))
        start = time.monotonic()
        for peer in peers:
            peer.measuring = True

        async def drive(peer):
            seq = 0
            next_at = ping_at = time.monotonic()
            while time.monotonic() - start < args.seconds and peer.state["phase"] == "playing":
                now = time.monotonic()
                peer.metrics.sent(seq, now)
                await peer.send({"type": "race_input", "v": 1, "matchId": peer.state["matchId"],
                                 "heat": peer.state["index"], "seq": seq, "steer": 0,
                                 "drift": False, "item": False, "assist": True})
                seq += 1
                if now >= ping_at:
                    waiter = await peer.ws.ping()
                    peer.pings.append(await asyncio.wait_for(waiter, 5) * 1000)
                    ping_at = now + 2
                # Drop missed send slots instead of bursting after a stall.
                next_at = max(next_at + 1 / args.hz, time.monotonic())
                await asyncio.sleep(max(0, next_at - time.monotonic()))

        writers = [asyncio.create_task(drive(peer)) for peer in peers[1:]]
        await asyncio.gather(*writers)
        result["measuredSeconds"] = round(time.monotonic() - start, 2)
        for peer in peers:
            peer.measuring = False
        result["complete"] = all(peer.metrics.frames > 0 and not peer.errors and not peer.disconnects for peer in peers)
    except Exception as error:
        # Never stringify exceptions that might contain an URL, token or frame.
        result["failure"] = type(error).__name__
    finally:
        for task in writers:
            task.cancel()
        await asyncio.gather(*writers, return_exceptions=True)
        result["connectionMs"], result["joinMs"] = distribution(connect_times), distribution(joins)
        await finish_result(peers, result)
    return result


if __name__ == "__main__":
    result = asyncio.run(measure(parse_args()))
    print(json.dumps(result, separators=(",", ":")))
    raise SystemExit(0 if result["complete"] else 1)
