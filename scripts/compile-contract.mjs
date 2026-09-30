import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = 'contracts/worker.compact';
const output = process.env.COMPACT_OUTPUT || 'contracts/managed/worker';
mkdirSync(resolve(root, output), { recursive: true });

function quoteBash(value) {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function wslPath(path) {
  const result = spawnSync('wsl.exe', ['--exec', 'wslpath', '-u', path], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    console.error(result.error?.message ?? result.stderr ?? 'Could not resolve the path inside WSL2.');
    process.exit(1);
  }
  return result.stdout.trim();
}

let result;
if (process.platform === 'win32') {
  const linuxRoot = wslPath(root);
  const linuxSource = wslPath(resolve(root, source));
  const linuxOutput = wslPath(resolve(root, output));
  const command = [
    `cd ${quoteBash(linuxRoot)}`,
    'compact compile --version',
    `compact compile +0.31.1 ${quoteBash(linuxSource)} ${quoteBash(linuxOutput)}`,
  ].join(' && ');
  result = spawnSync('wsl.exe', ['--exec', 'bash', '-lc', command], { cwd: root, stdio: 'inherit' });
} else {
  const args = ['compile', '--version'];
  result = spawnSync('compact', args, { cwd: root, stdio: 'inherit' });
  if (result.status === 0) {
    result = spawnSync('compact', ['compile', '+0.31.1', source, output], { cwd: root, stdio: 'inherit' });
  }
}

if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
