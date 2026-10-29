# Grand Prix track projection performance contract

The server projects every kart onto 256 track segments repeatedly per physics
step. The current scan constructs temporary objects and computes angles/square
roots whenever a better candidate appears. Precompute invariant segment geometry
and construct only the final nearest result. Preserve the full global scan,
segment order, exact projection arithmetic, tie behavior, returned fields and
physics rules. No approximate search, new dependencies or transport changes.

Acceptance: compare against the released algorithm across on-track, seam,
centerline and off-track samples; run full guest tests and root checks/build.
Measure both algorithms on identical deterministic samples after warmup. Report
local timing as local CPU evidence, not a production latency guarantee.

## Local measurement

Run `node script/benchmark-race-track.mjs` from a checkout containing the pinned
baseline revision. After warmup, seven alternating-order rounds each project
20,480 deterministic points. Initial local medians were 132.53 ms before versus
18.86 ms after (7.03x projection throughput, 85.8% less time in this function).
This does not establish a corresponding whole-game or production speedup.
The equivalence regression covers 2,826 inputs, including every track vertex,
seam endpoints, large offsets, center, corners and non-finite inputs.
