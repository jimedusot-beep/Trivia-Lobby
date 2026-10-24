# Locally rendered live-room QR invitations

## Behavior

The host lobby displays an accessible SVG QR code containing the **same public guest invitation URL** as the adjacent copy/share controls. It is generated entirely in the browser and never sent to a QR image API. Invite links include `/join?code=ABC234` only; there are **no host tokens, player credentials or private deck data** in the code.

Mobile guests scan using their device camera, open the join page with the room code prefilled, choose a nickname, and join without an account. If QR encoding is unavailable, the original room code and link remain visible. Hosts can still copy and share the ordinary link.

## Licensed QR encoder provenance

We use the established MIT-licensed QR Code generator by **Project Nayuki**, without any proprietary Kahoot code or interface assets:
- Project and maintained source: https://github.com/nayuki/QR-Code-generator
- Exact upstream TypeScript source: https://github.com/nayuki/QR-Code-generator/blob/8329a7108fc22be3e1eec0a9f9318978579e3621/typescript-javascript/qrcodegen.ts
- Upstream commit: `8329a7108fc22be3e1eec0a9f9318978579e3621` (September 1, 2024)
- Original source blob SHA: `c4191ac0b5f8a24d87fd9340ceaa2d3b07d0231a`
- Copyright / license: **Copyright (c) Project Nayuki. (MIT License)**. The full MIT permission and warranty notice is retained intact in `client/src/lib/vendor/qrcodegen.ts`. The only project adjustment is an export statement making the existing namespace available as an ES module.

No npm dependency, external QR endpoint, license-significant rewrite or tracking SDK is introduced.

## Test and release limits

- Unit tests exercise reproducible QR generation for full HTTPS invitation URLs, finder modules, and distinctions between room codes.
- Browser acceptance verifies a QR SVG appears in the host lobby, the encoded matrix is nonempty and the adjacent guest URL includes the exact room code.
- These checks **do not simulate an actual phone camera decoding the QR image**. A physical iOS/Android scan and real deployed HTTPS domain check remain a manual release requirement.
- QR generation does not solve broader catalog discovery, public moderation or distributed room authority.

This work is stacked on earlier parity PRs #27–#32. Merge and review dependent PRs in order after checks pass; no production deployment without offsite backup/recovery, permissions and real host/player acceptance.
