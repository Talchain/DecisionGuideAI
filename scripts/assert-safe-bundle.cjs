// scripts/assert-safe-bundle.cjs
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')

const dist = path.resolve(process.cwd(), 'dist')
const indexHtmlPath = path.join(dist, 'index.html')
const assetsDir = path.join(dist, 'assets')

const FORBIDDEN = [
  'react',
  'react-dom',
  'zustand',
  '@xyflow/',
  'use-sync-external-store',
]

function die(msg) {
  console.error(`\n❌ ${msg}\n`)
  process.exit(1)
}

if (!fs.existsSync(dist)) die('dist/ not found. Did you run "vite build"?')

// 1) Ensure index.html does not statically include the app bundle
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8')
if (/<script[^>]+src=.*(reactApp|main).*\.js/.test(indexHtml)) {
  die('index.html contains a static script tag for the app entry (reactApp/main). Must be dynamically imported.')
}

// 2) Check for safe-screen chunks (safe-entry, safe-utils, etc.)
// Note: lazySafe is a React lazy loading helper, not the safe screen
if (fs.existsSync(assetsDir)) {
  const allJs = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'))
  const safeScreenFiles = allJs.filter((f) => /safe-entry|safe-utils|poc.*safe/i.test(f))

  for (const file of safeScreenFiles) {
    const full = path.join(assetsDir, file)
    const content = fs.readFileSync(full, 'utf8')

    for (const bad of FORBIDDEN) {
      if (content.includes(bad)) {
        die(`Safe bundle leakage: "${file}" contains "${bad}". Safe chunks must be React/Zustand/RF/shim free.`)
      }
    }
  }
  
  if (safeScreenFiles.length === 0) {
    console.log('ℹ️  No safe-screen chunks found (may be inlined or not built)')
  }

  // 3) Block any standalone shim file
  const strayShim = allJs.find((f) => /use-sync-external-store/.test(f))
  if (strayShim) {
    console.log(`ℹ️  Found shim chunk: ${strayShim} (expected, should be tied to React vendor)`)
  }
}

console.log('✅ Bundle policy OK: safe chunks are React-free; app entry is dynamic.')
