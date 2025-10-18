const fs = require('fs');
const path = require('path');

const eff = {
  VITE_POC_ONLY: process.env.VITE_POC_ONLY,
  VITE_PLC_LAB: process.env.VITE_PLC_LAB,
  VITE_FEATURE_PLOT_USES_PLC_CANVAS: process.env.VITE_FEATURE_PLOT_USES_PLC_CANVAS,
};
console.log('[ASSERT] feature flags:', eff);

const pocOnly = String(process.env.VITE_POC_ONLY ?? '0') === '1';
const plcLabOn = String(process.env.VITE_PLC_LAB ?? '0') === '1';
const plcPlotOn = String(process.env.VITE_FEATURE_PLOT_USES_PLC_CANVAS ?? '0') === '1';
const needPlc = !pocOnly && (plcLabOn || plcPlotOn);

if (needPlc) {
  const dir = path.join(__dirname, '..', 'dist', 'assets');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
  const has = (re) => files.some(f => re.test(f));
  
  // Accept actual chunk names from build
  const hasPlot = has(/^PlotWorkspace-.*\.js$/) || has(/^PlcCanvas-.*\.js$/);
  const hasLab = has(/^PlcLab-.*\.js$/);
  
  const missing = [];
  if (plcPlotOn && !hasPlot) missing.push('plot chunk (PlotWorkspace-*.js)');
  if (plcLabOn && !hasLab) missing.push('lab chunk (PlcLab-*.js)');
  
  if (missing.length > 0) {
    console.error('[ASSERT] ❌ Missing PLC chunks:', missing);
    console.error('Available chunks:', files.filter(f => f.endsWith('.js')).slice(0, 10));
    process.exit(1);
  }
  console.log('[ASSERT] ✅ PLC chunks present');
} else {
  console.log('[ASSERT] ℹ️ PLC checks skipped (flags disabled)');
}
