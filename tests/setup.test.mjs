import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedPackages = ['pi-notify', 'pi-powerline-footer', 'pi-subagents', 'pi-web-access'];
const readJSON = path => JSON.parse(readFileSync(path, 'utf8'));
const writeJSON = (path, value) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pi-setup-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const repo = join(dir, 'repo');
  const home = join(dir, 'home');
  const agent = join(home, '.pi', 'agent');
  for (const path of ['scripts', 'pi-agent']) cpSync(join(root, path), join(repo, path), { recursive: true });
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  // Avoid real package installs in tests, while recording the exact invocation.
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$NPM_CALLS"\n', { mode: 0o755 });
  const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: agent, PATH: `${bin}:${process.env.PATH}`, NPM_CALLS: join(dir, 'npm-calls') };
  const run = script => execFileSync('bash', [join(repo, 'scripts', script)], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { dir, repo, home, agent, env, run };
}

test('settings, manifest, and lockfile agree on the four extension packages', () => {
  const settings = readJSON(join(root, 'pi-agent', 'settings.json'));
  const manifest = readJSON(join(root, 'pi-agent', 'package.json'));
  const lock = readJSON(join(root, 'pi-agent', 'package-lock.json'));
  assert.deepEqual(settings.packages.map(source => source.replace(/^npm:/, '')).sort(), expectedPackages);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), expectedPackages);
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  for (const name of expectedPackages) assert.ok(lock.packages[`node_modules/${name}`]?.integrity);
});

test('installer copies the profile, backs up existing settings, and preserves auth', t => {
  const f = fixture(t);
  const existing = { packages: ['npm:old-package'] };
  writeJSON(join(f.agent, 'settings.json'), existing);
  writeJSON(join(f.agent, 'auth.json'), { provider: { apiKey: 'fake-test-secret' } });
  f.run('install-to-local.sh');
  assert.deepEqual(readJSON(join(f.agent, 'settings.json')), readJSON(join(f.repo, 'pi-agent', 'settings.json')));
  const backup = readdirSync(f.agent).find(name => name.startsWith('settings.json.bak-'));
  assert.ok(backup);
  assert.deepEqual(readJSON(join(f.agent, backup)), existing);
  assert.deepEqual(readJSON(join(f.agent, 'auth.json')), { provider: { apiKey: 'fake-test-secret' } });
  assert.equal(readFileSync(f.env.NPM_CALLS, 'utf8').trim(), 'ci --legacy-peer-deps');
});

test('sync snapshots the profile and custom resources without credentials or databases', t => {
  const f = fixture(t);
  f.run('install-to-local.sh');
  writeJSON(join(f.agent, 'auth.json'), { provider: { apiKey: 'fake-test-secret' } });
  mkdirSync(join(f.agent, 'skills', 'test-skill'), { recursive: true });
  writeFileSync(join(f.agent, 'skills', 'test-skill', 'SKILL.md'), '# Test skill\n');
  writeFileSync(join(f.agent, 'skills', 'test-skill', 'cache.db'), 'runtime state');
  writeFileSync(join(f.agent, 'extensions', 'test.js'), 'export default function () {}\n');
  f.run('sync-from-local.sh');
  for (const name of ['package.json', 'package-lock.json']) {
    assert.equal(readFileSync(join(f.repo, 'pi-agent', name), 'utf8'), readFileSync(join(f.agent, 'npm', name), 'utf8'));
  }
  assert.deepEqual(readJSON(join(f.repo, 'pi-agent', 'settings.json')), readJSON(join(f.agent, 'settings.json')));
  assert.ok(existsSync(join(f.repo, 'pi-agent', 'skills', 'test-skill', 'SKILL.md')));
  assert.ok(existsSync(join(f.repo, 'pi-agent', 'extensions', 'test.js')));
  assert.equal(existsSync(join(f.repo, 'pi-agent', 'skills', 'test-skill', 'cache.db')), false);
  assert.equal(existsSync(join(f.repo, 'pi-agent', 'auth.json')), false);
});

test('installer replaces skills and prompts, preserving stale resources only in backups', t => {
  const f = fixture(t);
  for (const resource of ['skills', 'prompts']) {
    mkdirSync(join(f.agent, resource), { recursive: true });
    writeFileSync(join(f.agent, resource, 'stale.md'), 'old resource');
    mkdirSync(join(f.repo, 'pi-agent', resource), { recursive: true });
    writeFileSync(join(f.repo, 'pi-agent', resource, 'current.md'), 'current resource');
  }
  f.run('install-to-local.sh');
  for (const resource of ['skills', 'prompts']) {
    assert.equal(existsSync(join(f.agent, resource, 'stale.md')), false);
    assert.equal(readFileSync(join(f.agent, resource, 'current.md'), 'utf8'), 'current resource');
    const backup = readdirSync(f.agent).find(name => name.startsWith(`${resource}.bak-`));
    assert.ok(backup);
    assert.equal(readFileSync(join(f.agent, backup, 'stale.md'), 'utf8'), 'old resource');
  }
});

test('installer clears local prompts when the repo has no prompts directory', t => {
  const f = fixture(t);
  rmSync(join(f.repo, 'pi-agent', 'prompts'), { recursive: true, force: true });
  mkdirSync(join(f.agent, 'prompts'), { recursive: true });
  writeFileSync(join(f.agent, 'prompts', 'stale.md'), 'old prompt');
  f.run('install-to-local.sh');
  assert.deepEqual(readdirSync(join(f.agent, 'prompts')), []);
});

test('sync mirrors prompts and removes deleted templates', t => {
  const f = fixture(t);
  mkdirSync(join(f.agent, 'prompts'), { recursive: true });
  writeFileSync(join(f.agent, 'prompts', 'current.md'), 'current prompt');
  mkdirSync(join(f.repo, 'pi-agent', 'prompts'), { recursive: true });
  writeFileSync(join(f.repo, 'pi-agent', 'prompts', 'stale.md'), 'old prompt');
  f.run('sync-from-local.sh');
  assert.deepEqual(readdirSync(join(f.repo, 'pi-agent', 'prompts')), ['current.md']);
  assert.equal(readFileSync(join(f.repo, 'pi-agent', 'prompts', 'current.md'), 'utf8'), 'current prompt');
  rmSync(join(f.agent, 'prompts'), { recursive: true });
  f.run('sync-from-local.sh');
  assert.deepEqual(readdirSync(join(f.repo, 'pi-agent', 'prompts')), []);
});

test('installer falls back to npm install when no lockfile is provided', t => {
  const f = fixture(t);
  rmSync(join(f.repo, 'pi-agent', 'package-lock.json'));
  f.run('install-to-local.sh');
  assert.equal(readFileSync(f.env.NPM_CALLS, 'utf8').trim(), 'install --legacy-peer-deps');
});
