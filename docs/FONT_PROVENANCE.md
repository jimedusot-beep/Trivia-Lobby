# Bundled font provenance

Trivia Lobby bundles its two existing UI font families with the application. Runtime pages no longer request Google's font catalog or font CDN. Removing the unused catalog and external CSS imports avoids stylesheet delays during sign-in/reload and makes typography available on networks that block external font services. The viewport also permits browser pinch zoom.

| Family | Pinned source package | License notice shipped with the app |
|---|---|---|
| Fredoka | `@fontsource-variable/fredoka@5.3.0` | `client/public/licenses/fredoka-OFL.txt` — Copyright 2016 The Fredoka Project Authors |
| Nunito | `@fontsource-variable/nunito@5.3.0` | `client/public/licenses/nunito-OFL.txt` — Copyright 2014 The Nunito Project Authors |

Both packages declare SIL Open Font License 1.1. Their complete copyright/license notices are copied unchanged from the pinned packages and served at `/licenses/fredoka-OFL.txt` and `/licenses/nunito-OFL.txt`. The font binaries are unmodified package assets, emitted by Vite with hashed filenames. Fontsource's default variable faces retain the available Unicode subsets and use `font-display: swap` with system sans-serif fallbacks.

The full dependency audit remains clear; the regenerated production license inventory now records 282 packages with no missing/review-required metadata. See [Fontsource's installation documentation](https://fontsource.org/docs/getting-started/install) and [variable-font documentation](https://fontsource.org/docs/getting-started/variable).

The production-stylesheet browser checks load the exact built font bytes, wait for the font faces to be ready, reject external Google font requests, and verify that zoom is allowed. Cross-device sign-in checks synchronize with the actual document reload before inspecting the authenticated page.
