#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

mkdir -p "$PI_AGENT_DIR" "$PI_AGENT_DIR/npm" "$PI_AGENT_DIR/skills"

# Back up existing portable config if present.
ts="$(date +%Y%m%d-%H%M%S)"
for path in settings.json npm/package.json skills; do
  if [[ -e "$PI_AGENT_DIR/$path" ]]; then
    cp -a "$PI_AGENT_DIR/$path" "$PI_AGENT_DIR/$path.bak-$ts"
  fi
done

cp "$ROOT/pi-agent/settings.json" "$PI_AGENT_DIR/settings.json"
cp "$ROOT/pi-agent/package.json" "$PI_AGENT_DIR/npm/package.json"
rsync -a --delete "$ROOT/pi-agent/skills/" "$PI_AGENT_DIR/skills/"

# Install extension dependencies if npm is available.
if command -v npm >/dev/null 2>&1; then
  (cd "$PI_AGENT_DIR/npm" && npm install)
else
  echo "npm not found; skipping Pi extension dependency install" >&2
fi

cat <<EOF
Pi config installed to: $PI_AGENT_DIR

Next steps:
  - Authenticate providers normally; auth.json is intentionally not copied.
  - If settings.json references /workspace/pi-missions, ensure that repo exists or remove that package entry.
EOF
