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
