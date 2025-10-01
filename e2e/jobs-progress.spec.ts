import { test, expect } from '@playwright/test'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'

test('Jobs progress panel shows Running then Done, Cancel triggers /jobs/cancel once', async ({ page }) => {
  // Flags + auth bypass + shim
  await page.addInitScript(() => {
    try {
      localStorage.setItem('feature.sseStreaming', '1')
      localStorage.setItem('feature.hints', '1')
      localStorage.setItem('feature.jobsProgress', '1')
      // Bypass auth/navigation in E2E
      localStorage.setItem('sb-auth-token', '1')
      localStorage.setItem('dga_access_validated', 'true')
      localStorage.setItem('dga_access_validation_time', String(Date.now()))
      localStorage.setItem('dga_access_code', btoa('dga_v1_DGAIV01'))
      ;(window as any).__E2E = '1'
    } catch {}
  })
  await installFakeEventSource(page)
  // Swallow any Supabase calls
  await page.route('http://localhost:54321/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))

  // Intercept cancel endpoint and count calls
  const cancelCalls: string[] = []
  await page.route((u) => String(u).includes('/jobs/cancel'), async (route) => {
    cancelCalls.push(route.request().url())
    await route.fulfill({ status: 202, body: '' })
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Jobs UI should be present and a jobs EventSource created on mount
  await expect(page.getByTestId('jobs-list')).toBeVisible()
  await page.waitForFunction(() => {
    const insts = (window as any).FakeEventSource?.instances || []
    return insts.some((it: any) => String(it?.url || '').includes('/jobs/stream'))
  })
  const getES = () => page.evaluateHandle(() => {
    const insts = (window as any).FakeEventSource.instances || []
    return insts.find((it: any) => String(it?.url || '').includes('/jobs/stream'))
  })

  // queued -> running shows Cancel
  await page.evaluate(() => { const es = (window as any).FakeEventSource.instances[0]; es.emit('queued') })
  await expect(page.getByTestId('jobs-list')).toBeVisible()
  await page.evaluate(() => { const es = (window as any).FakeEventSource.instances[0]; es.emit('running') })
  await expect(page.getByTestId('job-status')).toHaveText('Running')
  await expect(page.getByTestId('job-cancel-btn')).toBeVisible()

  // Click Cancel once
  await page.getByTestId('job-cancel-btn').click()
  // Server echo may still arrive, but we only count our POST
  await page.waitForTimeout(50)
  expect(cancelCalls.length).toBe(1)

  // Done hides cancel
  await page.evaluate(() => { const es = (window as any).FakeEventSource.instances[0]; es.emit('done') })
  await expect(page.getByTestId('job-status')).toHaveText('Done')
  await expect(page.getByTestId('job-cancel-btn')).toHaveCount(0)
})
