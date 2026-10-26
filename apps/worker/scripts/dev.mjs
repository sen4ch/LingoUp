// Development runner: incremental TypeScript compilation + automatic restart.
// Same runner as apps/api, so both apps behave identically in development.
// Restarts are driven by an explicit watcher on dist/**/*.js: `node --watch-path` reacts to
// unrelated file events on Windows and restarted the server in a loop.
import { spawn } from 'node:child_process';
import { mkdirSync, watch } from 'node:fs';

const NODE_ARGS = ['--env-file-if-exists=../../.env', '--enable-source-maps', 'dist/main.js'];
const TSC = 'pnpm exec tsc -p tsconfig.build.json --watch --preserveWatchOutput';

let server = null;
let restartTimer = null;
let stopping = false;

function startServer() {
  server = spawn(process.execPath, NODE_ARGS, { stdio: 'inherit' });
  const current = server;
  current.on('exit', () => {
    if (server === current) server = null;
  });
}

function restartServer() {
  if (stopping) return;
  if (!server) {
    startServer();
    return;
  }
  const previous = server;
  previous.once('exit', startServer);
  previous.kill('SIGTERM');
}

// The server starts after the first compilation and restarts once per burst of writes.
mkdirSync('dist', { recursive: true });
watch('dist', { recursive: true }, (_event, file) => {
  if (!file?.endsWith('.js')) return;
  clearTimeout(restartTimer);
  restartTimer = setTimeout(restartServer, 300);
});

const compiler = spawn(TSC, { stdio: 'inherit', shell: true });

function stop() {
  stopping = true;
  clearTimeout(restartTimer);
  server?.kill('SIGTERM');
  compiler.kill('SIGTERM');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
compiler.on('exit', (code) => {
  if (!stopping && code !== 0 && code !== null) {
    stop();
    process.exitCode = code;
  }
});
