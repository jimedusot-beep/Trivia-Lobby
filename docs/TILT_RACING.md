# Tilt steering for Grand Prix

Add opt-in phone tilt steering within the shared one-screen controller. A visible
Tilt steering button requests orientation access directly from a user gesture.
Once valid data arrives, the comfortable held angle becomes neutral. Show a compact
steering indicator, Center and Touch controls while drift/item remain large.
Touch/keyboard steering remains available without sensors or permission. No server
physics, scoring, input budgets, other games or dependencies change.

Use relative deviceorientation readings only; no compass/magnetometer request,
recording or raw sensor transmission. Original implementation based on W3C Device
Orientation and Motion (26 October 2026 Candidate Recommendation), sections 3.1
(device coordinates do not rotate with the display), 4 and 6.1 (secure context,
user activation and permission). https://www.w3.org/TR/orientation-event/
No upstream source copied. Screen-relative gravity projection makes upright
portrait, both landscape directions and upside-down holds consistent. Flat holds
cannot determine steering-wheel roll reliably: neutralize and ask for upright hold.

Apply a 3-degree dead zone, full steering at 24 degrees and 80ms smoothing. Sample
through the existing 20Hz send loop; events never send packets directly. Stale data
(700ms), hidden/blurred pages and open controller dialogs neutralize steering and
require a fresh neutral sample. Rotation and Center recalibrate. Denial, unsupported
API, errors or no valid initial data within 3 seconds retain touch controls. Ignore
permission completions after cleanup. No automatic permission prompts after reload
or between heats; tap Tilt steering again. Normal browser zoom remains available.

Verify math, bounds, portrait/landscape, calibration, denied/granted/pending access,
missing/null/stale data, switching, dialog/visibility release, cleanup and real
WebSocket steering frames. Verify no page scrolling and drift/item with tilt on
short phones. Run root check/tests/build, guest tests and affected browser flows.
Browser tests use synthetic sensor events; physical iPhone/Android feel and sensor
compatibility remain unverified until tested on hardware.
