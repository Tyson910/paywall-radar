#!/bin/sh
set -e

run_as_appuser() {
  if [ "$(id -u)" -eq 0 ]; then
    exec runuser -u appuser -- "$@"
  fi

  exec "$@"
}

if [ "$(id -u)" -eq 0 ]; then
  chown -R appuser:appuser /app/data
fi

if [ -n "$LITESTREAM_REPLICA_URL" ]; then
  run_as_appuser /usr/local/bin/litestream replicate -config /etc/litestream.yml
else
  run_as_appuser node /app/dist/server/index.js
fi
