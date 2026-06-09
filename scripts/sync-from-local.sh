#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PI_AGENT_DIR="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}"

mkdir -p "$ROOT/pi-agent/npm" "$ROOT/pi-agent/skills" "$ROOT/pi-agent/extensions"

copy_file() {
  local src="$1"
  local dst="$2"
  if [[ -f "$src" ]]; then
    cp "$src" "$dst"
    echo "synced $src -> $dst"
  else
    echo "missing $src; skipping" >&2
  fi
}

copy_dir() {
  local src="$1"
  local dst="$2"
  rm -rf "$dst"
  mkdir -p "$dst"
  if [[ -d "$src" ]]; then
    (cd "$src" && tar \
      --exclude='node_modules' \
      --exclude='.git' \
      --exclude='*.db' \
      --exclude='*.db-wal' \
      --exclude='*.db-shm' \
      --exclude='*.bak-*' \
      --exclude='find-skills' \
      -cf - .) | (cd "$dst" && tar -xf -)
    echo "synced $src -> $dst"
  else
    echo "missing $src; ensured empty $dst" >&2
  fi
}

copy_file "$PI_AGENT_DIR/settings.json" "$ROOT/pi-agent/settings.json"
copy_file "$PI_AGENT_DIR/npm/package.json" "$ROOT/pi-agent/package.json"
copy_file "$PI_AGENT_DIR/npm/package-lock.json" "$ROOT/pi-agent/package-lock.json"
copy_dir "$PI_AGENT_DIR/skills" "$ROOT/pi-agent/skills"
copy_dir "$PI_AGENT_DIR/extensions" "$ROOT/pi-agent/extensions"

cat <<EOF

Synced portable Pi config from $PI_AGENT_DIR into $ROOT.
Review before committing:
  cd $ROOT
  git status
  git diff
EOF
