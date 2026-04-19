#!/bin/bash
while true; do
  if ! curl -s http://127.0.0.1:3000/ > /dev/null 2>&1; then
    cd /home/z/my-project
    pkill -f "next dev" 2>/dev/null
    sleep 2
    bun run dev >> /home/z/my-project/dev.log 2>&1 &
    for i in $(seq 1 15); do
      if curl -s http://127.0.0.1:3000/ > /dev/null 2>&1; then
        break
      fi
      sleep 1
    done
  fi
  sleep 5
  curl -s http://127.0.0.1:3000/ > /dev/null 2>&1
done
