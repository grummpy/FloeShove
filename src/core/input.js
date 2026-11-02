/** Default keyboard split. Codes are KeyboardEvent.code values. */
export const DEFAULT_BINDINGS = Object.freeze([
  Object.freeze({
    up: "KeyW",
    down: "KeyS",
    left: "KeyA",
    right: "KeyD",
    action: "KeyF",
    secondary: "KeyG",
  }),
  Object.freeze({
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    action: "Slash",
    secondary: "Period",
  }),
  Object.freeze({
    up: "KeyI",
    down: "KeyK",
    left: "KeyJ",
    right: "KeyL",
    action: "Semicolon",
    secondary: "Quote",
  }),
  Object.freeze({
    up: "Numpad8",
    down: "Numpad5",
    left: "Numpad4",
    right: "Numpad6",
    action: "Numpad0",
    secondary: "NumpadEnter",
  }),
]);

export const BINDING_FIELDS = Object.freeze([
  "up",
  "down",
  "left",
  "right",
  "action",
  "secondary",
]);

const DEADZONE = 0.22;

export function cloneBindings(bindings = DEFAULT_BINDINGS) {
  return bindings.map((b) => ({
    up: b.up,
    down: b.down,
    left: b.left,
    right: b.right,
    action: b.action,
    secondary: b.secondary,
  }));
}

export function isDown(down, code) {
  if (!down || !code) return false;
  if (typeof down.has === "function") return down.has(code);
  return !!down[code];
}

export function emptyAction() {
  return { moveX: 0, moveY: 0, action: false, secondary: false, pause: false };
}

function normalizeStick(x, y) {
  const mag = Math.hypot(x, y);
  if (mag > 1) return { x: x / mag, y: y / mag };
  return { x, y };
}

export function keyboardPlayer(down, binding) {
  let x = 0;
  let y = 0;
  if (isDown(down, binding.left)) x -= 1;
  if (isDown(down, binding.right)) x += 1;
  if (isDown(down, binding.up)) y -= 1;
  if (isDown(down, binding.down)) y += 1;
  const stick = normalizeStick(x, y);
  return {
    moveX: stick.x,
    moveY: stick.y,
    action: isDown(down, binding.action),
    secondary: isDown(down, binding.secondary),
    pause: false,
  };
}

function buttonPressed(pad, index) {
  const buttons = pad && pad.buttons;
  if (!buttons) return false;
  const button = buttons[index];
  if (!button) return false;
  if (typeof button === "boolean") return button;
  if (typeof button === "number") return button > 0.5;
  return !!(button.pressed || (button.value || 0) > 0.5);
}

/** Standard Gamepad mapping: stick / d-pad, A (0), B (1), Start (9). */
export function gamepadPlayer(pad) {
  if (!pad || !pad.connected) return emptyAction();
  const axes = pad.axes || [];
  let x = Number(axes[0]) || 0;
  let y = Number(axes[1]) || 0;
  if (Math.hypot(x, y) < DEADZONE) {
    x = 0;
    y = 0;
  }
  if (buttonPressed(pad, 14)) x -= 1;
  if (buttonPressed(pad, 15)) x += 1;
  if (buttonPressed(pad, 12)) y -= 1;
  if (buttonPressed(pad, 13)) y += 1;
  const stick = normalizeStick(x, y);
  return {
    moveX: stick.x,
    moveY: stick.y,
    action: buttonPressed(pad, 0),
    secondary: buttonPressed(pad, 1),
    pause: buttonPressed(pad, 9),
  };
}

/**
 * Pads 0-3 override that player's keyboard while connected.
 * Escape or any Start button raises pause.
 */
export function resolveInputs(down, pads, bindings = DEFAULT_BINDINGS) {
  const useBindings = bindings && bindings.length === 4 ? bindings : DEFAULT_BINDINGS;
  const players = [0, 1, 2, 3].map((i) => {
    const pad = pads && pads[i];
    if (pad && pad.connected) return gamepadPlayer(pad);
    return keyboardPlayer(down, useBindings[i]);
  });
  const pause =
    isDown(down, "Escape") || players.some((p) => p.pause) ||
    [0, 1, 2, 3].some((i) => pads && pads[i] && pads[i].connected && buttonPressed(pads[i], 9));
  return { players, pause };
}

const KEY_LABELS = {
  Slash: "/",
  Period: ".",
  Semicolon: ";",
  Quote: "'",
  Space: "Space",
  Escape: "Esc",
  Enter: "Enter",
  NumpadEnter: "Num Enter",
  NumpadAdd: "Num +",
  NumpadDecimal: "Num .",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
};

export function keyLabel(code) {
  if (!code) return "?";
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}
