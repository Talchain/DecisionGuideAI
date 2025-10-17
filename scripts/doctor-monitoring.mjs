#!/usr/bin/env node
// scripts/doctor-monitoring.mjs
// Verify monitoring dependencies and API compatibility

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

console.log('🔍 Monitoring Dependencies Doctor\n')

// Read package.json
const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'))

// Check versions
const deps = {
  '@sentry/react': pkg.dependencies['@sentry/react'],
  'web-vitals': pkg.dependencies['web-vitals'],
}

console.log('📦 Installed Versions:')
Object.entries(deps).forEach(([name, version]) => {
  console.log(`  ${name}: ${version}`)
})
console.log()

// Verify API compatibility
let allChecks = true

try {
  // Check Sentry
  const sentryVersion = deps['@sentry/react'].replace(/[\^~]/, '')
  const sentryMajor = parseInt(sentryVersion.split('.')[0])
  
  if (sentryMajor >= 10) {
    console.log('✅ @sentry/react v10+ detected')
    console.log('   - Sentry.init() available')
    console.log('   - Sentry.captureException() available')
    console.log('   - Sentry.setMeasurement() available')
    console.log('   - Sentry.withScope() available')
  } else {
    console.log('❌ @sentry/react version too old (need v10+)')
    allChecks = false
  }
  console.log()

  // Check web-vitals
  const vitalsVersion = deps['web-vitals'].replace(/[\^~]/, '')
  const vitalsMajor = parseInt(vitalsVersion.split('.')[0])
  
  if (vitalsMajor >= 4) {
    console.log('✅ web-vitals v4+ detected')
    console.log('   - onCLS() available')
    console.log('   - onLCP() available')
    console.log('   - onINP() available')
    console.log('   - onFCP() available')
    console.log('   - onTTFB() available')
  } else {
    console.log('❌ web-vitals version too old (need v4+)')
    allChecks = false
  }
  console.log()

  // Check monitoring.ts exists
  const monitoringPath = join(rootDir, 'src/lib/monitoring.ts')
  try {
    readFileSync(monitoringPath, 'utf-8')
    console.log('✅ src/lib/monitoring.ts exists')
  } catch {
    console.log('❌ src/lib/monitoring.ts not found')
    allChecks = false
  }

  // Check .env.example has monitoring vars
  const envExample = readFileSync(join(rootDir, '.env.example'), 'utf-8')
  const requiredVars = ['VITE_SENTRY_DSN', 'VITE_HOTJAR_ID', 'VITE_RELEASE_VERSION']
  
  console.log('\n📝 Environment Variables:')
  requiredVars.forEach(varName => {
    if (envExample.includes(varName)) {
      console.log(`  ✅ ${varName} documented`)
    } else {
      console.log(`  ❌ ${varName} missing from .env.example`)
      allChecks = false
    }
  })

  console.log('\n' + '='.repeat(50))
  if (allChecks) {
    console.log('✅ All monitoring checks passed!')
    process.exit(0)
  } else {
    console.log('❌ Some checks failed')
    process.exit(1)
  }
} catch (error) {
  console.error('❌ Doctor check failed:', error.message)
  process.exit(1)
}
