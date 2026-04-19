#!/bin/bash
while true; do
  if ! pgrep -f "next dev" > /dev/null; then
    echo "[$(date)] Restarting Next.js..." >> dev.log
    npx next dev --turbopack >> dev.log 2>&1 &
    sleep 8
  fi
  sleep 5
done
