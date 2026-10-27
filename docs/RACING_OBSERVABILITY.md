# Checkpoint logging and racing latency

## Operational events

The PostgreSQL checkpoint adapter used by both public guest and private quiz games emits single-line JSON:

- `room_checkpoint_failed` (`level=error`): failed load, save, delete or prune. Contains operation, transport, elapsed milliseconds and a safe error category; known provider codes are allowlisted. The original exception still reaches existing recovery handling.
- `room_checkpoint_slow` (`level=warn`): a successful operation taking at least 250 ms. This is a useful warning for the 100 ms racing-frame loop, not a performance service-level guarantee.

Events contain a process-local HMAC room reference rather than the joining code. They exclude SQL, raw exceptions/stacks, connection URLs, checkpoint content, names, answers and credentials. Each event/operation/transport combination emits at most once per 30 seconds; the next event includes its suppressed count. Buckets are independent of room codes and have bounded cardinality. Logging-sink failures cannot turn a successful database write into an apparent failure. Search Render application logs for either event name. No new monitoring service, secrets or environment variables are required.

The instrumentation measures the whole checkpoint-adapter call, including pool wait and serialization. It does not measure room-queue wait, socket transport, browser rendering or event-loop pauses separately. Ordinary successful operations under 250 ms do not generate logs.

## Repeatable bounded probe

Requirements: Python 3.11+ and `websockets==16.0`. Run explicitly against a service you control:

```sh
python -m pip install websockets==16.0
python -B script/measure-racing.py --players 10 --seconds 45 > racing-10.json
python -B script/measure-racing.py --players 20 --seconds 45 > racing-20.json
python -B -m unittest discover -s tests -p test_racing_probe.py
```

The manual **Opt-in live racing latency** GitHub workflow runs the same probe and retains a JSON artifact for 14 days. It has no schedule and does not automatically load-test production. Run samples sequentially. The probe opens one fresh guest room, joins the selected number of controllers, plays one Grand Prix heat and closes its sockets afterwards. The temporary disconnected room follows the normal expiry rules. Limits are 2–20 controllers, 1–60 seconds and at most 20 control messages/sec per controller. A heat finishing early shortens the sample.

- `frameGapMs`: intervals between authoritative frames arriving at a client. Grand Prix normally publishes at about 100 ms intervals.
- `inputEchoMs`: send-to-arrival latency for the exact input sequence echoed in a private authoritative frame. Intermediate controls are coalesced; they are counted as `supersededInputs`, not falsely called individually acknowledged.
- `batchWaitMs`: elapsed time from the oldest outstanding input covered by that newer frame. This reveals waiting that the latest-sequence echo alone can understate.
- `pingRttMs`: transport ping/pong round trip. It excludes checkpoint processing and is not a gameplay-response measurement.
- `connectionMs` includes HTTPS/WebSocket/proxy setup; `joinMs` starts after the socket opens.
- Errors, unexpected disconnects, no-frame samples and setup failures prevent `complete=true`. Completion means the probe ran without those failures, not that latency meets a release threshold.

No credential, room code, player identifier, name or raw server error is printed. Server error text is mapped to a fixed small category set. Percentiles use nearest rank. All timings use the probe's monotonic clock; no server/client wall-clock synchronization is assumed.

## October 27 baseline: live commit `6a95b84`

The existing free Render service was live at `6a95b84e10d3551974523952b7ce5fddf774054e` (deploy `dep-dbg1572vcj2c73arkqj0`). One probe process simulated phones through this execution environment's network/proxy. Each controller sent up to 20 inputs/sec. A 20-controller setup began near the end of the 10-controller run, so these exploratory runs are not clean isolated capacity benchmarks.

| Simulated controllers | Measured racing time | Host frame-gap p95 | Worst host gap | Range of individual controller input-echo p95 | Disconnects | Error responses |
|---|---:|---:|---:|---:|---:|---:|
| 10 | 39.44 s | 106.13 ms | 300.36 ms | 89.53–98.84 ms | 0 | 8 |
| 20 | 40.66 s | 107.68 ms | 577.79 ms | 67.69–105.61 ms | 0 | 3 |

Both heats finished before the requested 45 seconds, and both runs correctly reported `complete=false` due to error responses. They are not successful acceptance runs. A separate three-controller reproduction identified two `unknown_action` responses around heat completion. A delayed client can have a control in flight while the server moves to reveal; the old transport then misroutes that control to turn-based action validation. Local real-WebSocket regression tests reproduce the same error in Grand Prix, Tap Dash and Light Trails. The correction retains authentication, input shape, match/heat validation and rate limits, while making otherwise valid late controls harmless during reveal. Scores and results cannot change.

Raw sanitized evidence is in [measurements](measurements/). Subsequent deployment and clean retest results must be recorded separately with their actual deployed commit.

## Limits

This measures synthetic sockets in one room. It does not establish physical iPhone/Android touch latency, rendering frame rate, background/foreground behavior, household Wi-Fi quality, multiple simultaneous rooms or an evening of sustained play. The roughly 578 ms baseline outlier deserves further observation. PostgreSQL checkpoint writes gate authoritative frames, so database contention is a possible contributor; these baseline measurements do not isolate its cause. Test on real phones before describing 10–20-person reliability as established.
