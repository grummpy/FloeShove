import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_BINDINGS,
  cloneBindings,
  gamepadPlayer,
  keyLabel,
  resolveInputs,
} from "../src/core/input.js";

function pad(axes = [0, 0], pressed = {}) {
  const buttons = Array.from({ length: 16 }, (_, index) => ({
    pressed: !!pressed[index],
    value: pressed[index] ? 1 : 0,
  }));
  return { connected: true, axes, buttons };
}

test("default bindings match the four-player keyboard split", () => {
  assert.deepEqual(DEFAULT_BINDINGS[0], {
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    action: "KeyF",
    secondary: "KeyG",
  });
  assert.equal(DEFAULT_BINDINGS[1].action, "Slash");
  assert.equal(DEFAULT_BINDINGS[1].secondary, "Period");
  assert.equal(DEFAULT_BINDINGS[1].up, "ArrowUp");
  assert.equal(DEFAULT_BINDINGS[2].action, "Semicolon");
  assert.equal(DEFAULT_BINDINGS[2].secondary, "Quote");
  assert.equal(DEFAULT_BINDINGS[2].left, "KeyJ");
  assert.equal(DEFAULT_BINDINGS[3].up, "Numpad8");
  assert.equal(DEFAULT_BINDINGS[3].left, "Numpad4");
  assert.equal(DEFAULT_BINDINGS[3].down, "Numpad5");
  assert.equal(DEFAULT_BINDINGS[3].right, "Numpad6");
  assert.equal(DEFAULT_BINDINGS[3].action, "Numpad0");
  assert.equal(DEFAULT_BINDINGS[3].secondary, "NumpadEnter");
});

test("all four keyboards map at once, diagonals are normalized, labels are friendly", () => {
  const down = new Set([
    "KeyW",
    "KeyD",
    "ArrowLeft",
    "Slash",
    "KeyK",
    "Quote",
    "Numpad4",
    "Numpad0",
  ]);
  const { players } = resolveInputs(down, []);
  assert.ok(Math.abs(players[0].moveX - Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(players[0].moveY + Math.SQRT1_2) < 1e-6);
  assert.equal(players[0].action, false);
  assert.equal(players[1].moveX, -1);
  assert.equal(players[1].action, true);
  assert.equal(players[1].secondary, false);
  assert.equal(players[2].moveY, 1);
  assert.equal(players[2].secondary, true);
  assert.equal(players[3].moveX, -1);
  assert.equal(players[3].action, true);
  assert.equal(players[3].secondary, false);
  assert.equal(keyLabel("Slash"), "/");
  assert.equal(keyLabel("NumpadEnter"), "Num Enter");
  assert.equal(keyLabel("KeyF"), "F");
});

test("opposite keys cancel", () => {
  const { players } = resolveInputs(new Set(["KeyA", "KeyD", "KeyW", "KeyS"]), []);
  assert.equal(players[0].moveX, 0);
  assert.equal(players[0].moveY, 0);
});

test("gamepad stick, deadzone, d-pad, face buttons, and start", () => {
  const idle = gamepadPlayer(pad([0.1, -0.05]));
  assert.equal(idle.moveX, 0);
  assert.equal(idle.moveY, 0);
  assert.equal(idle.action, false);

  const stick = gamepadPlayer(pad([0.9, 0]));
  assert.equal(stick.moveX, 0.9);
  assert.equal(stick.moveY, 0);

  const dpad = gamepadPlayer(pad([0, 0], { 12: true, 0: true, 1: true, 9: true }));
  assert.equal(dpad.moveY, -1);
  assert.equal(dpad.action, true);
  assert.equal(dpad.secondary, true);
  assert.equal(dpad.pause, true);
});

test("a connected pad overrides that player only", () => {
  const pads = [pad([1, 0]), null, { connected: false, axes: [1, 0], buttons: [] }, null];
  const down = new Set(["KeyA", "KeyI"]);
  const { players, pause } = resolveInputs(down, pads);
  assert.equal(players[0].moveX, 1);
  assert.equal(players[2].moveY, -1);
  assert.equal(pause, false);
});

test("escape and start pause; cloning bindings does not edit the defaults", () => {
  assert.equal(resolveInputs(new Set(["Escape"]), []).pause, true);
  const start = resolveInputs(new Set(), [pad([0, 0], { 9: true })]);
  assert.equal(start.pause, true);
  assert.equal(start.players[0].pause, true);

  const copy = cloneBindings();
  copy[0].up = "KeyZ";
  assert.equal(DEFAULT_BINDINGS[0].up, "KeyW");
  const moved = resolveInputs(new Set(["KeyZ"]), [], copy);
  assert.equal(moved.players[0].moveY, -1);
});
