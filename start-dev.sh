#!/bin/bash
while true; do
  cd /home/z/my-project
  NODE_OPTIONS="--max-old-space-size=2048" npx next dev --turbopack -p 3000 2>&1
  echo "Server crashed at $(date). Restarting in 3 seconds..."
  sleep 3
done
