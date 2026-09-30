import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = process.env.COMPACT_OUTPUT || 'contracts/managed/worker';
mkdirSync(resolve(root, output), { recursive: true });
const args = ['compile', '+0.31.1', 'contracts/worker.compact', output];
const result = process.platform === 'win32'
  ? spawnSync('wsl', ['-d', 'Ubuntu-20.04', '--', 'bash', '-lc', `compact ${args.map(s => `'${s.replaceAll("'", "'\\''")}'`).join(' ')}`], { cwd: root, stdio: 'inherit' })
  : spawnSync('compact', args, { cwd: root, stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
