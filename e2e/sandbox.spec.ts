import { test, expect } from '@playwright/test'

// Helper to set flags and stub EventSource before app scripts run
async function primePage(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.hints', '1')
      localStorage.setItem('feature.streamBuffer', '0') // deterministic text assertions
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.runReport', '1')
      // Bypass access guard for E2E: treat user as authenticated
      localStorage.setItem('sb-auth-token', '1')
    } catch {}
  })

// Re-run from History: snap params and start immediately
test('Re-run from History starts streaming with snapped params', async ({ page }) => {
  await primePage(page)
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.history', '1')
      localStorage.setItem('feature.historyRerun', '1')
      localStorage.setItem('sandbox.seed', '42')
      localStorage.setItem('sandbox.budget', '3.5')
      localStorage.setItem('sandbox.model', 'local-sim')
    } catch {}
  })
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('/#/sandbox')

  // Run once to record into history
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('token', 'Hello', '1'); es.emit('done')
  })

  // Open history and click Re-run
  await page.getByTestId('history-btn').click()
  await page.getByTestId('history-drawer').isVisible()
  await page.getByTestId('rerun-btn').click()

  // A new ES instance should be created, with params in URL
  const url = await page.evaluate(() => (window as any).FakeEventSource.instances.at(-1).url)
  expect(url).toContain('seed=42')
  expect(url).toContain('budget=3.5')
  expect(url).toContain('model=local-sim')

  // Drive this re-run to completion
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances.at(-1)
    es.emit('open'); es.emit('token', 'Again', '2'); es.emit('done')
  })
  await expect(page.getByTestId('status-chip')).toHaveText('Done')
})

  await page.addInitScript(() => {
    class FakeEventSource {
      static instances: any[] = []
      url: string
      closed = false
      onopen: ((ev: any) => void) | null = null
      onmessage: ((ev: any) => void) | null = null
      onerror: ((ev: any) => void) | null = null
      private listeners = new Map<string, Set<(ev: any) => void>>()
      constructor(url: string) {
        this.url = url
        ;(FakeEventSource as any).instances.push(this)
      }
      addEventListener(type: string, cb: (ev: any) => void) {
        const set = this.listeners.get(type) || new Set()
        set.add(cb)
        this.listeners.set(type, set)
      }
      close() { this.closed = true }
      emit(type: string, data?: string, id?: string) {
        if (this.closed) return
        if (type === 'open') { this.onopen?.({}); return }
        if (type === 'error') { this.onerror?.({}); return }
        const ev: any = { data, lastEventId: id }
        if (type === 'message') this.onmessage?.(ev)
        const set = this.listeners.get(type)
        if (set) set.forEach((cb) => cb(ev))
      }
    }
    ;(window as any).FakeEventSource = FakeEventSource
    ;(window as any).EventSource = FakeEventSource as any
  })
}

// Happy path: Start -> tokens -> Done
test('Sandbox happy path renders tokens and Done', async ({ page }) => {
  await primePage(page)
  await page.route('http://localhost:54321/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.goto('/#/sandbox')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('[data-testid="start-btn"]', { timeout: 15000 })
  if (await page.getByTestId('start-btn').isVisible()) {
    await page.getByTestId('start-btn').click()
  } else {
    await page.getByRole('button', { name: 'Start' }).click()
  }

  // Drive the fake stream
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open')
    es.emit('token', 'Hel', '1')
    es.emit('token', 'lo', '2')
    es.emit('token', '!', '3')
    es.emit('done')
  })

  await expect(page.getByTestId('stream-output')).toHaveText('Hello!')
  await expect(page.getByTestId('status-chip')).toHaveText('Done')
})

// Stop UX: Start -> token -> Stop -> Cancelled -> server emits Aborted -> chip shows Aborted
test('Sandbox Stop then Aborted UX', async ({ page }) => {
  await primePage(page)
  await page.route('http://localhost:54321/**', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  await page.goto('/#/sandbox')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle')
  await expect(page.getByTestId('start-btn')).toBeVisible()
  await page.getByTestId('start-btn').click()

  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open')
    es.emit('token', 'A', '1')
  })

  await page.getByTestId('stop-btn').click()
  await expect(page.getByTestId('status-chip')).toHaveText('Cancelled')

  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('aborted')
  })

  await expect(page.getByTestId('status-chip')).toHaveText('Aborted')
})

// Limited-by-budget shows chip + limited tip
test('Sandbox limited by budget shows limited tip', async ({ page }) => {
  await primePage(page)
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('/#/sandbox')
  await page.waitForSelector('[data-testid="start-btn"]')
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('token', 'X', '1'); es.emit('limited')
  })
  await expect(page.getByTestId('status-chip')).toHaveText('Limited by budget')
  await expect(page.getByTestId('limited-tip')).toBeVisible()
})

// Retry once then terminal Error
test('Sandbox retry then terminal Error', async ({ page }) => {
  await primePage(page)
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('/#/sandbox')
  await page.waitForSelector('[data-testid="start-btn"]')
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => { const es = (window as any).FakeEventSource.instances[0]; es.emit('open'); es.emit('error') })
  await expect(page.getByTestId('reconnect-hint')).toBeVisible()
  await page.waitForFunction(() => (window as any).FakeEventSource.instances.length === 2)
  await page.evaluate(() => { const es2 = (window as any).FakeEventSource.instances[1]; es2.emit('error') })
  await expect(page.getByTestId('status-chip')).toHaveText('Error')
})

// Params persistence + URL includes params
test('Sandbox params persist and stream URL includes them', async ({ page }) => {
  await primePage(page)
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('/#/sandbox')
  await page.waitForSelector('[data-testid="param-seed"]')
  await page.getByTestId('param-seed').fill('42')
  await page.getByTestId('param-budget').fill('3.5')
  await page.getByTestId('param-model').selectOption('local-sim')
  await page.reload()
  await page.waitForSelector('[data-testid="param-seed"]')
  await expect(page.getByTestId('param-seed')).toHaveValue('42')
  await expect(page.getByTestId('param-budget')).toHaveValue('3.5')
  await expect(page.getByTestId('param-model')).toHaveValue('local-sim')
  await page.getByTestId('start-btn').click()
  const url = await page.evaluate(() => (window as any).FakeEventSource.instances[0].url)
  expect(url).toContain('seed=42')
  expect(url).toContain('budget=3.5')
  expect(url).toContain('model=local-sim')
})

// Report drawer opens post-terminal; Esc returns focus
test('Report drawer basic open and Esc returns focus', async ({ page }) => {
  await primePage(page)
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('/#/sandbox')
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => { const es = (window as any).FakeEventSource.instances[0]; es.emit('open'); es.emit('done') })
  const btn = page.getByTestId('view-report-btn')
  await expect(btn).toBeVisible()
  await btn.click()
  await expect(page.getByTestId('report-drawer')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(btn).toBeFocused()
})

// Keyboard-only: Tab/Enter/Space can Start; chip gets focus at terminal
test('Keyboard-only start and status chip focus at terminal', async ({ page }) => {
  await primePage(page)
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('/#/sandbox')
  await page.keyboard.press('Tab') // focus Start
  await page.keyboard.press('Enter')
  await page.evaluate(() => { const es = (window as any).FakeEventSource.instances[0]; es.emit('open'); es.emit('done') })
  await page.waitForTimeout(10)
  await expect(page.getByTestId('status-chip')).toBeFocused()
})

// Run History: record one run, open drawer, basic fields, Esc returns focus, persists after reload
test('Run History drawer shows entries and persists', async ({ page }) => {
  await primePage(page)
  // Enable history flag before app scripts run
  await page.addInitScript(() => { try { localStorage.setItem('feature.history', '1') } catch {} })
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto('/#/sandbox')
  await page.waitForSelector('[data-testid="start-btn"]')

  // Seed one quick run
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('token', 'He', '1'); es.emit('token', 'llo', '2'); es.emit('done')
  })

  // Open history
  const histBtn = page.getByTestId('history-btn')
  await expect(histBtn).toBeVisible()
  await histBtn.click()
  await expect(page.getByTestId('history-drawer')).toBeVisible()
  await expect(page.getByTestId('history-list')).toBeVisible()
  // Has an entry with Done status
  await expect(page.getByTestId('history-status').first()).toHaveText('Done')

  // Esc closes and focus returns to trigger
  await page.keyboard.press('Escape')
  await expect(histBtn).toBeFocused()

  // Reload and verify persistence
  await page.reload()
  await expect(page.getByTestId('history-btn')).toBeVisible()
  await page.getByTestId('history-btn').click()
  await expect(page.getByTestId('history-list')).toBeVisible()
  await expect(page.getByTestId('history-status').first()).toBeVisible()
})
