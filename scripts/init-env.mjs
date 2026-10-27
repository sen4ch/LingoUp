#!/usr/bin/env node
// Creates .env from .env.example with freshly generated random secrets.
// Usage: node scripts/init-env.mjs    (never overwrites an existing .env)
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = `${root}.env`;

if (existsSync(target)) {
  console.error('.env already exists; not overwriting it. Delete it first to regenerate.');
  process.exit(1);
}

// Every distinct placeholder gets one secret, so URLs and passwords stay consistent.
const secrets = new Map();
const content = readFileSync(`${root}.env.example`, 'utf8').replace(
  /change-me-[a-z0-9-]+/g,
  (placeholder) => {
    if (!secrets.has(placeholder)) secrets.set(placeholder, randomBytes(24).toString('hex'));
    return secrets.get(placeholder);
  },
);

writeFileSync(target, content, { mode: 0o600 });
console.warn(
  `.env created with ${secrets.size} random secrets. Keep it private; it is git-ignored.`,
);
