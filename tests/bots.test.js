import assert from "node:assert/strict";
import test from "node:test";
import { botIntent } from "../src/core/bots.js";
import { createMatch, step } from "../src/core/sim.js";

test("bot intents are shaped like player actions", () => {
  const state = createMatch({ seed: 1, countdown: 0 });
  for (let i = 0; i < 4; i++) {
    const input = botIntent(state, i);
    assert.equal(typeof input.moveX, "number");
    assert.equal(typeof input.moveY, "number");
    assert.equal(typeof input.action, "boolean");
    assert.equal(typeof input.secondary, "boolean");
    assert.ok(Math.hypot(input.moveX, input.moveY) <= 1 + 1e-6);
  }
  assert.deepEqual(botIntent(state, 9), {
    moveX: 0,
    moveY: 0,
    action: false,
    secondary: false,
  });
});

test("four bots play a round to a result without blowing up", () => {
  const state = createMatch({ seed: 7, countdown: 0, roundBanner: 1.5 });
  let steps = 0;
  while (state.phase === "playing" && steps < 120 * 60) {
    const inputs = [0, 1, 2, 3].map((id) => botIntent(state, id));
    step(state, inputs);
    steps += 1;
    if (steps % 30 === 0) {
      for (const player of state.players) {
        assert.ok(Number.isFinite(player.x) && Number.isFinite(player.y));
        assert.ok(Number.isFinite(player.vx) && Number.isFinite(player.vy));
      }
    }
  }
  assert.notEqual(state.phase, "playing");
  assert.ok(state.round >= 1);
  assert.equal(state.scores.length, 4);
});
