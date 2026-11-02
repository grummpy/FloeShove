import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { botIntent } from "../src/core/bots.js";
import { createMatch, digest, step } from "../src/core/sim.js";

function play(seed, frames) {
  const state = createMatch({ seed, countdown: 0, roundBanner: 2 });
  for (let i = 0; i < frames; i++) {
    const inputs = [0, 1, 2, 3].map((id) => botIntent(state, id));
    step(state, inputs);
  }
  return state;
}

test("a full bot match replays from the same seed", () => {
  const left = play(11, 240);
  const right = play(11, 240);
  assert.equal(digest(left), digest(right));
  assert.equal(left.tick, 240);
  const other = play(12, 240);
  assert.notEqual(digest(left), digest(other));
});

test("core modules stay free of DOM and Math.random", () => {
  const files = readdirSync(new URL("../src/core/", import.meta.url));
  assert.ok(files.length >= 4);
  for (const file of files) {
    const source = readFileSync(new URL(`../src/core/${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /\b(document|window|localStorage|canvas|HTMLElement)\b/);
    assert.doesNotMatch(source, /Math\.random/);
  }
});
