// scripts/assert-entry.cjs
const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '..', 'dist', 'assets');
if (!fs.existsSync(dist)) {
  console.error('[ASSERT] dist/assets not found — build may have failed');
  process.exit(1);
}

const files = fs.readdirSync(dist).filter(f => /^index-.*\.js$/.test(f));
if (!files.length) {
  console.error('[ASSERT] No index-*.js found in dist/assets — wrong entry or build failed');
  process.exit(1);
}

const token = 'ENTRY_PROOF_TOKEN::MAIN_TSX';
const found = files.some(f => fs.readFileSync(path.join(dist, f), 'utf8').includes(token));

if (!found) {
  console.error('[ASSERT] Entry proof token not found in index bundle — main.tsx is NOT in the built entry!');
  console.error('Searched files:', files);
  process.exit(1);
}

console.log('[ASSERT] ✅ main.tsx entry proof found in', files);
