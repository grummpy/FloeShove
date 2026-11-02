import assert from "node:assert/strict";
import test from "node:test";
import { makeRng } from "../src/core/rng.js";

test("same seed produces the same stream", () => {
  const left = makeRng(42);
  const right = makeRng(42);
  const a = Array.from({ length: 12 }, () => left());
  const b = Array.from({ length: 12 }, () => right());
  assert.deepEqual(a, b);
  for (const value of a) {
    assert.ok(value >= 0 && value < 1);
  }
});

test("different seeds diverge", () => {
  const left = makeRng(1);
  const right = makeRng(2);
  assert.notEqual(left(), right());
});

test("rng state advances and stays in range for ints", () => {
  const rng = makeRng(99);
  const seen = new Set();
  for (let i = 0; i < 40; i++) seen.add(rng.int(4));
  assert.ok(seen.size >= 2);
  for (const value of seen) assert.ok(value >= 0 && value < 4);
});
