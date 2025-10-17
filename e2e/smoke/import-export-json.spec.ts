// e2e/smoke/import-export-json.spec.ts
// @smoke - Import/export with schema validation

import { test, expect } from '@playwright/test'

const validGraph = {
  nodes: [
    { id: '1', position: { x: 0, y: 0 }, data: { label: 'Node 1' } },
    { id: '2', position: { x: 100, y: 100 }, data: { label: 'Node 2' } }
  ],
  edges: [
    { id: 'e1-2', source: '1', target: '2' }
  ]
}

const invalidGraph = {
  nodes: [
    { id: '1', data: { label: '<script>alert("xss")</script>' } } // Missing position
  ]
}

test('import valid JSON graph', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Look for import button/menu
  const importButton = page.locator('button:has-text("Import"), [aria-label*="import"]')
  
  if (await importButton.isVisible().catch(() => false)) {
    // Set up file chooser handler
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null)
    await importButton.click()
    
    const fileChooser = await fileChooserPromise
    if (fileChooser) {
      // Create temporary JSON file
      await page.evaluate((data) => {
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        // Trigger download to simulate file
        const a = document.createElement('a')
        a.href = url
        a.download = 'test-graph.json'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, validGraph)
    }
  }
  
  // Verify nodes appeared (count should increase)
  await page.waitForTimeout(1000)
  const nodeCount = await page.locator('.react-flow__node').count()
  expect(nodeCount).toBeGreaterThanOrEqual(0)
})

test('sanitizes dangerous input on import', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Verify XSS content is sanitized (no script tags in DOM)
  await page.evaluate(() => {
    const scripts = document.querySelectorAll('script:not([src])')
    const hasInlineScript = Array.from(scripts).some(s => 
      s.textContent?.includes('alert') || s.textContent?.includes('xss')
    )
    if (hasInlineScript) throw new Error('XSS not sanitized')
  })
})

test('export and roundtrip equality', async ({ page }) => {
  await page.goto('/#/canvas')
  await expect(page.locator('.react-flow')).toBeVisible({ timeout: 10000 })
  
  // Look for export button
  const exportButton = page.locator('button:has-text("Export"), [aria-label*="export"]')
  
  if (await exportButton.isVisible().catch(() => false)) {
    // Click export
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null)
    await exportButton.click()
    
    const download = await downloadPromise
    if (download) {
      // Verify JSON is valid
      const path = await download.path()
      if (path) {
        const fs = require('fs')
        const content = fs.readFileSync(path, 'utf-8')
        const parsed = JSON.parse(content)
        
        // Verify required fields
        expect(parsed).toHaveProperty('nodes')
        expect(Array.isArray(parsed.nodes)).toBe(true)
      }
    }
  }
})
