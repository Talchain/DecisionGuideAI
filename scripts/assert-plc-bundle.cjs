// scripts/assert-plc-bundle.js
// Postbuild assertion: fails CI if PLC chunks are missing from dist/assets

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'dist', 'assets');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
const hasPlcLab = files.some(f => /^PlcLab-.*\.js$/.test(f));

if (!hasPlcLab) {
  console.error('[ASSERT] ❌ PlcLab chunk missing — refusing PoC-only bundle.');
  process.exit(1);
}

console.log('[ASSERT] ✅ PLC chunks present:', files.filter(f => /^PlcLab-.*\.js$/.test(f)).join(', '));
