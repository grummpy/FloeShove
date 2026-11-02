# Floe Shove

![Floe Shove](assets/cover.jpg)

Walrus sumo on drifting ice. Four locals share one screen, slide with real momentum, and belly-shove each other toward the cracks. Floes give out under the weight. Last walrus still on the ice takes the round. First to three rounds takes the match.

## Launch

The game is plain HTML, canvas, and JavaScript. A tiny Python server hosts it (ES modules need HTTP) and opens your browser. The default port is **8812**. If that port is busy, the server tries the next ones.

| Platform | How |
| --- | --- |
| macOS | Double-click `launch-mac.command` |
| Windows | Double-click `launch-windows.bat` |
| Linux | `./launch-linux.sh` |
| Already have a server | Open `index.html` from any static host |

Python 3 is required. If it is missing, the launcher says so and points at [python.org](https://www.python.org/downloads/).

```bash
python3 server.py
```

Add `--no-browser` to skip opening a window, or `--port 9000` to start the search at another port.

`?autoplay=1` skips the menus and starts a four-CPU exhibition. Useful for a quick look, and for the headless playthrough.

## Controls

Keyboard works with no gamepads. On a gamepad, pads 0–3 are P1–P4: left stick or D-pad to move, **A** belly-shove, **B** brace, **Start** pause. A connected pad overrides that player's keys until it is unplugged. Icons on the HUD light up as pads connect and disconnect.

| Player | Move | Shove (action) | Brace (secondary) |
| --- | --- | --- | --- |
| P1 | W A S D | F | G |
| P2 | Arrow keys | / | . |
| P3 | I J K L | ; | ' |
| P4 | Numpad 8 4 5 6 | Numpad 0 | Numpad Enter |

P4 uses 8 up, 4 left, 5 down, 6 right. Turn Num Lock on so the numpad sends those keys.

Hold shove to charge, up to one second, then release. A longer charge hits harder. Brace plants you: you barely slide, and shoves barely move you, but you cannot walk. **M** mutes. **Esc** pauses.

Open Settings from the join screen or the pause menu to change volume, rounds to win (1, 3, or 5), and every binding. Remaps are stored in `localStorage`.

Empty join slots stay CPU unless you toggle them off. One human can play against three bots. At least two walruses are required to start.

## Rules

- The sea holds 6 to 10 ice floes that drift and bounce.
- Walruses slide. Low friction, so you keep your momentum.
- Step off toward a floe that is close enough and you hop. Step off into open water and you are out for the round.
- Each floe has a crack meter. It fills while walruses stand on it, faster as more of them pile on, and shatters at full. Everyone still on it splashes out.
- A fish sometimes washes up. Grab it and your shoves hit harder for a few seconds.
- New small floes drift in from the edges.
- After 60 seconds the round goes sudden death and every floe starts to shrink.
- Last walrus on the ice scores the round. If the last ones drop together, the round is a draw.
- First to the round target (3 by default) wins the match. Standings stay up for a rematch.

## Arcade manifest

`arcade.json` describes the cabinet: name, id `floeshove`, cover, icon, four players, port 8812, keyboard and gamepad, and the one-click launchers plus `index.html`.

## Tests

No install step. Node's built-in test runner covers the simulation; Python covers the server.

```bash
node --test tests/*.test.js
python3 -m unittest tests/test_server.py
```

Core rules, physics, scoring, the fish, bots, seeded randomness, and both keyboard and gamepad mapping are headless. The same seed replays the same match. GitHub Actions runs both commands.

## License

MIT. See [LICENSE](LICENSE).
