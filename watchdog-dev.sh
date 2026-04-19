#!/bin/bash
cd /home/z/my-project
LOG=/home/z/my-project/dev.log
while true; do
  if ! pgrep -f "next dev" > /dev/null 2>&1; then
    echo "$(date): Starting dev server..." >> $LOG
    node --max-old-space-size=2048 ./node_modules/.bin/next dev --turbopack -p 3000 >> $LOG 2>&1 &
    SERVER_PID=$!
    disown $SERVER_PID
    sleep 5
  else
    sleep 2
  fi
done
