# Public bilingual tools and control-test integration — November 21, 2026

## Scope and evidence labels

**Verified:** This change consolidates compatible repository work in the existing
bilingual-practice draft branch. It retains the current-main Next repair, the
sample/creator/practice stack, bounded interaction diagnostics, the Family
Showdown clock regression and the Firefox measurement repair. It adds the
previously local saved-course and Showdown-editor localization candidates.

**Needs testing:** This is draft integration, not whole-catalog bilingual
certification, physical-device acceptance, production readiness or deployment.
The final verification table distinguishes local fixture checks from the
database-backed application. No test result from an earlier report is counted as
a new execution here.

## Inventory before editing

**Verified:** The session parent directory was not a Git repository. Its shared
Trivia Lobby checkout was `trivia-integration-review-20261119`, with remote
`https://github.com/jimedusot-beep/Trivia-Lobby.git`. HEAD was detached at
`ea2cf978f779e204c23a473986ebdf1a026e6c43`. Its status was:

```text
## HEAD (no branch)
?? examples/party-engine/browser-specs/solo-percentage-completion.spec.js
```

The untracked Percentage file was byte-identical to current main, so it was
preserved rather than imported again. There were no local-only commits from that
HEAD. Cached `origin/main` was `51087647d0627521e57239c6a1612d3767c5833e`, two
commits ahead of HEAD. A read-only remote/API check established actual main as
`2224995770c7d362246581d6d07766bdee188aed`, fifteen commits ahead of HEAD with no
divergence. Main's tree was `74c32d88f07dc8b8b0099d11d9f7e854c707a657`.

Local `main` and numerous detached review/test worktrees existed. No PR belonged
to the detached checkout. The six open PRs were drafts: #161, #163, #164, #165,
#168 and #169. Their actual branches and heads were inspected before selection.
A fresh worktree was created on the observed existing branch
`codex/bilingual-practice-20261120` at
`94bf23435b1696d7cb8995ae4b2d8c969607b614`; existing source worktrees were not
overwritten. PR #165 is reused rather than creating a duplicate.

No `AGENTS.md` was found. README, CONTRIBUTING, package scripts and workflows
were inspected. The project uses React/TypeScript/Express/PostgreSQL plus its
standalone guest engine; Node 22+ is documented. The required runtime checks
include root type checking, unit tests, build, affected browser flows and
database-backed integration. CI/deployment configuration is retained from main.

## Reconciliation decisions

**Verified:** No conflicting implementation choice required guessing. The three
test patches applied cleanly; the selected course/editor source copies agreed.

| Decision | Candidate | Canonical choice / limit |
| --- | --- | --- |
| KEEP | Samples #163, creator #164, practice #165 | Retain the existing practice branch's dependency ancestry, including repaired main |
| KEEP | Geometry/redaction follow-up #161 | Port the four-file patch into the existing shared observer; no second recorder |
| KEEP | Family Showdown regression #168 | Port its helper extension and held-Next clock case; retain actual main's application repair |
| KEEP | Firefox measurement #169 | Port test-only 0.001px measurement normalization; application touch-target CSS is unchanged |
| KEEP | Local saved-course localization | Explicit UI copy, literal authored content, asynchronous save/focus safeguards and acceptance specs |
| KEEP | Local Showdown-editor localization | Literal authored fields, validation/import/save/export feedback and acceptance specs |
| REPLACE | Older duplicated foundation, Percentage and diagnostic candidates | Current main / published draft versions are canonical; originals remain preserved |
| HOLD | Separate driver-view prototype and ZBook-only dirty implementation | Not available as verified compatible source in this integration checkout; no blind ZIP overlay |
| HOLD | Playable bilingual content, answer adjudication, match rotation, private-account localization | Require separate bounded implementation and validation |
| HOLD | Editorial/device, database/recovery and production acceptance | No inferred pass from local UI tests |
| DROP from publication | Deliberately failing probes, generated bundles/results, dependency caches and temporary local harness | Excluded from commits; this is not deletion of original work |

The new commits are ordinary commits, not branch merges or cherry-picks. No PR
is merged or closed. Retargeting the existing draft to main exposes the complete
integrated diff without changing the other draft PRs.

## What ran

**Verified:** Node was `24.22.3`, Playwright was `1.64.1`. Existing installed
dependencies were reused; the root lockfile matched the installed source
checkout. No package was installed or upgraded. Chromium used an existing
headless-shell executable; Firefox/WebKit used existing browser runtimes and
native-library overrides. Host-requirement validation was explicitly skipped.
The browsers are desktop engines with synthetic data and emulated phone widths.

| Command / check | Observed result | Scope |
| --- | --- | --- |
| `npm run check` | Passed | Root TypeScript check, including the added specs |
| `npm test` at root | 122 passed; 0 failed/skipped | Existing root unit suites |
| `npm test` in `examples/party-engine` | 368 passed; 0 failed/skipped | Full guest Node suite, including redaction and source/build contracts |
| Six bilingual public-UI specs, three browsers | 96 passed; 0 failed/skipped; retries disabled | Thirty-two cases per engine; React + standalone guest proxy fixture, no database-backed APIs/recovery |
| Focused guest identity/control/editor cases, three browsers | 36 passed; 0 failed/skipped; retries disabled | Twelve cases per engine, including full Family Showdown, clock cleanup, diagnostic redaction and touch measurement |
| Existing learning + five mixed-language game specs, three browsers | 63 passed; 0 failed/skipped; retries disabled | Twenty-one cases per engine; English recovery/reward invariants, scoring, Next, TV-sized view and reconnect |
| `npm run build` | Passed | Production compilation and guest-asset packaging only |
| `git diff --check` and staged equivalent | Passed before control commits | Whitespace/diff checks |

The final passing browser suites total 195 cases (96 + 36 + 63), with no skips
or retries. The separate three-case handoff preflight is not added to that total.
The build emitted Vite's over-500-kB chunk warning (the largest client chunk was
830.72 kB before gzip); runtime performance and bundle-size optimization remain
separate work rather than being declared resolved by a successful build.

The two new feature cases were first run on the unmodified published draft and
both failed on the expected `main[lang]` mismatch (`en`, expected `es`). This is
the failing-first feature evidence. An earlier attempt failed because server
and browser commands had isolated loopback networks; those connection failures
are explicitly excluded from feature-regression proof.

### Integrated application attempt and fixture boundary

**Verified:** A real `npm run dev` application was also started with a deliberately
unavailable, synthetic loopback PostgreSQL URL. Its six-spec browser run recorded
89 passes, three Showdown host-handoff failures, four cases not run and a runner
stop error at the three-failure cap. All three failures were the same heading
assertion after host handoff. The application logged checkpoint `ECONNREFUSED`
and closed the connection through its existing recovery-storage guard.

The assertions were not weakened. The unchanged handoff case then passed in all
three engines against the existing style of local Vite/standalone-guest proxy
fixture. That fixture uses real frontend/guest sources and WebSockets with
synthetic rooms, but it does not construct the PostgreSQL checkpoint store or
exercise private authenticated APIs. Fixture passes do not erase the integrated
attempt or establish database-backed recovery. No production setting was changed
and no recovery guard was bypassed in application code.

The UI and guest tests used one worker per run and zero retries. Diagnostic
preflight repetitions are reported separately rather than inflating the final
suite totals.

## Commands and inspected-only requirements

The public-UI run selected these existing/added files through `npm run test:e2e`:

```text
e2e/bilingual-identity.spec.ts
e2e/bilingual-sample-learning.spec.ts
e2e/bilingual-creator.spec.ts
e2e/bilingual-practice.spec.ts
e2e/bilingual-courses.spec.ts
e2e/bilingual-showdown-editor.spec.ts
```

The focused standalone run selected `bilingual-identity.spec.js`,
`interaction-evidence.spec.js`, `open-pack.spec.js` and
`phone-controllers.spec.js`, with this exact title filter:

```text
interaction evidence:|Family Showdown:|short-landscape prompt|public tools retain|Spanish catalog|Custom showdown|Razzia import
```

The regression run selected `learning.spec.js`, `bilingual.spec.js`,
`bilingual-tv.spec.js`, `bilingual-answer-scoring.spec.js`,
`bilingual-answer-all-rounds.spec.js` and `bilingual-reconnect.spec.js`.
Standalone cross-browser execution used `PARTY_CROSS_BROWSER=1`; all browser
commands used `--retries=0 --workers=1 --reporter=line`.

**Inspected only / Needs testing:** Full PostgreSQL integration, migrations,
database restore drills, production-runtime startup, dependency security audit,
physical-device acceptance and live performance were not executed in this local
wave. Use the documented disposable-database setup and exact-head CI for those
gates. Build success alone is not production-startup or deployment evidence.

## Remaining gates and next handoff

**Needs testing:** Fresh exact-head CI; database-backed integrated host/recovery
acceptance; bilingual human editorial review; actual iPhone Safari, Android and
TV acceptance; remaining playable-content integration and release gates. The
existing game certification ledger is not advanced by this change.

The repository diff must contain no dependency/lockfile, CI, deployment,
infrastructure, credential or real-data change. No private prototype package or
private planning record is copied into this public repository. No new service,
telemetry, external translation request, audio capture or model download is added.

Before continuing, inspect the current branch/head, read CONTRIBUTING and this
record, compare current GitHub state and select one bounded next action. A fresh
local OpenCode checkout/handoff remains a separate verification; publishing this
branch does not synchronize a laptop automatically.

## Commit linkage

The locally tested functional integration is commit
`c966b7bb736f142933bc3f0cb8ead86a8e9a709e`. Its published counterpart is
`33bd417fcd8a53147b884cb416af59711a1abaea`. Both have exactly the same full tree:
`395416783e7bf1c38baecdc3ede9617cb6a7bb49`. Unit/browser checks ran against the
same candidate source bytes before/during the local commits; the eleven imported
feature/spec hashes were checked unchanged before committing. Publication was
verified by matching Git blob/tree hashes, not by relabeling earlier tests as new
hosted executions. The following verification-record commit changes docs only.

| Local commit | Published commit | Scope |
| --- | --- | --- |
| `17c14bff` | `4ba53db1` | Reconcile bounded shared geometry diagnostics |
| `a40294e5` | `24b23b17` | Retain Family Showdown held-Next clock regression |
| `2424c643` | `a7374304` | Normalize fractional measurements without changing CSS |
| `c966b7bb` | `33bd417f` | Localize saved courses and Showdown authoring with acceptance specs |

**Verified:** The shell's ordinary `git push` failed because no GitHub CLI/Git
credential was configured. That failed attempt moved no remote ref. The
authenticated connected GitHub service creates ordinary single-parent commits
with the verified source trees, followed by a non-forced fast-forward update
guarded by the expected old head. GitHub supplies different commit metadata, so
the commit IDs differ while every functional source tree is identical. The local
prepared commits are retained rather than reset or overwritten, and the published
head can be fetched normally into a fresh tracking worktree. No credential or
repository setting is changed for this fallback.

The published draft's previous head
`94bf23435b1696d7cb8995ae4b2d8c969607b614` remains an ancestor. No history is
rewritten and no forced update is required. Final CI must be reviewed at the
published documentation head; this record does not claim hosted CI completion.
