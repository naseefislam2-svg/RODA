import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, relative } from 'node:path';
const mode = process.argv[2];
const root = process.env.COMPACT_OUTPUT || 'contracts/managed/worker';
function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]); }
const files = walk(root).filter(p => !p.endsWith('.map')).sort();
const hashes = Object.fromEntries(files.map(file => [relative(root, file).replaceAll('\\', '/'), createHash('sha256').update(readFileSync(file)).digest('hex')]));
// Compact sources are text and may have CRLF line endings in Windows checkouts.
// Hash canonical LF bytes so the committed manifest verifies identically on every OS.
const compactSource = readFileSync('contracts/worker.compact', 'utf8').replace(/\r\n?/g, '\n');
hashes['source.compact'] = createHash('sha256').update(compactSource).digest('hex');
if (mode === 'sync') {
  for (const file of files.filter(p => /[\\/](keys|zkir)[\\/]/.test(p))) {
    const target = join('public/contract', relative(root, file));
    mkdirSync(join(target, '..'), { recursive: true }); copyFileSync(file, target);
  }
  writeFileSync('contracts/artifact-manifest.json', JSON.stringify({ compiler: '0.31.1', hashes }, null, 2) + '\n');
  console.log(`Synced ${files.length} generated contract artifacts.`);
} else {
  const expected = JSON.parse(readFileSync('contracts/artifact-manifest.json', 'utf8'));
  const mismatches = [...new Set([...Object.keys(expected.hashes), ...Object.keys(hashes)])]
    .filter(file => expected.hashes[file] !== hashes[file]);
  if (mismatches.length) throw new Error(`Compiled artifacts differ from the manifest: ${mismatches.join(', ')}. Recompile and sync deliberately.`);
  for (const [file, hash] of Object.entries(hashes).filter(([f]) => /^(keys|zkir)\//.test(f))) {
    const actual = createHash('sha256').update(readFileSync(join('public/contract', file))).digest('hex');
    if (actual !== hash) throw new Error(`Browser artifact mismatch: ${file}`);
  }
  console.log(`Verified compiler ${expected.compiler}: ${files.length} artifacts and browser keys match.`);
}
