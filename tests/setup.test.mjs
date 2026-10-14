import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const expectedPackages = ['billion-context', 'pi-notify', 'pi-powerline-footer', 'pi-subagents', 'pi-web-access'];
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
  const bili = join(home, '.config', 'billion-context', 'billion-context.json');
  for (const path of ['scripts', 'pi-agent', 'billion-context']) cpSync(join(root, path), join(repo, path), { recursive: true });
  const bin = join(dir, 'bin');
  mkdirSync(bin);
  // Avoid real package installs in tests, while recording the exact invocation.
  writeFileSync(join(bin, 'npm'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$NPM_CALLS"\n', { mode: 0o755 });
  const env = { ...process.env, HOME: home, PI_CODING_AGENT_DIR: agent, PATH: `${bin}:${process.env.PATH}`, NPM_CALLS: join(dir, 'npm-calls') };
  delete env.BILI_CONFIG_FILE;
  const run = script => execFileSync('bash', [join(repo, 'scripts', script)], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { dir, repo, home, agent, bili, env, run };
}

test('settings, manifest, and lockfile agree on the five extension packages', () => {
  const settings = readJSON(join(root, 'pi-agent', 'settings.json'));
  const manifest = readJSON(join(root, 'pi-agent', 'package.json'));
  const lock = readJSON(join(root, 'pi-agent', 'package-lock.json'));
  assert.deepEqual(settings.packages.map(source => source.replace(/^npm:/, '')).sort(), expectedPackages);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), expectedPackages);
  assert.deepEqual(lock.packages[''].dependencies, manifest.dependencies);
  for (const name of expectedPackages) assert.ok(lock.packages[`node_modules/${name}`]?.integrity);
  assert.equal(readJSON(join(root, 'billion-context', 'billion-context.json')).pi.subagents, false);
});

test('installer merges only the portable preference and backs up existing config', t => {
  const f = fixture(t);
  const existing = { pi: { subagents: true, debug: true }, providers: { custom: { apiKey: 'fake-test-secret' } }, compress: { enabled: true } };
  writeJSON(f.bili, existing);
  f.run('install-to-local.sh');
  assert.deepEqual(readJSON(f.bili), { ...existing, pi: { ...existing.pi, subagents: false } });
  const backup = readdirSync(dirname(f.bili)).find(name => name.startsWith('billion-context.json.bak-'));
  assert.ok(backup);
  assert.deepEqual(readJSON(join(dirname(f.bili), backup)), existing);
  assert.equal(readFileSync(f.env.NPM_CALLS, 'utf8').trim(), 'ci --legacy-peer-deps');
  assert.deepEqual(readJSON(join(f.agent, 'settings.json')), readJSON(join(f.repo, 'pi-agent', 'settings.json')));
});

test('installer creates a fresh billion-context config at the overridden path', t => {
  const f = fixture(t);
  const custom = join(f.dir, 'custom config', 'bili.json');
  f.env.BILI_CONFIG_FILE = custom;
  f.run('install-to-local.sh');
  assert.deepEqual(readJSON(custom), { pi: { subagents: false } });
  assert.equal(existsSync(f.bili), false);
});

test('sync snapshots the profile but never exports billion-context credentials', t => {
  const f = fixture(t);
  f.run('install-to-local.sh');
  writeJSON(f.bili, { pi: { subagents: false, debug: true }, providers: { custom: { apiKey: 'fake-test-secret' } }, proxy: { token: 'fake-token' } });
  f.run('sync-from-local.sh');
  assert.deepEqual(readJSON(join(f.repo, 'billion-context', 'billion-context.json')), { pi: { subagents: false } });
  assert.deepEqual(readJSON(join(f.repo, 'pi-agent', 'package.json')), readJSON(join(f.agent, 'npm', 'package.json')));
  assert.equal(readFileSync(join(f.repo, 'pi-agent', 'package-lock.json'), 'utf8'), readFileSync(join(f.agent, 'npm', 'package-lock.json'), 'utf8'));
});

test('sync keeps the portable preference when the local file or preference is missing', t => {
  const f = fixture(t);
  f.run('install-to-local.sh');
  rmSync(f.bili);
  f.run('sync-from-local.sh');
  const portable = join(f.repo, 'billion-context', 'billion-context.json');
  assert.deepEqual(readJSON(portable), { pi: { subagents: false } });
  writeJSON(f.bili, { providers: { custom: { apiKey: 'fake-test-secret' } } });
  f.run('sync-from-local.sh');
  assert.deepEqual(readJSON(portable), { pi: { subagents: false } });
});

test('invalid billion-context config is rejected without overwriting it', t => {
  const f = fixture(t);
  writeFileSync(join(f.repo, 'billion-context', 'billion-context.json'), '{"pi":{"subagents":"false"}}');
  writeJSON(f.bili, { pi: { subagents: true }, keep: 'unchanged' });
  assert.throws(() => f.run('install-to-local.sh'));
  assert.deepEqual(readJSON(f.bili), { pi: { subagents: true }, keep: 'unchanged' });
  writeJSON(join(f.repo, 'billion-context', 'billion-context.json'), { pi: { subagents: false } });
  writeFileSync(f.bili, '{ invalid json');
  assert.throws(() => f.run('install-to-local.sh'));
  assert.equal(readFileSync(f.bili, 'utf8'), '{ invalid json');
});
