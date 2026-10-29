# Race browser cleanup follow-up

Base: main `0c0ebfb8cac2d049f80917183b76d5ed2bb63d39` (after #106). Test-fixture maintenance only.

## Failure evidence

Guest run [40945025837](https://github.com/jimedusot-beep/Trivia-Lobby/actions/runs/40945025837), WebKit job `123698048799`, timed out the twenty-controller recovery journey on both attempts. Its traces show all recovery assertions completed successfully, including twenty published racers/results, match identity, player reload and host reload. The last successful assertion checked the empty browser-error list. The following cleanup click targeted “End this match”. It encountered intercepted pointer input, then the button detached as the real heat entered reveal. Cleanup waited for a button that no longer existed until the 120-second test deadline.

Before the change, the local WebKit twenty-controller journey passed in 57.9 seconds; the failure is intermittent locally, with two concrete failing hosted attempts above. An unchanged-fixture Firefox/WebKit race suite also passed 8/8, zero failures/skips, in 3.5 minutes. Passing local runs do not negate the hosted trace.

## Change and boundaries

The fixture finds and activates its existing End this match button in one synchronous browser DOM task. This avoids interleaving a heat transition between locating a button, scrolling, pointer hit-testing and activation. It retains the real confirmation handler and existing client/server action. If the button is already absent, cleanup proceeds as before. After activation the fixture requires an authoritative snapshot in finished or reveal, since the server can naturally finish the heat while an end request is in flight. Browser contexts always close in finally, and the fixture removes its dialog listener.

This programmatic activation is confined to fixture housekeeping. The explicit gameplay journey in race.spec.js still checks real heat results, next heat, the host's normal user click on End this match and return to the same room. Every twenty-player reload assertion is retained. No production file, scoring, physics, protocol, timeout, forced locator click, conditional skip or catch-and-ignore behavior changes.

Retaining active-match termination matters: merely closing the browser contexts leaves matches running until server host-grace expiry and can hit the existing four-active-race limit. Serial testing rejected that earlier cleanup approach. Natural reveal remains a legal cleanup boundary, as it was when the original visibility check found no end button.

## Reproduction and verification

From examples/party-engine, use the repository's configured Playwright browser versions:

```bash
PARTY_CROSS_BROWSER=1 npm run test:browser -- --project=chromium --project=firefox --project=webkit browser-specs/race.spec.js --output=/tmp/trivia-cleanup-final-race-results
npm run test:browser -- --project=chromium browser-specs/race-3d.spec.js --output=/tmp/trivia-cleanup-final-3d-results
npm test
```

Run one browser command at a time. Independent runs must use different output folders: simultaneous default-output runs caused missing Playwright trace files, and overlapping browser runs also experienced target crashes during setup. Those failed attempts are not passing evidence. Final candidate counts and hosted CI status belong in the PR description.

Local environment: Debian 13, Node 24.22.1; Chrome for Testing 156.0.8078.47 via CHROMIUM_EXECUTABLE_PATH, Playwright Firefox 157.0 (1555), and WebKit build 2370. Missing WebKit libraries were extracted into its local browser bundle without repository dependency changes. Local WebKit uses PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS=1 because its ldconfig-based prerequisite probe cannot see those local libraries; the actual browser journeys and assertions still execute. Hosted CI uses its normal dependency installation and validation.

Root npm run check, npm test (111 passed, zero failed/skipped) and npm run build passed on the unchanged runtime; build retains existing chunk/SVG warnings. Guest npm test passed 259/259, zero failures/skips. No root/database/production browser integration claim is made from these local commands.

## Integration handoff

- Files: examples/party-engine/browser-specs/helpers/race-lobby.js and this handoff.
- Dependencies/APIs/production bundle: unchanged. No schema, credential or storage operations.
- Source/license inventory: original test maintenance; no third-party code/assets or license changes.
- Conflict risk: other race-helper edits. Preserve QR decoding, independent browser contexts, captured state/inputs and every gameplay assertion.
- Required hosted gates: guest browser suite and existing platform/recovery workflows on the resulting PR head. This patch does not include #107's independent TV font/history changes; existing unrelated CI failures remain failures.
- Rollback: revert this fixture/documentation PR. No migration or deployment operation.
- Physical phones, workplace Wi-Fi and production acceptance remain unverified. No merge or deployment.
