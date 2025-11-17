import type { Page } from '@playwright/test'

// Shared helpers for priming UI state and dismissing blocking overlays

export async function primeUiState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      // Mark keyboard legend as seen to disable auto-show overlays
      localStorage.setItem('olumi_keys_seen', '1')
      ;(window as any).__E2E = '1'
    } catch {
      // ignore storage failures in tests
    }
  })
}

export async function dismissAllOverlays(page: Page): Promise<void> {
  // Best-effort blanket Escape for any open overlay
  try {
    await page.keyboard.press('Escape')
  } catch {
    // ignore
  }

  // If any dialog is still visible, send Escape again
  const dialogs = page.locator('[role="dialog"]')
  const anyDialogVisible = await dialogs.first().isVisible({ timeout: 1000 }).catch(() => false)
  if (anyDialogVisible) {
    try {
      await page.keyboard.press('Escape')
    } catch {
      // ignore
    }
  }

  // Onboarding overlays often expose a "Skip" button; force-click it if present
  const skipButton = page.locator('button:has-text("Skip")')
  const hasSkip = await skipButton.first().isVisible({ timeout: 500 }).catch(() => false)
  if (hasSkip) {
    await skipButton.first().click({ force: true })
  }
}
