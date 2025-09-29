import { test, expect } from '@playwright/test'
import { AxeBuilder } from '@axe-core/playwright'
import { gotoSandbox, waitForPanel, installFakeEventSource } from './_helpers'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

// Vendored axe scan across key surfaces

test('Vendored axe scans: Sandbox + Results + Report + Simplify + Share RO + Compare + Audit (serious/critical = 0)', async ({ page, context }) => {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('feature.canvasSimplify', '1')
      window.localStorage.setItem('feature.listView', '1')
      window.localStorage.setItem('feature.engineMode', '1')
      window.localStorage.setItem('feature.sseStreaming', '1')
      window.localStorage.setItem('feature.runReport', '1')
      window.localStorage.setItem('feature.params', '1')
      window.localStorage.setItem('feature.snapshots', '1')
      window.localStorage.setItem('feature.compare', '1')
      ;(window as any).__E2E = 1
      // Clipboard stub to capture share links
      const w: any = window
      w.__CLIPBOARD = ''
      const clip: any = (navigator as any).clipboard || {}
      clip.writeText = async (t: string) => { w.__CLIPBOARD = String(t); return }
      ;(navigator as any).clipboard = clip
    } catch {}
  })
  await installFakeEventSource(page)
  // Stub /report with a minimal valid payload when triggered
  await page.route('**/report**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ version: 1, seed: 777, route: 'critique', startedAt: '1970-01-01T00:00:00.000Z', finishedAt: '1970-01-01T00:00:01.000Z', totals: { inputTokens: 1, outputTokens: 1 }, steps: [], meta: {}, sections: [] })
    })
  })

  await gotoSandbox(page)
  await waitForPanel(page)

  // Start a run and finish quickly to reveal results/report actions
  await page.getByTestId('start-btn').click()
  await page.evaluate(() => {
    const es = (window as any).FakeEventSource?.instances?.[0]; es?.emit('open'); es?.emit('done')
  })

  // Results Summary is optional; assert visibility if present
  const rs = page.getByTestId('results-summary')
  if (await rs.count() > 0) {
    await expect(rs).toBeVisible()
  }

  // Open Report Drawer and ensure visible
  const viewReportBtn = page.getByTestId('view-report-btn')
  await expect(viewReportBtn).toBeEnabled()
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/report') && r.ok()),
    viewReportBtn.click(),
  ])
  await expect(page.getByTestId('report-drawer')).toBeVisible()

  // Toggle Simplify to display the badge
  await page.getByTestId('simplify-toggle').click()
  await expect(page.getByTestId('simplify-badge').first()).toBeVisible()
  // Ensure Audit panel visible (mounted in E2E path)
  await expect(page.getByTestId('audit-panel')).toBeVisible()

  // Create two snapshots and open Compare Drawer area
  await page.getByTestId('snapshot-btn').click()
  await page.getByTestId('snapshot-btn').click()
  const selA = page.getByTestId('compare-select-a')
  const selB = page.getByTestId('compare-select-b')
  await expect(selA.locator('option')).toHaveCount(3)
  const valB = await selA.locator('option').nth(1).getAttribute('value')
  const valA = await selA.locator('option').nth(2).getAttribute('value')
  await selA.selectOption(valA!)
  await selB.selectOption(valB!)
  await expect(page.getByTestId('compare-diff-list')).toBeVisible()

  // Axe scan on main Sandbox page
  const resultsMain = await new AxeBuilder({ page })
    .disableRules(['color-contrast']) // allow brand colors in PoC
    .analyze()

  // Open read-only Share link in a new page and scan
  // Copy share link from newest snapshot
  await page.getByTestId('sharelink-copy').first().click()
  const url = await page.evaluate(() => {
    try { return (window as any).__CLIPBOARD || '' } catch { return '' }
  })
  let resultsShare: any = { violations: [] }
  if (url) {
    const p2 = await context.newPage()
    await p2.goto(url, { waitUntil: 'domcontentloaded' })
    await expect(p2.getByTestId('snapshot-readonly-badge')).toBeVisible()
    resultsShare = await new AxeBuilder({ page: p2 as any })
      .disableRules(['color-contrast'])
      .analyze()
  }

  const allViolations = [
    ...(resultsMain.violations || []),
    ...(resultsShare.violations || []),
  ]
  const seriousOrCritical = allViolations.filter(v => v.impact === 'serious' || v.impact === 'critical')

  // Write a lightweight summary
  await mkdir(path.join(process.cwd(), 'docs/evidence/a11y'), { recursive: true })
  const summaryPath = 'docs/evidence/a11y/axe_summary.txt'
  const lines: string[] = []
  lines.push(`Tested at: ${new Date().toISOString()}`)
  lines.push(`Violations: ${allViolations.length}`)
  lines.push(`Serious/Critical: ${seriousOrCritical.length}`)
  if (seriousOrCritical.length > 0) {
    for (const v of seriousOrCritical) lines.push(`- ${v.id}: ${v.help}`)
  }
  await writeFile(summaryPath, lines.join('\n'), 'utf8')

  expect(seriousOrCritical.length).toBe(0)
})
