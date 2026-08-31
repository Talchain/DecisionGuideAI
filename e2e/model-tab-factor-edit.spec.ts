/**
 * Native keyboard witness of the real ModelTabV2Panel at dock width.
 *
 * This is deliberately a controlled browser mount, not deployed acceptance:
 * synthetic node props, the real panel/projections/row, and a dispatch-only
 * authority double. No store writer, network persistence, or receipt is faked.
 * The separate component suite covers the real authority invocation. This
 * suite can prove input gestures and honest unconfirmed rendering only.
 *
 * Vite's fixture and aliases are generated outside the repository and removed
 * afterward. No shared Vite/Playwright configuration or runtime file changes.
 */
import { test, expect, type Page, type TestInfo } from '@playwright/test'
import { mkdtemp, realpath, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import tailwindcss from 'tailwindcss'

const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)))
const require = createRequire(import.meta.url)
const AI_ID = 'browser-factor-ai'
const USER_ID = 'browser-factor-user'
const SELECT_ALL = process.platform === 'darwin' ? 'Meta+A' : 'Control+A'
let fixtureDir: string
let server: ViteDevServer
let baseURL: string

test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 900, height: 900 } })

test.beforeAll(async () => {
  fixtureDir = await realpath(await mkdtemp(join(tmpdir(), 'model-tab-browser-fixture-')))
  const authorityPath = join(fixtureDir, 'authority.ts')
  const focusPath = join(fixtureDir, 'focus.ts')
  await writeFile(authorityPath, `
    export function useModelEditAuthority(nodeId: string | null) {
      return {
        proposeFactorValue(value: number) {
          window.dispatchEvent(new CustomEvent('fixture-factor-dispatch', {
            detail: { nodeId, value },
          }));
          return 'dispatched';
        },
        proposeFactorConfirmation() { throw new Error('Outside factor-edit witness scope'); },
        proposeOptionIntervention() { throw new Error('Outside factor-edit witness scope'); },
      };
    }
  `)
  await writeFile(focusPath, `export function focusNodeById() {}\nexport function focusEdgeById() {}\n`)
  await writeFile(join(fixtureDir, 'index.html'), `
    <!doctype html><html lang="en"><head><meta charset="UTF-8" />
    <title>Controlled Model-tab editing witness</title></head>
    <body><div id="root"></div><script type="module" src="/entry.tsx"></script></body></html>
  `)
  await writeFile(join(fixtureDir, 'fixture.css'), `
    @import ${JSON.stringify(join(REPO, 'src/styles/brand.css'))};
    @tailwind base;
    @tailwind components;
    @tailwind utilities;
    body { margin: 24px; font-family: Inter, system-ui, sans-serif; background: var(--bg-canvas); }
    #dock { width: 440px; background: rgb(var(--bg-panel-rgb)); }
    #fixture-controls { margin-top: 16px; font-size: 12px; }
    #fixture-controls button { border: 1px solid #999; padding: 6px 10px; }
  `)
  await writeFile(join(fixtureDir, 'entry.tsx'), `
    import React, { useEffect, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { ModelTabV2Panel } from ${JSON.stringify(join(REPO, 'src/canvas/model-tab-v2/ModelTabV2Panel.tsx'))};
    import './fixture.css';
    const nodes = [
      { id: '${AI_ID}', type: 'factor', position: { x: 0, y: 0 }, data: {
        label: 'Estimated factor', kind: 'factor', category: 'observable',
        observedState: { value: 0.5, raw_value: 0.5, source: 'cee_inference' },
      } },
      { id: '${USER_ID}', type: 'factor', position: { x: 0, y: 100 }, data: {
        label: 'Supplied factor', kind: 'factor', category: 'observable',
        observedState: { value: 0.4, raw_value: 0.4, source: 'user' },
      } },
    ];
    function Fixture() {
      const [attempts, setAttempts] = useState([]);
      useEffect(() => {
        const record = event => setAttempts(prev => [...prev, event.detail]);
        window.addEventListener('fixture-factor-dispatch', record);
        return () => window.removeEventListener('fixture-factor-dispatch', record);
      }, []);
      return <>
        <main id="dock" data-testid="fixture-dock">
          <ModelTabV2Panel nodes={nodes} edges={[]} goalThreshold={null} />
        </main>
        <aside id="fixture-controls" aria-label="Test fixture controls">
          <button type="button">Outside editor</button>
          <p>Controlled dispatcher only. No canonical acknowledgement.</p>
          <output data-testid="fixture-dispatches">{JSON.stringify(attempts)}</output>
        </aside>
      </>;
    }
    createRoot(document.getElementById('root')).render(<Fixture />);
  `)
  const tailwindConfig = (await import(pathToFileURL(join(REPO, 'tailwind.config.js')).href)).default
  server = await createServer({
    configFile: false,
    root: fixtureDir,
    envDir: fixtureDir,
    cacheDir: join(fixtureDir, '.vite'),
    logLevel: 'error',
    esbuild: { jsx: 'automatic' },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [fixtureDir, REPO] } },
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: [
        { find: /^(?:.*\/)?hooks\/useModelEditAuthority(?:\.ts)?$/, replacement: authorityPath },
        { find: /^(?:.*\/)?utils\/focusHelpers(?:\.ts)?$/, replacement: focusPath },
        { find: /^react$/, replacement: require.resolve('react') },
        { find: /^react\/jsx-runtime$/, replacement: require.resolve('react/jsx-runtime') },
        { find: /^react\/jsx-dev-runtime$/, replacement: require.resolve('react/jsx-dev-runtime') },
        { find: /^react-dom\/client$/, replacement: require.resolve('react-dom/client') },
        { find: '@', replacement: join(REPO, 'src') },
      ],
    },
    css: { postcss: { plugins: [tailwindcss({
      ...tailwindConfig,
      content: [
        join(REPO, 'src/canvas/model-tab-v2/**/*.{ts,tsx}'),
        join(REPO, 'src/canvas/components/model-tab/SourceProvenancePill.tsx'),
        join(REPO, 'src/styles/typography.ts'),
      ],
    })] } },
  })
  await server.listen()
  const address = server.httpServer!.address()
  if (!address || typeof address === 'string') throw new Error('Fixture did not obtain a TCP port')
  baseURL = `http://127.0.0.1:${address.port}`
})

test.afterAll(async () => {
  await server?.close()
  if (fixtureDir) await rm(fixtureDir, { recursive: true, force: true })
})

test.beforeEach(async ({ page }) => {
  // This witness must never contact a live product endpoint or font service.
  await page.route('**/*', route => route.request().url().startsWith(baseURL)
    ? route.continue() : route.abort())
  await page.goto(baseURL)
  await expect(page.getByTestId('model-tab-v2-panel')).toBeVisible()
  await expect(page.getByTestId('fixture-dispatches')).toHaveText('[]')
  const dock = await page.getByTestId('fixture-dock').boundingBox()
  expect(dock?.width).toBe(440)
  // The unchanged user-owned sibling is also a positive provenance control.
  await expect(page.getByTestId(`model-row-v2-${USER_ID}-provenance`)).toHaveText('User edited')
})

async function openAI(page: Page) {
  await page.getByTestId(`model-row-v2-${AI_ID}-value`).click()
  const input = page.getByTestId(`model-row-v2-${AI_ID}-value-input`)
  await expect(input).toBeFocused()
  return input
}

async function capture(page: Page, info: TestInfo, name: string) {
  const dock = page.getByTestId('fixture-dock')
  expect(await dock.evaluate(el => el.scrollWidth <= el.clientWidth), 'panel content overflows the 440px dock').toBe(true)
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await info.attach(name, { path, contentType: 'image/png' })
}

async function expectOneUnconfirmed(page: Page) {
  await expect(page.getByTestId('fixture-dispatches')).toHaveText(JSON.stringify([{ nodeId: AI_ID, value: 0.85 }]))
  const row = page.getByTestId(`model-row-v2-${AI_ID}`)
  await expect(row).toHaveAttribute('data-phase', 'unconfirmed')
  await expect(row).toContainText('Your entry: 0.85')
  await expect(row).toContainText('Not yet confirmed')
  await expect(page.getByTestId(`model-row-v2-${AI_ID}-provenance`)).toHaveCount(0)
  await expect(row).not.toContainText('Set by you')
  await expect(row).not.toContainText('User edited')
  await expect(row).not.toContainText('Confirmed by you')
  await expect(page.getByTestId(`model-row-v2-${USER_ID}-provenance`)).toHaveText('User edited')
}

test('AI estimate stays context; opening then Enter or blur does not claim authorship', async ({ page }, info) => {
  let input = await openAI(page)
  await expect(input).toHaveValue('')
  await expect(page.getByTestId(`model-row-v2-${AI_ID}-value`)).toContainText('Olumi estimate:')
  await capture(page, info, 'blank-contribution-with-estimate-context')
  await input.press('Enter')
  await expect(page.getByTestId('fixture-dispatches')).toHaveText('[]')
  input = await openAI(page)
  await page.getByRole('button', { name: 'Outside editor' }).click()
  await expect(input).toHaveCount(0)
  await expect(page.getByTestId('fixture-dispatches')).toHaveText('[]')
  await expect(page.getByTestId(`model-row-v2-${AI_ID}-provenance`)).toHaveText('AI estimate')
})

test('native select-all replaces content; Enter then focus elsewhere dispatches exactly once', async ({ page }, info) => {
  const input = await openAI(page)
  await page.keyboard.type('0.5')
  await input.press(SELECT_ALL)
  await page.keyboard.type('0.85')
  await expect(input).toHaveValue('0.85')
  await input.press('Enter')
  // Enter unmounts the input, so the later focus change is not claimed as a
  // blur event on that removed input. Same-tick event collisions are covered
  // by the component suite; the next test drives a genuine native blur.
  await page.getByRole('button', { name: 'Outside editor' }).click()
  await expectOneUnconfirmed(page)
  await capture(page, info, 'enter-dispatched-not-confirmed')
})

test('blur sends the same factor and scalar as Enter and remains unconfirmed', async ({ page }) => {
  const input = await openAI(page)
  await page.keyboard.type('0.85')
  await expect(input).toHaveValue('0.85')
  await page.getByRole('button', { name: 'Outside editor' }).click()
  await expectOneUnconfirmed(page)
})

test('delete and decimal typing work; Escape then focus elsewhere makes no dispatch', async ({ page }) => {
  const input = await openAI(page)
  await page.keyboard.type('0.5')
  await input.press(SELECT_ALL)
  await input.press('Backspace')
  await expect(input).toHaveValue('')
  await page.keyboard.type('.85')
  await expect(input).toHaveValue('.85')
  await input.press('Escape')
  await page.getByRole('button', { name: 'Outside editor' }).click()
  await expect(page.getByTestId('fixture-dispatches')).toHaveText('[]')
  await expect(page.getByTestId(`model-row-v2-${AI_ID}-provenance`)).toHaveText('AI estimate')
})

for (const malformed of ['0.50.85', '0.85 or 0.9', 'Infinity', '1e309']) {
  test(`complete input ${JSON.stringify(malformed)} is refused before dispatch`, async ({ page }, info) => {
    const input = await openAI(page)
    await page.keyboard.type(malformed)
    await input.press('Enter')
    await expect(input).toHaveValue(malformed)
    await expect(input).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByTestId(`model-row-v2-${AI_ID}-value-error`)).toContainText('Enter one finite number')
    await page.getByRole('button', { name: 'Outside editor' }).click()
    await expect(page.getByTestId('fixture-dispatches')).toHaveText('[]')
    await expect(page.getByTestId(`model-row-v2-${AI_ID}`)).toHaveAttribute('data-phase', 'editing')
    await expect(page.getByTestId(`model-row-v2-${AI_ID}-provenance`)).toHaveText('AI estimate')
    if (malformed === '0.85 or 0.9') await capture(page, info, 'ambiguous-input-refused')
  })
}
