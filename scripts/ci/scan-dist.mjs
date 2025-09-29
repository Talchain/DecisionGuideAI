// scripts/ci/scan-dist.mjs
import { promises as fs } from 'fs';
import { gzipSync } from 'zlib';
import path from 'path';

const root = 'dist/assets';
let total = 0;
for (const f of await fs.readdir(root)) {
  if (!/\.(js|css)$/.test(f)) continue;
  const buf = await fs.readFile(path.join(root, f));
  total += gzipSync(buf).length;
}

// Prefer a committed baseline file; fall back to env; finally seed with current.
const baselineFile = 'scripts/ci/bundle-baseline.json';
let baseline = null;
try {
  const j = JSON.parse(await fs.readFile(baselineFile, 'utf8'));
  baseline = Number(j.bytes);
} catch {}
if (!baseline) baseline = Number(process.env.BUNDLE_BASELINE_BYTES || total);

const limit = Math.floor(baseline * 1.08);
const report = { bytes: total, baseline, limit, ok: total <= limit };
console.log(JSON.stringify(report, null, 2));
await fs.mkdir('docs/evidence/bundle', { recursive: true });
await fs.writeFile('docs/evidence/bundle/bundle_report.json', JSON.stringify(report, null, 2));
// If we had no committed baseline, write one now (establish baseline on this PR)
if (!(await exists(baselineFile))) {
  await fs.mkdir('scripts/ci', { recursive: true });
  await fs.writeFile(baselineFile, JSON.stringify({ bytes: total }, null, 2));
}
if (!report.ok) {
  console.error(`Bundle over budget: ${total} > ${limit}`);
  process.exit(1);
}

async function exists(p){ try { await fs.stat(p); return true; } catch { return false; } }
