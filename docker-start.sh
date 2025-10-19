#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-3000}"

echo "[docker-start] Starting scheduler process..."
node script/scheduler.mjs &
SCHEDULER_PID=$!

cleanup() {
    echo "[docker-start] Shutting down scheduler..."
    if kill -0 "$SCHEDULER_PID" 2>/dev/null; then
        kill "$SCHEDULER_PID"
        wait "$SCHEDULER_PID" || true
    fi
}

trap cleanup INT TERM EXIT

echo "[docker-start] Launching Astro preview on port ${PORT}..."
npm run preview -- --port "${PORT}" --host 0.0.0.0
