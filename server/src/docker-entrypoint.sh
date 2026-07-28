#!/bin/sh
set -e

if [ -n "$LITESTREAM_REPLICA_URL" ]; then
  exec /usr/local/bin/litestream replicate -config /etc/litestream.yml
else
  exec node /app/dist/server/index.js
fi
