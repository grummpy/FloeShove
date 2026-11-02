#!/usr/bin/env python3
"""Smoke test: server.py serves the game and falls forward when the port is taken."""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import unittest
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERVER = os.path.join(ROOT, "server.py")


def read_listening(proc, timeout=5):
    box = {}

    def target():
        box["line"] = proc.stdout.readline()

    import threading

    thread = threading.Thread(target=target)
    thread.start()
    thread.join(timeout)
    if thread.is_alive():
        proc.kill()
        raise AssertionError("server did not print LISTENING")
    return box.get("line", "")


class ServerSmokeTest(unittest.TestCase):
    def test_serves_game_files(self):
        proc = subprocess.Popen(
            [sys.executable, "-u", SERVER, "--port", "8944", "--no-browser"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        try:
            line = read_listening(proc)
            self.assertIn("LISTENING", line)
            base = line.strip().split()[-1]
            self.assertTrue(base.endswith("/"))
            with urllib.request.urlopen(base, timeout=5) as response:
                body = response.read().decode()
                status = response.status
            self.assertEqual(status, 200)
            self.assertIn("Floe Shove", body)
            self.assertIn("src/ui/main.js", body)
            for path in ("src/core/sim.js", "src/ui/main.js", "arcade.json", "assets/icon.jpg", "styles.css"):
                with urllib.request.urlopen(base + path, timeout=5) as response:
                    payload = response.read()
                    self.assertEqual(response.status, 200, path)
                    self.assertGreater(len(payload), 10, path)
            with urllib.request.urlopen(base + "src/core/sim.js", timeout=5) as response:
                self.assertIn(b"export function createMatch", response.read())
        finally:
            if proc.stdout:
                proc.stdout.close()
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()

    def test_port_fallback(self):
        blocker = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        blocker.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            blocker.bind(("127.0.0.1", 8812))
        except OSError:
            blocker.close()
            self.skipTest("port 8812 is already in use")
        blocker.listen(1)
        proc = subprocess.Popen(
            [sys.executable, "-u", SERVER, "--port", "8812", "--no-browser"],
            cwd=ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
        )
        try:
            line = read_listening(proc)
            self.assertIn("LISTENING", line)
            self.assertNotIn("127.0.0.1:8812/", line)
            self.assertIn("127.0.0.1:8813/", line)
            with urllib.request.urlopen(line.strip().split()[-1], timeout=5) as response:
                self.assertEqual(response.status, 200)
        finally:
            if proc.stdout:
                proc.stdout.close()
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
            blocker.close()


if __name__ == "__main__":
    unittest.main()
