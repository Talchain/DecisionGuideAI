import { test, expect } from '@playwright/test'
import { waitForPanel, gotoSandbox, installFakeEventSource } from './_helpers'

// Replay run (seeded) — E2E using unified harness
// - Enable SSE + params + replay
// - Start with a known seed, finish, then Replay
// - Assert the new EventSource URL includes the same seed
// - Assert the "Replayed from <seed>" chip is visible once

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.replay', '1')
      localStorage.removeItem('cfg.gateway')
      ;(window as any).__E2E = '1'
    } catch {}
  })
})

test('Replay run uses prior seed and shows chip', async ({ page }) => {
  await installFakeEventSource(page)
  await gotoSandbox(page)
  await waitForPanel(page)

  // Provide a stable seed
  const seedInput = page.getByTestId('param-seed')
  await expect(seedInput).toBeVisible()
  await seedInput.fill('777')

  // Start and finish the first run
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('done')
  })

  const replayBtn = page.getByTestId('replay-btn')
  await expect(replayBtn).toBeVisible()
  await replayBtn.click()

  // New instance must include the same seed
  const url = await page.evaluate(() => {
    const list = (window as any).FakeEventSource.instances
    const last = list[list.length - 1]
    return last?.url || ''
  })
  expect(url).toContain('seed=777')

  // Chip becomes visible exactly once
  const chip = page.getByTestId('replayed-chip')
  await expect(chip).toBeVisible()
  await expect(chip).toHaveAttribute('title', /Replayed from /)
})
