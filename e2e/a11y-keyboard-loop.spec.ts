import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { gotoSandbox, installFakeEventSource } from './_helpers'
import { mkdir } from 'node:fs/promises'

// A11y: within each drawer, Tab/Shift+Tab loops; Esc restores focus to trigger; axe serious/critical = 0

async function runA11yLoopTest(page: import('@playwright/test').Page, triggerTestId: string, drawerTestId: string, screenshotName: string) {
  const trigger = page.getByTestId(triggerTestId)
  await expect(trigger).toBeEnabled()
  await trigger.focus()
  await expect(trigger).toBeFocused()

  // Open drawer
  await Promise.all([
    page.waitForSelector(`[data-testid=${drawerTestId}]`),
    trigger.click(),
  ])

  const drawer = page.getByTestId(drawerTestId)
  await expect(drawer).toBeVisible()

  // Find focusable within drawer
  const first = drawer.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').first()
  const last = drawer.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').last()

  // Focus last and press Tab -> should wrap to first
  await last.focus()
  await page.keyboard.press('Tab')
  await expect(first).toBeFocused()

  // Focus first and press Shift+Tab -> should wrap to last
  await first.focus()
  await page.keyboard.press('Shift+Tab')
  await expect(last).toBeFocused()

  // Esc should close drawer and focus returns to trigger
  await page.keyboard.press('Escape')
  await expect(drawer).toHaveCount(0)
  await expect(trigger).toBeFocused()

  // Axe check (serious/critical = 0)
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  const serious = (results.violations || []).filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.length).toBe(0)

  // Screenshot evidence
  await mkdir('docs/evidence/a11y', { recursive: true })
  await page.screenshot({ path: `docs/evidence/a11y/${screenshotName}.png`, fullPage: false })
}

test.describe('A11y keyboard-loop', () => {
  test.beforeEach(async ({ page }) => {
    await installFakeEventSource(page)
    await page.addInitScript(() => {
      try {
        localStorage.setItem('feature.sseStreaming', '1')
        localStorage.setItem('feature.runReport', '1')
        localStorage.setItem('feature.params', '1')
        localStorage.setItem('feature.snapshots', '1')
        localStorage.setItem('feature.compare', '1')
        ;(window as any).__E2E = 1
      } catch {}
    })
    await page.route('**/report**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: 1, seed: 777, route: 'critique', startedAt: '1970-01-01T00:00:00.000Z', finishedAt: '1970-01-01T00:00:01.000Z', totals: { inputTokens: 1, outputTokens: 1 }, steps: [], meta: {}, sections: [] }) }))
    await gotoSandbox(page)
    await page.getByTestId('start-btn').click()
    await page.evaluate(() => { const es=(window as any).FakeEventSource?.instances?.[0]; es?.emit('open'); es?.emit('done') })
  })

  test('Report drawer loops focus; Esc restores to trigger', async ({ page }) => {
    await runA11yLoopTest(page, 'view-report-btn', 'report-drawer', 'a11y_keyboard_loop_report')
  })
})
