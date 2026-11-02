import { HOP_REACH } from "./constants.js";

function idle() {
  return { moveX: 0, moveY: 0, action: false, secondary: false };
}

function aim(input, dx, dy) {
  const mag = Math.hypot(dx, dy);
  if (mag < 1) return;
  input.moveX = dx / mag;
  input.moveY = dy / mag;
}

function findFloe(state, id) {
  for (let i = 0; i < state.floes.length; i++) {
    if (state.floes[i].id === id) return state.floes[i];
  }
  return null;
}

function gapBetween(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius;
}

/**
 * Simple free-for-all ice AI.
 * Flee a cracking floe, brace against a charged shove, otherwise close in and belly-shove.
 * Personalities differ only by player index so the result stays seeded and deterministic.
 */
export function botIntent(state, playerId) {
  const input = idle();
  const player = state.players[playerId];
  if (!player || !player.alive || !state || state.phase !== "playing") return input;

  const floe = findFloe(state, player.floeId);
  const enemies = [];
  for (let i = 0; i < state.players.length; i++) {
    const other = state.players[i];
    if (other.alive && other.id !== player.id) enemies.push(other);
  }

  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (enemy.charging && enemy.charge > 0.3 && dist < 130) {
      input.secondary = true;
      return input;
    }
  }

  if (floe && floe.crack > 0.58) {
    let safer = null;
    let saferGap = Infinity;
    for (let i = 0; i < state.floes.length; i++) {
      const candidate = state.floes[i];
      if (!candidate.alive || candidate.id === floe.id) continue;
      const gap = gapBetween(floe, candidate);
      if (gap > HOP_REACH) continue;
      if (candidate.crack > floe.crack - 0.08) continue;
      if (gap < saferGap) {
        safer = candidate;
        saferGap = gap;
      }
    }
    if (safer) {
      aim(input, safer.x - player.x, safer.y - player.y);
      return input;
    }
    aim(input, floe.x - player.x, floe.y - player.y);
    return input;
  }

  let target = null;
  let best = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    const enemy = enemies[i];
    const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
    if (dist < best) {
      best = dist;
      target = enemy;
    }
  }

  if (!target) {
    if (floe) aim(input, floe.x - player.x, floe.y - player.y);
    return input;
  }

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantCharge = 0.42 + (player.id % 3) * 0.16;
  const enemyFloe = floe ? findFloe(state, target.floeId) : null;
  const hopping =
    floe && enemyFloe && enemyFloe.id !== floe.id && gapBetween(floe, enemyFloe) <= HOP_REACH;

  if (floe && !hopping) {
    const ox = player.x - floe.x;
    const oy = player.y - floe.y;
    const centerDist = Math.hypot(ox, oy);
    const room = floe.radius - player.radius - centerDist;
    const outward = centerDist > 1 ? (player.vx * ox + player.vy * oy) / centerDist : 0;
    if (room < 22 || (room < 46 && outward > 36)) {
      aim(input, floe.x - player.x, floe.y - player.y);
      return input;
    }
  }

  const sameFloe = floe && target.floeId === floe.id;
  if (sameFloe && dist < 148) {
    aim(input, dx, dy);
    if (player.charging && player.charge >= wantCharge) input.action = false;
    else input.action = true;
    return input;
  }

  if (hopping) {
    aim(input, dx, dy);
    return input;
  }

  if (floe) {
    let bridge = null;
    let bridgeGap = Infinity;
    for (let i = 0; i < state.floes.length; i++) {
      const candidate = state.floes[i];
      if (!candidate.alive || candidate.id === floe.id) continue;
      const gap = gapBetween(floe, candidate);
      if (gap > HOP_REACH || gap >= bridgeGap) continue;
      bridge = candidate;
      bridgeGap = gap;
    }
    if (bridge) {
      aim(input, bridge.x - player.x, bridge.y - player.y);
      return input;
    }
    const angle = state.time * 0.6 + player.id * 1.4;
    const cruise = Math.max(8, (floe.radius - player.radius) * 0.25);
    aim(
      input,
      floe.x + Math.cos(angle) * cruise - player.x,
      floe.y + Math.sin(angle) * cruise - player.y,
    );
  }
  return input;
}
