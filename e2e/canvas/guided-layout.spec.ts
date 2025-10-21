import { test, expect } from '@playwright/test'

test.describe('Guided Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/canvas')
    await page.waitForSelector('[data-testid="react-flow-graph"]')
  })

  test('does not apply until Apply - Cancel keeps positions', async ({ page }) => {
    // Capture initial positions
    const initialPositions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('[data-id]')
      return Array.from(nodes).map(node => {
        const rect = node.getBoundingClientRect()
        return { id: node.getAttribute('data-id'), x: rect.x, y: rect.y }
      })
    })

    // Open guided layout dialog
    await page.getByRole('button', { name: /layout/i }).click()
    await page.getByRole('button', { name: /guided layout/i }).click()
    
    // Wait for dialog
    await page.waitForSelector('[data-testid="dialog-guided-layout"]')
    
    // Click Cancel
    await page.getByRole('button', { name: /cancel/i }).click()
    
    // Verify positions unchanged
    await page.waitForTimeout(100)
    const afterCancelPositions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('[data-id]')
      return Array.from(nodes).map(node => {
        const rect = node.getBoundingClientRect()
        return { id: node.getAttribute('data-id'), x: rect.x, y: rect.y }
      })
    })

    expect(afterCancelPositions).toEqual(initialPositions)
  })

  test('goals appear before outcomes in LR layout', async ({ page }) => {
    // Add a goal and outcome node if not present
    await page.evaluate(() => {
      const store = (window as any).__canvasStore
      if (store) {
        // Ensure we have goal and outcome nodes
        store.getState().addNode({ x: 100, y: 100 }, 'goal')
        store.getState().addNode({ x: 500, y: 100 }, 'outcome')
      }
    })

    // Open guided layout
    await page.getByRole('button', { name: /layout/i }).click()
    await page.getByRole('button', { name: /guided layout/i }).click()
    
    // Select Left → Right
    await page.getByLabel(/left.*right/i).check()
    
    // Apply
    await page.getByRole('button', { name: /apply/i }).click()
    
    // Wait for layout to apply
    await page.waitForTimeout(200)
    
    // Measure goal and outcome X positions
    const positions = await page.evaluate(() => {
      const goals: number[] = []
      const outcomes: number[] = []
      
      document.querySelectorAll('[data-id]').forEach(node => {
        const type = node.getAttribute('data-type')
        const rect = node.getBoundingClientRect()
        if (type === 'goal') goals.push(rect.x)
        if (type === 'outcome') outcomes.push(rect.x)
      })
      
      return { goals, outcomes }
    })

    // Goals should be to the left of outcomes
    if (positions.goals.length > 0 && positions.outcomes.length > 0) {
      const minGoalX = Math.min(...positions.goals)
      const minOutcomeX = Math.min(...positions.outcomes)
      expect(minGoalX).toBeLessThan(minOutcomeX)
    }
  })

  test('undo restores pre-layout positions', async ({ page }) => {
    // Capture initial positions
    const initialPositions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('[data-id]')
      return Array.from(nodes).map(node => {
        const rect = node.getBoundingClientRect()
        return { id: node.getAttribute('data-id'), x: Math.round(rect.x), y: Math.round(rect.y) }
      })
    })

    // Apply guided layout
    await page.getByRole('button', { name: /layout/i }).click()
    await page.getByRole('button', { name: /guided layout/i }).click()
    await page.getByRole('button', { name: /apply/i }).click()
    
    await page.waitForTimeout(200)

    // Undo with keyboard
    await page.keyboard.press('Meta+Z')
    
    await page.waitForTimeout(100)

    // Verify positions restored
    const afterUndoPositions = await page.evaluate(() => {
      const nodes = document.querySelectorAll('[data-id]')
      return Array.from(nodes).map(node => {
        const rect = node.getBoundingClientRect()
        return { id: node.getAttribute('data-id'), x: Math.round(rect.x), y: Math.round(rect.y) }
      })
    })

    expect(afterUndoPositions).toEqual(initialPositions)
  })
})
