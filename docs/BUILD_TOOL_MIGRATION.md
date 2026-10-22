# Build-tool security maintenance

The previous lockfile reported eight development advisories (five high, three moderate), all reachable through Tailwind 3's glob/selector dependencies and the unused typography plugin. The production-only CI audit did not fail for these findings. The new lockfile reports zero vulnerabilities in the full `npm audit`.

- Pin `tailwindcss` and `@tailwindcss/vite` to 4.3.3 and enable the dedicated Vite plugin. Keep the existing theme through an explicit CSS `@config` directive.
- Remove the unused typography plugin and obsolete PostCSS/autoprefixer setup. This removes the `braces`, `micromatch`, `fast-glob`, old `chokidar` and `postcss-selector-parser` dependency paths instead of suppressing their advisories.
- Update `tailwind-merge` to 3.7.0 for the v4 utility grammar. Keep component overrides for font size, height, padding, radius and shadows working.
- Preserve the existing small-shadow and blur sizes through renamed utilities, retain forced-color-compatible hidden outlines, and use explicit `var(...)` in Radix/chart utility values. Register spring easing as a v4 utility and retain the existing custom theme radii.
- Wrap home actions across rows. The compiled-style browser check exposed clipped actions and horizontal overflow at tablet widths when every action was forced into one row.
- Audit production and development dependencies in both CI workflows with `npm audit --audit-level=moderate`. No audit exceptions, dependency forks or forced incompatible transitive overrides are used.

The regenerated production license inventory still records 280 packages without missing/review-required metadata. Dependency license metadata remains an inventory rather than legal clearance.

## Browser compatibility and verification

Tailwind v4 requires Safari 16.4+, Chrome 111+ and Firefox 128+. These minimums follow the [official upgrade guide](https://tailwindcss.com/docs/upgrade-guide). Earlier browsers are outside the supported UI baseline.

`npm run build` must precede `npm run test:e2e`. The new browser scenarios load the actual compiled CSS into the real join/home UI, independently of the Vite development stylesheet. They cover phone/desktop form dimensions, theme/fonts, keyboard focus and enabled actions, plus tablet/phone/desktop overflow, gradients and visible touch targets. Only the external font CSS response is stubbed; application CSS is loaded from the production artifact. Existing authoring, matching, hotspot, study, editing, accessibility and multiplayer scenarios still exercise the development pipeline. CI runs the complete suite in Chromium, Firefox and WebKit with retries disabled.

Local follow-up checks: type checking, production build, 57 unit/socket tests, five PGlite database/API integration tests, HTTP/DB/WS smoke, the seven existing Chromium scenarios and the two added compiled-style scenarios. Native PostgreSQL, encrypted recovery and all three browser engines are additionally enforced in GitHub Actions before merge. This change does not configure production infrastructure.

References: [Tailwind's Vite migration](https://tailwindcss.com/docs/upgrade-guide#using-vite), [selector parser advisory](https://github.com/postcss/postcss-selector-parser/security/advisories/GHSA-rj75-hqrm-r3gf), [braces advisory discussion](https://github.com/micromatch/braces/issues/84).
