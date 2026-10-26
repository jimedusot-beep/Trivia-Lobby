# Locally rendered live-room QR invitations

## Behavior

Every guest and private host lobby displays an accessible SVG QR code containing the **same public guest invitation URL** as the adjacent copy/share controls. A compact invitation remains available during play and after the match. Assignment owners also have QR invitations. Encoding is entirely local and never uses a QR image API. Private live links use `/join?code=ABC234`; guest party links use `/party/?code=ABC234` (or `/?code=ABC234` on the standalone guest server). Assignment links use their existing public guest route. There are **no host tokens, player credentials, private deck IDs or question data** in the QR code or downloaded SVG.

Mobile guests scan using their device camera, open the join page with the room code prefilled, choose a nickname, and join without an account. If QR encoding is unavailable, the original room code and link remain visible. Hosts can still copy and share the ordinary link.

## Licensed QR encoder provenance

We use the established MIT-licensed QR Code generator by **Project Nayuki**, without any proprietary Kahoot code or interface assets:
- Project and maintained source: https://github.com/nayuki/QR-Code-generator
- Exact upstream TypeScript source: https://github.com/nayuki/QR-Code-generator/blob/8329a7108fc22be3e1eec0a9f9318978579e3621/typescript-javascript/qrcodegen.ts
- Upstream commit: `8329a7108fc22be3e1eec0a9f9318978579e3621` (September 1, 2024)
- Original source blob SHA: `c4191ac0b5f8a24d87fd9340ceaa2d3b07d0231a`
- Copyright / license: **Copyright (c) Project Nayuki. (MIT License)**. The full MIT permission and warranty notice is retained intact in `client/src/lib/vendor/qrcodegen.ts`. The only project adjustment is an export statement making the existing namespace available as an ES module.

The generated browser module at `examples/party-engine/public/vendor/qrcodegen.js` is derived from this same source with `node --import tsx script/build-qr.ts`, retaining the full MIT notice. The production build regenerates it. No runtime npm dependency, external QR endpoint, license-significant rewrite or tracking SDK is introduced. See `QR_PARTY_SHARING.md` for the complete upgrade specification and the development-only independent decoder.

## Test and release limits

- Unit and browser tests independently decode QR pixels and check the exact public invitation payload, including different origins, guest paths and assignment URLs.
- Browser acceptance covers hosted modes, guest joining, custom quizzes, sharing fallbacks, SVG downloads, reconnects and phone layouts.
- These checks **do not claim a physical phone camera was tested**. Real deployed HTTPS links are checked separately; physical iOS/Android camera scanning remains an additional manual check.
- QR generation does not solve broader catalog discovery, public moderation or distributed room authority.

Merge, deployment, automated decoding and physical-device verification are distinct states. Report only checks that actually ran. This presentation upgrade does not change game authority, private access controls or storage.
