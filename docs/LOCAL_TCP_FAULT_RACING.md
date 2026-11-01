# Real TCP fault test for Party Grand Prix

Date: November 1, 2026. Base commit: `fe41a2af5706156fa6845106649f30b53602725b` (current `main` when this branch was created).

## Player problem

A simulation can tell us a disconnected browser retries, but not whether real WebSocket traffic safely passes through delayed TCP connections and a hard connection reset while a shared race is running.

## External reference

[Shopify Toxiproxy](https://github.com/Shopify/toxiproxy/tree/49299d8838525126e09c85ebe0ba89940a3261e5), MIT license, is a practical example of controllable TCP failure injection. This trial uses an original, **local-only in-process TCP relay**, not the Toxiproxy binary or code. No third-party code or art has been imported.

## Delivered experiment

`examples/party-engine/test/network-tcp-faults.test.js` creates an actual local Party Grand Prix server and a TCP proxy bound to ephemeral `127.0.0.1` ports. It does not contact an external service.

The test exercises the following:

1. One host and two phones join an authenticated server-side race; the first phone joins through a proxy whose server-to-client TCP packets incur a configurable 90 ms delay.
2. The proxied phone receives a player-only race frame; the host and second phone are direct.
3. The proxy forcibly tears down its active TCP connections mid-race.
4. The affected phone reconnects through the proxy using its existing actor/credential, not a privileged test shortcut.
5. The same two-player roster and match are retained, new private racing frames arrive, no credential appears in the projected state, and the independent host socket remains connected.
6. Test diagnostics report only aggregate loopback TCP bytes. They never log credentials, room codes or raw game messages.

The proxy limits configured downstream delays to 0–500 ms, owns all timers, and destroys its connections during test cleanup. It has no production code path, runs without Docker or extra dependencies, and uses the existing `ws` test dependency.

## Verification

- `node --check test/network-tcp-faults.test.js` passed in an isolated Node 22 environment.
- An extracted copy of the proxy helper passed a local TCP echo smoke test with an artificial 70 ms downstream delay and forced shutdown.
- The full Grand Prix WebSocket integration test has **not yet been run locally with application dependencies**. The exact PR's `Guest party engine` workflow must run and pass before this is considered verified.
- No change to the real game client or server runtime; no merge and no Render deployment.

Run:

```bash
cd examples/party-engine
npm ci
node --test test/network-tcp-faults.test.js
npm test
```

## Interpretation and limitations

This is a controlled two-guest localhost test. It proves neither household Wi-Fi throughput nor 10–20 actual phone reliability, real iPhone Safari or Android Chrome behavior, internet latency or Render production capacity. It injects artificial downstream delay and a hard TCP disconnection; it does not emulate bandwidth starvation, radio packet loss, upstream jitter or browser sleep.

Future optional work, separate from this PR: use an audited/pinned Toxiproxy release in an explicit localhost or authorized staging environment for varied latency/packet-loss profiles and 10–20 simulated browsers, then validate on physical phones. Do not load-test or deliberately interrupt the public Render endpoint.
