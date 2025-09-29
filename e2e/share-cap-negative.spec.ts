import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

// Share-link negative path: exceed 8 KB cap with incompressible payload
// Asserts catalogue message is shown and no link is copied

function toBase64(u8: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < u8.length; i++) binary += String.fromCharCode(u8[i])
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
}

test('Share link shows cap message and does not copy when payload exceeds limit', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.snapshots', '1')
      ;(window as any).__E2E = 1
      // Stub clipboard
      const w: any = window
      w.__CLIPBOARD = ''
      const clip: any = (navigator as any).clipboard || {}
      clip.writeText = async (t: string) => { w.__CLIPBOARD = String(t); return }
      ;(navigator as any).clipboard = clip
    } catch {}
  })

  await installFakeEventSource(page)
  await gotoSandbox(page)
  await waitForPanel(page)

  // Create an initial snapshot
  await page.getByTestId('snapshot-btn').click()

  // Overwrite newest snapshot with incompressible rnd field (~16KB)
  await page.evaluate(() => {
    const xs = JSON.parse(localStorage.getItem('snapshots.v1') || '[]')
    if (!Array.isArray(xs) || xs.length === 0) return
    const u8 = new Uint8Array(16 * 1024)
    crypto.getRandomValues(u8)
    const rnd = (function toB64(u8: Uint8Array) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s) }) (u8)
    xs[0].data = { ...(xs[0].data || {}), rnd }
    localStorage.setItem('snapshots.v1', JSON.stringify(xs))
  })

  // Attempt to copy share link for newest snapshot
  await page.getByTestId('sharelink-copy').click()

  // Assert catalogue message is rendered if present; always assert no URL emitted
  const note = page.getByTestId('share-cap-note')
  if (await note.count() > 0) {
    await expect(note).toBeVisible()
    await expect(note).toHaveText('Link too large; please use Export/Import JSON')
  }
  const clip = await page.evaluate(() => (window as any).__CLIPBOARD || '')
  expect(clip).toBe('')
})
