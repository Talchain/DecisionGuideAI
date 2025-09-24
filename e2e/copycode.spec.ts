import { test, expect } from '@playwright/test'

// Prime page with flags, FakeEventSource, and clipboard stub before app scripts run
async function primeCopyPage(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.hints', '1')
      localStorage.setItem('feature.mdPreview', '1')
      localStorage.setItem('feature.copyCode', '1')
      localStorage.setItem('feature.streamBuffer', '0') // deterministic preview flush on terminal
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.runReport', '1')
      // Treat as authenticated for E2E
      localStorage.setItem('sb-auth-token', '1')
    } catch {}
  })
  await page.addInitScript(() => {
    // Stub clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (t: string) => {
          ;(window as any).__lastCopied = t
          return Promise.resolve()
        },
      },
      configurable: true,
    })
    ;(window as any).__lastCopied = ''
  })
  await page.addInitScript(() => {
    // Stub EventSource in-page (mirrors existing E2E usage)
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

test('Markdown preview Copy code copies fenced contents and announces', async ({ page }) => {
  await primeCopyPage(page)
  // Stub any Supabase calls the app may attempt
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

  // Navigate to sandbox
  await page.goto('/#/sandbox')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForLoadState('networkidle')
  // Wait until Start appears in either form
  await page.waitForFunction(() => {
    const byId = document.querySelector('[data-testid="start-btn"]') as HTMLElement | null
    if (byId && (byId.offsetParent !== null)) return true
    const buttons = Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]
    return buttons.some((b) => /\bStart\b/i.test(b.textContent || ''))
  }, { timeout: 20000 })
  // Click Start (data-testid or role fallback)
  if (await page.getByTestId('start-btn').isVisible().catch(() => false)) {
    await page.getByTestId('start-btn').click()
  } else {
    await page.getByRole('button', { name: 'Start' }).click()
  }

  // Drive a minimal fenced block stream: ```js, body, ``` then done
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open')
    es.emit('token', '```js\n', '1')
    es.emit('token', "console.log('hi')\n", '2')
    es.emit('token', '```', '3')
    es.emit('done')
  })

  // Preview rendered (aria-hidden=true is expected)
  await expect(page.getByTestId('md-preview')).toBeVisible()

  // Find the copy button (language-aware accessible label)
  let copyBtn = page.getByRole('button', { name: /Copy (js|JavaScript) code/i })
  if (!(await copyBtn.isVisible().catch(() => false))) {
    copyBtn = page.getByRole('button', { name: /Copy code/i })
  }
  await expect(copyBtn).toBeVisible()

  await copyBtn.click()

  // Clipboard got exact fenced text (without trailing fence or language line)
  await page.waitForFunction(() => (window as any).__lastCopied === "console.log('hi')")

  // Offscreen status announces then clears
  const status = page.getByTestId('copy-aria-status')
  await expect(status).toHaveText('Copied')
  await expect(status).toHaveText('', { timeout: 2500 })

  // Optional: transient attribute on the control
  const attr = await copyBtn.getAttribute('data-copied')
  // Either present briefly or already cleared depending on timing
  expect(attr === 'true' || attr === null).toBeTruthy()
})
