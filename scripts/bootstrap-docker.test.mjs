import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Docker bootstrap creates consistent secrets and retains them on subsequent launches', () => {
  const directory = mkdtempSync(join(tmpdir(), 'lingoup-bootstrap-test-'));
  try {
    const script = fileURLToPath(new URL('./bootstrap-docker.mjs', import.meta.url));
    const run = () =>
      execFileSync(process.execPath, [script], {
        env: { ...process.env, BOOTSTRAP_DIR: directory },
      }).toString();
    const output = run();
    const initial = readFileSync(join(directory, 'apps/runtime.env'), 'utf8');
    const database = readFileSync(join(directory, 'postgres/password'), 'utf8');
    assert.match(database, /^[a-f0-9]{64}$/);
    assert.ok(initial.includes(`postgres://lingoup:${database}@postgres:5432/lingoup`));
    assert.ok(!output.includes(database));
    run();
    assert.equal(readFileSync(join(directory, 'apps/runtime.env'), 'utf8'), initial);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
