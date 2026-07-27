#!/bin/bash
#
# Double-click this file in Finder to start the Notetaker app.
# It installs dependencies on first run, starts the dev server, and
# opens your browser to whichever port Next.js actually binds to.

cd "$(dirname "$0")" || exit 1

# Keep the window open long enough to read any error before it closes.
fail() {
  echo ""
  echo "ERROR: $1"
  echo ""
  read -r -p "Press Enter to close..."
  exit 1
}

# Find npm — covers Homebrew (Apple Silicon & Intel), nvm, and anything
# already on PATH.
NPM="$(command -v npm 2>/dev/null)"
if [ -z "$NPM" ]; then
  for candidate in \
    "/opt/homebrew/bin/npm" \
    "/usr/local/bin/npm" \
    "$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin/npm"
  do
    if [ -x "$candidate" ]; then
      NPM="$candidate"
      break
    fi
  done
fi
[ -z "$NPM" ] && fail "npm not found. Install Node.js 18+ from https://nodejs.org, then try again."

# Already running? Just open the browser.
for port in 3000 3001 3002; do
  if curl -s --max-time 1 "http://localhost:$port" > /dev/null 2>&1; then
    echo "Notetaker is already running on port $port — opening browser..."
    open "http://localhost:$port"
    exit 0
  fi
done

# First run, or after a git pull that changed dependencies.
if [ ! -d node_modules ]; then
  echo "Installing dependencies — this only happens once, give it a minute..."
  "$NPM" install || fail "npm install failed. Scroll up for details."
  echo ""
fi

echo "Starting Notetaker..."
LOG="/tmp/notetaker-dev.log"
rm -f "$LOG"
"$NPM" run dev > "$LOG" 2>&1 &
SERVER_PID=$!

# Stop the server when this window closes or Ctrl-C is pressed.
trap 'echo ""; echo "Stopping Notetaker..."; kill $SERVER_PID 2>/dev/null' EXIT INT TERM

# Wait for the server, reading the real port from Next.js's own output
# (it falls back to 3001+ when 3000 is already taken).
echo "Waiting for the server to come up..."
URL=""
for _ in $(seq 1 60); do
  # Bail out early if the server died during startup.
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    cat "$LOG"
    fail "The server stopped unexpectedly. See the output above."
  fi
  URL="$(grep -Eo 'http://localhost:[0-9]+' "$LOG" 2>/dev/null | head -1)"
  [ -n "$URL" ] && break
  sleep 1
done

if [ -z "$URL" ]; then
  echo ""
  cat "$LOG"
  fail "Server did not start within 60 seconds. See the output above."
fi

# Give Next a moment to finish compiling the first page.
for _ in $(seq 1 30); do
  curl -s --max-time 1 "$URL" > /dev/null 2>&1 && break
  sleep 1
done

open "$URL"
echo ""
echo "Notetaker is running at $URL"
echo "Leave this window open while you use the app."
echo "Closing this window (or pressing Ctrl-C) stops the server."
echo ""

wait $SERVER_PID
