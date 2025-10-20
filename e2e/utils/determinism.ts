import type { Page } from '@playwright/test'

export async function setupDeterministicTest(page: Page, opt: { width?: number; height?: number; dark?: boolean; timestamp?: number } = {}) {
  const { width=1280, height=720, dark=false, timestamp=1697731200000 } = opt
  
  await page.addInitScript((ts) => { Date.now = () => ts; Date.prototype.getTime = () => ts }, timestamp)
  await page.addInitScript(() => {
    let s = 12345
    Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  })
  
  await page.setViewportSize({ width, height })
  await page.emulateMedia({ colorScheme: dark ? 'dark' : 'light' })
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:.001s!important;transition-duration:.001s!important}' })
  await page.evaluate(() => (document as any).fonts?.ready)
  await page.waitForLoadState('networkidle')
}
