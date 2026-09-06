/**
 * THE GUARD'S OWN GUARD.
 *
 * `e2e/support/servingTree.ts` is what stops the geometry and visual harnesses
 * measuring — and, in the visual harness's case, BLESSING A BASELINE FROM — another
 * lane's checkout. Until this file existed its only evidence was a manual two-checkout
 * race, run once, by hand. That is precisely the shape this estate keeps paying for: a
 * guard whose own correctness is attested by a demonstration nobody can re-run.
 *
 * ⚠ THE TWO MUTATIONS THAT MATTER are the ones that would restore pre-guard behaviour
 * with NO RED ANYWHERE, and they are pinned by name below:
 *
 *   - "SKIP IF UNREACHABLE" — the catch-branch returning instead of throwing. A guard
 *     that stands down when it cannot see is the old behaviour wearing a green tick.
 *     Pinned by `is a HARD ERROR, never a skip, when nothing is listening`.
 *   - "COMPARE SOMETHING WEAKER THAN THE PATH" — e.g. basenames, or deriving
 *     `expected` from the response instead of from `configFile`. Every checkout of
 *     this repo serves a module called `main.tsx`, so that comparison is vacuous in
 *     exactly the case the guard exists for (CLAUDE.md trap 13b). Pinned by
 *     `REFUSES a foreign checkout and names BOTH trees` plus
 *     `derives EXPECTED from configFile, NOT from the response`.
 *
 * Both were mutated and both turned this file RED before it was committed.
 *
 * The stub servers are real `node:http` servers on ephemeral ports, so the real
 * `fetch` path, the real regex and the real base64 decode are all exercised. A mocked
 * fetch would prove only that the function calls the mock.
 *
 * ⚠ EVERY TEST PINS ITS OWN PRECONDITION. The match case asserts the guard actually
 * READ the served path back (not that it merely failed to throw), and the mismatch
 * cases assert the FOREIGN path appears in the message. Without that, a guard that
 * stopped parsing the response entirely would still pass the happy case.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertServingTree, PROBE_MODULE } from '../e2e/support/servingTree'

/**
 * A tree on disk that looks enough like a checkout for the guard to resolve it.
 *
 * ⚠ `realpathSync` IS LOAD-BEARING, and leaving it out cost an hour. On macOS
 * `tmpdir()` is `/var/folders/...`, a symlink to `/private/var/folders/...`. The
 * guard canonicalises both sides on purpose (a lane under `/private/tmp` and the
 * same tree seen as `/tmp` are NOT a collision), so a test holding the uncanonical
 * form compares two different strings for the same file. Worse, it fails SOFT: a
 * `toContain` assertion still passes, because `/var/x` is a substring of
 * `/private/var/x`. Canonicalise here so every assertion below is EXACT.
 */
function makeCheckout(): { root: string; configFile: string; probeFile: string } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'serving-tree-')))
  mkdirSync(join(root, 'src'), { recursive: true })
  const probeFile = join(root, PROBE_MODULE)
  writeFileSync(probeFile, '// stub entry\n', 'utf8')
  const configFile = join(root, 'playwright.stub.config.ts')
  writeFileSync(configFile, '// stub config\n', 'utf8')
  return { root, configFile, probeFile }
}

/** A Vite-shaped dev-transform response: module text plus an inline sourcemap. */
function moduleBodyServedBy(file: string | null, extra: Record<string, unknown> = {}): string {
  const map = JSON.stringify({ version: 3, sources: ['main.tsx'], ...(file === null ? {} : { file }), ...extra })
  const b64 = Buffer.from(map, 'utf8').toString('base64')
  return `export default 1\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,${b64}\n`
}

const servers: Server[] = []
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))))
})

/** Start a stub dev server; resolves with its `http://127.0.0.1:<port>` origin. */
function startStub(handler: (url: string) => { status: number; body: string }): Promise<string> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const { status, body } = handler(req.url ?? '')
      res.writeHead(status, { 'content-type': 'application/javascript' })
      res.end(body)
    })
    servers.push(server)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr === null || typeof addr === 'string') throw new Error('stub server has no port')
      resolve(`http://127.0.0.1:${addr.port}`)
    })
  })
}

const cfg = (configFile: string | undefined, baseURL: string | undefined, webServerTimeout?: number) => ({
  configFile,
  projects: [{ use: { baseURL } }],
  ...(webServerTimeout === undefined ? {} : { webServer: { timeout: webServerTimeout } }),
})

/** A server that ACCEPTS the connection and then never answers. */
function startBlackHole(): Promise<string> {
  return new Promise((resolve) => {
    const server = createServer(() => {
      /* deliberately never responds */
    })
    servers.push(server)
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      if (addr === null || typeof addr === 'string') throw new Error('stub server has no port')
      resolve(`http://127.0.0.1:${addr.port}`)
    })
  })
}

describe('assertServingTree — refuses to measure a foreign checkout', () => {
  it('PROCEEDS, and reports the path it read back, when the server serves THIS checkout', async () => {
    const mine = makeCheckout()
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy(mine.probeFile) }))

    const id = await assertServingTree(cfg(mine.configFile, base), { label: 'test' })

    // PRECONDITION PIN: the guard must have PARSED the response, not merely
    // failed to throw. A guard that stopped reading the body would still not
    // throw here, and this assertion is what notices.
    expect(id.served).toBe(id.expected)
    expect(id.served).toContain('main.tsx')
    expect(id.probeURL).toBe(`${base}/${PROBE_MODULE}`)
  })

  it('REFUSES a foreign checkout and names BOTH trees', async () => {
    const mine = makeCheckout()
    const foreign = makeCheckout()
    expect(foreign.probeFile).not.toBe(mine.probeFile) // the discrimination is real
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy(foreign.probeFile) }))

    const err = await assertServingTree(cfg(mine.configFile, base), { label: 'visreg' }).then(
      () => null,
      (e: Error) => e,
    )

    expect(err, 'a foreign checkout must not be measured').not.toBeNull()
    expect(err!.message).toContain('REFUSING TO MEASURE')
    expect(err!.message).toContain(foreign.probeFile) // served by
    expect(err!.message).toContain(mine.probeFile) // under test
    expect(err!.message.startsWith('[visreg]')).toBe(true)
  })

  it('derives EXPECTED from configFile, NOT from the response', async () => {
    // The mutation this pins: `expected = served`, or any comparison weak enough
    // (basenames, repo names) that two checkouts of the same repo agree. Both
    // trees below serve a module called `main.tsx` at the same depth.
    const mine = makeCheckout()
    const foreign = makeCheckout()
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy(foreign.probeFile) }))

    const err = await assertServingTree(cfg(mine.configFile, base), { label: 'test' }).catch((e: Error) => e)

    expect(err).toBeInstanceOf(Error)
    const underTest = /under test: (.+)/.exec((err as Error).message)?.[1]
    expect(underTest, 'the tree under test is the one the CONFIG names').toBe(mine.probeFile)
  })

  it('appends the caller-supplied remediation to the refusal', async () => {
    const mine = makeCheckout()
    const foreign = makeCheckout()
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy(foreign.probeFile) }))

    const err = await assertServingTree(cfg(mine.configFile, base), {
      label: 'geometry',
      remediation: ['GEOMETRY_PORT=5289 pnpm exec playwright test'],
    }).catch((e: Error) => e)

    expect((err as Error).message).toContain('GEOMETRY_PORT=5289')
  })

  it('is a HARD ERROR, never a skip, when nothing is listening', async () => {
    // ⭐ THE MUTATION SENTINEL. Turning the unreachable branch into a `return`
    // restores pre-guard behaviour and nothing else in the suite notices.
    const mine = makeCheckout()
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy(mine.probeFile) }))
    // Close it, so the port is refused rather than merely slow.
    await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))))

    const err = await assertServingTree(cfg(mine.configFile, base), { label: 'visreg' }).then(
      () => null,
      (e: Error) => e,
    )

    expect(err, 'an unreachable server must NOT be treated as agreement').not.toBeNull()
    expect(err!.message).toContain('COULD NOT REACH')
    expect(err!.message).toContain('deliberately NOT a skip')
  })

  it('DERIVES the probe budget from the config\'s webServer.timeout', async () => {
    // ⚠ THE FIXED 20s THIS REPLACED HAD TWO SECONDS OF HEADROOM against this
    // repo's own measured worst case (see servingTree.ts). A guard that refuses an
    // honest run is muted within a week, so the budget is derived, and the failure
    // says which number it used.
    const mine = makeCheckout()
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy(mine.probeFile) }))
    await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))))

    const err = await assertServingTree(cfg(mine.configFile, base, 1234), { label: 'test' }).catch((e: Error) => e)

    expect((err as Error).message).toContain('waited 1234ms')
  })

  it('falls back to 60s when the config declares no webServer.timeout', async () => {
    const mine = makeCheckout()
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy(mine.probeFile) }))
    await Promise.all(servers.splice(0).map((s) => new Promise<void>((r) => s.close(() => r()))))

    const err = await assertServingTree(cfg(mine.configFile, base), { label: 'test' }).catch((e: Error) => e)

    expect((err as Error).message).toContain('waited 60000ms')
  })

  it('ACTUALLY ABORTS on the derived budget — the number is wired, not just printed', async () => {
    // PRECONDITION PIN: a server that accepts and never answers. Without the
    // signal being wired to `fetch`, this hangs until the test times out.
    const mine = makeCheckout()
    const base = await startBlackHole()

    const started = Date.now()
    const err = await assertServingTree(cfg(mine.configFile, base, 400), { label: 'test' }).catch((e: Error) => e)
    const elapsed = Date.now() - started

    expect((err as Error).message).toContain('COULD NOT REACH')
    expect(elapsed, 'the abort must fire on the derived budget, not on a fixed one').toBeLessThan(5_000)
  })

  it('REFUSES on a non-200 from the dev server', async () => {
    const mine = makeCheckout()
    const base = await startStub(() => ({ status: 404, body: 'not found' }))

    const err = await assertServingTree(cfg(mine.configFile, base), { label: 'test' }).catch((e: Error) => e)

    expect((err as Error).message).toContain('IDENTITY PROBE GOT HTTP 404')
  })

  it('REFUSES when the response carries no inline sourcemap', async () => {
    const mine = makeCheckout()
    const base = await startStub(() => ({ status: 200, body: 'export default 1\n' }))

    const err = await assertServingTree(cfg(mine.configFile, base), { label: 'test' }).catch((e: Error) => e)

    expect((err as Error).message).toContain('NO INLINE SOURCEMAP')
  })

  it('REFUSES when the sourcemap carries no `file` — `sources[0]` will not do', async () => {
    const mine = makeCheckout()
    // `sources` is present and plausible; only `file` is missing. This is the
    // exact shape the "simplify it to sources[0]" change would produce.
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy(null) }))

    const err = await assertServingTree(cfg(mine.configFile, base), { label: 'test' }).catch((e: Error) => e)

    expect((err as Error).message).toContain('READ NO `file`')
  })

  it('REFUSES when Playwright reports no configFile', async () => {
    const base = await startStub(() => ({ status: 200, body: moduleBodyServedBy('/anything/src/main.tsx') }))

    const err = await assertServingTree(cfg(undefined, base), { label: 'test' }).catch((e: Error) => e)

    expect((err as Error).message).toContain('CANNOT NAME THE TREE UNDER TEST')
  })

  it('REFUSES when the config has no baseURL', async () => {
    const mine = makeCheckout()

    const err = await assertServingTree(cfg(mine.configFile, undefined), { label: 'test' }).catch((e: Error) => e)

    expect((err as Error).message).toContain('CANNOT NAME THE SERVER UNDER TEST')
  })
})
