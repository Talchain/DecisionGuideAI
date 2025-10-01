import { test, expect } from '@playwright/test'
import { waitForPanel, gotoSandbox, installFakeEventSource } from './_helpers'

function downloadToString(dl: import('@playwright/test').Download): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const stream = await dl.createReadStream()
      if (!stream) {
        const p = await dl.path()
        if (!p) return reject(new Error('No download path'))
        const fs = await import('fs')
        fs.readFile(p, 'utf8', (err, data) => err ? reject(err) : resolve(data))
        return
      }
      let data = ''
      stream.setEncoding('utf8')
      stream.on('data', (chunk) => { data += chunk })
      stream.on('end', () => resolve(data))
      stream.on('error', reject)
    } catch (e) {
      reject(e)
    }
  })
}

// E2E: Markdown export produces a file with front-matter and body
test('Export Markdown produces critique-*.md with header and body', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.export', '1')
      localStorage.setItem('feature.params', '1')
      localStorage.setItem('feature.streamBuffer', '0')
      localStorage.setItem('sb-auth-token', '1')
      localStorage.setItem('dga_access_validated', 'true')
      localStorage.setItem('dga_access_validation_time', String(Date.now()))
      localStorage.setItem('dga_access_code', btoa('dga_v1_DGAIV01'))
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await gotoSandbox(page)
  await waitForPanel(page)
  await page.waitForSelector('[data-testid="start-btn"]')
  await page.getByTestId('start-btn').click()

  await page.evaluate(() => {
    const es = (window as any).FakeEventSource.instances[0]
    es.emit('open'); es.emit('token', 'Hello', '1'); es.emit('done')
  })

  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-md-btn').click(),
  ])

  const name = dl.suggestedFilename()
  expect(/^critique-\d{8}-\d{4}\.md$/.test(name)).toBeTruthy()

  const text = await downloadToString(dl)
  // Has front-matter header (markers) and a date line; other keys may be omitted when undefined
  expect(text).toContain('---')
  expect(text).toMatch(/date:\s*\d{4}-\d{2}-\d{2}T/) // ISO-like
  // Body contains the streamed content
  expect(text.trim().endsWith('Hello')).toBe(true)
})
