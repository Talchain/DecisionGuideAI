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

const baseline = Number(process.env.BUNDLE_BASELINE_BYTES || total);
const limit = Math.floor(baseline * 1.08);
const report = { bytes: total, baseline, limit, ok: total <= limit };
console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  console.error(`Bundle over budget: ${total} > ${limit}`);
  process.exit(1);
}
