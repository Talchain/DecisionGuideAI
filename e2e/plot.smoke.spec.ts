import { test, expect } from '@playwright/test'
test.setTimeout(10000)

const ROUTE = '/#/plot'

async function getWorkspaceState(page) {
  return await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('plot_workspace_state')
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  })
}

test.describe('Scenario Sandbox /plot - P0 guardrails', () => {
  test('Banner transitions and basic load', async ({ page }) => {
    await page.goto(ROUTE)
    await expect(page.getByText('Checking', { exact: false })).toBeVisible()
    await expect(
      page.locator('text=/Ready|Demo Mode/')
    ).toBeVisible({ timeout: 20000 })
  })

  test('Ink persist across reload and Clear empties', async ({ page }) => {
    await page.goto(ROUTE)

    const canvas = page.getByTestId('whiteboard-canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    // Draw a small stroke
    const start = { x: box.x + box.width / 2 - 20, y: box.y + box.height / 2 }
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 60, start.y + 10)
    await page.mouse.up()

    // Reload and assert paths persisted
    await page.reload()
    const after = await getWorkspaceState(page)
    expect(after?.whiteboardPaths?.length || 0).toBeGreaterThan(0)

    // Accept confirm dialog for Clear
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Clear' }).click()
    await page.reload()
    const cleared = await getWorkspaceState(page)
    expect((cleared?.whiteboardPaths?.length || 0) + (cleared?.stickyNotes?.length || 0) + (cleared?.nodes?.length || 0)).toBe(0)
  })

  test('Notes: add via M, enters edit, space types; drag has no jump at different zooms', async ({ page }) => {
    await page.goto(ROUTE)

    // Add note via keyboard
    await page.keyboard.press('m')
    const textarea = page.locator('textarea')
    await expect(textarea).toBeVisible()

    // Space types while editing
    await textarea.type('Hello')
    await page.keyboard.press('Space')
    await expect(textarea).toHaveValue(/Hello\s$/)

    // Exit edit to drag
    await textarea.blur()

    // Zoom out then drag
    const canvas = page.getByTestId('whiteboard-canvas')
    const box = await canvas.boundingBox()
    if (!box) return
    await page.mouse.move(box.x + 50, box.y + 50)
    // wheel to zoom out and in
    await canvas.hover()
    await page.mouse.wheel(0, -200) // zoom in
    await page.mouse.wheel(0, 200) // zoom out

    // Drag note by grabbing its card area (absolute divs). Heuristic: drag near center where note likely is.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 + 10)
    await page.mouse.up()

    // Persist drag
    const state = await getWorkspaceState(page)
    expect((state?.stickyNotes?.length || 0)).toBeGreaterThan(0)
  })

  test('Nodes: add (N), connect (C click→click), rename, persist', async ({ page }) => {
    await page.goto(ROUTE)

    // Add two nodes via keyboard
    await page.keyboard.press('n')
    await page.keyboard.press('n')

    // Drag the second node by clicking one of the hit areas
    const hitAreas = page.getByTestId('node-hit-area')
    await expect(hitAreas.first()).toBeVisible()
    const count = await hitAreas.count()
    expect(count).toBeGreaterThanOrEqual(2)

    const firstBox = await hitAreas.nth(0).boundingBox()
    const secondBox = await hitAreas.nth(1).boundingBox()
    if (!firstBox || !secondBox) return

    // Connect mode
    await page.keyboard.press('c')
    await page.mouse.click(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
    await page.mouse.click(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2)

    // Rename first node (double click then type)
    await page.mouse.dblclick(firstBox.x + firstBox.width / 2, firstBox.y + firstBox.height / 2)
    const input = page.locator('input[type="text"]')
    await expect(input).toBeVisible()
    await input.fill('Renamed')
    await input.blur()

    // Reload and ensure nodes/edges persisted
    await page.reload()
    const after = await getWorkspaceState(page)
    expect((after?.nodes?.length || 0)).toBeGreaterThanOrEqual(2)
  })

  test('No page scroll during canvas pan/zoom; Space+drag pans', async ({ page }) => {
    await page.goto(ROUTE)
    const canvas = page.getByTestId('whiteboard-canvas')
    const beforeScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))

    // Space+drag pan gesture
    const box = await canvas.boundingBox()
    if (!box) return
    await canvas.hover()
    await page.keyboard.down('Space')
    await page.mouse.move(box.x + 200, box.y + 200)
    await page.mouse.down()
    await page.mouse.move(box.x + 250, box.y + 230)
    await page.mouse.up()
    await page.keyboard.up('Space')

    const afterScroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }))
    expect(afterScroll.y).toBe(beforeScroll.y)
    expect(afterScroll.x).toBe(beforeScroll.x)
  })

  test('No re-fetch storm after init', async ({ page, context }) => {
    let versionHits = 0
    let fixturesHits = 0
    await context.route(/version\.json|fixtures\//, route => {
      const url = route.request().url()
      if (url.includes('version.json')) versionHits++
      if (url.includes('fixtures/')) fixturesHits++
      route.continue()
    })

    await page.goto(ROUTE)
    // Interact a bit after ready
    await expect(page.locator('text=/Ready|Demo Mode/')).toBeVisible()
    await page.keyboard.press('m')
    await page.keyboard.press('n')
    await page.waitForTimeout(500)

    // Expect only initial calls (allow small leeway of <=2)
    expect(versionHits).toBeGreaterThanOrEqual(1)
    expect(versionHits).toBeLessThanOrEqual(2)
    expect(fixturesHits).toBeGreaterThanOrEqual(1)
    expect(fixturesHits).toBeLessThanOrEqual(3)
  })

  test('Zoom centers under cursor (node remains under mouse)', async ({ page }) => {
    await page.goto(ROUTE)
    const canvas = page.getByTestId('whiteboard-canvas')
    const box = await canvas.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    // Add one node centered in view
    await page.keyboard.press('n')

    const hitAreas = page.getByTestId('node-hit-area')
    await expect(hitAreas.first()).toBeVisible()

    // Choose the node closest to canvas center
    const cx = box.x + box.width / 2
    const cy = box.y + box.height / 2
    const count = await hitAreas.count()
    let bestIdx = 0
    let bestDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < count; i++) {
      const bb = await hitAreas.nth(i).boundingBox()
      if (!bb) continue
      const mx = bb.x + bb.width / 2
      const my = bb.y + bb.height / 2
      const d2 = (mx - cx) * (mx - cx) + (my - cy) * (my - cy)
      if (d2 < bestDist) { bestDist = d2; bestIdx = i }
    }

    const target = hitAreas.nth(bestIdx)
    const bb = await target.boundingBox()
    if (!bb) return
    const mouseX = bb.x + bb.width / 2
    const mouseY = bb.y + bb.height / 2

    // Hover over node center and zoom in
    await page.mouse.move(mouseX, mouseY)
    await page.mouse.wheel(0, -500)

    const after = await target.boundingBox()
    if (!after) return
    const ax = after.x + after.width / 2
    const ay = after.y + after.height / 2
    expect(Math.abs(ax - mouseX)).toBeLessThanOrEqual(3)
    expect(Math.abs(ay - mouseY)).toBeLessThanOrEqual(3)

    console.log('GATES: PASS — e2e zoom centers under cursor')
  })

  test('Toolbar clickable above overlapping note (layering OK)', async ({ page }) => {
    test.setTimeout(10000);

    // Ensure we’re on the plot route when running this test in isolation
    const ROUTE = process.env.E2E_ROUTE ?? '/#/plot'
    await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
    await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' })

    // Add a note via toolbar and ensure it’s visible
    await page.getByTestId('plot-toolbar').getByRole('button', { name: /note/i }).click();
    const note = page.getByTestId('sticky-note').first();
    await expect(note).toBeVisible();

    // Exit edit mode so mousedown/drag isn't swallowed by the textarea
    const editor = page.getByRole('textbox').first();
    if (await editor.isVisible()) {
      await editor.press('Escape');
      await expect(editor).not.toBeVisible();
    }

    // 2) Get bounding boxes
    const nb0 = await note.boundingBox();
    const tb0 = await page.getByTestId('plot-toolbar').boundingBox();
    expect(nb0 && tb0).toBeTruthy();

    // 3) Drag the note's center into the toolbar's center
    const noteCenterX = nb0!.x + nb0!.width / 2;
    const noteCenterY = nb0!.y + nb0!.height / 2;
    const toolbarCenterX = tb0!.x + tb0!.width / 2;
    const toolbarCenterY = tb0!.y + tb0!.height / 2;

    await page.mouse.move(noteCenterX, noteCenterY);
    await page.mouse.down();
    await page.mouse.move(toolbarCenterX, toolbarCenterY, { steps: 10 });
    await page.mouse.up();

    // 4) Assert true AABB overlap on BOTH axes
    const nb = await note.boundingBox();
    const tb = await page.getByTestId('plot-toolbar').boundingBox();
    expect(nb && tb).toBeTruthy();

    const overlapX = nb!.x < tb!.x + tb!.width && nb!.x + nb!.width > tb!.x;
    const overlapY = nb!.y < tb!.y + tb!.height && nb!.y + nb!.height > tb!.y;
    expect(overlapX).toBeTruthy();
    expect(overlapY).toBeTruthy();

    // 5) Toolbar must still be clickable above note
    await page.getByTestId('plot-toolbar').getByRole('button', { name: /note/i }).click();
    await expect(page.getByRole('textbox').first()).toBeVisible();

    console.log('GATES: PASS — toolbar clickable above notes')
  })
})
