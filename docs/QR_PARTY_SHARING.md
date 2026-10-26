# QR invitations for every hosted game

## Specification

Every guest Quiz, custom Quiz, Prompt Duel and Charades room provides a locally
generated QR invitation, the same readable join URL, copy/share controls and an
SVG download. All eight private host modes retain the same controls. A compact
invitation remains available during play and after a match. Assignment owners
can share their public guest invitation using the same QR controls.

QR payloads contain only the public guest URL and public room code or assignment
ID. Never encode host/player reconnect credentials, private deck IDs, question
content, the host's query string or fragments. Encoding and downloads run locally;
there is no QR image service, new database schema or change to joining/scoring.
New live players still join during the lobby; existing players may reconnect.

The host lobby shows the QR prominently. Other participants and active matches
use a collapsible panel to keep play readable on phones. Updates to scores or
players must not replace a focused invitation control or close an open panel.
Clipboard failures leave a selectable link; a cancelled native share is respected.
Encoding failures leave all ordinary invitation controls usable. QR modules use
dark ink on white with a four-module quiet zone and no logo overlay.

## Acceptance

- Independently decode rendered QR modules back to their exact invitation URLs.
- Scan targets prefill the guest join form, without requiring an account.
- Cover every hosted mode, custom quizzes, assignments, active games and rematches.
- Check copy success, denied clipboard, unavailable/cancelled native sharing,
  SVG downloads, reconnects and phone layouts.
- No external QR requests or credentials in payloads, SVG downloads or share data.
- TypeScript, unit tests, production build, guest browser scenarios and the
  Chromium/Firefox/WebKit application matrix must pass before merge.

## Reuse and limitations

The encoder is the existing MIT-licensed Project Nayuki implementation documented
in `LOCAL_QR_INVITATIONS.md`. `script/build-qr.ts` derives the guest-browser ES module
from that canonical TypeScript source, retaining the full license. The checked-in
browser module also supports the standalone guest server without a build tool.
The main production build regenerates it before packaging.

Development-only jsQR 1.4.0 (https://github.com/cozmo/jsQR, Apache-2.0) independently
decodes QR pixels in tests. Development-only pngjs 7.0.0
(https://github.com/pngjs/pngjs, MIT) reads browser screenshot pixels for that
independent decode. Both exact versions and package integrities are pinned in
the lockfile; their package license notices remain intact. Neither ships to players.
A software decode is not
a claim that a physical phone camera was tested. Room links remain temporary and
cannot reconnect a guest to a room after a server restart.
