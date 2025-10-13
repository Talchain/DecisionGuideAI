// scripts/assert-plc-bundle.cjs
// Postbuild assertion: fails CI if PLC chunks are missing from dist/assets
/* eslint-disable */

const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'dist', 'assets');
const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];

// Check for required PLC chunks
const hasPlcLab = files.some(f => /^PlcLab-.*\.js$/.test(f));
const hasPlcCanvas = files.some(f => /^PlcCanvas-.*\.js$/.test(f));

const missing = [];
if (!hasPlcLab) missing.push('PlcLab-*.js (PLC Lab for /#/plc)');
if (!hasPlcCanvas) missing.push('PlcCanvas-*.js (PLC canvas for /#/plot)');

if (missing.length > 0) {
  console.error('[ASSERT] ❌ Missing PLC chunks in dist/assets:');
  missing.forEach(m => console.error('  -', m));
  console.error('\nThis means VITE_POC_ONLY=1 was set or PLC code was excluded.');
  console.error('Fix: Ensure netlify.toml uses "npm run build:ci" and VITE_POC_ONLY="0"');
  process.exit(1);
}

const plcChunks = files.filter(f => /^(PlcLab|PlcCanvas)-.*\.js$/.test(f));
console.log('[ASSERT] ✅ PLC chunks present:', plcChunks.join(', '));
