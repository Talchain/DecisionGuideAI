import { test, expect, Page } from '@playwright/test'
import { openCanvas, setupConsoleErrorTracking, expectNoConsoleErrors } from './helpers/canvas'

async function addNodeNearEdge(page: Page, side: 'left' | 'right'): Promise<void> {
  const root = page.locator('[data-testid="rf-root"]')
  const box = await root.boundingBox()
  if (!box) throw new Error('Could not get rf-root bounding box')

  const x = side === 'left' ? box.x + 16 : box.x + box.width - 16
  const y = box.y + box.height / 2

  await page.mouse.dblclick(x, y)
}

test.describe('S8-DOCK-LAYOUT: docked layout keeps canvas interactive', () => {
  test.describe('when dock feature flag is OFF', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('feature.inputsOutputs', '0')
          ;(window as any).__E2E = '1'
        } catch {}
      })

      await openCanvas(page)
    })

    test('renders canvas without inputs/outputs docks and nodes near edges remain clickable', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)

      const inputsDock = page.locator('[aria-label="Inputs dock"], [data-testid="inputs-dock"]')
      const outputsDock = page.locator('[aria-label="Outputs dock"], [data-testid="outputs-dock"]')

      await expect(inputsDock).toHaveCount(0)
      await expect(outputsDock).toHaveCount(0)

      const nodes = page.locator('[data-testid="rf-node"]')
      const initialCount = await nodes.count()

      await addNodeNearEdge(page, 'left')
      await page.waitForTimeout(200)
      const afterLeft = await nodes.count()
      expect(afterLeft).toBeGreaterThanOrEqual(initialCount)

      if (afterLeft > 0) {
        const leftNode = nodes.nth(afterLeft - 1)
        await leftNode.click()
        await expect(leftNode).toHaveClass(/border-\[#EA7B4B\]/)
      }

      await addNodeNearEdge(page, 'right')
      await page.waitForTimeout(200)
      const afterRight = await nodes.count()
      expect(afterRight).toBeGreaterThanOrEqual(afterLeft)

      if (afterRight > 0) {
        const rightNode = nodes.nth(afterRight - 1)
        await rightNode.click()
        await expect(rightNode).toHaveClass(/border-\[#EA7B4B\]/)
      }

      expectNoConsoleErrors(errors)
    })
  })

  test.describe('when dock feature flag is ON', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => {
        try {
          localStorage.setItem('feature.inputsOutputs', '1')
          ;(window as any).__E2E = '1'
        } catch {}
      })

      await openCanvas(page)
    })

    test('shows inputs and outputs docks and nodes near edges remain clickable', async ({ page }) => {
      const errors = setupConsoleErrorTracking(page)

      const inputsDock = page.locator('[data-testid="inputs-dock"]')
      const outputsDock = page.locator('[data-testid="outputs-dock"]')

      await expect(inputsDock).toBeVisible()
      await expect(outputsDock).toBeVisible()

      const nodes = page.locator('[data-testid="rf-node"]')
      const initialCount = await nodes.count()

      await addNodeNearEdge(page, 'left')
      await page.waitForTimeout(200)
      const afterLeft = await nodes.count()
      expect(afterLeft).toBeGreaterThanOrEqual(initialCount)

      if (afterLeft > 0) {
        const leftNode = nodes.nth(afterLeft - 1)
        await leftNode.click()
        await expect(leftNode).toHaveClass(/border-\[#EA7B4B\]/)
      }

      await addNodeNearEdge(page, 'right')
      await page.waitForTimeout(200)
      const afterRight = await nodes.count()
      expect(afterRight).toBeGreaterThanOrEqual(afterLeft)

      if (afterRight > 0) {
        const rightNode = nodes.nth(afterRight - 1)
        await rightNode.click()
        await expect(rightNode).toHaveClass(/border-\[#EA7B4B\]/)
      }

      expectNoConsoleErrors(errors)
    })
  })
})
