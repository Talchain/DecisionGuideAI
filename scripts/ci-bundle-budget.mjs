#!/usr/bin/env node
// scripts/ci-bundle-budget.mjs
// Enforce bundle size budgets - fail CI if exceeded

import { readFileSync, readdirSync } from 'fs'
import { gzipSync } from 'zlib'

const BUDGETS = {
  route: 200 * 1024,   // 200KB per route chunk
  vendor: 250 * 1024,  // 250KB for standard vendor chunks
  lazyVendor: 500 * 1024,  // 500KB for lazy-loaded heavy vendors (elk, tldraw)
  total: 2 * 1024 * 1024  // 2MB total
}

const dist = 'dist/assets'
const files = readdirSync(dist).filter(f => f.endsWith('.js') && !f.endsWith('.map'))

let totalSize = 0
let failed = false

console.log('📊 Bundle Budget Enforcement\n')
console.log(`Route budget: ${(BUDGETS.route/1024).toFixed(0)} KB`)
console.log(`Vendor budget: ${(BUDGETS.vendor/1024).toFixed(0)} KB`)
console.log(`Lazy vendor budget: ${(BUDGETS.lazyVendor/1024).toFixed(0)} KB (elk, tldraw, html2canvas)`)
console.log(`Total budget: ${(BUDGETS.total/1024/1024).toFixed(1)} MB\n`)

files.forEach(f => {
  const content = readFileSync(`${dist}/${f}`)
  const size = gzipSync(content).length
  totalSize += size
  
  const kb = (size/1024).toFixed(1)
  const isVendor = f.includes('vendor')
  const isLazyVendor = f.includes('elk-vendor') || f.includes('tldraw-vendor') || f.includes('html2canvas-vendor')
  
  let budget, budgetKb
  if (isLazyVendor) {
    budget = BUDGETS.lazyVendor
    budgetKb = (budget/1024).toFixed(0)
  } else if (isVendor) {
    budget = BUDGETS.vendor
    budgetKb = (budget/1024).toFixed(0)
  } else {
    budget = BUDGETS.route
    budgetKb = (budget/1024).toFixed(0)
  }
  
  if (size > budget) {
    console.log(`❌ ${f}: ${kb} KB (exceeds ${budgetKb} KB budget)`)
    failed = true
  } else {
    const pct = ((size/budget)*100).toFixed(0)
    const label = isLazyVendor ? 'lazy vendor' : isVendor ? 'vendor' : 'route'
    console.log(`✅ ${f}: ${kb} KB (${pct}% of ${budgetKb} KB ${label} budget)`)
  }
})

console.log(`\nTotal: ${(totalSize/1024).toFixed(1)} KB (${(totalSize/1024/1024).toFixed(2)} MB)`)

if (totalSize > BUDGETS.total) {
  console.log(`❌ Total exceeds ${(BUDGETS.total/1024/1024).toFixed(1)} MB budget`)
  failed = true
}

if (failed) {
  console.log('\n❌ Bundle budget check FAILED')
  console.log('\nTo fix:')
  console.log('  1. Check for accidental eager imports (should be lazy)')
  console.log('  2. Review vite.config.ts manualChunks strategy')
  console.log('  3. Remove unused dependencies')
  console.log('  4. Consider code splitting heavy features')
  process.exit(1)
}

console.log('\n✅ All budgets met!')
process.exit(0)
