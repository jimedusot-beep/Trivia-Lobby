// SPDX-License-Identifier: AGPL-3.0-or-later
import { packIds, packMin } from "../public/pack-config.js";
import {
  openFeud,
  acceptFeud,
  tickFeud,
  nextFeud,
  projectFeud,
} from "./feud.js";
import {
  openDrawing,
  acceptDrawing,
  tickDrawing,
  nextDrawing,
  projectDrawing,
} from "./drawing.js";
import {
  openColors,
  acceptColors,
  tickColors,
  projectColors,
} from "./colors.js";
import { boardKinds } from "./board-rules.js";
import {
  openBoards,
  acceptBoard,
  tickBoards,
  projectBoards,
} from "./boards.js";
import {
  openTabletop,
  acceptTabletop,
  projectTabletop,
  openBackgammon,
  acceptBackgammon,
  projectBackgammon,
} from "./tabletop.js";
import { fail, integer, requireFields, hostOnly } from "./shared.js";
import { openRace, finishRace, nextRace, projectRace } from "./race.js";
import { openTap, finishTap, nextTap, projectTap } from "./tap.js";
export { packIds, packMin };
export function validatePackSettings(mode, settings = {}) {
  requireFields(
    settings,
    [],
    mode === "colors"
      ? ["bots", "stacking", "turnSeconds"]
      : mode === "table"
        ? ["preset"]
        : [],
  );
  if (mode === "colors") {
    if (settings.bots !== undefined && !integer(settings.bots, 0, 8))
      fail("Use 0–8 bots.");
    if (
      settings.stacking !== undefined &&
      typeof settings.stacking !== "boolean"
    )
      fail("Stacking must be on or off.");
    if (
      settings.turnSeconds !== undefined &&
      ![15, 30, 60, 90].includes(settings.turnSeconds)
    )
      fail("Choose a supported turn timer.");
  }
  if (
    mode === "table" &&
    settings.preset !== undefined &&
    !["poker", "whist"].includes(settings.preset)
  )
    fail("Choose a card-table preset.");
  return { ...settings };
}
export function openPack(p) {
  if (p.mode === "tap") openTap(p);
  else if (p.mode === "race") openRace(p);
  else if (p.mode === "feud") openFeud(p);
  else if (p.mode === "draw") openDrawing(p);
  else if (p.mode === "colors") openColors(p);
  else if (boardKinds.includes(p.mode)) openBoards(p);
  else if (p.mode === "table") openTabletop(p);
  else openBackgammon(p);
}
export function acceptPack(p, actor, v) {
  if (p.phase !== "playing" || !packIds.includes(p.mode))
    fail("This game is not accepting moves.");
  if (v.action === "end-match") {
    requireFields(v, ["action"]);
    hostOnly(actor);
    p.endedByHost = true;
    p.enter("finished");
    return;
  }
  if (p.mode === "tap") fail("Use the Tap Dash phone controller.");
  else if (p.mode === "race") fail("Use the racing controller to drive.");
  else if (p.mode === "feud") acceptFeud(p, actor, v);
  else if (p.mode === "draw") acceptDrawing(p, actor, v);
  else if (p.mode === "colors") acceptColors(p, actor, v);
  else if (boardKinds.includes(p.mode)) acceptBoard(p, actor, v);
  else if (p.mode === "table") acceptTabletop(p, actor, v);
  else acceptBackgammon(p, actor, v);
}
export function tickPack(p) {
  if (p.mode === "tap") finishTap(p);
  else if (p.mode === "race") finishRace(p);
  else if (p.mode === "feud") tickFeud(p);
  else if (p.mode === "draw") tickDrawing(p);
  else if (p.mode === "colors") tickColors(p);
  else if (boardKinds.includes(p.mode)) tickBoards(p);
  else p.enter("reveal");
}
export function nextPack(p) {
  if (p.mode === "tap") nextTap(p);
  else if (p.mode === "race") nextRace(p);
  else if (p.mode === "feud") nextFeud(p);
  else if (p.mode === "draw") nextDrawing(p);
  else p.enter("finished");
}
export function projectPack(p, actor) {
  if (
    !packIds.includes(p.mode) ||
    !p.pack ||
    ["lobby", "countdown"].includes(p.phase)
  )
    return null;
  if (p.mode === "tap") return projectTap(p, actor);
  if (p.mode === "race") return projectRace(p, actor);
  if (p.mode === "feud") return projectFeud(p, actor);
  if (p.mode === "draw") return projectDrawing(p, actor);
  if (p.mode === "colors") return projectColors(p, actor);
  if (boardKinds.includes(p.mode)) return projectBoards(p, actor);
  return p.mode === "table"
    ? projectTabletop(p, actor)
    : projectBackgammon(p, actor);
}
