import { botIntent } from "../core/bots.js";
import { PLAYER_COLORS } from "../core/constants.js";
import { keyLabel, cloneBindings, resolveInputs } from "../core/input.js";
import { createMatch, snapshot, step } from "../core/sim.js";
import { createAudio } from "./audio.js";
import { render } from "./render.js";

const STORAGE_KEY = "floeshove-settings-v1";
const STEP_MS = 1000 / 60;
const FIELDS = ["up", "down", "left", "right", "action", "secondary"];
const BLOCKED = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Space",
  "Slash",
  "Quote",
  "Semicolon",
  "Period",
  "Numpad8",
  "Numpad5",
  "Numpad4",
  "Numpad6",
  "Numpad0",
  "NumpadEnter",
  "Tab",
]);

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const params = new URLSearchParams(location.search);
const autoplay = params.has("autoplay");
const audio = createAudio();

const app = {
  screen: "title",
  slots: ["bot", "bot", "bot", "bot"],
  match: null,
  settings: loadSettings(),
  menuIndex: 0,
  settingsReturn: "join",
  remap: null,
  uiTime: 0,
  goTimer: 0,
  toast: "",
  toastTtl: 0,
  notices: [],
  particles: [],
  hitboxes: [],
  pads: [null, null, null, null],
  sawMatch: false,
  navCool: 0,
};

const down = new Set();
const prev = new Set();
const queued = [];
let prevStart = false;
let prevButtons = [false, false, false, false];
let swallowFrame = false;
const cover = new Image();
const icon = new Image();
cover.src = "assets/cover.jpg";
icon.src = "assets/icon.jpg";

window.__FLOE_ERRORS__ = window.__FLOE_ERRORS__ || [];
window.addEventListener("error", (event) => {
  window.__FLOE_ERRORS__.push(String(event.message || event.error || "error"));
});
window.addEventListener("unhandledrejection", (event) => {
  window.__FLOE_ERRORS__.push(String(event.reason || "rejection"));
});

function loadSettings() {
  const settings = {
    volume: 0.7,
    muted: false,
    roundsToWin: 3,
    bindings: cloneBindings(),
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return settings;
    const data = JSON.parse(raw);
    if (typeof data.volume === "number") settings.volume = Math.max(0, Math.min(1, data.volume));
    if (typeof data.muted === "boolean") settings.muted = data.muted;
    if ([1, 3, 5].includes(data.roundsToWin)) settings.roundsToWin = data.roundsToWin;
    if (Array.isArray(data.bindings) && data.bindings.length === 4) {
      const next = cloneBindings();
      let ok = true;
      for (let i = 0; i < 4; i++) {
        for (const field of FIELDS) {
          if (!data.bindings[i] || typeof data.bindings[i][field] !== "string" || !data.bindings[i][field]) {
            ok = false;
          } else {
            next[i][field] = data.bindings[i][field];
          }
        }
      }
      if (ok) settings.bindings = next;
    }
  } catch {
    /* private mode or bad JSON — defaults stand */
  }
  return settings;
}

function saveSettings() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        volume: app.settings.volume,
        muted: app.settings.muted,
        roundsToWin: app.settings.roundsToWin,
        bindings: app.settings.bindings,
      }),
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function notice(text) {
  app.notices.push({ text, ttl: 2.4 });
}

function toast(text) {
  app.toast = text;
  app.toastTtl = 2.2;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(canvas.width / 1280, 0, 0, canvas.height / 720, 0, 0);
}

function pointer(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 1280,
    y: ((event.clientY - rect.top) / rect.height) * 720,
  };
}

function pollPads() {
  const source = navigator.getGamepads ? navigator.getGamepads() : [];
  app.pads = [0, 1, 2, 3].map((index) => {
    const pad = source && source[index];
    if (!pad || !pad.connected) return null;
    return {
      connected: true,
      axes: Array.from(pad.axes || []),
      buttons: Array.from(pad.buttons || []).map((button) => ({
        pressed: !!(button && button.pressed),
        value: button ? button.value || 0 : 0,
      })),
    };
  });
}

function edge(code) {
  return down.has(code) && !prev.has(code);
}

function tapped(code, just) {
  return just.has(code) || edge(code);
}

function startHeld() {
  return app.pads.some((pad) => pad && pad.buttons[9] && (pad.buttons[9].pressed || pad.buttons[9].value > 0.5));
}

function buttonHeld(index) {
  return app.pads.some((pad) => pad && pad.buttons[index] && (pad.buttons[index].pressed || pad.buttons[index].value > 0.5));
}

function stickY() {
  for (let i = 0; i < app.pads.length; i++) {
    const pad = app.pads[i];
    if (!pad) continue;
    const y = pad.axes[1] || 0;
    if (Math.abs(y) > 0.55) return Math.sign(y);
    if (pad.buttons[12] && pad.buttons[12].pressed) return -1;
    if (pad.buttons[13] && pad.buttons[13].pressed) return 1;
  }
  return 0;
}

function stickX() {
  for (let i = 0; i < app.pads.length; i++) {
    const pad = app.pads[i];
    if (!pad) continue;
    const x = pad.axes[0] || 0;
    if (Math.abs(x) > 0.55) return Math.sign(x);
    if (pad.buttons[14] && pad.buttons[14].pressed) return -1;
    if (pad.buttons[15] && pad.buttons[15].pressed) return 1;
  }
  return 0;
}

function activeCount() {
  return app.slots.filter((slot) => slot !== "off").length;
}

function beginMatch() {
  if (activeCount() < 2) {
    toast("Need at least two walruses");
    return;
  }
  const seed = autoplay ? 7 : (Date.now() % 99991) >>> 0;
  app.match = createMatch({
    seed,
    roundsToWin: app.settings.roundsToWin,
    players: app.slots.map((mode) => ({ active: mode !== "off" })),
  });
  app.screen = "game";
  app.menuIndex = 0;
  app.sawMatch = false;
  app.particles = [];
  audio.resume();
}

function cycleSlot(index) {
  const order = ["bot", "human", "off"];
  const current = app.slots[index];
  app.slots[index] = order[(order.indexOf(current) + 1) % order.length];
}

function settingRows() {
  return [
    { id: "volume", label: `Volume  ${Math.round(app.settings.volume * 100)}%` },
    { id: "rounds", label: `Rounds to win  ${app.settings.roundsToWin}` },
    { id: "controls", label: "Controls" },
    { id: "back", label: "Back" },
  ];
}

function activate(id) {
  if (!id) return;
  if (id === "start") {
    app.screen = "join";
    app.menuIndex = 0;
    return;
  }
  if (id === "start-match") {
    beginMatch();
    return;
  }
  if (id === "resume") {
    app.screen = "game";
    return;
  }
  if (id === "settings") {
    app.settingsReturn = app.screen === "settings" ? app.settingsReturn : app.screen;
    if (app.settingsReturn === "settings") app.settingsReturn = "pause";
    app.screen = "settings";
    app.menuIndex = 0;
    return;
  }
  if (id === "controls") {
    app.screen = "controls";
    app.remap = null;
    return;
  }
  if (id === "back") {
    app.screen = app.screen === "controls" ? "settings" : app.settingsReturn || "join";
    app.remap = null;
    return;
  }
  if (id === "quit" || id === "title") {
    app.screen = "title";
    app.match = null;
    app.menuIndex = 0;
    return;
  }
  if (id === "rematch") {
    beginMatch();
    return;
  }
  if (id.startsWith("slot-")) {
    cycleSlot(Number(id.slice(5)));
    return;
  }
  if (id.startsWith("bind-")) {
    const [, player, field] = id.split("-");
    app.remap = { player: Number(player), field };
  }
}

function adjustSetting(dir) {
  const rows = settingRows();
  const row = rows[app.menuIndex];
  if (!row) return;
  if (row.id === "volume") {
    app.settings.volume = Math.max(0, Math.min(1, Math.round((app.settings.volume + dir * 0.05) * 20) / 20));
    saveSettings();
  } else if (row.id === "rounds") {
    const options = [1, 3, 5];
    const index = options.indexOf(app.settings.roundsToWin);
    app.settings.roundsToWin = options[(index + (dir > 0 ? 1 : options.length - 1)) % options.length];
    saveSettings();
  }
}

function menuConfirm() {
  if (app.screen === "pause") {
    const ids = ["resume", "settings", "quit"];
    activate(ids[app.menuIndex] || "resume");
  } else if (app.screen === "settings") {
    const row = settingRows()[app.menuIndex];
    if (row && (row.id === "controls" || row.id === "back")) activate(row.id);
  } else if (app.match && app.match.phase === "match_end") {
    activate(app.menuIndex === 0 ? "rematch" : "title");
  }
}

function moveMenu(dir, length) {
  app.menuIndex = (app.menuIndex + dir + length) % length;
}

function burst(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = speed * (0.35 + Math.random());
    app.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 1,
      decay: 1.1 + Math.random(),
      r: 2 + Math.random() * 3,
      color,
    });
  }
  if (app.particles.length > 240) app.particles.splice(0, app.particles.length - 240);
}

function react(events) {
  if (!events) return;
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    if (event.type === "hit") burst(event.x, event.y, "#fff1c9", 8, 140);
    else if (event.type === "ko") burst(event.x, event.y, "#9bd7ff", 16, 180);
    else if (event.type === "shatter") burst(event.x, event.y, "#e7f7ff", 22, 220);
    else if (event.type === "pickup") burst(event.x, event.y, "#ffd166", 10, 120);
    else if (event.type === "countdown" && event.value === 0) app.goTimer = 0.55;
  }
}

function simTick(resolved) {
  if (app.screen !== "game" || !app.match || app.match.phase === "match_end") return;
  const inputs = [0, 1, 2, 3].map((index) => {
    if (autoplay || app.slots[index] === "bot") return botIntent(app.match, index);
    if (app.slots[index] === "off") return { moveX: 0, moveY: 0, action: false, secondary: false };
    const input = resolved.players[index];
    return {
      moveX: input.moveX,
      moveY: input.moveY,
      action: input.action,
      secondary: input.secondary,
    };
  });
  step(app.match, inputs);
  audio.playEvents(app.match.events);
  react(app.match.events);
  if (app.match.phase === "match_end" && !app.sawMatch) {
    app.sawMatch = true;
    app.menuIndex = 0;
  }
}

function bindingLabels() {
  return app.settings.bindings.map((binding) => {
    const labeled = {};
    for (const field of FIELDS) labeled[field] = keyLabel(binding[field]);
    return labeled;
  });
}

function moveLabels() {
  return app.settings.bindings.map((binding) => ({
    move: `${keyLabel(binding.up)} ${keyLabel(binding.left)} ${keyLabel(binding.down)} ${keyLabel(binding.right)}`,
    action: keyLabel(binding.action),
    secondary: keyLabel(binding.secondary),
  }));
}

function view() {
  return {
    screen: app.screen,
    state: app.match,
    uiTime: app.uiTime,
    goTimer: app.goTimer,
    hitboxes: app.hitboxes,
    particles: app.particles,
    slots: app.slots,
    colors: PLAYER_COLORS,
    pads: app.pads.map((pad) => !!(pad && pad.connected)),
    muted: app.settings.muted,
    toast: app.toastTtl > 0 ? app.toast : "",
    notices: app.notices,
    menuIndex: app.menuIndex,
    cover: cover.complete && cover.naturalWidth ? cover : null,
    icon: icon.complete && icon.naturalWidth ? icon : null,
    settingRows: settingRows(),
    remap: app.remap,
    bindingLabels: bindingLabels(),
    keyLabels: moveLabels(),
  };
}

function updateFrame(dt, resolved, startEdge, just) {
  app.uiTime += dt;
  app.goTimer = Math.max(0, app.goTimer - dt);
  app.navCool = Math.max(0, app.navCool - dt);
  if (app.toastTtl > 0) {
    app.toastTtl -= dt;
    if (app.toastTtl <= 0) app.toast = "";
  }
  app.notices = app.notices.filter((item) => {
    item.ttl -= dt;
    return item.ttl > 0;
  });
  for (let i = app.particles.length - 1; i >= 0; i--) {
    const particle = app.particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= particle.decay * dt;
    if (particle.life <= 0) app.particles.splice(i, 1);
  }

  if (swallowFrame) return;

  const confirm = tapped("Enter", just) || (buttonHeld(0) && !prevButtons[0]);
  const up = tapped("ArrowUp", just) || tapped("KeyW", just);
  const downEdge = tapped("ArrowDown", just) || tapped("KeyS", just);
  const left = tapped("ArrowLeft", just) || tapped("KeyA", just);
  const right = tapped("ArrowRight", just) || tapped("KeyD", just);
  const padY = stickY();
  const padX = stickX();

  if (app.screen === "title") {
    if (tapped("Enter", just) || tapped("Space", just) || startEdge) activate("start");
  } else if (app.screen === "join") {
    const inputs = resolved.players;
    for (let i = 0; i < 4; i++) {
      if (app.slots[i] !== "human" && inputs[i].action && !app.prevAction[i]) app.slots[i] = "human";
      else if (inputs[i].secondary && !app.prevSecondary[i]) {
        if (app.slots[i] === "human") app.slots[i] = "bot";
        else app.slots[i] = app.slots[i] === "bot" ? "off" : "bot";
      }
    }
    if (tapped("Enter", just) || startEdge) beginMatch();
    if (tapped("Escape", just)) activate("title");
  } else if (app.screen === "game" && app.match && app.match.phase !== "match_end") {
    if (startEdge || tapped("Escape", just)) app.screen = "pause";
  } else if (app.screen === "pause") {
    if (startEdge || tapped("Escape", just)) app.screen = "game";
    else {
      if (up || (padY < 0 && app.navCool === 0)) {
        moveMenu(-1, 3);
        app.navCool = padY ? 0.22 : 0;
      } else if (downEdge || (padY > 0 && app.navCool === 0)) {
        moveMenu(1, 3);
        app.navCool = padY ? 0.22 : 0;
      }
      if (confirm) menuConfirm();
    }
  } else if (app.screen === "settings") {
    const rows = settingRows();
    if (tapped("Escape", just)) activate("back");
    else {
      if (up || (padY < 0 && app.navCool === 0)) {
        moveMenu(-1, rows.length);
        app.navCool = padY ? 0.22 : 0;
      } else if (downEdge || (padY > 0 && app.navCool === 0)) {
        moveMenu(1, rows.length);
        app.navCool = padY ? 0.22 : 0;
      }
      if (left || (padX < 0 && app.navCool === 0)) {
        adjustSetting(-1);
        if (padX) app.navCool = 0.18;
      } else if (right || (padX > 0 && app.navCool === 0)) {
        adjustSetting(1);
        if (padX) app.navCool = 0.18;
      }
      if (confirm) menuConfirm();
    }
  } else if (app.screen === "controls") {
    if (tapped("Escape", just) && !app.remap) activate("back");
  }

  if (app.match && app.match.phase === "match_end" && app.screen === "game") {
    if (up || (padY < 0 && app.navCool === 0)) {
      moveMenu(-1, 2);
      app.navCool = padY ? 0.22 : 0;
    } else if (downEdge || (padY > 0 && app.navCool === 0)) {
      moveMenu(1, 2);
      app.navCool = padY ? 0.22 : 0;
    }
    if (confirm || tapped("Escape", just)) {
      if (tapped("Escape", just)) activate("title");
      else menuConfirm();
    }
  }

  if (tapped("KeyM", just)) {
    app.settings.muted = !app.settings.muted;
    saveSettings();
    toast(app.settings.muted ? "Muted" : "Sound on");
  }
}

window.addEventListener("keydown", (event) => {
  if (BLOCKED.has(event.code)) event.preventDefault();
  if (event.repeat) return;
  down.add(event.code);
  queued.push(event.code);
  audio.resume();
  if (app.screen === "controls" && app.remap) {
    swallowFrame = true;
    if (event.code === "Escape") {
      app.remap = null;
      return;
    }
    const ignore = ["Tab", "MetaLeft", "MetaRight", "AltLeft", "AltRight", "ShiftLeft", "ShiftRight", "ControlLeft", "ControlRight"];
    if (ignore.includes(event.code)) return;
    for (let player = 0; player < 4; player++) {
      for (const field of FIELDS) {
        const same = player === app.remap.player && field === app.remap.field;
        if (!same && app.settings.bindings[player][field] === event.code) {
          toast("That key is already used");
          return;
        }
      }
    }
    app.settings.bindings[app.remap.player][app.remap.field] = event.code;
    app.remap = null;
    saveSettings();
  }
});

window.addEventListener("keyup", (event) => {
  down.delete(event.code);
});

window.addEventListener("blur", () => {
  down.clear();
});

canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  audio.resume();
  const point = pointer(event);
  const boxes = app.hitboxes || [];
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i];
    if (point.x >= box.x && point.x <= box.x + box.w && point.y >= box.y && point.y <= box.y + box.h) {
      activate(box.id);
      break;
    }
  }
});

window.addEventListener("resize", resize);
window.addEventListener("gamepadconnected", (event) => {
  notice(`Pad ${event.gamepad.index + 1} connected`);
});
window.addEventListener("gamepaddisconnected", (event) => {
  notice(`Pad ${event.gamepad.index + 1} unplugged`);
});

app.prevAction = [false, false, false, false];
app.prevSecondary = [false, false, false, false];

if (autoplay) {
  app.slots = ["bot", "bot", "bot", "bot"];
  beginMatch();
}

let last = 0;
let acc = 0;

function frame(now) {
  if (!last) last = now;
  let delta = now - last;
  last = now;
  if (delta > 80) delta = 80;
  acc += delta;
  const dt = delta / 1000;
  resize();
  pollPads();
  const just = new Set(queued.splice(0, queued.length));
  const virtualDown = new Set(down);
  for (const code of just) virtualDown.add(code);
  const resolved = resolveInputs(virtualDown, app.pads, app.settings.bindings);
  const startEdge = startHeld() && !prevStart;
  updateFrame(dt, resolved, startEdge, just);
  let guard = 0;
  while (acc >= STEP_MS && guard < 5) {
    acc -= STEP_MS;
    guard += 1;
    simTick(resolved);
  }
  audio.setVolume(app.settings.volume, app.settings.muted);
  audio.pump();
  const picture = view();
  render(ctx, picture);
  app.hitboxes = picture.hitboxes;
  prevStart = startHeld();
  prevButtons = [0, 1, 2, 3].map((index) => buttonHeld(index));
  app.prevAction = resolved.players.map((input) => input.action);
  app.prevSecondary = resolved.players.map((input) => input.secondary);
  prev.clear();
  for (const code of down) prev.add(code);
  swallowFrame = false;

  const snap = snapshot(app.match);
  window.__FLOE__ = {
    ready: true,
    screen: app.screen,
    autoplay,
    snapshot: snap,
    errors: window.__FLOE_ERRORS__.slice(),
    slots: app.slots.slice(),
    frames: (window.__FLOE__ && window.__FLOE__.frames ? window.__FLOE__.frames : 0) + 1,
  };
  requestAnimationFrame(frame);
}

resize();
canvas.focus();
requestAnimationFrame(frame);
