#!/bin/bash
cd /home/z/my-project
while true; do
  node --max-old-space-size=4096 ./node_modules/.bin/next dev --turbopack -p 3000
  echo "Server crashed at $(date), restarting in 3s..."
  sleep 3
done
