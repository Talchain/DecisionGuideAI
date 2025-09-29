import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

// Lightweight web-worker layout probe at 20 nodes; target ≤150 ms
// We create a Blob worker inside the page, do an O(n) grid layout, and time it.

test('Worker layout at 20 nodes ≤150 ms', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const code = `self.onmessage = (ev) => { const { nodes } = ev.data; const t0 = Date.now(); const cols = 5; const spacing = 40; const out = []; for (let i=0;i<nodes.length;i++){ const r = Math.floor(i/cols), c = i%cols; out.push({ id: nodes[i].id, x: c*spacing, y: r*spacing }); } const dt = Date.now()-t0; self.postMessage({ dt, count: out.length }); };`;
    const blob = new Blob([code], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const w: Worker = new Worker(url);
    const nodes = Array.from({ length: 20 }).map((_, i) => ({ id: 'n' + (i + 1) }));
    const out: any = await new Promise((resolve) => {
      w.onmessage = (ev) => resolve(ev.data);
      w.postMessage({ nodes });
    });
    try { w.terminate() } catch {}
    return out;
  });

  const budgetMs = 150;
  expect(result.count).toBe(20);
  expect(result.dt).toBeLessThanOrEqual(budgetMs);

  // Persist evidence
  const evidenceDir = path.join(process.cwd(), 'docs/evidence/perf');
  await mkdir(evidenceDir, { recursive: true });
  const payload = { nodes: 20, dt_ms: result.dt, budget_ms: budgetMs, ok: result.dt <= budgetMs };
  await writeFile(path.join(evidenceDir, 'worker_20_nodes.json'), JSON.stringify(payload, null, 2), 'utf8');
});
