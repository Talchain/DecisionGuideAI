import { expect, Page } from '@playwright/test'

export async function installFakeEventSource(page: Page) {
  await page.addInitScript(() => {
    // A simple deterministic EventSource shim used across specs
    class FakeEventSource {
      static instances: any[] = []
      url: string
      readyState = 0
      onopen: any = null
      onmessage: any = null
      onerror: any = null
      private listeners: Record<string, Function[]> = {}
      constructor(url: string) {
        this.url = String(url)
        ;(FakeEventSource as any).instances.push(this)
        setTimeout(() => { this.readyState = 1; this.onopen && this.onopen({}) }, 0)
      }
      addEventListener(type: string, cb: any) {
        ;(this.listeners[type] ||= []).push(cb)
      }
      emit(type: string, data?: any, id?: string) {
        const ev: any = { data: typeof data === 'string' ? data : data == null ? '' : JSON.stringify(data), lastEventId: id }
        ;(this.listeners[type] || []).forEach((cb) => cb(ev))
        if (type === 'message' && this.onmessage) this.onmessage(ev)
        if (type === 'error' && this.onerror) this.onerror(ev)
        if (type === 'open' && this.onopen) this.onopen(ev)
      }
      close() { this.readyState = 2 }
    }
    ;(window as any).FakeEventSource = FakeEventSource
    ;(window as any).EventSource = FakeEventSource as any
  })
}

export async function waitForPanel(page: Page) {
  // Primary: window flag set by E2E mount probe in main.tsx
  try {
    await page.waitForFunction(() => (window as any).__PANEL_RENDERED === true, { timeout: 8000 })
  } catch {}
  try {
    // Best-effort E2E surface probe; non-fatal if missing
    await page.waitForSelector('[data-testid=e2e-surface]', { timeout: 2000 })
  } catch {}
  // Panel root should be present; allow a generous timeout to avoid flake
  try {
    await page.waitForSelector('[data-testid=panel-root]', { timeout: 10000 })
  } catch {
    // Final fallback: wait for Start button (core control)
    await page.waitForSelector('[data-testid=start-btn]', { timeout: 10000 })
  }
}

export async function gotoSandbox(page: Page) {
  // Warm-up navigation to base E2E URL first, then go to the hash route
  await page.goto('/?e2e=1', { waitUntil: 'domcontentloaded' })
  try { await page.waitForLoadState('networkidle', { timeout: 5000 }) } catch {}
  await page.goto('/?e2e=1#/sandbox', { waitUntil: 'domcontentloaded' })
  try { await page.waitForLoadState('networkidle', { timeout: 5000 }) } catch {}
  await waitForPanel(page)
}
