# Milestone 1 — release readiness

Authority: the user's PROJECT TRIVIA LOBBY assignment; execute now, no production deployment.
Baseline: main 0c0ebfb8cac2d049f80917183b76d5ed2bb63d39.

1. Audit current main, requested PR heads, actual failed-job logs/artifacts, deployment manifest, workflows, migrations and existing game infrastructure. Reproduce the TV/tilt failures locally before changes where the browser environment permits.
2. Consolidate reviewed test-only changes from #107 and #109, preserving provenance in git. Keep current-source assertions and manual historical screenshot capture. Remove the now-unused historical checkout requirement from .github/workflows/party-engine.yml. No product behavior, migration, timeout or skip changes.
3. Run root typecheck/unit/build/audit, standalone engine tests and targeted three-browser TV/tilt/racing tests. Run required hosted CI for the combined branch, including PostgreSQL 16/18, production-only startup and full browser suites. Diagnose any new failures using logs and retained traces.
4. Record exact evidence and limitations in docs/RELEASE_READINESS_2026_10_30.md and source decisions in docs/OPEN_SOURCE_ATTRIBUTION.md. Commit focused changes, open one PR, obtain an independent review, and leave unmerged/undeployed.

Review focus: assertions must still detect undersized controls, controller/host style leakage and broken end-match behavior. Programmatic activation is fixture cleanup only. Existing WebGL-specific skips must be reported, never relabeled as passing browser coverage. #81/#108 remain separate candidates; #84 is overlapping historical integration, not a new merge target.

Progress ledger: audit completed; baseline root tests 111/111, zero skips. No AGENTS.md found. Fresh clone isolates this work from earlier checkouts. User explicitly authorized implementation and PR creation; no additional plan-approval pause.
