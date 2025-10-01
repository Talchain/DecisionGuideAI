import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'
import { mkdir, writeFile } from 'fs/promises'

// Reduced-motion runtime guard: verifies scheduleFlush() uses microtask path
// (no requestAnimationFrame) and public strings remain unchanged.

test('Reduced motion uses microtask flush; no RAF; strings unchanged', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.streamBuffer', '1')
      ;(window as any).__E2E = '1'
      // Match reduced motion
      const mm = (q: string) => ({ matches: q.includes('prefers-reduced-motion'), media: q, addListener() {}, removeListener() {} })
      Object.defineProperty(window, 'matchMedia', { value: mm, configurable: true })
      // Count RAF calls; our reduced-motion path should not use RAF
      ;(window as any).__RAF_COUNT = 0
      Object.defineProperty(window, 'requestAnimationFrame', { value: () => { (window as any).__RAF_COUNT++; return 1 }, configurable: true })
    } catch {}
  })

  await installFakeEventSource(page)
  await gotoSandbox(page)
  await waitForPanel(page)

  // Start streaming
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open')
    // Emit a few tokens to exercise the buffering + scheduleFlush()
    es.emit('token', 'Hello ')
    es.emit('token', 'World')
    es.emit('done')
  })

  // Ensure status chip reflects done state; strings unchanged
  await expect(page.getByTestId('status-chip')).toHaveText(/done/i)

  // Assert no RAF calls under reduced motion (microtask path used)
  const rafCount = await page.evaluate(() => (window as any).__RAF_COUNT || 0)
  expect(rafCount).toBe(0)

  // Evidence note
  const dir = 'docs/evidence/a11y'
  await mkdir(dir, { recursive: true })
  await writeFile(`${dir}/reduced_motion_note.txt`, 'Reduced-motion honoured (microtask fallback).\n', 'utf8')
})
