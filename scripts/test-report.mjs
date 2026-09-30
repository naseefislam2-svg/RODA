import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0) {
    process.stdout.write(output);
    process.exit(result.status ?? 1);
  }
  return output;
}

const frontend = run('npm', ['test']);
const backend = run('.\\.venv\\Scripts\\pytest.exe', ['-q'], `${process.cwd()}\\backend`);
const report = [
  'RODA verification report',
  `Generated: ${new Date().toISOString()}`,
  '',
  'FRONTEND + GENERATED COMPACT CONTRACT',
  frontend.trim(),
  '',
  'FASTAPI + PRIVACY BOUNDARY',
  backend.trim(),
  '',
  'RESULT: ALL TESTS PASSED',
].join('\n');
mkdirSync('artifacts', { recursive: true });
writeFileSync('artifacts/test-output.txt', `${report}\n`);
process.stdout.write(`${report}\n`);
