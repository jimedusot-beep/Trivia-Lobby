# TV console cover shelf — game library redesign

**Scope:** Guest home game library and in-room host game selector. Original, Nintendo Switch-inspired *navigation pattern* with film-poster-style artwork; no Nintendo assets, branding, icons, game art, audio, or proprietary layout source copied.

## Approved preview match — poster-first homepage (October 31)

This PR now matches the user's approved local UI preview more closely, while remaining an actual party-game launcher rather than a stand-alone mockup:

- `/party/` displays the **dark game-library shell as the first screen**. The old welcome hero is hidden on the ordinary library route, and the existing host/join forms remain intact below the shelf. A top-level **Join party** shortcut links directly to the form.
- The original `Pick a Game` heading is now the visible `h1` while browsing, preserving the one-heading-per-public-page accessibility test. Direct QR invite and active-room phases retain their own single `h1` and layouts.
- The featured hero defaults to **Party Grand Prix** (21 of 31), uses a mint **Host this game** action, and explains that the room code/QR appear after hosting. No game session is created until a real button click.
- The selected Grand Prix cover is centered horizontally on first paint; arrow controls move the shelf **without jumping the whole document vertically**. Touch scroll and existing keyboard focus navigation remain.
- The scope excludes the separate Open Party Lab page (`body.opl-page`), quiz editor, study pages, invited-phone route, active race/quiz screens and in-room private controls.
- TV/mobile snapshots to inspect: `switch-tv-1920-home.png` and `switch-mobile-390-home.png`, plus the pre-existing responsive catalog captures. The workflow retains them as artifacts; actual screenshots must be inspected rather than inferred from this document.

**Approval still required after passing exact-head browser tests and screenshot inspection.** Nothing in this PR modifies existing game logic, QR admission, account-free player controllers or server state. No merge/deploy is implied.

## What changed

- Convert the long auto-fitting tile grid into a single horizontal row of cover-art posters with touch/mouse horizontal scroll, scroll snapping, visible previous/next controls and a selection counter.
- Each of the 31 existing game modes gets an **original CSS-generated tall poster** with its own title, category tag, emoji emblem, category pattern and theme color. All content remains authored locally; no off-site image requests, licensed screenshot/box art, extra asset bytes or dependencies.
- Selecting a cover changes the large featured/game-detail banner, preserving the server-authored rules, eligible player counts and game-specific Host/Choose callback.
- Keyboard Arrow Left/Right works when the cover rail or featured detail has focus. Focus follows the selected cover. Enter/Space on a poster previews it, and the Host/Choose button still launches or selects the exact game ID.
- Search and category filters remain; counters and disabled end arrows reflect only visible filtered games. No matches still shows the existing reset action.
- On phones the rail scrolls horizontally within its own width; it does not add page-wide horizontal scrolling or change any active phone game controller.

## Owned code and compatibility

1. `examples/party-engine/public/game-catalog.js`: presentational picker only. All game descriptors, IDs, rules, launch callbacks, `asHost` and category groups retained.
2. `examples/party-engine/public/game-catalog.css`: additive scoped layout and original artwork; no global `app.js`, `style.css`, racing or phone controller modifications.
3. `examples/party-engine/browser-specs/tv-catalog.spec.js`: existing 31-game/host/filters/keyboard/preview tests remain; add console-navigation and mobile-overflow coverage.

## Acceptance before merge

- [ ] Run `npm run check`, `npm test`, `npm run build`, standalone guest `npm test` and Chromium/Firefox/WebKit browser suites on this PR head.
- [ ] Confirm all **31** covers, tags and selected game title render with original colors at 1920x1080 and 1280x800, with functional previous/next arrows.
- [ ] Confirm arrow navigation does not steal input focus from the search field; Enter on the selected cover opens preview; Host/Choose sends the existing ID.
- [ ] Test 320x700 and 390x844 narrow screens: horizontal cover rail stays contained; search and filters remain usable; no `documentElement.scrollWidth > innerWidth`.
- [ ] Verify reduced-motion behavior, native keyboard focus rings and scroll position; actual remote-controller mapping is not claimed.
- [ ] Check that `asHost` in-room selection, QR entry, reconnect, all 31 games and private role boundaries are unchanged.
- [ ] Capture and inspect real 1920x1080, 1280x800 and mobile screenshots; validate poster copy legibility in long-name cards.
- [ ] Run real TV + phone tests separately. Browser tests are not physical-TV acceptance.

## Rollback

Revert this CSS/JS/test PR; all source games and server rules are independent. No migration, deployment, package installation, credentials, hosting or license changes.

**Status:** Reviewable feature branch, not deployed. No screenshots or passing tests claimed until CI/browser evidence is collected.
