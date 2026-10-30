# Historical handoff from PR #107

This records the standalone patch's validation and scope. The consolidated Milestone 1 branch additionally removes the obsolete workflow history prerequisite; see `RELEASE_READINESS_2026_10_30.md` and its PR for current integration evidence.

# TV browser CI follow-up

Base: main `4f7c3211e91fb1568dd3fa60c3929df87df83b39` (merged #105).

The PR #105 Chromium job failed because its shallow checkout could not resolve historical revision 55414cd for a baseline screenshot. The other 180 tests passed; a tilt sizing case retried after measuring 43.99999237060547px against 44px.

Moved historical capture out of the automated browser suite to `script/capture-tv-catalog-baseline.mjs`. It retains the pinned full revision and identical 1920x1080 capture. Use a full checkout containing that revision, start the guest server, then run:

```
BASE_URL=http://127.0.0.1:4317 CHROMIUM_EXECUTABLE_PATH=/path/to/chrome-headless-shell node script/capture-tv-catalog-baseline.mjs
```

Output: `test-results/gx2-catalog-before.png`. Routine functional tests now require only current source; no history/network lookup, skip, or workflow change. Existing historical evidence in docs/evidence/gx2-tv remains intact.

The tilt test now independently asserts computed CSS min-height >=44px and measured box height >=43.99px. This accounts for browser geometry rounding while still rejecting undersized controls. No controller runtime/CSS changes. This minimal test-only change overlaps Agent 03's race-tilt spec; retain both assertions when integrating later edits.

Validation:

- `CHROMIUM_EXECUTABLE_PATH=/tmp/tv-fix-chrome/chrome-headless-shell-linux64/chrome-headless-shell npx playwright test --config examples/party-engine/playwright.config.js tv-catalog race-tilt mobile-host-invite --reporter=line`: 15 passed, 0 failed/skipped (44.0s).
- Manual capture command above against a local guest server on port 4318: passed, screenshot generated.
- `npm run check`: passed. `git diff --check`: passed.

No product code, dependencies, assets, protocols or licenses changed. No new performance claim. Full three-browser remote CI remains pending; physical devices untested. No merge/deployment performed. Rollback by reverting the PR; no migration.
