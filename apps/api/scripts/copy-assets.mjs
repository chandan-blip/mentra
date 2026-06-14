// Copy non-TS assets (e.g. data/*.json) from src into dist, mirroring the tree.
// `tsc` only emits .js/.d.ts and leaves data files behind, so anything read at
// runtime via readFileSync (e.g. skills catalogue) would be missing in dist.
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url)); // apps/api/scripts
const src = join(root, '..', 'src');
const dist = join(root, '..', 'dist');

let count = 0;
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests') continue; // tests aren't shipped
      await walk(abs);
      continue;
    }
    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) continue;
    if (entry.name.endsWith('.md')) continue; // docs, not runtime assets
    const out = join(dist, relative(src, abs));
    await mkdir(dirname(out), { recursive: true });
    await cp(abs, out);
    count += 1;
  }
}

await walk(src);
console.log(`copy-assets: copied ${count} non-TS asset(s) to dist`);
