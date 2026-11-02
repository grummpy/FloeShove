/** Tunables shared by the simulation, bots, and tests. */
export const WORLD_W = 1280;
export const WORLD_H = 720;
export const DT = 1 / 60;
export const PLAYER_COUNT = 4;

export const WALRUS_RADIUS = 18;
export const ACCEL = 720;
export const FRICTION = 0.5;
export const MAX_SPEED = 300;
export const BRACE_DAMP = 14;
export const CHARGE_MOVE_SCALE = 0.35;

export const SHOVE_MAX_CHARGE = 1;
export const SHOVE_COOLDOWN = 0.38;
export const SHOVE_BASE = 170;
export const SHOVE_GAIN = 480;
export const SHOVE_SELF = 80;
export const SHOVE_SELF_GAIN = 150;
export const SHOVE_REACH = 36;
export const SHOVE_REACH_GAIN = 74;
export const BRACE_KNOCK_SCALE = 0.22;
export const BOOST_KNOCK_SCALE = 1.65;
export const BOOST_TIME = 5.5;

export const HOP_REACH = 128;
export const HOP_COOLDOWN = 0.3;

export const CRACK_RATE = 0.042;
export const SUDDEN_DEATH_TIME = 60;
export const SHRINK_RATE = 28;
export const MIN_FLOE_RADIUS = 30;

export const FLOE_MIN = 6;
export const FLOE_MAX = 10;
export const SPAWN_EVERY = 8;
export const PICKUP_EVERY = 9;
export const MAX_PICKUPS = 2;

export const COUNTDOWN_TIME = 3;
export const ROUND_BANNER_TIME = 2.6;
export const ROUNDS_TO_WIN = 3;

export const PLAYER_COLORS = ["#e85d04", "#2a9d8f", "#9b5de5", "#f4d35e"];
export const PLAYER_LABELS = ["P1", "P2", "P3", "P4"];

/** Impulse speed added to a struck walrus. Charge is 0..1. */
export function shovePower(charge, bracing, boosted) {
  const t = Math.max(0, Math.min(SHOVE_MAX_CHARGE, charge));
  const base = SHOVE_BASE + t * SHOVE_GAIN;
  return base * (bracing ? BRACE_KNOCK_SCALE : 1) * (boosted ? BOOST_KNOCK_SCALE : 1);
}
