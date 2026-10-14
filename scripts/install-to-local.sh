#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"
ts="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$PI_AGENT_DIR" "$PI_AGENT_DIR/npm" "$PI_AGENT_DIR/skills" "$PI_AGENT_DIR/extensions"

backup_path() {
  local rel="$1"
  if [[ -e "$PI_AGENT_DIR/$rel" ]]; then
    cp -a "$PI_AGENT_DIR/$rel" "$PI_AGENT_DIR/$rel.bak-$ts"
    echo "backed up $PI_AGENT_DIR/$rel"
  fi
}

backup_path settings.json
backup_path npm/package.json
backup_path npm/package-lock.json
backup_path skills
backup_path extensions

cp "$ROOT/pi-agent/settings.json" "$PI_AGENT_DIR/settings.json"
cp "$ROOT/pi-agent/package.json" "$PI_AGENT_DIR/npm/package.json"
if [[ -f "$ROOT/pi-agent/package-lock.json" ]]; then
  cp "$ROOT/pi-agent/package-lock.json" "$PI_AGENT_DIR/npm/package-lock.json"
fi
rm -rf "$PI_AGENT_DIR/skills" "$PI_AGENT_DIR/extensions"
mkdir -p "$PI_AGENT_DIR/skills" "$PI_AGENT_DIR/extensions"
if [[ -d "$ROOT/pi-agent/skills" ]]; then
  (cd "$ROOT/pi-agent/skills" && tar -cf - .) | (cd "$PI_AGENT_DIR/skills" && tar -xf -)
fi
if [[ -d "$ROOT/pi-agent/extensions" ]]; then
  (cd "$ROOT/pi-agent/extensions" && tar -cf - .) | (cd "$PI_AGENT_DIR/extensions" && tar -xf -)
fi

if command -v npm >/dev/null 2>&1; then
  if [[ -f "$PI_AGENT_DIR/npm/package-lock.json" ]]; then
    (cd "$PI_AGENT_DIR/npm" && npm ci --legacy-peer-deps)
  else
    (cd "$PI_AGENT_DIR/npm" && npm install --legacy-peer-deps)
  fi
else
  echo "npm not found; skipping extension dependency install" >&2
fi

cat <<EOF

Installed portable Pi config to $PI_AGENT_DIR.
Secrets/auth/session state were not installed from this repo.
Authenticate providers separately if needed.
EOF
