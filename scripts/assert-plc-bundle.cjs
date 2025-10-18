const fs = require('fs');
const path = require('path');

const eff = {
  VITE_POC_ONLY: process.env.VITE_POC_ONLY,
  VITE_PLC_LAB: process.env.VITE_PLC_LAB,
  VITE_FEATURE_PLOT_USES_PLC_CANVAS: process.env.VITE_FEATURE_PLOT_USES_PLC_CANVAS,
};
console.log('[ASSERT] feature flags:', eff);

const pocOnly = String(process.env.VITE_POC_ONLY ?? '0') === '1';
const plcLabOn = String(process.env.VITE_PLC_LAB ?? '1') === '1';
const plcPlotOn = String(process.env.VITE_FEATURE_PLOT_USES_PLC_CANVAS ?? '1') === '1';
const needPlc = !pocOnly && (plcLabOn || plcPlotOn);

if (needPlc) {
  const dir = path.join(__dirname, '..', 'dist', 'assets');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const missing = [];
  if (plcLabOn && !files.some(f => /^PlcLab-.*\.js$/.test(f))) missing.push('PlcLab-*.js');
  if (plcPlotOn && !files.some(f => /^PlcCanvas-.*\.js$/.test(f))) missing.push('PlcCanvas-*.js');
  if (missing.length > 0) {
    console.error('[ASSERT] ❌ Missing PLC chunks:', missing);
    process.exit(1);
  }
  console.log('[ASSERT] ✅ PLC chunks present');
} else {
  console.log('[ASSERT] ℹ️ PLC checks skipped (flags disabled)');
}
