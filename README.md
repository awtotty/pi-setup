# Pi Config Setup

Portable Pi agent configuration for a new dev VM.

This repo intentionally stores only portable config:

- `pi-agent/settings.json`
- `pi-agent/package.json` for Pi extension npm dependencies
- `pi-agent/skills/` custom user skills

It intentionally does **not** store secrets or machine/session state:

- `auth.json`
- `sessions/`
- `run-history.jsonl`
- `context-mode/` databases
- `missions/` runtime state

## Install on a new VM

Clone this repo, then run:

```bash
./scripts/install-pi-config.sh
```

Then authenticate providers normally on the new machine as needed.

## Notes

Your current `settings.json` includes this package entry:

```json
"../../../../workspace/pi-missions"
```

That path is only valid if `/workspace/pi-missions` exists relative to `~/.pi/agent/npm`. On a fresh VM you either need to clone `pi-missions` to `/workspace/pi-missions`, remove that package entry, or replace it with a package/source that is available on the VM.
