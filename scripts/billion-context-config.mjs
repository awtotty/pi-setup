#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Only this non-secret preference belongs in the portable profile. Never export
// providers, credentials, proxy configuration, or runtime state from the host.
const [mode, source, destination] = process.argv.slice(2);
if (!['export', 'merge'].includes(mode) || !source || !destination) {
  throw new Error('Usage: billion-context-config.mjs <export|merge> <source> <destination>');
}

function readObject(path) {
  const value = JSON.parse(readFileSync(path, 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Expected a JSON object in ${path}`);
  }
  return value;
}

const input = readObject(source);
if (typeof input.pi?.subagents !== 'boolean') {
  if (mode === 'export') {
    console.error(`No explicit pi.subagents preference in ${source}; keeping portable config unchanged`);
    process.exit(0);
  }
  throw new Error(`Expected a boolean pi.subagents in ${source}`);
}

const output = mode === 'merge' && existsSync(destination) ? readObject(destination) : {};
if (output.pi !== undefined && (!output.pi || typeof output.pi !== 'object' || Array.isArray(output.pi))) {
  throw new Error(`Expected a pi object in ${destination}`);
}
output.pi = { ...output.pi, subagents: input.pi.subagents };
mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${JSON.stringify(output, null, 2)}\n`, { mode: 0o600 });
console.log(`${mode === 'export' ? 'synced portable preference to' : 'merged portable preference into'} ${destination}`);
