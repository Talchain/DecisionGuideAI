/**
 * WHOSE TREE IS ON THE OTHER END OF THE PORT?
 *
 * ⭐ THE INCIDENT (1 Sep 2026). Several geometry runs MEASURED ANOTHER LANE'S
 * CHECKOUT while reporting about their own. Playwright printed `2 passed`, exited
 * 0, and emitted well-formed `MOUNTJSON` / `SCROLLJSON` measurement lines — from a
 * tree the reporting lane had never touched. Nothing in the run said so.
 *
 * ⭐ THE MECHANISM, measured on this tip rather than assumed. It is a TOCTOU race
 * on the shared port, and it is NOT the case people expect:
 *
 *   - If something is ALREADY listening when Playwright starts, `reuseExistingServer:
 *     false` is genuinely loud — Playwright throws `... is already used`. That path
 *     is fine, and it is the path `playwright.visual.config.ts` describes when it
 *     says "a collision is a loud failure rather than a wrong answer".
 *   - The race is the other path. Playwright checks the port, finds it FREE, and
 *     launches `vite --strictPort`. A sibling lane binds the port inside that boot
 *     window (~1-3s, longer on a cold dep prebundle). OUR vite then dies:
 *         [WebServer] error when starting dev server:
 *         [WebServer] Error: Port 5189 is already in use
 *     — and Playwright's wait-for-the-port is satisfied BY THE SIBLING'S SERVER, so
 *     the run proceeds against a foreign checkout. The death of our own server is
 *     one line in the log, sitting above a green summary, among proxy warnings.
 *
 * So the existing guard (`strictPort` + `reuseExistingServer: false`) closes the
 * door it was pointed at and leaves the race wide open. A per-lane port narrows the
 * window; it does not close it, because two lanes can always be handed the same
 * value. Only asking the server WHO IT IS closes it.
 *
 * ⭐ WHY THIS WAS EVER NOTICED, and the reason this file exists at all: the probe
 * that caught it bound its assertions by `data-testid` IDENTITY, so a foreign tree
 * surfaced as "handles missing" rather than as a number. A probe binding by position
 * or by value would have returned a BELIEVABLE, WRONG measurement and nobody would
 * ever have known (CLAUDE.md trap 19). We do not get to rely on that twice.
 *
 * ⭐ THE SIGNAL, and why this one and not a build stamp. Vite's dev transform appends
 * an inline sourcemap to every module it serves, and that map's `"file"` field is the
 * ABSOLUTE PATH OF THE MODULE IN THE SERVING CHECKOUT. It was the signal that proved
 * the incident, and it is the right one here for three reasons:
 *
 *   1. IT IDENTIFIES THE CHECKOUT, NOT THE COMMIT. This is the load-bearing property.
 *      Colliding lanes are usually sitting on the SAME commit, so a commit stamp, a
 *      `version.json` or a build id would AGREE across the collision — the guard
 *      would be vacuous in exactly the case it exists for (CLAUDE.md trap 13b, a
 *      guard agreeing with itself).
 *   2. It needs no product-source change and no build-time stamping, so there is no
 *      hand-maintained mirror to drift (CLAUDE.md trap 12). Vite emits it whether or
 *      not anyone remembers this file exists.
 *   3. It is derived end to end: the EXPECTED tree comes from `config.configFile` —
 *      the config Playwright actually loaded — so it cannot disagree with the tree
 *      under test, and the URL comes from the config's own `baseURL`. No constant is
 *      restated here, so nothing can drift out of step with the config.
 *
 * ⚠ `sources[0]` is only the BASENAME (`main.tsx`) — measured at a live dev server.
 * `file` is the field that carries the path. Do not "simplify" one into the other.
 *
 * ⭐ WHY globalSetup AND NOT A SPEC. `--grep` can exclude a spec; it cannot exclude
 * globalSetup. Same reasoning as `e2e/visual/globalTeardown.ts`: the check that
 * proves the run measured the right thing must not be skippable by the run.
 *
 * ⭐ WHY EVERY FAILURE TO DERIVE IS A HARD ERROR. An identity check that can silently
 * not-run is not an instrument (CLAUDE.md trap 13 — an absence probe with no positive
 * control). If `src/main.tsx` moves, if the transform stops carrying a sourcemap, or
 * if the map has no `file`, this REDs and says so. It never shrugs and passes.
 *
 * ⭐ ORDERING, DERIVED (Playwright 1.47, measured at this tip, not read from docs):
 * `webServer` is set up BEFORE `globalSetup` — a fetch of the dev server from here
 * returned 200 on a cold run with the port free beforehand. That is what lets this
 * check be unconditional: an unreachable server HERE is a real failure, not a race
 * with our own boot, so there is no "skip if nothing is listening" branch to hide in.
 */

import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { FullConfig } from '@playwright/test'

/**
 * The module the identity probe asks the dev server to transform. It only has to be
 * a real source file that Vite will transform — the entry is the most stable choice.
 * If it ever moves, this file REDs (see "hard error" above), which is the point.
 */
const PROBE_MODULE = 'src/main.tsx'

const SOURCEMAP_RE = /sourceMappingURL=data:application\/json;(?:charset=[^,;]+;)?base64,([A-Za-z0-9+/=]+)/

/**
 * Compare real paths. On macOS the harness routinely runs under `/private/tmp` while
 * the same tree is reachable as `/tmp`, and a raw string compare would call that a
 * collision. A path that does not resolve (a genuinely foreign machine) falls through
 * unchanged and therefore still mismatches — which is the correct answer.
 */
function real(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

function fail(headline: string, detail: string[]): never {
  throw new Error(
    [`[geometry] ${headline}`, ...detail.map((line) => `  ${line}`)].join('\n'),
  )
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const configFile = config.configFile
  if (!configFile) {
    fail('CANNOT NAME THE TREE UNDER TEST.', [
      'Playwright did not report a `configFile`, so this run cannot derive which',
      'checkout it is supposed to be measuring. Refusing to start — a measurement',
      'that cannot be attributed to a tree is not a measurement.',
    ])
  }

  const repoRoot = dirname(configFile)
  const expected = real(resolve(repoRoot, PROBE_MODULE))

  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) {
    fail('CANNOT NAME THE SERVER UNDER TEST.', [
      'No `use.baseURL` on the first project, so there is no URL to interrogate.',
    ])
  }

  const probeURL = new URL(PROBE_MODULE, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href

  let body: string
  try {
    const res = await fetch(probeURL, { signal: AbortSignal.timeout(20_000) })
    if (!res.ok) {
      fail(`IDENTITY PROBE GOT HTTP ${res.status} FROM ${probeURL}`, [
        'The dev server answered but would not serve the probe module, so this run',
        'cannot establish whose tree it is talking to. That is a hard error, never a',
        'skip: an identity check that can quietly not-run is not an instrument.',
        `If ${PROBE_MODULE} has moved, update PROBE_MODULE in this file.`,
      ])
    }
    body = await res.text()
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('[geometry]')) throw err
    fail(`IDENTITY PROBE COULD NOT REACH ${probeURL}`, [
      `${(err as Error).message}`,
      '',
      '`webServer` is set up BEFORE `globalSetup`, so by the time this runs the dev',
      'server should be answering. An unreachable server here is a real failure.',
      '',
      'If the port is occupied, the correct way to look is:',
      '    lsof -nP -iTCP:<port> -sTCP:LISTEN',
      'NOT `lsof -ti tcp:<port>` — see the note in playwright.geometry.config.ts.',
    ])
  }

  const match = SOURCEMAP_RE.exec(body)
  if (!match) {
    fail('IDENTITY PROBE FOUND NO INLINE SOURCEMAP.', [
      `${probeURL} was served, but its response carries no`,
      '`sourceMappingURL=data:application/json;base64,...` trailer, so the serving',
      "checkout's path cannot be read out of it.",
      '',
      'This is a hard error rather than a pass because the alternative is a guard',
      'that silently stops discriminating (CLAUDE.md trap 13b) — and a harness that',
      'cannot tell whose tree it measured is not an instrument.',
    ])
  }

  let servedFile: unknown
  try {
    servedFile = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8')).file
  } catch (err) {
    fail('IDENTITY PROBE COULD NOT DECODE THE INLINE SOURCEMAP.', [`${(err as Error).message}`])
  }

  if (typeof servedFile !== 'string' || servedFile.length === 0) {
    fail('IDENTITY PROBE READ NO `file` FROM THE SOURCEMAP.', [
      `Got: ${JSON.stringify(servedFile)}`,
      '',
      '⚠ `sources[0]` is only the basename and will NOT do — `file` is the field that',
      'carries the absolute path of the module in the SERVING checkout.',
    ])
  }

  const served = real(servedFile)

  if (served !== expected) {
    fail('THIS RUN IS TALKING TO SOMEBODY ELSE\'S CHECKOUT. REFUSING TO MEASURE.', [
      `served by : ${served}`,
      `under test: ${expected}`,
      `port      : ${probeURL}`,
      '',
      'A sibling lane owns the dev server on this port. Any number produced from here',
      'would describe THEIR tree while carrying YOUR branch name — which is exactly the',
      'failure this guard was written for (1 Sep 2026), and it previously presented as a',
      'clean `passed` with plausible measurement JSON.',
      '',
      'Give this lane its own port and re-run:',
      '    GEOMETRY_PORT=5289 pnpm exec playwright test -c playwright.geometry.config.ts',
      '',
      'To see who holds the port — and note the flag, it matters:',
      '    lsof -nP -iTCP:<port> -sTCP:LISTEN',
      'A bare `lsof -ti tcp:<port>` also lists the browser CLIENT sockets, so it reads',
      'as "the port will not free" long after the listener is gone.',
    ])
  }

  // eslint-disable-next-line no-console
  console.log(`[geometry] identity OK — ${probeURL} is served by ${repoRoot}`)
}
