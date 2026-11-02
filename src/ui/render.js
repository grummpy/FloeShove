/** Canvas rendering for every screen. Drawing coordinates are 1280×720. */

const W = 1280;
const H = 720;

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function font(ctx, size, weight = "700") {
  ctx.font = `${weight} ${size}px Trebuchet MS, Segoe UI, sans-serif`;
}

function drawSea(ctx, time) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#1a5278");
  sky.addColorStop(0.45, "#0e3a5a");
  sky.addColorStop(1, "#071422");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    const base = 30 + i * 78;
    for (let x = 0; x <= W; x += 18) {
      const y = base + Math.sin(x * 0.012 + time * 0.7 + i * 0.8) * 7;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.04 + (i % 3) * 0.02})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function coverImage(ctx, image) {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return;
  const scale = Math.max(W / iw, H / ih);
  const dw = iw * scale;
  const dh = ih * scale;
  ctx.drawImage(image, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function hit(view, x, y, w, h, id) {
  view.hitboxes.push({ x, y, w, h, id });
}

function button(ctx, view, x, y, w, h, label, id, selected) {
  ctx.fillStyle = selected ? "#f4d35e" : "rgba(255,255,255,0.1)";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = selected ? "#fff6d0" : "rgba(255,255,255,0.18)";
  ctx.stroke();
  font(ctx, 22);
  ctx.fillStyle = selected ? "#1c2430" : "#f4fbff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
  hit(view, x, y, w, h, id);
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = "rgba(6, 18, 32, 0.9)";
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(186, 230, 253, 0.35)";
  ctx.stroke();
}

function drawFloe(ctx, floe, time) {
  ctx.save();
  ctx.translate(floe.x, floe.y);
  const n = 11;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const wobble = 0.9 + 0.1 * Math.sin(angle * 3 + floe.id * 1.7);
    const radius = floe.radius * wobble;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * 0.96;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const ice = ctx.createRadialGradient(-floe.radius * 0.3, -floe.radius * 0.35, 8, 0, 0, floe.radius);
  ice.addColorStop(0, "#ffffff");
  ice.addColorStop(0.45, "#d7f1fb");
  ice.addColorStop(1, floe.crack > 0.72 ? "#9fd0e4" : "#b7e0f2");
  ctx.fillStyle = ice;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();

  if (floe.crack > 0.04) {
    ctx.beginPath();
    const lines = 2 + Math.floor(floe.crack * 6);
    for (let i = 0; i < lines; i++) {
      const angle = floe.id + i * 1.15;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(angle) * floe.radius * Math.min(1, floe.crack + 0.1), Math.sin(angle) * floe.radius * 0.9 * floe.crack);
    }
    ctx.strokeStyle = `rgba(18, 47, 74, ${0.25 + floe.crack * 0.6})`;
    ctx.lineWidth = 1.2 + floe.crack * 2.2;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.strokeStyle = floe.crack > 0.75 ? "#e63946" : "rgba(30, 74, 110, 0.45)";
  ctx.lineWidth = 4;
  ctx.arc(0, 0, Math.max(8, floe.radius - 6), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, floe.crack));
  ctx.stroke();

  if (floe.crack > 0.8) {
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(time * 10);
    ctx.fillStyle = "#e63946";
    ctx.fill();
  }
  ctx.restore();
}

function drawWalrus(ctx, player, time) {
  ctx.save();
  ctx.translate(player.x, player.y);
  const bob = player.bracing ? 0 : Math.sin(time * 5 + player.id) * 1.2;
  ctx.rotate(player.facing);
  ctx.translate(bob, 0);
  if (player.bracing) ctx.scale(1.18, 0.78);
  else if (player.charging) ctx.scale(1.08, 0.9);

  ctx.fillStyle = "rgba(7, 20, 34, 0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 10, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.ellipse(-2, 0, 16, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6e6d0";
  ctx.beginPath();
  ctx.ellipse(2, 1, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.ellipse(14, 0, 9, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c98462";
  ctx.beginPath();
  ctx.ellipse(21, 0, 5.5, 4.2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fffaf2";
  ctx.fillRect(22, -4.2, 8, 2.1);
  ctx.fillRect(22, 2.2, 8, 2.1);

  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.arc(16, -3.2, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(16.5, -3.6, 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  if (player.bracing) {
    ctx.beginPath();
    ctx.strokeStyle = "rgba(125, 200, 255, 0.9)";
    ctx.lineWidth = 3;
    ctx.arc(player.x, player.y, 24, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (player.boost > 0) {
    ctx.beginPath();
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 2;
    ctx.arc(player.x, player.y, 27, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (player.charging) {
    ctx.beginPath();
    ctx.strokeStyle = "#ffe66d";
    ctx.lineWidth = 4;
    ctx.arc(player.x, player.y, 30, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * player.charge);
    ctx.stroke();
  }

  font(ctx, 13, "800");
  ctx.fillStyle = "#f7fbff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(player.label, player.x, player.y + 30);
}

function drawFish(ctx, fish, time) {
  ctx.save();
  ctx.translate(fish.x, fish.y);
  ctx.rotate(Math.sin(time * 3 + fish.id) * 0.4);
  ctx.fillStyle = "#ff8c42";
  ctx.beginPath();
  ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-10, 0);
  ctx.lineTo(-16, -5);
  ctx.lineTo(-16, 5);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1b1b1b";
  ctx.beginPath();
  ctx.arc(5, -1, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawParticles(ctx, particles) {
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPad(ctx, x, y, on) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = on ? "rgba(110, 220, 170, 0.22)" : "rgba(255,255,255,0.05)";
  ctx.strokeStyle = on ? "#9ef0c8" : "rgba(255,255,255,0.28)";
  ctx.lineWidth = 1.5;
  roundRect(ctx, -16, -11, 32, 22, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = on ? "#d8ffe9" : "rgba(255,255,255,0.35)";
  ctx.fillRect(-8, -2, 5, 4);
  ctx.beginPath();
  ctx.arc(4, -2, 2, 0, Math.PI * 2);
  ctx.arc(9, 2, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHud(ctx, view) {
  const state = view.state;
  ctx.fillStyle = "rgba(5, 16, 28, 0.55)";
  roundRect(ctx, 16, 12, W - 32, 64, 14);
  ctx.fill();

  font(ctx, 20, "800");
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4fbff";
  const goal = state.config.roundsToWin;
  ctx.fillText(`Round ${state.round}`, 32, 44);
  font(ctx, 14, "600");
  ctx.fillStyle = "#b7d4e6";
  ctx.fillText(`first to ${goal}`, 150, 44);

  for (let i = 0; i < 4; i++) {
    const player = state.players[i];
    const x = 310 + i * 170;
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(x, 44, 8, 0, Math.PI * 2);
    ctx.fill();
    font(ctx, 18, "800");
    ctx.fillStyle = player.alive || state.phase !== "playing" ? "#f7fbff" : "rgba(247,251,255,0.35)";
    ctx.textAlign = "left";
    ctx.fillText(`${player.label}  ${state.scores[i]}`, x + 16, 44);
    if (state.phase === "playing" && !player.alive) {
      font(ctx, 12, "700");
      ctx.fillStyle = "#ffb4a8";
      ctx.fillText("OUT", x + 78, 44);
    }
  }

  for (let i = 0; i < 4; i++) {
    drawPad(ctx, W - 150 + i * 32, 44, !!(view.pads && view.pads[i]));
  }

  if (state.suddenDeath) {
    font(ctx, 18, "800");
    ctx.textAlign = "center";
    ctx.fillStyle = Math.sin(view.uiTime * 8) > 0 ? "#ff6b6b" : "#ffe66d";
    ctx.fillText("SUDDEN DEATH", W / 2, 96);
  }

  if (view.muted) {
    font(ctx, 14, "700");
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffd6d6";
    ctx.fillText("MUTE", W - 24, 96);
  }

  if (view.toast) {
    font(ctx, 16, "700");
    ctx.textAlign = "center";
    ctx.fillStyle = "#f7fbff";
    ctx.fillText(view.toast, W / 2, H - 28);
  }
}

function drawWorld(ctx, view) {
  const state = view.state;
  drawSea(ctx, state.time + view.uiTime * 0.15);
  for (let i = 0; i < state.floes.length; i++) {
    if (state.floes[i].alive) drawFloe(ctx, state.floes[i], state.time);
  }
  for (let i = 0; i < state.pickups.length; i++) {
    if (state.pickups[i].alive) drawFish(ctx, state.pickups[i], state.time);
  }
  for (let i = 0; i < state.players.length; i++) {
    if (state.players[i].alive) drawWalrus(ctx, state.players[i], state.time);
  }
  drawParticles(ctx, view.particles || []);
  drawHud(ctx, view);

  if (state.phase === "countdown") {
    font(ctx, 120, "800");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fffaf0";
    ctx.strokeStyle = "rgba(8, 20, 34, 0.65)";
    ctx.lineWidth = 8;
    const n = Math.max(1, Math.ceil(state.countdown));
    ctx.strokeText(String(n), W / 2, H / 2);
    ctx.fillText(String(n), W / 2, H / 2);
  } else if (view.goTimer > 0) {
    font(ctx, 96, "800");
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe66d";
    ctx.fillText("GO!", W / 2, H / 2);
  }

  if (state.phase === "round_end") {
    ctx.fillStyle = "rgba(4, 12, 22, 0.45)";
    ctx.fillRect(0, 0, W, H);
    panel(ctx, 340, 250, 600, 180);
    font(ctx, 36, "800");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fffaf0";
    const text =
      state.roundWinner == null
        ? "Everybody splashed — draw"
        : `${state.players[state.roundWinner].label} takes the round`;
    ctx.fillText(text, W / 2, 340);
  }
}

function drawTitle(ctx, view) {
  if (view.cover) {
    coverImage(ctx, view.cover);
    const shade = ctx.createLinearGradient(0, 480, 0, H);
    shade.addColorStop(0, "rgba(4, 14, 24, 0)");
    shade.addColorStop(1, "rgba(4, 14, 24, 0.72)");
    ctx.fillStyle = shade;
    ctx.fillRect(0, 480, W, 240);
  } else {
    drawSea(ctx, view.uiTime);
    font(ctx, 92, "800");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(6, 18, 32, 0.75)";
    ctx.strokeText("FLOE SHOVE", W / 2, 250);
    ctx.fillStyle = "#f4fbff";
    ctx.fillText("FLOE SHOVE", W / 2, 250);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (Math.floor(view.uiTime * 2) % 2 === 0) {
    font(ctx, 28, "800");
    ctx.fillStyle = "#ffe66d";
    ctx.fillText("Press Enter  /  Start", W / 2, 600);
  }
  button(ctx, view, W / 2 - 120, 640, 240, 52, "Start", "start", true);
  if (view.icon) {
    ctx.save();
    roundRect(ctx, 28, 28, 64, 64, 12);
    ctx.clip();
    ctx.drawImage(view.icon, 28, 28, 64, 64);
    ctx.restore();
  }
}

function drawJoin(ctx, view) {
  drawSea(ctx, view.uiTime);
  font(ctx, 40, "800");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4fbff";
  ctx.fillText("Who is on the ice?", W / 2, 58);
  font(ctx, 16, "600");
  ctx.fillStyle = "#c5dbe8";
  ctx.fillText("Action joins  ·  Secondary toggles CPU / off  ·  empty slots can be bots", W / 2, 96);

  const labels = view.keyLabels;
  for (let i = 0; i < 4; i++) {
    const x = 48 + i * 308;
    const mode = view.slots[i];
    ctx.fillStyle = "rgba(6, 18, 32, 0.82)";
    roundRect(ctx, x, 130, 284, 390, 16);
    ctx.fill();
    ctx.fillStyle = view.colors[i];
    roundRect(ctx, x, 130, 284, 12, 6);
    ctx.fill();
    font(ctx, 28, "800");
    ctx.fillStyle = "#f7fbff";
    ctx.fillText(`P${i + 1}`, x + 142, 180);
    font(ctx, 32, "800");
    ctx.fillStyle = mode === "human" ? "#b7f7c8" : mode === "bot" ? "#ffe66d" : "#ffb4a8";
    ctx.fillText(mode === "human" ? "YOU" : mode === "bot" ? "CPU" : "OFF", x + 142, 230);
    font(ctx, 16, "600");
    ctx.fillStyle = "#d5e7f2";
    const row = labels[i];
    const lines = [
      `Move  ${row.move}`,
      `Shove  ${row.action}`,
      `Brace  ${row.secondary}`,
    ];
    for (let line = 0; line < lines.length; line++) ctx.fillText(lines[line], x + 142, 290 + line * 28);
    font(ctx, 14, "600");
    ctx.fillStyle = "#9fb4c4";
    ctx.fillText("Click card to cycle", x + 142, 400);
    hit(view, x, 130, 284, 390, `slot-${i}`);
  }

  const active = view.slots.filter((slot) => slot !== "off").length;
  button(ctx, view, W / 2 - 250, 560, 220, 52, "Start match", "start-match", active >= 2);
  button(ctx, view, W / 2 + 30, 560, 220, 52, "Settings", "settings", false);
  font(ctx, 15, "600");
  ctx.fillStyle = active >= 2 ? "#c5dbe8" : "#ffb4a8";
  ctx.fillText(
    active >= 2 ? "Enter starts the match" : "Need at least two walruses",
    W / 2,
    640,
  );
  button(ctx, view, 48, 640, 140, 40, "Title", "title", false);
}

function drawMenu(ctx, view, title, rows) {
  ctx.fillStyle = "rgba(4, 12, 22, 0.55)";
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 390, 150, 500, 80 + rows.length * 68);
  font(ctx, 32, "800");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4fbff";
  ctx.fillText(title, W / 2, 190);
  rows.forEach((row, index) => {
    button(ctx, view, 460, 230 + index * 68, 360, 52, row.label, row.id, index === view.menuIndex);
  });
}

function drawControls(ctx, view) {
  drawSea(ctx, view.uiTime);
  font(ctx, 36, "800");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f4fbff";
  ctx.fillText("Remap controls", W / 2, 48);
  font(ctx, 16, "600");
  ctx.fillStyle = "#c5dbe8";
  const capture = view.remap;
  ctx.fillText(
    capture ? `Press a key for P${capture.player + 1} ${capture.field}` : "Click a key, then press a replacement. Esc backs out.",
    W / 2,
    84,
  );
  const fields = ["up", "down", "left", "right", "action", "secondary"];
  const titles = ["Up", "Down", "Left", "Right", "Shove", "Brace"];
  for (let p = 0; p < 4; p++) {
    const y = 130 + p * 120;
    ctx.fillStyle = "rgba(6, 18, 32, 0.82)";
    roundRect(ctx, 40, y, 1200, 104, 14);
    ctx.fill();
    font(ctx, 22, "800");
    ctx.fillStyle = view.colors[p];
    ctx.textAlign = "left";
    ctx.fillText(`P${p + 1}`, 60, y + 52);
    for (let f = 0; f < fields.length; f++) {
      const field = fields[f];
      const x = 160 + f * 175;
      const selected = capture && capture.player === p && capture.field === field;
      ctx.fillStyle = selected ? "#f4d35e" : "rgba(255,255,255,0.08)";
      roundRect(ctx, x, y + 22, 160, 60, 10);
      ctx.fill();
      font(ctx, 13, "700");
      ctx.fillStyle = selected ? "#1c2430" : "#9fb4c4";
      ctx.textAlign = "center";
      ctx.fillText(titles[f], x + 80, y + 40);
      font(ctx, 18, "800");
      ctx.fillStyle = selected ? "#1c2430" : "#f7fbff";
      ctx.fillText(view.bindingLabels[p][field], x + 80, y + 64);
      hit(view, x, y + 22, 160, 60, `bind-${p}-${field}`);
    }
  }
  button(ctx, view, W / 2 - 100, 640, 200, 48, "Back", "back", false);
}

function drawMatch(ctx, view) {
  const state = view.state;
  ctx.fillStyle = "rgba(4, 12, 22, 0.62)";
  ctx.fillRect(0, 0, W, H);
  panel(ctx, 340, 80, 600, 520);
  font(ctx, 40, "800");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe66d";
  const winner = state.players[state.winner];
  ctx.fillText(`${winner ? winner.label : "Nobody"} wins`, W / 2, 140);
  font(ctx, 18, "600");
  ctx.fillStyle = "#d5e7f2";
  ctx.fillText("Final standings", W / 2, 185);
  const rows = state.players
    .map((player) => ({ player, score: state.scores[player.id] }))
    .sort((a, b) => b.score - a.score || a.player.id - b.player.id);
  rows.forEach((row, index) => {
    const y = 230 + index * 58;
    ctx.fillStyle = row.player.color;
    ctx.beginPath();
    ctx.arc(430, y, 10, 0, Math.PI * 2);
    ctx.fill();
    font(ctx, 24, "800");
    ctx.textAlign = "left";
    ctx.fillStyle = "#f7fbff";
    ctx.fillText(`${index + 1}.  ${row.player.label}`, 456, y);
    ctx.textAlign = "right";
    ctx.fillText(String(row.score), 860, y);
  });
  button(ctx, view, 430, 490, 180, 52, "Rematch", "rematch", view.menuIndex === 0);
  button(ctx, view, 670, 490, 180, 52, "Title", "title", view.menuIndex === 1);
}

export function render(ctx, view) {
  view.hitboxes = [];
  ctx.clearRect(0, 0, W, H);
  if (view.screen === "title") {
    drawTitle(ctx, view);
  } else if (view.screen === "join") {
    drawJoin(ctx, view);
  } else if (view.screen === "controls") {
    drawControls(ctx, view);
  } else if (view.screen === "game" || view.screen === "pause" || view.screen === "settings") {
    if (view.state) drawWorld(ctx, view);
    else drawSea(ctx, view.uiTime);
    if (view.screen === "pause") {
      drawMenu(ctx, view, "Paused", [
        { id: "resume", label: "Resume" },
        { id: "settings", label: "Settings" },
        { id: "quit", label: "Quit to title" },
      ]);
    } else if (view.screen === "settings") {
      drawMenu(ctx, view, "Settings", view.settingRows);
    }
    if (view.state && view.state.phase === "match_end") drawMatch(ctx, view);
  }
  if (view.notices && view.notices.length) {
    font(ctx, 16, "700");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#e7fff4";
    view.notices.forEach((notice, index) => {
      ctx.fillText(notice.text, W / 2, 118 + index * 22);
    });
  }
}
