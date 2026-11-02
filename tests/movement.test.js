import assert from "node:assert/strict";
import test from "node:test";
import { ACCEL, DT, FRICTION, MAX_SPEED } from "../src/core/constants.js";
import { createMatch, idleInputs, step } from "../src/core/sim.js";

function arena(players, floes, extra = {}) {
  return createMatch({
    seed: 1,
    scripted: true,
    countdown: 0,
    roundBanner: 4,
    suddenDeathTime: 9999,
    floes,
    players,
    ...extra,
  });
}

test("acceleration, friction, and speed cap are deterministic", () => {
  const state = arena(
    [
      { x: 400, y: 360, floeId: 1 },
      { active: false },
      { active: false },
      { active: false },
    ],
    [{ id: 1, x: 400, y: 360, radius: 240, vx: 0, vy: 0 }],
  );
  const inputs = idleInputs();
  inputs[0].moveX = 1;
  step(state, inputs);
  const expectedVx = ACCEL * DT * Math.exp(-FRICTION * DT);
  assert.ok(Math.abs(state.players[0].vx - expectedVx) < 1e-6);
  assert.ok(Math.abs(state.players[0].x - (400 + expectedVx * DT)) < 1e-6);

  state.players[0].vx = 200;
  state.players[0].vy = 0;
  const coast = idleInputs();
  step(state, coast);
  assert.ok(Math.abs(state.players[0].vx - 200 * Math.exp(-FRICTION * DT)) < 1e-6);

  const sprint = arena(
    [
      { x: 640, y: 360, floeId: 1 },
      { active: false },
      { active: false },
      { active: false },
    ],
    [{ id: 1, x: 640, y: 360, radius: 300, vx: 0, vy: 0 }],
  );
  const hold = idleInputs();
  hold[0].moveX = 1;
  for (let i = 0; i < 50; i++) step(sprint, hold);
  const speed = Math.hypot(sprint.players[0].vx, sprint.players[0].vy);
  assert.equal(sprint.players[0].alive, true);
  assert.ok(speed <= MAX_SPEED + 1e-6);
  assert.ok(speed > MAX_SPEED * 0.85);
});

test("brace resists movement", () => {
  const state = arena(
    [
      { x: 400, y: 360, floeId: 1, vx: 180, vy: 40 },
      { active: false },
      { active: false },
      { active: false },
    ],
    [{ id: 1, x: 400, y: 360, radius: 240, vx: 0, vy: 0 }],
  );
  const inputs = idleInputs();
  inputs[0].moveX = 1;
  inputs[0].secondary = true;
  for (let i = 0; i < 40; i++) step(state, inputs);
  assert.ok(Math.hypot(state.players[0].vx, state.players[0].vy) < 1);
  assert.ok(Math.abs(state.players[0].x - 400) < 30);
  assert.equal(state.players[0].bracing, true);
  assert.equal(state.players[0].charging, false);
});

test("walruses separate when they overlap, and a brace gives less ground", () => {
  const state = arena(
    [
      { x: 400, y: 360, floeId: 1 },
      { x: 408, y: 360, floeId: 1 },
      { active: false },
      { active: false },
    ],
    [{ id: 1, x: 400, y: 360, radius: 240, vx: 0, vy: 0 }],
  );
  const inputs = idleInputs();
  inputs[0].secondary = true;
  const before = state.players[0].x;
  step(state, inputs);
  const dist = Math.hypot(state.players[1].x - state.players[0].x, state.players[1].y - state.players[0].y);
  assert.ok(dist >= 35);
  assert.ok(Math.abs(state.players[1].x - 408) > Math.abs(state.players[0].x - before));
});

test("riders move with a drifting floe", () => {
  const state = arena(
    [
      { x: 400, y: 360, floeId: 1 },
      { active: false },
      { active: false },
      { active: false },
    ],
    [{ id: 1, x: 400, y: 360, radius: 180, vx: 90, vy: 0 }],
  );
  const inputs = idleInputs();
  for (let i = 0; i < 60; i++) step(state, inputs);
  assert.ok(Math.abs(state.players[0].x - 490) < 0.05);
  assert.ok(Math.abs(state.floes[0].x - 490) < 0.05);
  assert.equal(state.players[0].alive, true);
});

test("a walrus hops to a floe within reach and falls when nothing is there", () => {
  const hop = arena(
    [
      { x: 300 + 100 - 18 - 2, y: 300, floeId: 1, facing: 0 },
      { active: false },
      { active: false },
      { active: false },
    ],
    [
      { id: 1, x: 300, y: 300, radius: 100, vx: 0, vy: 0 },
      { id: 2, x: 540, y: 300, radius: 100, vx: 0, vy: 0 },
    ],
    { hopReach: 140 },
  );
  const toward = idleInputs();
  toward[0].moveX = 1;
  for (let i = 0; i < 200 && hop.players[0].floeId !== 2; i++) step(hop, toward);
  assert.equal(hop.players[0].floeId, 2);
  assert.equal(hop.players[0].alive, true);

  const fall = arena(
    [
      { x: 200 + 90 - 18 - 1, y: 200, floeId: 1, facing: 0 },
      { x: 1000, y: 520, floeId: 2 },
      { active: false },
      { active: false },
    ],
    [
      { id: 1, x: 200, y: 200, radius: 90, vx: 0, vy: 0 },
      { id: 2, x: 1000, y: 520, radius: 130, vx: 0, vy: 0 },
    ],
  );
  const off = idleInputs();
  off[0].moveX = 1;
  for (let i = 0; i < 200 && fall.players[0].alive; i++) step(fall, off);
  assert.equal(fall.players[0].alive, false);
  assert.equal(fall.players[1].alive, true);
  assert.equal(fall.scores[1], 1);
  assert.equal(fall.roundWinner, 1);
  assert.equal(fall.phase, "round_end");
});
