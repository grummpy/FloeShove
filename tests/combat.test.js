import assert from "node:assert/strict";
import test from "node:test";
import { SHOVE_BASE, SHOVE_GAIN, SHOVE_MAX_CHARGE, shovePower } from "../src/core/constants.js";
import { createMatch, idleInputs, step } from "../src/core/sim.js";

function duel() {
  return createMatch({
    seed: 3,
    scripted: true,
    countdown: 0,
    roundBanner: 5,
    suddenDeathTime: 9999,
    floes: [{ id: 1, x: 400, y: 360, radius: 260, vx: 0, vy: 0 }],
    players: [
      { x: 340, y: 360, floeId: 1, facing: 0 },
      { x: 410, y: 360, floeId: 1 },
      { active: false },
      { active: false },
    ],
  });
}

function releaseAfter(frames, { brace = false, boost = false } = {}) {
  const state = duel();
  if (boost) state.players[0].boost = 4;
  const inputs = idleInputs();
  inputs[0].action = true;
  if (brace) inputs[1].secondary = true;
  for (let i = 0; i < frames; i++) step(state, inputs);
  inputs[0].action = false;
  step(state, inputs);
  return state;
}

test("shove power grows with charge, drops when the target braces, and rises with a boost", () => {
  assert.equal(shovePower(0, false, false), SHOVE_BASE);
  assert.equal(shovePower(SHOVE_MAX_CHARGE, false, false), SHOVE_BASE + SHOVE_GAIN);
  assert.ok(shovePower(1, true, false) < shovePower(0.25, false, false));
  assert.ok(shovePower(1, false, true) > shovePower(1, false, false));

  const tap = releaseAfter(12);
  const charged = releaseAfter(60);
  const braced = releaseAfter(60, { brace: true });
  const boosted = releaseAfter(60, { boost: true });
  const power = (state) => state.events.find((event) => event.type === "hit").power;
  assert.ok(tap.players[1].alive && charged.players[1].alive);
  assert.ok(charged.players[1].vx > tap.players[1].vx);
  assert.ok(braced.players[1].vx < charged.players[1].vx);
  assert.ok(power(boosted) > power(charged));
  assert.ok(boosted.players[1].vx > charged.players[1].vx);
  assert.ok(charged.players[0].vx > 0);
});

test("charge builds up to one second and brace cancels it", () => {
  const state = duel();
  const inputs = idleInputs();
  inputs[0].action = true;
  for (let i = 0; i < 30; i++) step(state, inputs);
  assert.ok(Math.abs(state.players[0].charge - 0.5) < 0.02);
  assert.equal(state.players[0].charging, true);
  for (let i = 0; i < 50; i++) step(state, inputs);
  assert.equal(state.players[0].charge, 1);

  inputs[0].action = true;
  inputs[0].secondary = true;
  step(state, inputs);
  assert.equal(state.players[0].charging, false);
  assert.equal(state.players[0].charge, 0);
  assert.equal(state.players[0].bracing, true);
});
