#!/usr/bin/env bash
# One-click launcher for Floe Shove on macOS. Double-click in Finder.
cd "$(dirname "$0")" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is required to launch Floe Shove."
  echo "Install it from https://www.python.org/downloads/ and try again."
  exit 1
fi
exec python3 server.py
