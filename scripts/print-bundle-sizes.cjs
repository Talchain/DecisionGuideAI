const fs = require('fs')
const path = require('path')
const { gzipSync } = require('zlib')

const distPath = path.join(__dirname, '..', 'dist', 'assets')

function getGzipSize(filePath) {
  const content = fs.readFileSync(filePath)
  const gzipped = gzipSync(content)
  return gzipped.length
}

function formatBytes(bytes) {
  return (bytes / 1024).toFixed(2) + ' KB'
}

function analyzeBundle() {
  if (!fs.existsSync(distPath)) {
    console.error('❌ dist/assets not found. Run `npm run build` first.')
    process.exit(1)
  }

  const files = fs.readdirSync(distPath)
  const jsFiles = files.filter(f => f.endsWith('.js'))
  
  const bundles = jsFiles.map(file => {
    const filePath = path.join(distPath, file)
    const stats = fs.statSync(filePath)
    const gzipSize = getGzipSize(filePath)
    
    return {
      name: file,
      size: stats.size,
      gzip: gzipSize
    }
  })

  // Sort by gzip size descending
  bundles.sort((a, b) => b.gzip - a.gzip)

  console.log('\n📦 Bundle Size Report\n')
  console.log('=' .repeat(80))
  console.log('File'.padEnd(50), 'Size'.padStart(12), 'Gzipped'.padStart(12))
  console.log('-'.repeat(80))

  let totalSize = 0
  let totalGzip = 0
  let immediateGzip = 0

  bundles.forEach(bundle => {
    totalSize += bundle.size
    totalGzip += bundle.gzip
    
    // Identify lazy-loaded chunks
    const isLazy = bundle.name.includes('html2canvas') || 
                   bundle.name.includes('layout') ||
                   bundle.name.includes('elk')
    
    if (!isLazy) {
      immediateGzip += bundle.gzip
    }
    
    const marker = isLazy ? '(lazy)' : ''
    console.log(
      bundle.name.padEnd(50),
      formatBytes(bundle.size).padStart(12),
      formatBytes(bundle.gzip).padStart(12),
      marker
    )
  })

  console.log('-'.repeat(80))
  console.log('Total'.padEnd(50), formatBytes(totalSize).padStart(12), formatBytes(totalGzip).padStart(12))
  console.log('Immediate Load'.padEnd(50), ''.padStart(12), formatBytes(immediateGzip).padStart(12))
  console.log('=' .repeat(80))

  // Check budget
  const budgetKB = 200
  const immediateKB = immediateGzip / 1024

  console.log(`\n🎯 Budget Check: ${immediateKB.toFixed(2)} KB / ${budgetKB} KB`)
  
  if (immediateKB > budgetKB) {
    console.log(`❌ FAIL: Immediate bundle exceeds ${budgetKB} KB budget by ${(immediateKB - budgetKB).toFixed(2)} KB`)
    process.exit(1)
  } else {
    console.log(`✅ PASS: Within budget (${(budgetKB - immediateKB).toFixed(2)} KB remaining)`)
  }

  // Identify largest chunks
  console.log('\n📊 Largest Chunks:')
  bundles.slice(0, 5).forEach((bundle, i) => {
    const isLazy = bundle.name.includes('html2canvas') || bundle.name.includes('layout')
    console.log(`${i + 1}. ${bundle.name} - ${formatBytes(bundle.gzip)} ${isLazy ? '(lazy)' : ''}`)
  })

  console.log('\n✅ Bundle analysis complete\n')
}

analyzeBundle()
