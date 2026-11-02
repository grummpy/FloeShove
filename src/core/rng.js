/**
 * Mulberry32. Same seed always yields the same stream.
 * The returned function also exposes `.state` so a match can be inspected.
 */
export function makeRng(seed) {
  const state = { seed: seed >>> 0 };
  const next = () => {
    state.seed = (state.seed + 0x6d2b79f5) | 0;
    let t = Math.imul(state.seed ^ (state.seed >>> 15), 1 | state.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.state = state;
  next.int = (n) => Math.floor(next() * n);
  next.range = (a, b) => a + next() * (b - a);
  return next;
}
