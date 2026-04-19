#!/bin/bash
cd /home/z/my-project
while true; do
  NODE_OPTIONS="--max-old-space-size=1024" node node_modules/.bin/next dev --turbopack -p 3000 2>&1 | tee -a /home/z/my-project/dev.log
  echo "[$(date)] Server died, restarting in 2s..." >> /home/z/my-project/dev.log
  sleep 2
done
