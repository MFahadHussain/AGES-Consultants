#!/bin/bash
# Start Next.js dev server and keep it alive
cd /home/z/my-project

# Kill any existing Next.js processes
pkill -f "next dev" 2>/dev/null
sleep 2

# Start fresh
nohup bun run dev > dev.log 2>&1 &
echo "Server PID: $!"
sleep 8

# Keep-alive loop
while true; do
  if ! pgrep -f "next dev" > /dev/null; then
    echo "[$(date)] Server died, restarting..." >> dev.log
    nohup bun run dev >> dev.log 2>&1 &
    sleep 8
  fi
  # Make a request to keep the process alive
  curl -s http://127.0.0.1:3000/ > /dev/null 2>&1
  sleep 10
done
