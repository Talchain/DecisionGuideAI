import { test, expect, type Page } from '@playwright/test'

// Uses a fresh browser-context copy of a saved example, without an AI request.
// Also runnable against a candidate with playwright.select-grab.config.ts.
async function snapshot(page: Page) {
  return page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('.react-flow__viewport')!
    const matrix = new DOMMatrixReadOnly(getComputedStyle(viewport).transform)
    const nodes = [...document.querySelectorAll<HTMLElement>('.react-flow__node')]
    return {
      x: matrix.e, y: matrix.f,
      selected: nodes.filter(node => node.classList.contains('selected'))
        .map(node => node.dataset.id!).sort(),
      positions: Object.fromEntries(nodes.map(node => [node.dataset.id!, node.style.transform])),
    }
  })
}

async function drag(page: Page, x: number, y: number, dx: number, dy: number) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  await page.mouse.up()
}

async function fit(page: Page) {
  await page.getByRole('button', { name: 'Fit to view', exact: true }).click()
  await page.evaluate(async () => {
    await document.fonts.ready
    let previous = '', stableSince = performance.now()
    // Initial measured-card layout is debounced after fit/LOD changes. Wait
    // for its actual geometry, not only the faster viewport animation.
    while (performance.now() - stableSince < 1000) {
      await new Promise(requestAnimationFrame)
      const current = JSON.stringify([
        document.querySelector<HTMLElement>('.react-flow__viewport')!.style.transform,
        ...[...document.querySelectorAll<HTMLElement>('.react-flow__node')].map(node => {
          const box = node.getBoundingClientRect()
          return [node.style.transform, box.width, box.height]
        }),
      ])
      if (current !== previous) stableSince = performance.now()
      previous = current
    }
  })
}

for (const ids of [['dec_cdp'], ['opt_segment', 'opt_rudderstack']]) {
  test(`Hand pans a ${ids.length}-node marquee selection and Select restores dragging`, async ({ page }, testInfo) => {
    await page.goto('/#/canvas')
    await page.getByRole('button', { name: /Customer Data Platform Selection Replace CDP/ }).click()
    await expect(page.locator('[data-id="dec_cdp"]')).toBeVisible()
    await page.getByRole('button', { name: 'Collapse outputs dock', exact: true }).click()
    await fit(page)
    // Keep the target below the local offline-engine notice, when present.
    // This is ordinary Hand panning; no UI or model state is injected.
    await drag(page, 1000, 180, 0, 160)
    await page.getByRole('button', { name: 'Switch to Select mode', exact: true }).click()

    const boxes = await Promise.all(ids.map(id => page.locator(`[data-id="${id}"]`).boundingBox()))
    expect(boxes.every(Boolean)).toBe(true)
    const left = Math.min(...boxes.map(b => b!.x)) - 3
    const top = Math.min(...boxes.map(b => b!.y)) - 3
    const right = Math.max(...boxes.map(b => b!.x + b!.width)) + 3
    const bottom = Math.max(...boxes.map(b => b!.y + b!.height)) + 3
    await drag(page, left, top, right - left, bottom - top)
    const selected = [...ids].sort()
    await expect.poll(async () => (await snapshot(page)).selected).toEqual(selected)

    const overlay = page.locator('.react-flow__nodesselection-rect')
    await expect(overlay).toBeVisible()
    const box = (await overlay.boundingBox())!
    const start = { x: box.x + 12, y: box.y + 12 }
    await page.getByRole('button', { name: 'Switch to Hand mode', exact: true }).click()
    await expect(page.locator('.canvas-mode-hand')).toBeVisible()
    const hit = await page.evaluate(({ x, y }) => {
      const element = document.elementFromPoint(x, y)!
      return { cursor: getComputedStyle(element).cursor, onSelectionOverlay: !!element.closest('.react-flow__nodesselection') }
    }, start)
    expect(hit).toEqual({ cursor: 'grab', onSelectionOverlay: false })
    const before = await snapshot(page)
    await drag(page, start.x, start.y, 80, 40)
    await expect.poll(async () => (await snapshot(page)).x - before.x).toBeCloseTo(80, 0)
    const panned = await snapshot(page)
    expect(panned.y - before.y).toBeCloseTo(40, 0)
    expect(panned.selected).toEqual(selected)
    expect(panned.positions).toEqual(before.positions)

    await page.getByRole('button', { name: 'Switch to Select mode', exact: true }).click()
    const restoredBox = (await overlay.boundingBox())!
    await drag(page, restoredBox.x + 12, restoredBox.y + 12, 40, 20)
    await expect.poll(async () => (await snapshot(page)).positions[ids[0]])
      .not.toEqual(panned.positions[ids[0]])
    const moved = await snapshot(page)
    expect(moved.x).toBe(panned.x)
    expect(moved.y).toBe(panned.y)
    expect(moved.selected).toEqual(selected)
    for (const id of ids) expect(moved.positions[id]).not.toBe(panned.positions[id])
    for (const id of Object.keys(moved.positions).filter(id => !ids.includes(id))) {
      expect(moved.positions[id]).toBe(panned.positions[id])
    }
    // Escape retains its existing focused-node/selection cancellation semantics.
    // It must not pan or mutate model positions, and is never needed to switch tools.
    await page.keyboard.press('Escape')
    const escaped = await snapshot(page)
    expect(escaped.positions).toEqual(moved.positions)
    expect(escaped.x).toBe(moved.x)
    expect(escaped.y).toBe(moved.y)
    // Focus is on the selection rectangle after group dragging, rather than
    // an individual node. Escape therefore keeps this selection intact.
    expect(escaped.selected).toEqual(moved.selected)
    await testInfo.attach('selection-pan-and-drag', {
      body: JSON.stringify({ before, panned, moved, escaped }), contentType: 'application/json',
    })
  })
}
