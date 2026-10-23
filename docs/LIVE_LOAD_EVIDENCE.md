# Single-instance classroom load evidence

This original, opt-in, local-only harness exercises Trivia Lobby's actual versioned WebSocket server and server-authoritative scoring. It uses fixture decks and no private user accounts, third-party services, credentials or external HTTP requests.

## Reproduce

```bash
npm ci
node --import tsx script/load-live.ts 10 25 50 100
```

The CI workflow `.github/workflows/local-websocket-load.yml` runs these four levels and uploads `load-results.ndjson`. The tests are isolated from production data. The server and simulated sockets share one Node.js process, so delivery latency is a **local baseline**, not a real Wi-Fi/classroom internet latency measurement.

For each cohort the test verifies:
- all clients join and receive an answer-key-free live question;
- all clients submit nearly simultaneously and receive exactly one consistent correct result;
- leaderboard and final `GAME_OVER` rankings contain all participants with equal authoritative scores;
- p50/p95/p99/max local question delivery and answer-reveal delays, test duration and sampled peak RSS;
- no failed joins within the scenario.

Loopback addresses (`127.0.0.10` etc.) simulate distinct household/client source addresses to exercise the application **without disabling the built-in per-IP joining protections**. Linux supports the full `127.0.0.0/8` loopback space. This is **not** a bypass available to remote browser players.

## Interpreting results

The run emits machine-readable NDJSON. No claims about production player capacity, number of concurrent servers, or WAN latency follow from this local synthetic test.

Initial release targets, to be reviewed against representative infrastructure:
- Zero malformed/protocol-failed joins, zero corrupt scoring and zero unexpected room closures at 10/25/50/100.
- Compare 50- and 100-player p95 delivery/reveal latencies to an explicit deployed classroom latency budget, then choose an actual supported player limit.
- Conduct real device/Wi-Fi tests, network throttling, repeated game-loop tests, host reconnect and server-restart tests before any classroom or larger-scale guarantee.

## Known deployment limits

The game-room authority is still held in one Node.js process. Restarting it ends active games; load evidence is not multi-instance resilience. Report and assignment persistence do not make live rooms restart-safe. Production hardening requires ownership review, secrets management, database migration and offsite recovery drills, object-storage permission checks and observed alerting.

The synthetic test does not yet model heterogeneous latency, packet loss, hundreds of concurrent *rooms*, or real authentication/DB contention. This should inform, not replace, scenario-based Playwright and operational acceptance.
