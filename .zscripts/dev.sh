#!/bin/bash
cd /home/z/my-project
echo "[DEV] Starting Next.js development server..."

# Kill any existing process on port 3000 first
pkill -f "next dev" 2>/dev/null || true
fuser -k 3000/tcp 2>/dev/null || true
sleep 2

# Initial setup
bun install --frozen-lockfile 2>/dev/null || bun install
bun run db:push 2>/dev/null || true

# Start the dev server and keep it alive with auto-restart
while true; do
  echo "[DEV] Starting bun run dev..."
  bun run dev &
  SERVER_PID=$!

  # Wait for server to be ready
  for i in $(seq 1 30); do
    if curl -s http://127.0.0.1:3000/ > /dev/null 2>&1; then
      echo "[DEV] Next.js dev server ready on port 3000 (PID=$SERVER_PID)"
      break
    fi
    sleep 1
  done

  # Keep pinging to maintain process activity
  while true; do
    sleep 5
    if ! kill -0 $SERVER_PID 2>/dev/null; then
      echo "[DEV] Server process $SERVER_PID died"
      break
    fi
    # Ping to keep process active
    curl -s http://127.0.0.1:3000/ > /dev/null 2>&1
  done

  echo "[DEV] Server died, restarting in 3s..."
  sleep 3
done
