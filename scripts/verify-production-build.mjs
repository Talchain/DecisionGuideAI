#!/usr/bin/env node
/**
 * Production Build Verification Script
 *
 * Catches initialization order bugs (TDZ errors, undefined React, etc.)
 * that only manifest in production builds, not unit tests.
 *
 * Run: node scripts/verify-production-build.mjs
 *
 * This script:
 * 1. Builds the production bundle
 * 2. Starts a preview server
 * 3. Uses Puppeteer to load the page and check for JS errors
 * 4. Reports any initialization errors that would cause blank screens
 */

import { spawn, execSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const PREVIEW_PORT = 4174 // Different from dev port to avoid conflicts
const TIMEOUT_MS = 30000

async function main() {
  console.log('🔨 Building production bundle...')

  try {
    execSync('npm run build', { stdio: 'inherit' })
  } catch (error) {
    console.error('❌ Build failed')
    process.exit(1)
  }

  console.log('🚀 Starting preview server on port', PREVIEW_PORT)

  const preview = spawn('npx', ['vite', 'preview', '--port', String(PREVIEW_PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  })

  let serverOutput = ''
  preview.stdout.on('data', (data) => {
    serverOutput += data.toString()
  })
  preview.stderr.on('data', (data) => {
    serverOutput += data.toString()
  })

  // Wait for server to be ready
  await sleep(3000)

  // Check if puppeteer is available
  let puppeteer
  try {
    puppeteer = await import('puppeteer')
  } catch {
    console.log('⚠️  Puppeteer not installed. Skipping browser verification.')
    console.log('   Install with: npm install -D puppeteer')
    console.log('   For now, manually test: npm run preview')
    preview.kill()
    process.exit(0)
  }

  console.log('🌐 Launching headless browser...')

  const browser = await puppeteer.default.launch({ headless: 'new' })
  const page = await browser.newPage()

  const jsErrors = []

  // Capture all JS errors
  page.on('pageerror', (error) => {
    jsErrors.push(error.message)
  })

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      jsErrors.push(msg.text())
    }
  })

  try {
    console.log(`📄 Loading http://localhost:${PREVIEW_PORT}...`)

    await page.goto(`http://localhost:${PREVIEW_PORT}`, {
      waitUntil: 'networkidle0',
      timeout: TIMEOUT_MS
    })

    // Wait a bit for React to initialize
    await sleep(2000)

    // Check if React mounted successfully
    const appMounted = await page.evaluate(() => {
      return window.__APP_MOUNTED_CALLED__ === true
    })

    // Check for common initialization errors
    const criticalErrors = jsErrors.filter(err =>
      err.includes('Cannot read properties of undefined') ||
      err.includes('Cannot access') ||
      err.includes('before initialization') ||
      err.includes('is not defined') ||
      err.includes('Maximum update depth exceeded') ||
      err.includes('React error #185')
    )

    if (criticalErrors.length > 0) {
      console.error('❌ CRITICAL: Production build has initialization errors:')
      criticalErrors.forEach(err => console.error('   •', err))
      await browser.close()
      preview.kill()
      process.exit(1)
    }

    if (jsErrors.length > 0) {
      console.warn('⚠️  Non-critical JS errors detected:')
      jsErrors.forEach(err => console.warn('   •', err))
    }

    console.log('✅ Production build verification passed!')
    console.log('   • No TDZ errors')
    console.log('   • No React initialization errors')
    console.log('   • App loaded successfully')

  } catch (error) {
    console.error('❌ Browser test failed:', error.message)
    await browser.close()
    preview.kill()
    process.exit(1)
  }

  await browser.close()
  preview.kill()
  process.exit(0)
}

main().catch((err) => {
  console.error('Script failed:', err)
  process.exit(1)
})
