import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("arcade.json is valid and points at real files", () => {
  const manifest = JSON.parse(readFileSync(join(root, "arcade.json"), "utf8"));
  assert.equal(manifest.name, "Floe Shove");
  assert.equal(manifest.id, "floeshove");
  assert.equal(manifest.players, 4);
  assert.equal(manifest.minPlayers, 1);
  assert.equal(manifest.port, 8812);
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.input, ["keyboard", "gamepad"]);
  assert.equal(manifest.launch.web, "index.html");
  for (const relative of [
    manifest.icon,
    manifest.cover,
    manifest.launch.web,
    manifest.launch.linux.replace(/^\.\//, ""),
    manifest.launch.mac.replace(/^\.\//, ""),
    manifest.launch.windows,
  ]) {
    const path = join(root, relative);
    assert.ok(existsSync(path), relative);
    assert.ok(statSync(path).size > 0, relative);
  }
  const index = readFileSync(join(root, "index.html"), "utf8");
  assert.match(index, /Floe Shove/);
  assert.match(index, /src\/ui\/main\.js/);
  assert.match(index, /<canvas/);
  for (const script of ["launch-linux.sh", "launch-mac.command", "launch-windows.bat"]) {
    const text = readFileSync(join(root, script), "utf8");
    assert.match(text, /server\.py/);
    assert.match(text, /Python 3/);
  }
  if (process.platform !== "win32") {
    assert.ok(statSync(join(root, "launch-linux.sh")).mode & 0o111);
    assert.ok(statSync(join(root, "launch-mac.command")).mode & 0o111);
  }
});
