#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { gzipSync, brotliCompressSync } from 'zlib'

const BUDGETS = {
  'templates': { gzip: 120 * 1024, brotli: 45 * 1024 }, // 120KB gz, 45KB br
  'main': { gzip: 200 * 1024, brotli: 75 * 1024 }       // 200KB gz, 75KB br
}

const distDir = join(process.cwd(), 'dist', 'assets')

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`
}

function analyzeChunk(filePath) {
  const content = readFileSync(filePath)
  const raw = content.length
  const gzip = gzipSync(content).length
  const brotli = brotliCompressSync(content).length
  
  return { raw, gzip, brotli }
}

function main() {
  console.log('\n📦 Bundle Size Report\n')
  
  const files = readdirSync(distDir)
    .filter(f => f.endsWith('.js'))
    .map(f => join(distDir, f))
  
  let failed = false
  const results = []
  
  for (const file of files) {
    const name = file.split('/').pop()
    const stats = statSync(file)
    const sizes = analyzeChunk(file)
    
    let chunkType = 'other'
    if (name.includes('DecisionTemplates') || name.includes('templates')) {
      chunkType = 'templates'
    } else if (name.includes('index')) {
      chunkType = 'main'
    }
    
    const budget = BUDGETS[chunkType]
    const gzipPass = !budget || sizes.gzip <= budget.gzip
    const brotliPass = !budget || sizes.brotli <= budget.brotli
    
    results.push({
      name,
      chunkType,
      sizes,
      budget,
      gzipPass,
      brotliPass
    })
    
    if (!gzipPass || !brotliPass) {
      failed = true
    }
  }
  
  // Sort by size descending
  results.sort((a, b) => b.sizes.gzip - a.sizes.gzip)
  
  for (const r of results) {
    const status = r.gzipPass && r.brotliPass ? '✅' : '❌'
    console.log(`${status} ${r.name}`)
    console.log(`   Raw: ${formatBytes(r.sizes.raw)}`)
    console.log(`   Gzip: ${formatBytes(r.sizes.gzip)}${r.budget ? ` / ${formatBytes(r.budget.gzip)} ${r.gzipPass ? '✓' : '✗'}` : ''}`)
    console.log(`   Brotli: ${formatBytes(r.sizes.brotli)}${r.budget ? ` / ${formatBytes(r.budget.brotli)} ${r.brotliPass ? '✓' : '✗'}` : ''}`)
    console.log()
  }
  
  if (failed) {
    console.error('❌ Bundle size budget exceeded!\n')
    process.exit(1)
  } else {
    console.log('✅ All bundle size budgets passed!\n')
  }
}

main()
