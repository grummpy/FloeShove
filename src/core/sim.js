import {
  ACCEL,
  BOOST_TIME,
  BRACE_DAMP,
  CHARGE_MOVE_SCALE,
  COUNTDOWN_TIME,
  CRACK_RATE,
  DT,
  FLOE_MAX,
  FLOE_MIN,
  FRICTION,
  HOP_COOLDOWN,
  HOP_REACH,
  MAX_PICKUPS,
  MAX_SPEED,
  MIN_FLOE_RADIUS,
  PICKUP_EVERY,
  PLAYER_COLORS,
  PLAYER_COUNT,
  PLAYER_LABELS,
  ROUND_BANNER_TIME,
  ROUNDS_TO_WIN,
  SHOVE_COOLDOWN,
  SHOVE_MAX_CHARGE,
  SHOVE_REACH,
  SHOVE_REACH_GAIN,
  SHOVE_SELF,
  SHOVE_SELF_GAIN,
  SHRINK_RATE,
  SPAWN_EVERY,
  SUDDEN_DEATH_TIME,
  WALRUS_RADIUS,
  WORLD_H,
  WORLD_W,
  shovePower,
} from "./constants.js";
import { makeRng } from "./rng.js";

export { shovePower };

const EMPTY = { moveX: 0, moveY: 0, action: false, secondary: false };

function readInput(raw) {
  if (!raw) return EMPTY;
  return {
    moveX: Number(raw.moveX) || 0,
    moveY: Number(raw.moveY) || 0,
    action: !!raw.action,
    secondary: !!raw.secondary,
  };
}

export function idleInputs() {
  return [0, 1, 2, 3].map(() => ({ moveX: 0, moveY: 0, action: false, secondary: false }));
}

function normalizeFloe(partial, id) {
  const radius = partial.radius ?? 90;
  return {
    id: partial.id ?? id,
    x: partial.x ?? 0,
    y: partial.y ?? 0,
    vx: partial.vx ?? 0,
    vy: partial.vy ?? 0,
    radius,
    baseRadius: partial.baseRadius ?? radius,
    crack: partial.crack ?? 0,
    alive: partial.alive !== false,
    age: partial.age ?? 0,
  };
}

function cloneFloe(floe) {
  return {
    id: floe.id,
    x: floe.x,
    y: floe.y,
    vx: floe.vx,
    vy: floe.vy,
    radius: floe.baseRadius ?? floe.radius,
    baseRadius: floe.baseRadius ?? floe.radius,
    crack: 0,
    alive: true,
    age: 0,
  };
}

function makePlayer(id, spec = {}) {
  const active = spec.active !== false;
  return {
    id,
    active,
    x: spec.x ?? 0,
    y: spec.y ?? 0,
    vx: spec.vx ?? 0,
    vy: spec.vy ?? 0,
    radius: spec.radius ?? WALRUS_RADIUS,
    floeId: spec.floeId ?? null,
    alive: active && spec.alive !== false,
    facing: spec.facing ?? -Math.PI / 2,
    charge: 0,
    charging: false,
    bracing: false,
    cooldown: 0,
    hopCooldown: 0,
    boost: spec.boost ?? 0,
    color: PLAYER_COLORS[id],
    label: PLAYER_LABELS[id],
    _mx: 0,
    _my: 0,
  };
}

function configFrom(opts) {
  return {
    worldW: opts.worldW ?? WORLD_W,
    worldH: opts.worldH ?? WORLD_H,
    roundsToWin: opts.roundsToWin ?? ROUNDS_TO_WIN,
    countdown: opts.countdown ?? COUNTDOWN_TIME,
    roundBanner: opts.roundBanner ?? ROUND_BANNER_TIME,
    suddenDeathTime: opts.suddenDeathTime ?? SUDDEN_DEATH_TIME,
    crackRate: opts.crackRate ?? CRACK_RATE,
    shrinkRate: opts.shrinkRate ?? SHRINK_RATE,
    hopReach: opts.hopReach ?? HOP_REACH,
    scripted: !!opts.scripted,
    floeCount: opts.floeCount ?? 8,
    boostTime: opts.boostTime ?? BOOST_TIME,
  };
}

function overlaps(floes, x, y, radius, pad) {
  for (let i = 0; i < floes.length; i++) {
    const other = floes[i];
    if (!other.alive) continue;
    const need = other.radius + radius + pad;
    if (Math.hypot(other.x - x, other.y - y) < need) return true;
  }
  return false;
}

function spawnProceduralFloes(state, count) {
  const { worldW, worldH } = state.config;
  const target = Math.max(FLOE_MIN, Math.min(FLOE_MAX, count));
  const floes = [];
  let guard = 0;
  while (floes.length < target && guard < 500) {
    guard += 1;
    const radius = state.rng.range(72, 118);
    const x = state.rng.range(radius + 10, worldW - radius - 10);
    const y = state.rng.range(radius + 10, worldH - radius - 10);
    if (overlaps(floes, x, y, radius, 28)) continue;
    const angle = state.rng() * Math.PI * 2;
    const speed = state.rng.range(8, 22);
    floes.push(
      normalizeFloe(
        {
          id: state.nextFloeId++,
          x,
          y,
          radius,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          crack: state.rng() * 0.22,
        },
        state.nextFloeId,
      ),
    );
  }
  return floes;
}

function spawnIncoming(state) {
  const { worldW, worldH } = state.config;
  const radius = state.rng.range(48, 72);
  const edge = state.rng.int(4);
  const speed = state.rng.range(16, 30);
  let x = 0;
  let y = 0;
  let vx = 0;
  let vy = 0;
  if (edge === 0) {
    x = radius + 8;
    y = state.rng.range(radius, worldH - radius);
    vx = speed;
    vy = state.rng.range(-12, 12);
  } else if (edge === 1) {
    x = worldW - radius - 8;
    y = state.rng.range(radius, worldH - radius);
    vx = -speed;
    vy = state.rng.range(-12, 12);
  } else if (edge === 2) {
    x = state.rng.range(radius, worldW - radius);
    y = radius + 8;
    vy = speed;
    vx = state.rng.range(-12, 12);
  } else {
    x = state.rng.range(radius, worldW - radius);
    y = worldH - radius - 8;
    vy = -speed;
    vx = state.rng.range(-12, 12);
  }
  state.floes.push(
    normalizeFloe(
      {
        id: state.nextFloeId++,
        x,
        y,
        vx,
        vy,
        radius,
        crack: state.rng() * 0.08,
      },
      state.nextFloeId,
    ),
  );
  state.events.push({ type: "floe", floeId: state.nextFloeId - 1 });
}

function placeActivePlayers(state, players) {
  const floes = state.floes.filter((floe) => floe.alive);
  const open = players.filter((player) => player.active);
  open.forEach((player, index) => {
    if (!floes.length) {
      player.alive = false;
      player.floeId = null;
      return;
    }
    const floe = floes[index % floes.length];
    const angle = (index / Math.max(1, open.length)) * Math.PI * 2 + index;
    const spread = Math.min(floe.radius * 0.35, 28);
    player.x = floe.x + Math.cos(angle) * spread;
    player.y = floe.y + Math.sin(angle) * spread;
    player.floeId = floe.id;
    player.alive = true;
    player.vx = 0;
    player.vy = 0;
  });
}

function rememberTemplate(state) {
  state.template = {
    floes: state.floes.map((floe) => cloneFloe(floe)),
    spawns: state.players.map((player) => ({
      id: player.id,
      active: player.active,
      x: player.x,
      y: player.y,
      floeId: player.floeId,
      facing: player.facing,
      custom: player._custom,
    })),
  };
}

function restorePlayers(state) {
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    const spawn = state.template.spawns[i];
    player.vx = 0;
    player.vy = 0;
    player.charge = 0;
    player.charging = false;
    player.bracing = false;
    player.cooldown = 0;
    player.hopCooldown = 0;
    player.boost = 0;
    player.facing = spawn.facing;
    player.active = spawn.active;
    if (!player.active) {
      player.alive = false;
      player.floeId = null;
      continue;
    }
    if (spawn.custom) {
      player.x = spawn.x;
      player.y = spawn.y;
      player.floeId = spawn.floeId;
      player.alive = true;
    }
  }
  if (!state.config.scripted || state.template.spawns.some((spawn) => spawn.active && !spawn.custom)) {
    const auto = state.players.filter((player) => {
      const spawn = state.template.spawns[player.id];
      return player.active && !spawn.custom;
    });
    placeActivePlayers(state, auto);
  }
}

export function createMatch(opts = {}) {
  const config = configFrom(opts);
  const rng = makeRng(opts.seed ?? 1);
  const state = {
    config,
    rng,
    seed: opts.seed ?? 1,
    time: 0,
    tick: 0,
    roundTime: 0,
    round: 1,
    scores: [0, 0, 0, 0],
    phase: "playing",
    countdown: 0,
    banner: 0,
    suddenDeath: false,
    pendingMatch: false,
    winner: null,
    roundWinner: null,
    events: [],
    floes: [],
    pickups: [],
    players: [],
    nextFloeId: 1,
    nextPickupId: 1,
    spawnTimer: SPAWN_EVERY,
    pickupTimer: 5,
    wanderTimer: 2.5,
    template: null,
  };

  if (opts.floes) {
    state.floes = opts.floes.map((floe, index) => normalizeFloe(floe, index + 1));
    let maxId = 0;
    for (let i = 0; i < state.floes.length; i++) maxId = Math.max(maxId, state.floes[i].id);
    state.nextFloeId = maxId + 1;
  } else {
    state.floes = spawnProceduralFloes(state, config.floeCount);
  }

  const specs = opts.players || [];
  for (let id = 0; id < PLAYER_COUNT; id++) {
    const player = makePlayer(id, specs[id] || {});
    player._custom = !!(
      specs[id] &&
      (specs[id].x != null ||
        specs[id].floeId != null ||
        specs[id].active === false ||
        specs[id].alive === false)
    );
    state.players.push(player);
  }

  const needsPlace = state.players.some((player) => player.active && !player._custom);
  if (needsPlace) placeActivePlayers(state, state.players.filter((player) => player.active && !player._custom));

  if (opts.pickups) {
    state.pickups = opts.pickups.map((pickup, index) => ({
      id: pickup.id ?? index + 1,
      x: pickup.x,
      y: pickup.y,
      floeId: pickup.floeId ?? null,
      radius: pickup.radius ?? 12,
      alive: pickup.alive !== false,
    }));
    state.nextPickupId = state.pickups.reduce((max, pickup) => Math.max(max, pickup.id), 0) + 1;
  }

  rememberTemplate(state);
  state.phase = config.countdown > 0 ? "countdown" : "playing";
  state.countdown = config.countdown > 0 ? config.countdown : 0;
  return state;
}

function beginRound(state) {
  if (state.config.scripted) {
    state.floes = state.template.floes.map((floe) => cloneFloe(floe));
    state.pickups = [];
  } else {
    state.nextFloeId = 1;
    state.floes = spawnProceduralFloes(state, state.config.floeCount);
    state.pickups = [];
  }
  restorePlayers(state);
  if (!state.config.scripted) {
    rememberTemplate(state);
  }
  state.roundTime = 0;
  state.suddenDeath = false;
  state.roundWinner = null;
  state.spawnTimer = SPAWN_EVERY;
  state.pickupTimer = 5;
  state.wanderTimer = 2.5;
  if (state.config.countdown > 0) {
    state.phase = "countdown";
    state.countdown = state.config.countdown;
  } else {
    state.phase = "playing";
    state.countdown = 0;
  }
}

function bestIndex(scores) {
  let best = scores[0];
  let index = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > best) {
      best = scores[i];
      index = i;
    }
  }
  return index;
}

function advance(state) {
  if (state.pendingMatch || state.scores.some((score) => score >= state.config.roundsToWin)) {
    state.phase = "match_end";
    state.winner = bestIndex(state.scores);
    state.pendingMatch = false;
    state.events.push({ type: "match", winner: state.winner });
    return;
  }
  state.round += 1;
  beginRound(state);
}

function endRound(state, winner) {
  state.phase = "round_end";
  state.roundWinner = winner ? winner.id : null;
  state.banner = state.config.roundBanner;
  if (winner) state.scores[winner.id] += 1;
  if (state.scores.some((score) => score >= state.config.roundsToWin)) state.pendingMatch = true;
  state.events.push({ type: "round", winner: state.roundWinner });
}

function eliminate(state, player, reason) {
  if (!player.alive) return;
  player.alive = false;
  player.floeId = null;
  player.charging = false;
  player.charge = 0;
  player.bracing = false;
  player.vx = 0;
  player.vy = 0;
  state.events.push({ type: "ko", playerId: player.id, reason, x: player.x, y: player.y });
}

function shatter(state, floe) {
  if (!floe.alive) return;
  floe.alive = false;
  state.events.push({ type: "shatter", floeId: floe.id, x: floe.x, y: floe.y });
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (player.alive && player.floeId === floe.id) eliminate(state, player, "shatter");
  }
  for (let i = 0; i < state.pickups.length; i++) {
    if (state.pickups[i].floeId === floe.id) state.pickups[i].alive = false;
  }
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby || 1;
  let t = (apx * abx + apy * aby) / ab2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function performShove(state, player) {
  const charge = Math.max(0, Math.min(SHOVE_MAX_CHARGE, player.charge));
  const dirX = Math.cos(player.facing);
  const dirY = Math.sin(player.facing);
  const selfPush = SHOVE_SELF + charge * SHOVE_SELF_GAIN;
  player.vx += dirX * selfPush;
  player.vy += dirY * selfPush;
  const reach = SHOVE_REACH + charge * SHOVE_REACH_GAIN;
  const width = player.radius + 10;
  state.events.push({ type: "shove", playerId: player.id, charge, x: player.x, y: player.y });
  const x2 = player.x + dirX * reach;
  const y2 = player.y + dirY * reach;
  for (let i = 0; i < state.players.length; i++) {
    const other = state.players[i];
    if (other.id === player.id || !other.alive) continue;
    const dist = distToSegment(other.x, other.y, player.x, player.y, x2, y2);
    if (dist > width + other.radius) continue;
    let ax = other.x - player.x;
    let ay = other.y - player.y;
    let mag = Math.hypot(ax, ay);
    if (mag < 1) {
      ax = dirX;
      ay = dirY;
      mag = 1;
    }
    ax /= mag;
    ay /= mag;
    const power = shovePower(charge, other.bracing, player.boost > 0);
    other.vx += ax * power;
    other.vy += ay * power;
    state.events.push({
      type: "hit",
      playerId: other.id,
      sourceId: player.id,
      charge,
      power,
      x: other.x,
      y: other.y,
    });
  }
}

function findHop(state, player, from, nx, ny) {
  let best = null;
  let bestGap = Infinity;
  for (let i = 0; i < state.floes.length; i++) {
    const floe = state.floes[i];
    if (!floe.alive || floe.id === from.id) continue;
    const gap = Math.hypot(floe.x - from.x, floe.y - from.y) - from.radius - floe.radius;
    if (gap > state.config.hopReach) continue;
    const tx = floe.x - player.x;
    const ty = floe.y - player.y;
    const mag = Math.hypot(tx, ty) || 1;
    const align = (tx / mag) * nx + (ty / mag) * ny;
    if (align < 0.2) continue;
    if (gap < bestGap) {
      best = floe;
      bestGap = gap;
    }
  }
  return best;
}

function containOrHop(state, player) {
  const floe = state.floes.find((item) => item.alive && item.id === player.floeId);
  if (!floe) {
    eliminate(state, player, "fall");
    return;
  }
  const dx = player.x - floe.x;
  const dy = player.y - floe.y;
  const dist = Math.hypot(dx, dy) || 0.0001;
  const limit = floe.radius - player.radius;
  if (dist <= limit) return;
  const nx = dx / dist;
  const ny = dy / dist;
  if (player.hopCooldown <= 0) {
    const target = findHop(state, player, floe, nx, ny);
    if (target) {
      const tdx = player.x - target.x;
      const tdy = player.y - target.y;
      const td = Math.hypot(tdx, tdy) || 1;
      const inset = Math.max(4, target.radius - player.radius - 2);
      player.x = target.x + (tdx / td) * inset;
      player.y = target.y + (tdy / td) * inset;
      player.floeId = target.id;
      player.hopCooldown = HOP_COOLDOWN;
      state.events.push({ type: "hop", playerId: player.id, floeId: target.id });
      return;
    }
  }
  const outward = player.vx * nx + player.vy * ny;
  if (outward > 24 || dist > limit + 8) {
    eliminate(state, player, "fall");
    return;
  }
  player.x = floe.x + nx * limit;
  player.y = floe.y + ny * limit;
  if (outward > 0) {
    player.vx -= nx * outward;
    player.vy -= ny * outward;
  }
}

function separate(state) {
  const players = state.players;
  for (let i = 0; i < players.length; i++) {
    const a = players[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < players.length; j++) {
      const b = players[j];
      if (!b.alive) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius;
      if (dist >= min) continue;
      if (dist < 0.001) {
        const angle = a.facing || 0;
        dx = Math.cos(angle);
        dy = Math.sin(angle);
        dist = 1;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      const push = (min - dist) / 2;
      const wa = a.bracing ? 0.15 : 1;
      const wb = b.bracing ? 0.15 : 1;
      const sum = wa + wb || 1;
      a.x -= nx * push * 2 * (wa / sum);
      a.y -= ny * push * 2 * (wa / sum);
      b.x += nx * push * 2 * (wb / sum);
      b.y += ny * push * 2 * (wb / sum);
    }
  }
}

function driftFloes(state, dt) {
  if (!state.config.scripted) {
    state.wanderTimer -= dt;
    if (state.wanderTimer <= 0) {
      state.wanderTimer = 2.5;
      for (let i = 0; i < state.floes.length; i++) {
        const floe = state.floes[i];
        if (!floe.alive) continue;
        floe.vx += (state.rng() - 0.5) * 14;
        floe.vy += (state.rng() - 0.5) * 14;
        const speed = Math.hypot(floe.vx, floe.vy);
        if (speed > 34) {
          floe.vx = (floe.vx / speed) * 34;
          floe.vy = (floe.vy / speed) * 34;
        }
      }
    }
  }
  const { worldW, worldH } = state.config;
  for (let i = 0; i < state.floes.length; i++) {
    const floe = state.floes[i];
    if (!floe.alive) continue;
    const ox = floe.x;
    const oy = floe.y;
    floe.x += floe.vx * dt;
    floe.y += floe.vy * dt;
    floe.age += dt;
    if (floe.x < floe.radius) {
      floe.x = floe.radius;
      floe.vx = Math.abs(floe.vx);
    } else if (floe.x > worldW - floe.radius) {
      floe.x = worldW - floe.radius;
      floe.vx = -Math.abs(floe.vx);
    }
    if (floe.y < floe.radius) {
      floe.y = floe.radius;
      floe.vy = Math.abs(floe.vy);
    } else if (floe.y > worldH - floe.radius) {
      floe.y = worldH - floe.radius;
      floe.vy = -Math.abs(floe.vy);
    }
    const dx = floe.x - ox;
    const dy = floe.y - oy;
    if (!dx && !dy) continue;
    for (let p = 0; p < state.players.length; p++) {
      const player = state.players[p];
      if (player.alive && player.floeId === floe.id) {
        player.x += dx;
        player.y += dy;
      }
    }
    for (let k = 0; k < state.pickups.length; k++) {
      const pickup = state.pickups[k];
      if (pickup.alive && pickup.floeId === floe.id) {
        pickup.x += dx;
        pickup.y += dy;
      }
    }
  }
}

function crackAndShrink(state, dt) {
  if (state.roundTime >= state.config.suddenDeathTime) {
    state.suddenDeath = true;
    for (let i = 0; i < state.floes.length; i++) {
      const floe = state.floes[i];
      if (!floe.alive) continue;
      floe.radius -= state.config.shrinkRate * dt;
      if (floe.radius < MIN_FLOE_RADIUS) shatter(state, floe);
    }
  }
  for (let i = 0; i < state.floes.length; i++) {
    const floe = state.floes[i];
    if (!floe.alive) continue;
    let count = 0;
    for (let p = 0; p < state.players.length; p++) {
      const player = state.players[p];
      if (player.alive && player.floeId === floe.id) count += 1;
    }
    if (count > 0) floe.crack += dt * state.config.crackRate * count;
    if (floe.crack >= 1) shatter(state, floe);
  }
}

function spawnFish(state) {
  const floes = state.floes.filter((floe) => floe.alive && floe.radius > 40);
  if (!floes.length) return;
  const floe = floes[state.rng.int(floes.length)];
  const angle = state.rng() * Math.PI * 2;
  const dist = state.rng() * (floe.radius - 24);
  state.pickups.push({
    id: state.nextPickupId++,
    x: floe.x + Math.cos(angle) * dist,
    y: floe.y + Math.sin(angle) * dist,
    floeId: floe.id,
    radius: 12,
    alive: true,
  });
}

function updatePickups(state, dt) {
  if (!state.config.scripted) {
    state.pickupTimer -= dt;
    const aliveCount = state.pickups.filter((pickup) => pickup.alive).length;
    if (state.pickupTimer <= 0 && aliveCount < MAX_PICKUPS) {
      spawnFish(state);
      state.pickupTimer = PICKUP_EVERY;
    } else if (state.pickupTimer <= 0) {
      state.pickupTimer = PICKUP_EVERY;
    }
  }
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (!player.alive) continue;
    for (let k = 0; k < state.pickups.length; k++) {
      const pickup = state.pickups[k];
      if (!pickup.alive) continue;
      if (Math.hypot(player.x - pickup.x, player.y - pickup.y) <= player.radius + pickup.radius) {
        pickup.alive = false;
        player.boost = state.config.boostTime;
        state.events.push({
          type: "pickup",
          playerId: player.id,
          pickupId: pickup.id,
          x: player.x,
          y: player.y,
        });
      }
    }
  }
}

function maybeSpawnFloe(state, dt) {
  if (state.config.scripted) return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  state.spawnTimer = SPAWN_EVERY;
  const alive = state.floes.filter((floe) => floe.alive).length;
  if (alive < FLOE_MAX) spawnIncoming(state);
}

function checkWinner(state) {
  const active = state.players.filter((player) => player.active).length;
  const alive = state.players.filter((player) => player.alive);
  if (alive.length <= 1 && alive.length < active) {
    endRound(state, alive[0] || null);
    return true;
  }
  return false;
}

export function step(state, inputs = [], dt = DT) {
  if (!(dt > 0)) return state;
  state.events = [];
  state.tick += 1;
  state.time += dt;

  if (state.phase === "match_end") return state;

  if (state.phase === "countdown") {
    const before = Math.ceil(state.countdown - 1e-8);
    state.countdown -= dt;
    const after = state.countdown <= 0 ? 0 : Math.ceil(state.countdown - 1e-8);
    if (after !== before) state.events.push({ type: "countdown", value: after });
    driftFloes(state, dt);
    if (state.countdown <= 0) {
      state.countdown = 0;
      state.phase = "playing";
    }
    return state;
  }

  if (state.phase === "round_end") {
    state.banner -= dt;
    if (state.banner <= 0) advance(state);
    return state;
  }

  const list = [0, 1, 2, 3].map((i) => readInput(inputs[i]));

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    const input = list[i] || EMPTY;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.hopCooldown = Math.max(0, player.hopCooldown - dt);
    player.boost = Math.max(0, player.boost - dt);
    if (!player.alive) {
      player.bracing = false;
      player.charging = false;
      player._mx = 0;
      player._my = 0;
      continue;
    }
    let mx = input.moveX;
    let my = input.moveY;
    const mag = Math.hypot(mx, my);
    if (mag > 1) {
      mx /= mag;
      my /= mag;
    }
    player._mx = mx;
    player._my = my;
    if ((mx || my) && !input.secondary) player.facing = Math.atan2(my, mx);
    player.bracing = !!input.secondary;
    if (player.bracing) {
      player.charging = false;
      player.charge = 0;
    }
  }

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (!player.alive || player.bracing) continue;
    const input = list[i] || EMPTY;
    if (player.charging && !input.action) {
      performShove(state, player);
      player.charging = false;
      player.charge = 0;
      player.cooldown = SHOVE_COOLDOWN;
    } else if (input.action && player.cooldown <= 0) {
      player.charging = true;
      player.charge = Math.min(SHOVE_MAX_CHARGE, player.charge + dt);
    } else if (!input.action) {
      player.charging = false;
    }
  }

  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    if (!player.alive) continue;
    if (player.bracing) {
      const damp = Math.exp(-BRACE_DAMP * dt);
      player.vx *= damp;
      player.vy *= damp;
    } else {
      // Walking tops out at MAX_SPEED. A shove can launch someone faster;
      // friction bleeds that speed off instead of an instant clamp.
      const launched = Math.hypot(player.vx, player.vy);
      const scale = player.charging ? CHARGE_MOVE_SCALE : 1;
      player.vx += player._mx * ACCEL * scale * dt;
      player.vy += player._my * ACCEL * scale * dt;
      const damp = Math.exp(-FRICTION * dt);
      player.vx *= damp;
      player.vy *= damp;
      const speed = Math.hypot(player.vx, player.vy);
      const cap = Math.max(MAX_SPEED, launched * damp);
      if (speed > cap) {
        player.vx = (player.vx / speed) * cap;
        player.vy = (player.vy / speed) * cap;
      }
    }
    player.x += player.vx * dt;
    player.y += player.vy * dt;
  }

  driftFloes(state, dt);
  separate(state);
  crackAndShrink(state, dt);
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].alive) containOrHop(state, state.players[i]);
  }
  updatePickups(state, dt);
  maybeSpawnFloe(state, dt);
  state.roundTime += dt;

  if (state.phase === "playing" && checkWinner(state) && state.banner <= 0 && state.phase === "round_end") {
    advance(state);
  }
  return state;
}

export function digest(state) {
  const r = (n) => (Math.round((n || 0) * 1000) / 1000).toFixed(3);
  const parts = [
    state.phase,
    String(state.round),
    String(state.tick),
    state.scores.join(","),
    String(state.roundWinner),
    String(state.winner),
  ];
  for (let i = 0; i < state.players.length; i++) {
    const player = state.players[i];
    parts.push(
      [
        player.id,
        player.alive ? 1 : 0,
        r(player.x),
        r(player.y),
        r(player.vx),
        r(player.vy),
        player.floeId,
        r(player.charge),
        r(player.boost),
      ].join(":"),
    );
  }
  for (let i = 0; i < state.floes.length; i++) {
    const floe = state.floes[i];
    parts.push(
      [floe.id, floe.alive ? 1 : 0, r(floe.x), r(floe.y), r(floe.radius), r(floe.crack)].join(":"),
    );
  }
  return parts.join("|");
}

export function snapshot(state) {
  if (!state) return null;
  return {
    phase: state.phase,
    round: state.round,
    roundTime: state.roundTime,
    scores: state.scores.slice(),
    alive: state.players.map((player) => player.alive),
    aliveCount: state.players.filter((player) => player.alive).length,
    tick: state.tick,
    winner: state.winner,
    roundWinner: state.roundWinner,
    suddenDeath: state.suddenDeath,
    floes: state.floes.filter((floe) => floe.alive).length,
    time: state.time,
  };
}
