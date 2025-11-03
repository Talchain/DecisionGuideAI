// e2e/webvitals.spec.ts
// Core Web Vitals CI gates

import { test, expect } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Thresholds (configurable via env)
const THRESHOLDS = {
  LCP: parseInt(process.env.VITALS_LCP_MS || '2500'),
  INP: parseInt(process.env.VITALS_INP_MS || '100'),
  CLS: parseFloat(process.env.VITALS_CLS || '0.1')
}

interface VitalsMetrics {
  lcp?: number
  inp?: number
  fid?: number
  cls?: number
  ttfb?: number
  fcp?: number
}

test('Core Web Vitals meet thresholds', async ({ page }) => {
  const metrics: VitalsMetrics = {}
  
  // Inject PerformanceObserver to capture vitals
  await page.addInitScript(() => {
    window.__webVitals = {}
    
    // LCP Observer
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          window.__webVitals.lcp = lastEntry.renderTime || lastEntry.loadTime
        })
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch (e) {
        console.warn('LCP observer failed:', e)
      }
      
      // CLS Observer
      try {
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
          window.__webVitals.cls = clsValue
        })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
      } catch (e) {
        console.warn('CLS observer failed:', e)
      }
      
      // FCP Observer
      try {
        const fcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const fcp = entries.find((e: any) => e.name === 'first-contentful-paint')
          if (fcp) {
            window.__webVitals.fcp = fcp.startTime
          }
        })
        fcpObserver.observe({ type: 'paint', buffered: true })
      } catch (e) {
        console.warn('FCP observer failed:', e)
      }
    }
  })
  
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Interact with page to trigger INP
  await page.mouse.move(100, 100)
  await page.mouse.click(100, 100)
  await page.waitForTimeout(1000)
  
  // Scroll to trigger more layout shifts
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(1000)
  
  // Collect metrics
  const vitals = await page.evaluate(() => window.__webVitals || {})
  metrics.lcp = vitals.lcp
  metrics.cls = vitals.cls
  metrics.fcp = vitals.fcp
  
  // Get INP/FID from performance timeline
  const inp = await page.evaluate(() => {
    const entries = performance.getEntriesByType('event') as any[]
    if (entries.length === 0) return undefined
    
    const maxDuration = Math.max(...entries.map(e => e.duration || 0))
    return maxDuration
  })
  metrics.inp = inp
  
  // Get TTFB
  const ttfb = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as any
    return nav ? nav.responseStart - nav.requestStart : undefined
  })
  metrics.ttfb = ttfb
  
  // Save metrics to artifacts
  try {
    mkdirSync('test-artifacts', { recursive: true })
    writeFileSync(
      join('test-artifacts', 'webvitals.json'),
      JSON.stringify({ metrics, thresholds: THRESHOLDS, timestamp: new Date().toISOString() }, null, 2)
    )
  } catch (e) {
    console.warn('Failed to write vitals artifact:', e)
  }
  
  // Assert thresholds
  console.log('Web Vitals Metrics:', metrics)
  console.log('Thresholds:', THRESHOLDS)
  
  if (metrics.lcp) {
    expect(metrics.lcp).toBeLessThan(THRESHOLDS.LCP)
    console.log(`✓ LCP: ${metrics.lcp.toFixed(0)}ms < ${THRESHOLDS.LCP}ms`)
  }
  
  if (metrics.cls !== undefined) {
    expect(metrics.cls).toBeLessThan(THRESHOLDS.CLS)
    console.log(`✓ CLS: ${metrics.cls.toFixed(3)} < ${THRESHOLDS.CLS}`)
  }
  
  if (metrics.inp) {
    expect(metrics.inp).toBeLessThan(THRESHOLDS.INP)
    console.log(`✓ INP: ${metrics.inp.toFixed(0)}ms < ${THRESHOLDS.INP}ms`)
  }
})

test('Web Vitals measurement is consistent', async ({ page }) => {
  const runs: VitalsMetrics[] = []
  
  // Run 3 times to check consistency
  for (let i = 0; i < 3; i++) {
    await page.goto('/#/canvas')
    await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
    await page.waitForTimeout(2000)
    
    const vitals = await page.evaluate(() => window.__webVitals || {})
    runs.push(vitals)
    
    // Reload for next run
    if (i < 2) {
      await page.reload({ waitUntil: 'networkidle' })
    }
  }
  
  // Calculate variance
  const lcpValues = runs.map(r => r.lcp).filter(Boolean) as number[]
  if (lcpValues.length >= 2) {
    const avg = lcpValues.reduce((a, b) => a + b, 0) / lcpValues.length
    const variance = lcpValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / lcpValues.length
    const stdDev = Math.sqrt(variance)
    
    // Standard deviation should be reasonable (< 50% of mean)
    expect(stdDev / avg).toBeLessThan(0.5)
    console.log(`LCP consistency: avg=${avg.toFixed(0)}ms, stdDev=${stdDev.toFixed(0)}ms`)
  }
})

test('Representative user flow: template load → run → results (INP/LCP/CLS budget)', async ({ page }) => {
  const metrics: VitalsMetrics = {}
  let interactionTimings: number[] = []

  // Inject vitals tracking
  await page.addInitScript(() => {
    window.__webVitals = {}
    window.__interactionTimings = []

    if ('PerformanceObserver' in window) {
      // LCP Observer
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const lastEntry = entries[entries.length - 1] as any
          window.__webVitals.lcp = lastEntry.renderTime || lastEntry.loadTime
        })
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch (e) {}

      // CLS Observer
      try {
        let clsValue = 0
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!(entry as any).hadRecentInput) {
              clsValue += (entry as any).value
            }
          }
          window.__webVitals.cls = clsValue
        })
        clsObserver.observe({ type: 'layout-shift', buffered: true })
      } catch (e) {}

      // Event timing for INP
      try {
        const eventObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (entry.duration > 0) {
              window.__interactionTimings.push(entry.duration)
            }
          }
        })
        eventObserver.observe({ type: 'event', buffered: true })
      } catch (e) {}
    }
  })

  // 1. Load canvas page (initial LCP)
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  await page.waitForTimeout(1000)

  // Capture initial vitals
  let vitals = await page.evaluate(() => ({
    vitals: window.__webVitals || {},
    interactions: window.__interactionTimings || []
  }))

  console.log('After canvas load - LCP:', vitals.vitals.lcp, 'CLS:', vitals.vitals.cls)

  // 2. Run analysis (major interaction)
  const runStart = Date.now()
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter')
  await expect(page.locator('[aria-label="Analysis Results"]')).toBeVisible({ timeout: 10000 })
  await expect(page.locator('text=Complete')).toBeVisible({ timeout: 15000 })
  const runDuration = Date.now() - runStart

  console.log(`Run completed in ${runDuration}ms`)

  // Wait for results to fully render
  await page.waitForTimeout(1000)

  // 3. Open node inspector (interaction)
  const firstNode = page.locator('.react-flow__node').first()
  await firstNode.click()
  await expect(page.locator('[aria-label="Node Inspector"]')
    .or(page.locator('[aria-label="Inspector"]'))).toBeVisible({ timeout: 5000 })

  await page.waitForTimeout(500)

  // 4. Collect final metrics
  vitals = await page.evaluate(() => ({
    vitals: window.__webVitals || {},
    interactions: window.__interactionTimings || []
  }))

  metrics.lcp = vitals.vitals.lcp
  metrics.cls = vitals.vitals.cls
  interactionTimings = vitals.interactions

  // Calculate INP (98th percentile of interaction timings)
  if (interactionTimings.length > 0) {
    const sorted = interactionTimings.sort((a, b) => a - b)
    const p98Index = Math.floor(sorted.length * 0.98)
    metrics.inp = sorted[p98Index] || sorted[sorted.length - 1]
  }

  // Save comprehensive metrics
  try {
    mkdirSync('test-artifacts', { recursive: true })
    writeFileSync(
      join('test-artifacts', 'webvitals-representative.json'),
      JSON.stringify({
        metrics,
        thresholds: THRESHOLDS,
        flow: {
          runDuration,
          interactionCount: interactionTimings.length,
          allInteractions: interactionTimings
        },
        timestamp: new Date().toISOString()
      }, null, 2)
    )
  } catch (e) {
    console.warn('Failed to write vitals artifact:', e)
  }

  // Assert budgets
  console.log('Representative Flow Metrics:', metrics)
  console.log('Interaction timings:', interactionTimings.length, 'events')

  // LCP: ≤ 2.5s
  if (metrics.lcp) {
    expect(metrics.lcp).toBeLessThan(THRESHOLDS.LCP)
    console.log(`✓ LCP: ${metrics.lcp.toFixed(0)}ms < ${THRESHOLDS.LCP}ms`)
  } else {
    console.warn('⚠ LCP not captured')
  }

  // INP: ≤ 100ms
  if (metrics.inp) {
    expect(metrics.inp).toBeLessThan(THRESHOLDS.INP)
    console.log(`✓ INP: ${metrics.inp.toFixed(0)}ms < ${THRESHOLDS.INP}ms`)
  } else {
    console.warn('⚠ INP not captured (no interactions detected)')
  }

  // CLS: ≤ 0.1
  if (metrics.cls !== undefined) {
    expect(metrics.cls).toBeLessThan(THRESHOLDS.CLS)
    console.log(`✓ CLS: ${metrics.cls.toFixed(3)} < ${THRESHOLDS.CLS}`)
  } else {
    console.warn('⚠ CLS not captured')
  }
})
