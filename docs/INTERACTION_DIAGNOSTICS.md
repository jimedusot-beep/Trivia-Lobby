# Bounded diagnostics for three intermittent browser failures

This test-only infrastructure was introduced by #166. The numeric-geometry
follow-up carries useful #161 evidence into the same bounded observer instead
of adding a second recorder. It does not change application handlers or
authorize deployment.

## Observed gaps

- Firefox Family Showdown: joining timed out before a lobby heading appeared.
- Firefox Doodle Dash: Next completed at the browser API, but the next artist's
  word chooser did not become visible before the existing timeout.
- WebKit Wave Sprint: GAS OFF click completed at the browser API, but GAS ON
  did not appear before the existing timeout.

All three passed automatic CI retries. Five isolated attempts each passed with
retries disabled before this candidate; their causes remain unresolved. A
completed Playwright click does not establish native-event delivery, action
transmission, server acceptance or rendering. The earlier trace streams did not
contain WebSocket frame events. This candidate adds evidence for those stages.

## Capture contract

Only the selected Family, Doodle and Wave cases activate the helper. Instrumentation is attached
before navigation to the host and at most four anonymous guest seats. It follows
the same pages across reloads and observes native capture/bubble events for Join,
host Next and GAS, including Enter/Space activation. Per-document anonymous node
ordinals help identify replacement between pointer events. It does not replace
application handlers or WebSocket methods, send actions, or modify storage.

Known keyboard activations retain release events when the focused button is
removed between keydown and keyup. A two-key allowlist is cleared on release,
window blur and teardown; unrelated body input and Space typed into a nickname
field are ignored. This distinguishes missing activation from an unreleased key
without recording typed text. A controlled target-replacement test checks both
mouse and keyboard release; it is not a reproduction of a production defect.

The failure JSON correlates sent actions and acknowledgments using bounded
per-seat request ordinals. It records allowlisted message types, phases/stages,
numeric revisions/indices, gas booleans, known status categories, and whether a
word chooser is present/visible. No word/answer list is copied. A protocol error
can be classified as stale or other; the original error text is never written.

The JSON does not include URLs, room codes, credentials, raw request/match/player
IDs, nicknames, answers, secret words, frame payloads, arbitrary DOM/exception
text or audio. Only the main frame can contribute DOM records. These guarantees
apply to the new JSON, not the existing trace/error-context bundles, which are
unchanged and can contain synthetic test content.

Each attempt is limited to five pages, sixteen sockets per page, 128 anonymous
request IDs per page, 256 recent wire events and 128 recent DOM events per page.
Rolling buffers preserve the tail rather than stopping at the first burst.
Explicit dropped counters identify missing history/correlation. Browser binding
calls are limited to32 concurrently pending events; final browser teardown is
bounded to one second. Schemas2 and3 use one shared attempt-relative clock for all
seats and for both DOM/wire records, clipped at120seconds. Schema1 used a separate
origin for each seat; do not compare those legacy times across seats. Node and
request IDs still belong to their document/seat namespaces. Observed browser
loss is totaled across documents without double-counting repeated samples.
Missing callbacks can still hide unobserved loss; counters are not completeness
proof. The serialized file is
capped at512KiB. Partial/absent capture is marked; it is never proof that an
unrecorded event did not happen.

Only failed or timed-out ordinary game attempts write
`interaction-diagnostics.json`. Passing/skipped/interrupted attempts do not.
Teardown is idempotent; capture/write/attachment failures annotate missing
evidence and preserve the original test status. Existing assertions, gameplay
actions, timeouts and retry settings remain unchanged. The existing successful
job artifact allowlist gains only this JSON filename, with the same three-day
retention. Existing failure bundles remain intact.

## Validation and interpretation

The new unit tests check redaction, correlation, rolling-buffer overflow,
multi-page/file bounds, reload namespaces, independent attempts, teardown,
unresponsive pages, attachment/capture loss, shared clock alignment and loss
totals across reloads. Browser contract tests deliberately
retain a controlled failure report, inspect it, and remove it on success. One
withholds a synthetic join submission to prove that native events can exist
without a sent join. Positive controls use normal joins, GAS, host Next, reloads
and the Doodle private chooser. This is diagnostic control evidence, not a
reproduction of the original intermittent defects.

Validate the three unchanged game cases with the helper enabled and retries0.
Record the candidate source tree, actual commands/counts and runtime qualifications
in the accompanying validation report. These desktop synthetic fixtures do not
reproduce GitHub runner load/order, prove all-game completion or replace actual
iPhone/Android/TV acceptance. The observer can affect timing; a green instrumented
run does not solve a race.

On a future failure, compare the named seat/document/native target, sent action,
anonymous request/ack and state revision, then the DOM snapshot. A missing action
after a native event, a stale rejection, a missing acknowledgment, and an accepted
state that was not rendered are different hypotheses. Missing/dropped capture
must remain an uncertainty. Review that exact evidence before proposing a fix;
do not hide failures by weakening assertions or increasing retries/timeouts.

The older #161 helper is a historical prototype. Its useful numeric geometry
and board context are reconciled above; do not install duplicate observers or
add this helper to runtime code.


## Schema3 numeric geometry reconciliation

Schema3 adds optional Next bounding-box x/y/width/height and native pointer
coordinates, rounded to0.001px and clipped to±100000. Nonfinite/non-numeric
values are omitted. Pointer ordinals remain bounded integers. `timerVisible`
is only a boolean; timer text is not retained. Structured received states can
include their canonical zero-based board `round` (maximum10), avoiding parses
of localized or authored DOM text. This preserves #161's useful button/point
geometry and board context while retaining #166's shared clock, caps, privacy,
reload namespaces, keyboard release and bounded cleanup. Older schema2 records
remain valid historical evidence with the same clock basis.

The full five-page/buffer-size unit case includes the added geometry and still
requires the512KiB limit. Native browser controls verify Next press coordinates
and a visible control rectangle; successful control JSON is inspected/deleted.
Geometry reads can perturb timing and are diagnostic evidence, not a race fix.
