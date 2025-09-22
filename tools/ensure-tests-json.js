// Ensure reports/tests.json exists (non-blocking). Intended for local/CI post-test.
const fs = require('fs');
const path = require('path');
const outDir = path.join(process.cwd(), 'reports');
const outFile = path.join(outDir, 'tests.json');
try {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(outFile)) {
    fs.writeFileSync(outFile, JSON.stringify({ summary: 'generated locally' }, null, 2));
    console.log(`Created ${outFile}` );
  } else {
    console.log(`${outFile} already exists` );
  }
} catch (e) {
  console.error(`ensure-tests-json failed: ${e.message}` );
}
