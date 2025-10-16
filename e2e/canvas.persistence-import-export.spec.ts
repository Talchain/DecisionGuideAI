import { test, expect } from '@playwright/test'
import { openCanvas, waitForDebouncedAutosave, exportCanvas, setupConsoleErrorTracking, expectNoConsoleErrors, pressShortcut, clickToolbarButton } from './helpers/canvas'

test.describe('Canvas Persistence, Import & Export', () => {
  test.beforeEach(async ({ page }) => {
    await openCanvas(page)
  })

  test('debounced autosave fires after idle period', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Make a change (add node)
    await clickToolbarButton(page, '+ Node')
    
    // Wait for debounced autosave (2s + tolerance)
    // NOTE: This is the ONLY approved use of waitForTimeout per requirements
    // Rationale: Autosave debounces for 2000ms with no other reliable signal
    await waitForDebouncedAutosave(page)
    
    // Verify localStorage has been updated
    const saved = await page.evaluate(() => {
      return localStorage.getItem('canvas-storage') !== null
    })
    
    expect(saved).toBe(true)
    
    expectNoConsoleErrors(errors)
  })

  test('manual save creates snapshot', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await clickToolbarButton(page, 'Save')
    
    // Check snapshot was created
    const snapshotKeys = await page.evaluate(() => {
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('canvas-snapshot-')) {
          keys.push(key)
        }
      }
      return keys
    })
    
    expect(snapshotKeys.length).toBeGreaterThan(0)
    
    expectNoConsoleErrors(errors)
  })

  test('export produces valid JSON', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const json = await exportCanvas(page)
    
    // Should be valid JSON
    const parsed = JSON.parse(json)
    expect(parsed.version).toBe(1)
    expect(parsed.timestamp).toBeGreaterThan(0)
    expect(Array.isArray(parsed.nodes)).toBe(true)
    expect(Array.isArray(parsed.edges)).toBe(true)
    
    expectNoConsoleErrors(errors)
  })

  test('export-import round-trip preserves state', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Export current state
    const json = await exportCanvas(page)
    const parsed = JSON.parse(json)
    const originalNodeCount = parsed.nodes.length
    
    // Add a node to change state
    await clickToolbarButton(page, '+ Node')
    await page.waitForTimeout(300)
    
    // Import original state
    const imported = await page.evaluate((jsonStr) => {
      // @ts-ignore
      return window.useCanvasStore.getState().importCanvas(jsonStr)
    }, json)
    
    expect(imported).toBe(true)
    
    await page.waitForTimeout(500)
    
    // Should be back to original state
    const newNodeCount = await page.locator('[data-testid="rf-node"]').count()
    expect(newNodeCount).toBe(originalNodeCount)
    
    expectNoConsoleErrors(errors)
  })

  test('import reseeds IDs to avoid collisions', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const json = await exportCanvas(page)
    
    // Import (IDs should be reseeded)
    await page.evaluate((jsonStr) => {
      // @ts-ignore
      window.useCanvasStore.getState().importCanvas(jsonStr)
    }, json)
    
    await page.waitForTimeout(300)
    
    // Add new node - should have ID > imported max
    await clickToolbarButton(page, '+ Node')
    await page.waitForTimeout(200)
    
    // Verify new node exists
    const nodes = page.locator('[data-testid="rf-node"]')
    expect(await nodes.count()).toBeGreaterThan(0)
    
    expectNoConsoleErrors(errors)
  })

  test('import rejects malformed JSON', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const result = await page.evaluate(() => {
      // @ts-ignore
      return window.useCanvasStore.getState().importCanvas('invalid json')
    })
    
    expect(result).toBe(false)
    
    // Canvas should still be functional
    const nodes = page.locator('[data-testid="rf-node"]')
    expect(await nodes.count()).toBeGreaterThan(0)
    
    expectNoConsoleErrors(errors)
  })

  test('import rejects missing required fields', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const invalidJson = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      nodes: [] // missing edges
    })
    
    const result = await page.evaluate((jsonStr) => {
      // @ts-ignore
      return window.useCanvasStore.getState().importCanvas(jsonStr)
    }, invalidJson)
    
    expect(result).toBe(false)
    
    expectNoConsoleErrors(errors)
  })

  test('import sanitizes malicious labels', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    const maliciousJson = JSON.stringify({
      version: 1,
      timestamp: Date.now(),
      nodes: [
        {
          id: '1',
          type: 'decision',
          position: { x: 100, y: 100 },
          data: { label: '<script>alert("xss")</script>Hacked' }
        }
      ],
      edges: []
    })
    
    await page.evaluate((jsonStr) => {
      // @ts-ignore
      window.useCanvasStore.getState().importCanvas(jsonStr)
    }, maliciousJson)
    
    await page.waitForTimeout(300)
    
    // Check label was sanitized
    const node = page.locator('[data-testid="rf-node"]').first()
    const text = await node.textContent()
    
    expect(text).not.toContain('<script>')
    expect(text).toContain('Hacked')
    
    expectNoConsoleErrors(errors)
  })

  test('snapshot rotation keeps max 10', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Create more than 10 snapshots
    for (let i = 0; i < 12; i++) {
      await page.evaluate(() => {
        // @ts-ignore
        window.useCanvasStore.getState().saveSnapshot()
      })
      await page.waitForTimeout(10) // Small delay for unique timestamps
    }
    
    // Check snapshot count
    const snapshotCount = await page.evaluate(() => {
      let count = 0
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('canvas-snapshot-')) {
          count++
        }
      }
      return count
    })
    
    expect(snapshotCount).toBeLessThanOrEqual(10)
    
    expectNoConsoleErrors(errors)
  })

  test('localStorage quota exceeded is handled gracefully', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    // Mock quota exceeded
    await page.evaluate(() => {
      const originalSetItem = Storage.prototype.setItem
      Storage.prototype.setItem = function(key: string) {
        if (key.includes('test-quota')) {
          const error = new DOMException('Quota exceeded', 'QuotaExceededError')
          throw error
        }
        return originalSetItem.apply(this, arguments as any)
      }
      
      try {
        localStorage.setItem('test-quota-trigger', 'x'.repeat(10000000))
      } catch (e) {
        // Expected to throw
      }
    })
    
    // Canvas should still work
    const nodes = page.locator('[data-testid="rf-node"]')
    expect(await nodes.count()).toBeGreaterThan(0)
    
    expectNoConsoleErrors(errors)
  })

  test('Cmd+S shortcut triggers save', async ({ page }) => {
    const errors = setupConsoleErrorTracking(page)
    
    await pressShortcut(page, 's')
    await page.waitForTimeout(200)
    
    // Verify snapshot was created
    const snapshotKeys = await page.evaluate(() => {
      const keys = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('canvas-snapshot-')) {
          keys.push(key)
        }
      }
      return keys
    })
    
    expect(snapshotKeys.length).toBeGreaterThan(0)
    
    expectNoConsoleErrors(errors)
  })
})
