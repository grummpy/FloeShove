import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, idleInputs, step } from "../src/core/sim.js";

function scripted(extra) {
  return createMatch({
    seed: 4,
    scripted: true,
    countdown: 0,
    suddenDeathTime: 9999,
    ...extra,
  });
}

test("a floe cracks faster with more walruses and shatters into a draw", () => {
  const alone = scripted({
    roundBanner: 3,
    crackRate: 0.2,
    floes: [{ id: 1, x: 400, y: 360, radius: 200, vx: 0, vy: 0, crack: 0 }],
    players: [
      { x: 390, y: 360, floeId: 1 },
      { active: false },
      { active: false },
      { active: false },
    ],
  });
  const crowd = scripted({
    roundBanner: 3,
    crackRate: 0.2,
    floes: [{ id: 1, x: 400, y: 360, radius: 200, vx: 0, vy: 0, crack: 0 }],
    players: [
      { x: 380, y: 360, floeId: 1 },
      { x: 420, y: 360, floeId: 1 },
      { active: false },
      { active: false },
    ],
  });
  const inputs = idleInputs();
  for (let i = 0; i < 60; i++) {
    step(alone, inputs);
    step(crowd, inputs);
  }
  const ratio = crowd.floes[0].crack / alone.floes[0].crack;
  assert.ok(ratio > 1.9 && ratio < 2.1);

  const shatter = scripted({
    roundBanner: 3,
    floes: [{ id: 1, x: 400, y: 360, radius: 200, vx: 0, vy: 0, crack: 0.999 }],
    players: [
      { x: 380, y: 360, floeId: 1 },
      { x: 420, y: 360, floeId: 1 },
      { active: false },
      { active: false },
    ],
  });
  step(shatter, idleInputs());
  assert.equal(shatter.floes[0].alive, false);
  assert.equal(shatter.players[0].alive, false);
  assert.equal(shatter.players[1].alive, false);
  assert.equal(shatter.roundWinner, null);
  assert.deepEqual(shatter.scores, [0, 0, 0, 0]);
  assert.equal(shatter.phase, "round_end");
});

test("last walrus on the ice scores, and first to N takes the match", () => {
  const state = scripted({
    roundsToWin: 2,
    roundBanner: 0,
    floes: [
      { id: 1, x: 220, y: 200, radius: 80, vx: 0, vy: 0 },
      { id: 2, x: 980, y: 480, radius: 140, vx: 0, vy: 0 },
    ],
    players: [
      { x: 220 + 80 - 18 - 1, y: 200, floeId: 1, facing: 0 },
      { x: 980, y: 480, floeId: 2 },
      { active: false },
      { active: false },
    ],
  });
  const inputs = idleInputs();
  inputs[0].moveX = 1;
  let guard = 0;
  while (state.phase !== "match_end" && guard < 800) {
    step(state, inputs);
    guard += 1;
  }
  assert.equal(state.phase, "match_end");
  assert.equal(state.winner, 1);
  assert.equal(state.scores[1], 2);
  assert.equal(state.scores[0], 0);
  assert.ok(state.events.some((event) => event.type === "match"));
});

test("sudden death shrinks floes until they fail", () => {
  const state = scripted({
    roundBanner: 3,
    suddenDeathTime: 0,
    shrinkRate: 90,
    floes: [
      { id: 1, x: 300, y: 300, radius: 70, vx: 0, vy: 0 },
      { id: 2, x: 900, y: 420, radius: 260, vx: 0, vy: 0 },
    ],
    players: [
      { x: 300, y: 300, floeId: 1 },
      { x: 900, y: 420, floeId: 2 },
      { active: false },
      { active: false },
    ],
  });
  const inputs = idleInputs();
  for (let i = 0; i < 90; i++) step(state, inputs);
  assert.equal(state.suddenDeath, true);
  assert.equal(state.floes[0].alive, false);
  assert.equal(state.players[0].alive, false);
  assert.equal(state.players[1].alive, true);
  assert.equal(state.scores[1], 1);
});

test("fresh floes drift in during a free match", () => {
  const state = createMatch({ seed: 2, floeCount: 6, countdown: 0, suddenDeathTime: 999 });
  const start = state.floes.length;
  assert.ok(start >= 6 && start <= 10);
  const inputs = idleInputs();
  for (let i = 0; i < 60 * 9; i++) step(state, inputs);
  assert.ok(state.floes.length > start);
  assert.ok(state.floes.filter((floe) => floe.alive).length >= 6);
});
