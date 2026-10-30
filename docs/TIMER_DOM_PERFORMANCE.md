# Milestone 4 — Avoid redundant guest timer DOM writes

Date: 2026-10-30. Baseline `main` `dd7de61007f3985a0a2681bab01d4c7fa88d6790` (including merged #81 recovery, #108 phone focus and #111 TV fullscreen).

## Finding and change

The existing guest room controller polls its time offset every **200 ms**. Before this patch it unconditionally assigned `#timer.textContent` and `#timer.dataset.urgent` even during an indefinite lobby where both are unchanged. These operations can produce DOM mutations and cause dependent listeners or styling work without changing anything visible. On each open host/phone page the loop runs **five times per second**.

This small patch **keeps the 200 ms poll interval unchanged** so the urgent-state transition and Homeward custom clocks retain their previous cadence. It samples the adjusted clock once per poll, calculates the same visible seconds-remaining text and the same urgent predicate, and updates each DOM field **only when its value differs**. It does not change deadlines, server synchronization, authoritative validation, tick cadence, game modes, animations, accessibility labels, or game scoring.

## Verification

A new browser regression in `browser-specs/party.spec.js` hosts a real room with three mobile guest contexts. It waits until the idle timer is initialized and observes all DOM changes on `#timer` for 800 ms. There must be **zero** redundant mutations while the room is idle. It then starts a real quiz match and verifies the same countdown still appears and advances.

This contract would fail on the original code: each 200 ms tick directly overwrites both fields. During an idle room, baseline code attempts approximately **5 text writes + 5 attribute writes per second**; the new code attempts **0** after initialization. During a timed round, text typically changes at most once each second. These are **code-derived write counts**, not CPU, FPS, energy or network benchmarks; the browser test measures actual DOM mutation records.

## Limits and release checklist

This is a minor local/browser efficiency improvement, not a measured improvement in whole-site bundle size or Grand Prix frame rate. Previous Grand Prix CPU projection optimization and conditional 3D loading already exist, so neither is duplicated. Repeatable p50/p95 network latency, 10–20 real phones, CPU/GPU use and actual production loading speed remain separate tasks.

Required checks on this exact PR commit: CI/typecheck/production build, guest engine unit and Chromium/Firefox/WebKit browser runs, integrated PostgreSQL acceptance, encrypted backup, synthetic WebSocket and Render configuration. Keep the PR unmerged if any required check fails, and do not deploy Render without explicit approval. No new dependencies or externally copied source, assets or license changes.
