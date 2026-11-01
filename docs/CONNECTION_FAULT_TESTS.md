# Connection fault tests — deterministic first pass

Research and prototype date: November 1, 2026. This work is independent of Doodle Dash PR #123 and the Solo Test/content drafts.

## Problem and scope

Verify current client WebSocket recovery behaviors under repeatable simulated faults without contacting the live Render service, changing player permissions, or adding new dependencies. The existing client uses a handshake deadline, a pong heartbeat deadline, exponential backoff, a current-socket identity check, and an explicit stop operation.

One narrow hardening fix is included: an old socket must be OPEN to deliver any queued onmessage callback. The deterministic late-frame test originally failed before this guard and passed afterward in an isolated Node 22 prototype.

## Source and licensing

Reference: https://github.com/Shopify/toxiproxy (MIT; GitHub repository inspected November 1, 2026). Toxiproxy provides a Go TCP proxy and control API for latency, timeout, connection interruptions and other network conditions. Here it is **conceptual inspiration only**: no upstream code, binary, Docker image, Node client or other runtime dependency was imported.

## Tests added

- Opening stalls beyond the ten-second deadline: connection closes, retry occurs after 500 milliseconds, late events from the old socket are ignored.
- Heartbeat response missing: the stale socket closes, a replacement socket accepts a valid pong, and does not immediately time out.
- A late state event after socket closure cannot reach the app; a policy-rejected terminal close code must not retry.
- Hidden tab ignores online signal; visible tab refresh reconnects.
- Stop cancels retry/heartbeat timers and future online events have no effect.

The suite uses an in-memory fake clock and fake WebSocket injected through the existing connection factory. It never opens a real network socket and cannot exercise real TCP-level packet loss.

## Verification and limits

- Isolated Node 22 prototype using the existing connection implementation: 5/5 deterministic cases passed after the one-line guard (4/5 before).
- Required next gate: full guest npm test, Chromium/Firefox/WebKit browser suites and GitHub CI on the exact proposed PR commit.
- NOT VERIFIED: actual Toxiproxy TCP experiments, live Wi-Fi jitter, Render request latency, physical phones, 10–20 device concurrency, gameplay quality during a dropped race socket or persistent-room restart.

Run from a checkout of this branch:

    cd examples/party-engine
    npm ci
    node --test test/connection-network-faults.test.js
    npm test

## Follow-up without scope creep

If this minimal fix passes CI, create a separate opt-in localhost-only TCP/WebSocket fault-injection experiment with Toxiproxy pinned to an auditable upstream release. Use explicit environment guards and guaranteed cleanup. Perform latency, packet drop and reconnection checks only against a local or authorized staging service—never production load or disruptions.

No merge, Render deployment, server-protocol change or new service is part of this PR.
