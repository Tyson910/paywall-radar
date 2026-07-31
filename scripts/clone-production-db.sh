#!/usr/bin/env bash
set -euo pipefail

project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
env_file="$project_root/.env"
timestamp=$(date -u +%Y%m%dT%H%M%S)
relative_output=${1:-"data/production-snapshots/paywall-radar-$timestamp.db"}

if [[ ! -f "$env_file" ]]; then
  echo "Missing $env_file" >&2
  exit 1
fi

if [[ "$relative_output" = /* || "$relative_output" = *".."* ]]; then
  echo "Output path must stay within the project." >&2
  exit 1
fi

output="$project_root/$relative_output"
output_directory=$(dirname -- "$output")
output_file=$(basename -- "$output")

if [[ -e "$output" || -e "$output-wal" || -e "$output-shm" ]]; then
  echo "Refusing to overwrite existing database files at $output" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop or OrbStack and try again." >&2
  exit 1
fi

clone_env=$(mktemp)
trap 'rm -f "$clone_env"' EXIT
grep -E '^(AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|AWS_REGION|LITESTREAM_REPLICA_URL)=' \
  "$env_file" >"$clone_env"

mkdir -p "$output_directory"

docker build --target clone-db -t paywall-radar-db-clone "$project_root"

if ! docker run --rm \
  --user "$(id -u):$(id -g)" \
  --env-file "$clone_env" \
  -e "OUTPUT_FILE=$output_file" \
  -v "$output_directory:/backup" \
  paywall-radar-db-clone; then
  rm -f "$output" "$output-wal" "$output-shm"
  exit 1
fi

echo "Production database restored to $relative_output"
