# Pi Setup

Portable Pi agent configuration for new machines/VMs. Requires Node.js **22.19.0 or newer**, npm, and an installed Pi CLI.

## Extension profile

The shared profile installs:

- `pi-subagents` — subagents and delegation
- `pi-powerline-footer` — terminal status UI
- `pi-web-access` — web search and content fetching
- `billion-context` — context compression
- `pi-notify` — terminal/desktop completion notifications

Billion-context's own subagents are disabled with `pi.subagents: false`, so `pi-subagents` remains the sole subagent implementation. Built-in Pi MCP support stays enabled. The old pi-missions path and removed extension packages are no longer part of this profile.

## Portable files

This repo stores:

- `pi-agent/settings.json`
- `pi-agent/package.json` and `pi-agent/package-lock.json` for extension npm dependencies
- `pi-agent/skills/` custom user skills
- `pi-agent/extensions/` custom user extensions, if any
- `billion-context/billion-context.json` — only the portable `pi.subagents` preference

It intentionally does **not** store secrets or runtime state:

- Pi provider credentials (`~/.pi/agent/auth.json`)
- Sessions and run history
- Billion-context provider credentials, proxy configuration, or compression state
- Databases, downloaded binaries, package git checkouts, or `node_modules/`

## Sync from the current machine

After adding/removing Pi extensions or skills locally:

```bash
./scripts/sync-from-local.sh
git status
git diff
git add .
git commit -m "Update Pi setup"
```

The script snapshots settings, npm manifests/lockfile, skills, and local extensions. It exports **only** `pi.subagents` from billion-context; other billion-context keys are never copied into the repo. If that preference or its source file is absent, the existing portable billion-context config is kept.

Review settings and custom files for secrets before committing.

## Install on a new VM

Clone this repo, then run:

```bash
./scripts/install-to-local.sh
```

The installer backs up existing Pi files before replacing them. With the committed lockfile, it runs `npm ci --legacy-peer-deps` to reproduce the extension dependencies without installing Pi's host-provided peer packages. Without a lockfile it falls back to `npm install --legacy-peer-deps`.

For billion-context, it backs up an existing config and **merges only** `pi.subagents`, preserving any existing providers, credentials, and other settings. On a fresh machine it creates the minimal config. Authenticate providers separately, then start Pi or run `/reload` in an existing Pi session. Other applications embedding Pi, such as pi-telegram-bot, need to be restarted separately to load the profile.

### Path overrides

Both scripts support:

- `PI_CODING_AGENT_DIR` — defaults to `~/.pi/agent`
- `BILI_CONFIG_FILE` — defaults to `~/.config/billion-context/billion-context.json`

These scripts do not configure tmux.

## Tests

Run the setup-script tests with isolated temporary homes and a fake npm executable (no network installs or changes to your live Pi profile):

```bash
node --test tests/setup.test.mjs
```
