// e2e/sandbox.multiselect.spec.ts
import { test, expect } from '@playwright/test';

const route = process.env.E2E_ROUTE ?? '/#/test';

async function rectXY(el: import('@playwright/test').Locator) {
  const x = await el.getAttribute('x');
  const y = await el.getAttribute('y');
  return { x: Number(x ?? '0'), y: Number(y ?? '0') };
}

function platformModifier() {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

test.beforeEach(async ({ page }) => {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('whiteboard-canvas').waitFor({ state: 'visible' });
  // Ensure clean slate via Clear if available
  const clear = page.getByTestId('clear-btn');
  if (await clear.isVisible().catch(() => false)) {
    await clear.click();
  }
});

test('shift-click — multi-select drag applies one batchMove; undo/redo works', async ({ page }) => {
  // Add 3 nodes
  const add = page.getByTestId('add-node-btn');
  await add.click(); await add.click(); await add.click();
  await expect(page.getByTestId('graph-node')).toHaveCount(3);

  const node = (i: number) => page.getByTestId('graph-node').nth(i);
  const rect = (i: number) => node(i).locator('rect');

  // Shift+Click nodes 0 and 2 to select them both
  await rect(0).click(); // first selects 0
  await rect(2).click({ modifiers: ['Shift'] });

  // Capture initial positions
  const a0 = await rectXY(rect(0));
  const c0 = await rectXY(rect(2));

  // Drag node 0 by ~(+40,+30)
  const box0 = await rect(0).boundingBox();
  if (!box0) throw new Error('bbox unavailable');
  await page.mouse.move(box0.x + box0.width / 2, box0.y + box0.height / 2);
  await page.mouse.down();
  await page.mouse.move(box0.x + box0.width / 2 + 40, box0.y + box0.height / 2 + 30);
  await page.mouse.up();

  // Read positions after drag
  const a1 = await rectXY(rect(0));
  const c1 = await rectXY(rect(2));
  expect(a1.x - a0.x).toBeGreaterThanOrEqual(37);
  expect(a1.y - a0.y).toBeGreaterThanOrEqual(27);
  // Node 2 should have moved by the same delta (±3px tolerance)
  expect(Math.abs((c1.x - c0.x) - (a1.x - a0.x))).toBeLessThanOrEqual(3);
  expect(Math.abs((c1.y - c0.y) - (a1.y - a0.y))).toBeLessThanOrEqual(3);

  // Undo then Redo
  await page.getByTestId('undo-btn').click();
  const aU = await rectXY(rect(0));
  const cU = await rectXY(rect(2));
  expect(aU.x).toBe(a0.x); expect(aU.y).toBe(a0.y);
  expect(cU.x).toBe(c0.x); expect(cU.y).toBe(c0.y);

  await page.getByTestId('redo-btn').click();
  const aR = await rectXY(rect(0));
  const cR = await rectXY(rect(2));
  expect(Math.abs((aR.x - a0.x) - (a1.x - a0.x))).toBeLessThanOrEqual(2);
  expect(Math.abs((aR.y - a0.y) - (a1.y - a0.y))).toBeLessThanOrEqual(2);
  expect(Math.abs((cR.x - c0.x) - (c1.x - c0.x))).toBeLessThanOrEqual(2);
  expect(Math.abs((cR.y - c0.y) - (c1.y - c0.y))).toBeLessThanOrEqual(2);

  console.log('GATES: PASS — multiselect shift-click e2e');
});

test('marquee delete — select two by marquee, Delete removes, Undo restores', async ({ page }) => {
  const add = page.getByTestId('add-node-btn');
  await add.click(); await add.click(); await add.click();
  await expect(page.getByTestId('graph-node')).toHaveCount(3);
  const svg = page.getByTestId('whiteboard-canvas');

  // Read first two rects to build marquee box
  const rect0 = page.getByTestId('graph-node').nth(0).locator('rect');
  const rect1 = page.getByTestId('graph-node').nth(1).locator('rect');
  const p0 = await rectXY(rect0);
  const p1 = await rectXY(rect1);

  // Node rect size assumption (PoC): 120x40
  const minX = Math.min(p0.x, p1.x) - 5;
  const minY = Math.min(p0.y, p1.y) - 5;
  const maxX = Math.max(p0.x + 120, p1.x + 120) + 5;
  const maxY = Math.max(p0.y + 40, p1.y + 40) + 5;

  const bbox = await svg.boundingBox();
  if (!bbox) throw new Error('svg bbox unavailable');

  // Convert svg coords (approx) to page coords using bbox offsets
  await page.mouse.move(bbox.x + minX, bbox.y + minY);
  await page.mouse.down();
  await page.mouse.move(bbox.x + maxX, bbox.y + maxY);
  await page.mouse.up();

  // Expect marquee to have been visible momentarily, then selection applied
  await expect(page.getByTestId('graph-node').nth(0)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('graph-node').nth(1)).toHaveAttribute('aria-selected', 'true');

  // Delete selection
  await page.keyboard.press('Delete').catch(async () => { await page.keyboard.press('Backspace'); });
  await expect(page.getByTestId('graph-node')).toHaveCount(1);

  // Undo restores
  await page.getByTestId('undo-btn').click();
  await expect(page.getByTestId('graph-node')).toHaveCount(3);

  console.log('GATES: PASS — multiselect marquee/delete e2e');
});

test('select all esc — Cmd/Ctrl+A selects all; Esc clears', async ({ page }) => {
  const add = page.getByTestId('add-node-btn');
  await add.click(); await add.click(); await add.click();
  await expect(page.getByTestId('graph-node')).toHaveCount(3);

  const mod = platformModifier();
  await page.keyboard.press(`${mod}+KeyA` );

  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId('graph-node').nth(i)).toHaveAttribute('aria-selected', 'true');
  }

  await page.keyboard.press('Escape');
  for (let i = 0; i < 3; i++) {
    await expect(page.getByTestId('graph-node').nth(i)).not.toHaveAttribute('aria-selected', 'true');
  }

  console.log('GATES: PASS — multiselect keyboard e2e');
});
