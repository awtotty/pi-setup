# Pi Setup

Portable Pi agent configuration for new machines/VMs. Requires Node.js **22.19.0 or newer**, npm, and an installed Pi CLI.

## Extension profile

The shared profile installs:

- `pi-subagents` — subagents and delegation
- `pi-powerline-footer` — terminal status UI
- `pi-web-access` — web search and content fetching
- `pi-notify` — terminal/desktop completion notifications
- `pi-usage-meters` — `/usage` subscription quota meters and reset times

Built-in Pi MCP support stays enabled. The old pi-missions path and removed extension packages are no longer part of this profile.

## Portable files

This repo stores:

- `pi-agent/settings.json`
- `pi-agent/package.json` and `pi-agent/package-lock.json` for extension npm dependencies
- `pi-agent/skills/` custom user skills
- `pi-agent/prompts/` custom prompt templates, if any
- `pi-agent/extensions/` custom user extensions, if any

It intentionally does **not** store secrets or runtime state:

- Pi provider credentials (`~/.pi/agent/auth.json`)
- Sessions and run history
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

The script snapshots settings, npm manifests/lockfile, skills, prompt templates, and local extensions.

Review settings and custom files for secrets before committing.

## Install on a new VM

Clone this repo, then run:

```bash
./scripts/install-to-local.sh
```

The installer backs up existing Pi files before replacing them. Skills, prompts, and local extensions are replaced rather than merged; resources absent from the repo are removed from the active directories (including when the repo directory is missing).

This only manages resources under `PI_CODING_AGENT_DIR`. Pi also discovers shared skills from `~/.agents/skills`, project resources, and resources supplied by configured packages. Those are not deleted by this installer, so this profile does not define an exclusive list of every skill or command visible in Pi.

With the committed lockfile, it runs `npm ci --legacy-peer-deps` to reproduce the extension dependencies without installing Pi's host-provided peer packages. Without a lockfile it falls back to `npm install --legacy-peer-deps`.

Authenticate providers separately, then start Pi or run `/reload` in an existing Pi session. Other applications embedding Pi, such as pi-telegram-bot, need to be restarted separately to load the profile.

### Path overrides

Both scripts support `PI_CODING_AGENT_DIR`, which defaults to `~/.pi/agent`.

These scripts do not configure tmux.

## Tests

Run the setup-script tests with isolated temporary homes and a fake npm executable (no network installs or changes to your live Pi profile):

```bash
node --test tests/setup.test.mjs
```
