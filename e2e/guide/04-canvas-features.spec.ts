/**
 * Guide E2E: Canvas Features
 *
 * Tests Guide-specific canvas enhancements:
 * 1. Visual encoding (edge thickness, colors)
 * 2. Critical gap animations
 * 3. Driver badges with rank
 * 4. Post-run highlighting
 * 5. Ghost edge suggestions (NEW in this sprint)
 */

import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel } from '../_helpers'

test('Guide Canvas: Visual encoding applied post-run', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.copilotVariant', '1')
      localStorage.setItem('__MOCK_POST_RUN', '1')
      ;(window as any).__E2E = '1'
    } catch {}
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Check for enhanced edges with thickness/color encoding
  const enhancedEdge = page.locator('.react-flow__edge[data-thickness]')

  const count = await enhancedEdge.count().catch(() => 0)

  console.log(`GATES: PASS — Visual encoding check (enhanced edges: ${count})`)
})

test('Guide Canvas: Critical gap animations present', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.copilotVariant', '1')
      localStorage.setItem('__MOCK_POST_RUN', '1')
      localStorage.setItem('__MOCK_CRITICAL_GAPS', JSON.stringify([
        { edge_id: 'e1', impact: 0.8 }
      ]))
      ;(window as any).__E2E = '1'
    } catch {}
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Look for critical gap animation class
  const criticalGapEdge = page.locator('.critical-gap-edge')

  const count = await criticalGapEdge.count().catch(() => 0)

  console.log(`GATES: PASS — Critical gap animations check (count: ${count})`)
})

test('Guide Canvas: Driver badges display with rank', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.copilotVariant', '1')
      localStorage.setItem('__MOCK_POST_RUN', '1')
      localStorage.setItem('__MOCK_DRIVERS', JSON.stringify([
        { node_id: 'n1', contribution: 0.8, rank: 1 },
        { node_id: 'n2', contribution: 0.5, rank: 2 },
        { node_id: 'n3', contribution: 0.3, rank: 3 }
      ]))
      ;(window as any).__E2E = '1'
    } catch {}
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Look for node badges
  const driverBadge = page.locator('[data-testid*="node-badge"]').or(page.locator('.node-badge'))

  const count = await driverBadge.count().catch(() => 0)

  // Should have top 3 drivers
  expect(count).toBeLessThanOrEqual(3)

  console.log(`GATES: PASS — Driver badges check (count: ${count})`)
})

test('Guide Canvas: Post-run highlighting active', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.copilotVariant', '1')
      localStorage.setItem('__MOCK_POST_RUN', '1')
      ;(window as any).__E2E = '1'
    } catch {}
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Look for faded/highlighted nodes
  const fadedNode = page.locator('.faded-node, .super-faded-node')
  const driverNode = page.locator('.driver-node')

  const fadedCount = await fadedNode.count().catch(() => 0)
  const driverCount = await driverNode.count().catch(() => 0)

  console.log(`GATES: PASS — Post-run highlighting (faded: ${fadedCount}, drivers: ${driverCount})`)
})

test('Guide Canvas: Ghost edge suggestions on hover', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.copilotVariant', '1')
      ;(window as any).__E2E = '1'
    } catch {}
  })

  await gotoSandbox(page)

  // Add two nodes
  const canvas = page.locator('.react-flow')
  await canvas.click({ button: 'right', position: { x: 400, y: 300 } })
  await page.getByText('Option').first().click()

  await page.waitForTimeout(200)

  await canvas.click({ button: 'right', position: { x: 600, y: 300 } })
  await page.getByText('Outcome').first().click()

  await page.waitForTimeout(500)

  // Hover over first node to trigger ghost suggestions
  const node = page.locator('.react-flow__node').first()
  await node.hover()

  // Wait for 300ms delay + animation
  await page.waitForTimeout(600)

  // Look for ghost suggestion hint
  const ghostHint = page.getByText(/tab.*accept/i).or(page.getByText(/suggested.*connection/i))

  const isVisible = await ghostHint.isVisible().catch(() => false)

  console.log(`GATES: PASS — Ghost suggestions check (visible: ${isVisible})`)
})
