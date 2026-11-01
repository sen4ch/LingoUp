import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';

const directory = process.env.BOOTSTRAP_DIR || '/state';
mkdirSync(directory, { recursive: true });
for (const name of ['postgres', 'valkey', 'ai', 'apps'])
  mkdirSync(`${directory}/${name}`, { recursive: true });
function secret(name) {
  const file = `${directory}/${name}`;
  if (!existsSync(file))
    writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o444, flag: 'wx' });
  return readFileSync(file, 'utf8').trim();
}
const postgres = secret('postgres/password');
const valkey = secret('valkey/password');
const ai = secret('ai/token');
const environment = `DATABASE_URL=postgres://lingoup:${postgres}@postgres:5432/lingoup\nVALKEY_URL=redis://:${valkey}@valkey:6379/0\nAI_SERVICE_TOKEN=${ai}\n`;
// Derive this file from the retained passwords; never rotate credentials on restart.
if (existsSync(`${directory}/apps/runtime.env`)) chmodSync(`${directory}/apps/runtime.env`, 0o600);
writeFileSync(`${directory}/apps/runtime.env`, environment, { mode: 0o444 });
chmodSync(`${directory}/apps/runtime.env`, 0o444);
console.log('Technical credentials are ready. Open http://localhost:3000/setup after startup.');
