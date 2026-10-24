# Post-merge HTTP request parsing mitigation — October 24, 2026

The merged Trivia Lobby parity code is on `main`, but dependency audit detected two newly disclosed high-severity vulnerabilities. This is **not a complete fix for the release gate**.

## GHSA-27r3-jxmh-p828: compressed request body denial of service

The web application accepts ordinary JSON and URL-encoded form submissions. It has no legitimate need to inflate gzip/deflate/brotli HTTP request bodies. The production server now explicitly sets `inflate: false` in both `express.json` and `express.urlencoded` so an encoded body is refused *before* an affected decompression stream is created.

The production acceptance test sends compressed JSON and compressed URL-encoded payloads to public authentication routes, requires status 415, then confirms `/health/live` still responds. This is defense in depth, **not a claim that `body-parser@2.3.0` is patched**. Upgrade it to 2.4.0 and commit the refreshed lockfile.

Primary upstream advisory: https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828

## GHSA-mrhx-c7xc-m3w5: Zod unconstrained collection handling

Installed `zod@3.24.2` is flagged by the October 2026 security advisory; a release-grade fix requires migration to `zod@4.6.6+` with all dependent schema logic and frontend types exercised. The current repository already bounds many public collections, and accepts maximum 4 MB JSON bodies, reducing exploitability but **not eliminating the reported dependency finding**. Do not alter or disable `npm audit` to make CI appear green.

Primary advisory: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5

## Gate and outstanding integration work

- **Do not promote or deploy** until the dependency upgrade, reproducible lockfile, security audit and standard/three-browser/integration/recovery tests succeed.
- Open tracking issue: https://github.com/jimedusot-beep/Trivia-Lobby/issues/34
- Learner history migration `0006_persistent_learning_history.sql` is in still-open PR #26 and is absent from the merged migrations runner; reconcile and rehearse it with already-merged `0007` and `0008`.
- No change in this branch to multiplayer score authority, existing game persistence, assignment grading, or media. The mitigation is limited to the app-wide request-parser configuration and its regression test.
