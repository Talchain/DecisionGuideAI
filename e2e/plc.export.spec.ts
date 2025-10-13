import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const ROUTE = process.env.E2E_ROUTE ?? '/?e2e=1#/plc'

async function mountPlc(page: import('@playwright/test').Page) {
  await page.addInitScript(() => { try {
    localStorage.setItem('PLC_ENABLED','1')
    localStorage.setItem('plc.snap','0')
    localStorage.setItem('plc.guides','0')
    localStorage.setItem('plc.snapGuide','0')
  } catch {} })
  await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => location.hash === '#/plc')
  await page.getByTestId('plc-root').waitFor()
  await page.getByTestId('plc-whiteboard').waitFor()
}

function plcRects(page: import('@playwright/test').Page) {
  return page.locator('svg g[data-testid="plc-node"] rect')
}

// Utility to open IO panel
async function openIO(page: import('@playwright/test').Page) {
  const toggle = page.getByTestId('plc-io-toggle-btn')
  await toggle.click()
  await page.getByTestId('plc-io-panel').waitFor()
  return toggle
}

test('PLC Export: deterministic JSON, clipboard success + fallback, Axe=0 on panel', async ({ page }) => {
  await mountPlc(page)

  // Seed two nodes and one edge (self edge when created by default UI)
  const add = page.getByTestId('add-node-btn')
  await add.click(); await add.click()
  await expect(plcRects(page)).toHaveCount(2)

  const toggle = await openIO(page)

  // A11y: panel has no serious issues
  const axe = await new AxeBuilder({ page }).include('[data-testid="plc-io-panel"]').analyze()
  const serious = axe.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
  expect(serious.length, serious.map(v => v.id).join(',')).toBe(0)

  // Stub clipboard success path
  await page.evaluate(() => { (window as any).__CLIPS = [] })
  await page.route('**/*', route => route.continue())
  await page.evaluate(() => {
    const original = navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (t: string) => { (window as any).__CLIPS.push(t); return Promise.resolve() },
      }
    })
    ;(window as any).__CLIPBOARD_ORIG = original
  })

  await page.getByTestId('plc-io-export').click()
  const clips = await page.evaluate(() => (window as any).__CLIPS)
  expect(Array.isArray(clips)).toBe(true)
  const exported = String(clips[clips.length - 1] || '')
  expect(exported.length).toBeGreaterThan(0)
  // Exact fixture (deep-sorted keys -> edges, nodes, schemaVersion) with two nodes, no edges
  const expected = `{
  "edges": [],
  "nodes": [
    {
      "id": "n1",
      "label": "Node 1",
      "x": 100,
      "y": 80
    },
    {
      "id": "n2",
      "label": "Node 2",
      "x": 300,
      "y": 80
    }
  ],
  "schemaVersion": 1
}`
  expect(exported).toBe(expected)

  // Validate deterministic shape
  const parsed = JSON.parse(exported)
  expect(parsed.schemaVersion).toBe(1)
  expect(Array.isArray(parsed.nodes)).toBe(true)
  expect(Array.isArray(parsed.edges)).toBe(true)
  // Sorted by id and from+to
  const nodeIds = parsed.nodes.map((n: any) => n.id)
  expect([...nodeIds].sort().join(',')).toBe(nodeIds.join(','))
  const edgeKeys = parsed.edges.map((e: any) => `${e.from}|${e.to}`)
  expect([...edgeKeys].sort().join(',')).toBe(edgeKeys.join(','))

  // Force clipboard failure to exercise fallback path
  await page.evaluate(() => {
    ;(navigator as any).clipboard = {
      writeText: (_t: string) => Promise.reject(new Error('denied')),
    }
    // Make execCommand succeed for textarea fallback
    ;(document as any).execCommand = (_cmd: string) => true
  })
  await page.getByTestId('plc-io-export').click()
  // Expect success via fallback
  await expect(page.getByTestId('plc-io-status')).toHaveText('Exported ✓')

  // Close via Esc and focus returns to toggle
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('plc-io-panel')).toHaveCount(0)
  await expect(toggle).toBeFocused()
})
