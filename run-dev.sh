#!/bin/bash
cd /home/z/my-project
while true; do
  echo "[$(date)] Starting Next.js..." >> dev.log
  bun run dev >> dev.log 2>&1 &
  SERVER_PID=$!
  
  # Wait for server to be ready
  for i in $(seq 1 20); do
    if curl -s http://127.0.0.1:3000/ > /dev/null 2>&1; then
      echo "[$(date)] Server ready (PID=$SERVER_PID)" >> dev.log
      break
    fi
    sleep 1
  done
  
  # Keep alive by pinging and watching
  while true; do
    sleep 5
    if ! kill -0 $SERVER_PID 2>/dev/null; then
      echo "[$(date)] Server PID=$SERVER_PID died" >> dev.log
      break
    fi
    # Ping to keep process active
    curl -s http://127.0.0.1:3000/ > /dev/null 2>&1
  done
  
  sleep 2
done
