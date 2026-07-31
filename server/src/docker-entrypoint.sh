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

# Reset stale Litestream state during entrypoint execution
if [ -n "$LITESTREAM_REPLICA_URL" ]; then
  LS_DIR="/app/data/.paywall-radar.db-litestream"
  if [ -d "$LS_DIR" ] && [ ! -f "$LS_DIR/ltx/0/0000000000000001-0000000000000001.ltx" ]; then
    echo "Litestream state is stale, resetting..."
    rm -rf "$LS_DIR"
  fi
  run_as_appuser /usr/local/bin/litestream replicate -config /etc/litestream.yml
else
  run_as_appuser node /app/dist/server/index.js
fi
