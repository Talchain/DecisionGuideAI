// scripts/assert-plc-bundle.js
// Postbuild assertion: fails CI if PLC chunks are missing from dist/assets

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist', 'assets');

if (!fs.existsSync(dist)) {
  console.error('[ASSERT] dist/assets does not exist');
  process.exit(1);
}

const files = fs.readdirSync(dist);

const required = [
  /PlcLab-.*\.js/i,
  /PlcCanvas-.*\.js/i,
  /PlcCanvasAdapter-.*\.js/i
];

const missing = required.filter(re => !files.some(f => re.test(f)));

if (missing.length) {
  console.error('[ASSERT] ❌ Missing PLC chunks in dist/assets:');
  missing.forEach(re => console.error('  -', re.toString()));
  console.error('\nThis means VITE_POC_ONLY=1 was set or PLC code was excluded.');
  console.error('Fix: Ensure netlify.toml uses "npm run build:ci" and VITE_POC_ONLY="0"');
  process.exit(1);
}

const plcChunks = files.filter(f => /Plc(Lab|Canvas|Adapter)/i.test(f));
console.log('[ASSERT] ✅ PLC chunks present:', plcChunks.join(', '));
