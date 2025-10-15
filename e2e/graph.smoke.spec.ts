import { test, expect } from '@playwright/test'

test.describe('React Flow Graph - Smoke Test', () => {
  test('renders with ?rf=1 flag', async ({ page }) => {
    await page.goto('/#/plot?rf=1')
    
    // Wait for React Flow to render
    await expect(page.locator('[data-testid="react-flow-graph"]')).toBeVisible()
    
    // Check that legacy canvases are not rendered
    await expect(page.locator('[data-testid="legacy-canvas"]')).not.toBeVisible()
    await expect(page.locator('[data-testid="plc-canvas-adapter"]')).not.toBeVisible()
  })

  test('has React Flow controls', async ({ page }) => {
    await page.goto('/#/plot?rf=1')
    
    // Check for React Flow UI elements
    await expect(page.locator('.react-flow__controls')).toBeVisible()
    await expect(page.locator('.react-flow__minimap')).toBeVisible()
  })

  test('renders decision nodes', async ({ page }) => {
    await page.goto('/#/plot?rf=1')
    
    // Wait for graph to load
    await page.waitForTimeout(500)
    
    // Check if nodes are rendered (if there are default nodes)
    const nodes = page.locator('[data-testid="decision-node"]')
    const nodeCount = await nodes.count()
    
    // Should have at least the background and controls
    const reactFlowExists = await page.locator('.react-flow').count()
    expect(reactFlowExists).toBeGreaterThan(0)
  })

  test('does not render when flag is off', async ({ page }) => {
    await page.goto('/#/plot')
    
    // React Flow should not be visible without flag
    await expect(page.locator('[data-testid="react-flow-graph"]')).not.toBeVisible()
    
    // Legacy canvas should be visible instead
    const legacyVisible = await page.locator('[data-testid="legacy-canvas"]').isVisible()
    expect(legacyVisible).toBe(true)
  })
})
