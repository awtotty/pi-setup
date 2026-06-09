# Pi Setup

Portable Pi agent configuration for new machines/VMs.

This repo intentionally stores only portable config:

- `pi-agent/settings.json`
- `pi-agent/package.json` / `package-lock.json` for Pi extension npm dependencies
- `pi-agent/skills/` custom user skills
- `pi-agent/extensions/` custom user extensions

It intentionally does **not** store secrets or runtime state:

- `~/.pi/agent/auth.json`
- `~/.pi/agent/sessions/`
- `~/.pi/agent/run-history.jsonl`
- `~/.pi/context-mode/` databases
- `~/.pi/missions/` runtime state
- `~/.pi/agent/bin/`
- `~/.pi/agent/git/`
- `node_modules/`

## Sync from the current machine

After adding/removing Pi extensions or skills locally:

```bash
./scripts/sync-from-local.sh
git status
git diff
git add .
git commit -m "Update Pi setup"
```

## Install on a new VM

Clone this repo, then run:

```bash
./scripts/install-to-local.sh
```

Then authenticate providers normally on the new machine as needed.

## Notes

Your current `settings.json` includes this package entry:

```json
"../../../../workspace/pi-missions"
```

That path is only valid if `/workspace/pi-missions` exists relative to `~/.pi/agent/npm`. On a fresh VM you either need to clone `pi-missions` to `/workspace/pi-missions`, remove that package entry, or replace it with a package/source that is available on the VM.
