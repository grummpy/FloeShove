import assert from "node:assert/strict";
import test from "node:test";
import { createMatch, idleInputs, step } from "../src/core/sim.js";

test("a fish pickup charges the next belly-shove", () => {
  const state = createMatch({
    seed: 1,
    scripted: true,
    countdown: 0,
    roundBanner: 4,
    suddenDeathTime: 9999,
    boostTime: 5,
    floes: [{ id: 1, x: 400, y: 360, radius: 250, vx: 0, vy: 0 }],
    players: [
      { x: 400, y: 360, floeId: 1, facing: 0 },
      { x: 470, y: 360, floeId: 1 },
      { active: false },
      { active: false },
    ],
    pickups: [{ id: 1, x: 400, y: 360, floeId: 1, radius: 12 }],
  });
  const plain = createMatch({
    seed: 1,
    scripted: true,
    countdown: 0,
    roundBanner: 4,
    suddenDeathTime: 9999,
    floes: [{ id: 1, x: 400, y: 360, radius: 250, vx: 0, vy: 0 }],
    players: [
      { x: 400, y: 360, floeId: 1, facing: 0 },
      { x: 470, y: 360, floeId: 1 },
      { active: false },
      { active: false },
    ],
  });

  step(state, idleInputs());
  assert.equal(state.pickups[0].alive, false);
  assert.ok(state.players[0].boost > 4);
  assert.ok(state.events.some((event) => event.type === "pickup"));

  const boostedInputs = idleInputs();
  const plainInputs = idleInputs();
  boostedInputs[0].action = true;
  plainInputs[0].action = true;
  for (let i = 0; i < 40; i++) {
    step(state, boostedInputs);
    step(plain, plainInputs);
  }
  boostedInputs[0].action = false;
  plainInputs[0].action = false;
  step(state, boostedInputs);
  step(plain, plainInputs);
  const boostedHit = state.events.find((event) => event.type === "hit");
  const plainHit = plain.events.find((event) => event.type === "hit");
  assert.ok(boostedHit.power > plainHit.power);
  assert.ok(state.players[1].vx > plain.players[1].vx);
  assert.equal(state.players[1].alive, true);
});
