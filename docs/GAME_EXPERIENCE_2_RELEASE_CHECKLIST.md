# Game Experience 2.0 release checklist

Owner: Agent 00. Date: October 29, 2026. Planning only; all unchecked gates remain outstanding.

## Before agents branch

- [x] Pin current main: `55414cd7d3f8cc903897f5d40f3d0e914aea579b`.
- [x] Inspect source, package scripts, workflows, existing renderer APIs and catalog (31 IDs).
- [x] Verify #93 is open and its six workflow conclusions are success at `cdc9cce43b869d520253148fc22c3b384ac156d2`.
- [x] Record open #81–84 and avoid duplicate reliability integration.
- [x] Assign exclusive ownership and protected shared paths in the roadmap.
- [ ] Complete Agent 09 pinned license/asset review and approved reuse menu.
- [ ] Recheck main and PR statuses immediately before each new branch/integration.

## Each implementation PR

- [ ] Record baseline/head SHA, PR URL, owned files and any shared-patch agreement.
- [ ] Preserve every existing game, account-free entry, authority and role privacy.
- [ ] Run root check/test/build and focused guest tests; report exact pass/fail/skip counts.
- [ ] Supply before/after captures with browser, dimensions, state and commit.
- [ ] Check no-scroll phone controls, keyboard, safe areas, orientation, accessibility and reduced motion.
- [ ] Verify reload/reconnect, return to trivia and correct phase/turn transitions.
- [ ] Record asset source/revision/license/notices, bundle impact and cleanup/performance evidence.
- [ ] Preserve fallback, mute and cancellation paths where relevant.
- [ ] Document limitations and integration handoff; leave PR unmerged.

## Combined candidate and release approval

- [ ] Record disposable integration head and every source PR/head SHA.
- [ ] Pass all three-browser guest and integrated-platform workflows on that head.
- [ ] Pass recovery and simulated 2/4/10/20-player load checks; report metrics and environment.
- [ ] Confirm no hidden-answer/card leakage and phones never load race 3D assets.
- [ ] Resolve #93 integration and independently assess #84 vs #81–83.
- [ ] Retain durable capture links/files; CI screenshot artifacts have limited retention.
- [ ] Record real iPhone/Android permission, tilt calibration, touch fallback and comfort results.
- [ ] Record workplace Wi-Fi test with 4 then 10–20 actual phones, QR entry, race, reconnect and trivia return.
- [ ] Record previous known-good artifact, rollback steps and any operational constraints.
- [ ] Obtain user approval for named merges; recheck head/CI/conflicts before each merge.
- [ ] Obtain deployment approval for the tested artifact/environment.
- [ ] Verify deployed artifact identity and live smoke test; only then report deployed status.

## Agent 00 audit validation

Local environment: Node 24.22.1; CI configuration uses Node 22. No browser or physical-phone acceptance is implied by source inspection. Commands and final results are recorded below before PR submission. Browser/database acceptance is deferred to implementation and combined-candidate gates because this change edits documentation only.

| Command | Result |
| --- | --- |
| Root `npm ci --ignore-scripts --no-audit --no-fund` | Passed; 395 packages installed |
| `npm run check` | Passed; TypeScript exit 0 |
| Root `npm test` | 111 passed, 0 failed, 0 skipped |
| `npm run build` | Passed; existing large-chunk warning reported |
| Guest `npm ci --ignore-scripts --no-audit --no-fund` then `npm test` | 253 passed, 0 failed, 0 skipped |
| Import `guestGames` and count IDs | 31 unique catalog entries inspected |
| `git diff --check` | Passed before submission |

Not run in this documentation assignment: browser suites, database integration, new performance benchmarks, upstream license verification and physical-device tests. No new assets, dependencies or runtime changes. Agent 09 owns the license audit and its generated inventory; this PR does not claim compliance approval.
