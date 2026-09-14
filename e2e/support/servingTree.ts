/**
 * WHOSE TREE IS ON THE OTHER END OF THE PORT?
 *
 * ⭐ ONE IMPLEMENTATION, TWO HARNESSES. This module is the identity assertion that
 * shipped for the geometry harness in #1130 (1 Sep 2026), lifted out so the visual
 * harness can use the same one rather than a second copy. Two copies of a guard is
 * the hand-maintained mirror at the top of CLAUDE.md: they drift, the drift reads as
 * green, and the copy that drifted is the one nobody was watching. It is also what
 * makes the guard TESTABLE — `tests/serving-tree-identity.spec.ts` exercises this
 * function directly against stub servers, so the check that protects both harnesses
 * is itself checked.
 *
 * ⭐ THE INCIDENT (1 Sep 2026). Several geometry runs MEASURED ANOTHER LANE'S
 * CHECKOUT while reporting about their own. Playwright printed `2 passed`, exited
 * 0, and emitted well-formed `MOUNTJSON` / `SCROLLJSON` measurement lines — from a
 * tree the reporting lane had never touched. Nothing in the run said so.
 *
 * ⭐ THE MECHANISM, measured rather than assumed. It is a TOCTOU race on the shared
 * port, and it is NOT the case people expect:
 *
 *   - If something is ALREADY listening when Playwright starts, `reuseExistingServer:
 *     false` is genuinely loud — Playwright throws `... is already used`. That path
 *     is fine.
 *   - The race is the other path. Playwright checks the port, finds it FREE, and
 *     launches `vite --strictPort`. A sibling lane binds the port inside that boot
 *     window (~1-3s, longer on a cold dep prebundle). OUR vite then dies:
 *         [WebServer] error when starting dev server:
 *         [WebServer] Error: Port 5189 is already in use
 *     — and Playwright's wait-for-the-port is satisfied BY THE SIBLING'S SERVER, so
 *     the run proceeds against a foreign checkout. The death of our own server is
 *     one line in the log, sitting above a green summary, among proxy warnings.
 *
 * So `strictPort` + `reuseExistingServer: false` closes the door it was pointed at
 * and leaves the race wide open. A per-lane port narrows the window; it does not
 * close it, because two lanes can always be handed the same value. Only asking the
 * server WHO IT IS closes it.
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
 *      restated by a caller, so nothing can drift out of step with the config.
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
 * ⚠⚠ AND THAT IS THE BRANCH TO WATCH IN REVIEW. A `skip if unreachable`, or deriving
 * `expected` from the response instead of from `configFile`, would silently restore
 * pre-guard behaviour with no red anywhere. That is no longer only a comment: those
 * two mutations are pinned by name in `tests/serving-tree-identity.spec.ts`, and both
 * have been shown to turn it RED.
 *
 * ⭐ ORDERING, DERIVED (Playwright 1.47, measured, not read from docs): `webServer`
 * is set up BEFORE `globalSetup` — a fetch of the dev server from here returned 200
 * on a cold run with the port free beforehand. That is what lets this check be
 * unconditional: an unreachable server HERE is a real failure, not a race with our
 * own boot, so there is no "skip if nothing is listening" branch to hide in.
 */

import { realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

/**
 * The module the identity probe asks the dev server to transform. It only has to be
 * a real source file that Vite will transform — the entry is the most stable choice.
 * If it ever moves, this REDs (see "hard error" above), which is the point.
 */
export const PROBE_MODULE = 'src/main.tsx'

const SOURCEMAP_RE = /sourceMappingURL=data:application\/json;(?:charset=[^,;]+;)?base64,([A-Za-z0-9+/=]+)/

/**
 * How long to wait for the dev server to answer the probe — DERIVED FROM THE
 * CONFIG'S OWN `webServer.timeout`, not restated here.
 *
 * ⚠ THE FIXED 20s THIS REPLACES WAS MEASURABLY TOO TIGHT, and it would have failed
 * in the direction that gets a guard muted. Measured on this repo (2 Sep 2026, load
 * ~16 on 10 cores), from the moment the port ACCEPTS to the moment `src/main.tsx` is
 * first served:
 *
 *     proof tree A   17.98s
 *     proof tree A   16.33s
 *     proof tree B   10.71s
 *
 * Vite binds the port at ~1s and only then finishes dependency optimisation, so
 * Playwright's wait-for-the-port is satisfied LONG before the first module can be
 * transformed. Against a 20s budget the worst sample had two seconds of headroom;
 * on a slower runner it refuses a run that was perfectly honest, and a guard that
 * cries wolf is muted within a week (CLAUDE.md trap 7).
 *
 * `webServer.timeout` is the budget the harness already grants the same server for
 * the same work (240s in both harnesses), so it is the right one to borrow — and
 * borrowing it means no third number to keep in step.
 */
const FALLBACK_PROBE_TIMEOUT_MS = 60_000

function probeTimeoutMs(config: ServingTreeConfig): number {
  const declared = config.webServer?.timeout
  return typeof declared === 'number' && declared > 0 ? declared : FALLBACK_PROBE_TIMEOUT_MS
}

/**
 * The shape this check actually needs from Playwright's `FullConfig`. Declared
 * structurally rather than importing `FullConfig` so the guard can be driven directly
 * by a test against a stub server — a guard whose own coverage requires booting a
 * real Playwright run does not get covered. `FullConfig` is assignable to it.
 */
export interface ServingTreeConfig {
  configFile?: string
  projects: readonly { use?: { baseURL?: string } }[]
  webServer?: { timeout?: number } | null
}

export interface ServingTreeOptions {
  /** Prefix on every message this throws, e.g. `geometry` or `visreg`. */
  label: string
  /**
   * Harness-specific lines appended to the mismatch failure — how to give THIS lane
   * its own port. Kept out of this module so no port constant is restated here.
   */
  remediation?: string[]
}

export interface ServingTreeIdentity {
  /** Absolute, realpath-resolved path of the probe module in the tree under test. */
  expected: string
  /** Absolute, realpath-resolved path of the probe module in the SERVING tree. */
  served: string
  /** The URL that was interrogated. */
  probeURL: string
  /** The repo root derived from `config.configFile`. */
  repoRoot: string
}

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

function fail(label: string, headline: string, detail: string[]): never {
  throw new Error(
    [`[${label}] ${headline}`, ...detail.map((line) => `  ${line}`)].join('\n'),
  )
}

/**
 * Ask the dev server which checkout it is serving, and THROW if it is not this one.
 *
 * Resolves with the two paths it compared, so a caller can log the agreement rather
 * than restating it.
 */
export async function assertServingTree(
  config: ServingTreeConfig,
  opts: ServingTreeOptions,
): Promise<ServingTreeIdentity> {
  const { label } = opts
  const configFile = config.configFile
  if (!configFile) {
    fail(label, 'CANNOT NAME THE TREE UNDER TEST.', [
      'Playwright did not report a `configFile`, so this run cannot derive which',
      'checkout it is supposed to be measuring. Refusing to start — a measurement',
      'that cannot be attributed to a tree is not a measurement.',
    ])
  }

  const repoRoot = dirname(configFile)
  const expected = real(resolve(repoRoot, PROBE_MODULE))

  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) {
    fail(label, 'CANNOT NAME THE SERVER UNDER TEST.', [
      'No `use.baseURL` on the first project, so there is no URL to interrogate.',
    ])
  }

  const probeURL = new URL(PROBE_MODULE, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).href

  let body: string
  try {
    const res = await fetch(probeURL, { signal: AbortSignal.timeout(probeTimeoutMs(config)) })
    if (!res.ok) {
      fail(label, `IDENTITY PROBE GOT HTTP ${res.status} FROM ${probeURL}`, [
        'The dev server answered but would not serve the probe module, so this run',
        'cannot establish whose tree it is talking to. That is a hard error, never a',
        'skip: an identity check that can quietly not-run is not an instrument.',
        `If ${PROBE_MODULE} has moved, update PROBE_MODULE in e2e/support/servingTree.ts.`,
      ])
    }
    body = await res.text()
  } catch (err) {
    if (err instanceof Error && err.message.startsWith(`[${label}]`)) throw err
    fail(label, `IDENTITY PROBE COULD NOT REACH ${probeURL}`, [
      `${(err as Error).message}`,
      `waited ${probeTimeoutMs(config)}ms (derived from this config's webServer.timeout)`,
      '',
      '`webServer` is set up BEFORE `globalSetup`, so by the time this runs the dev',
      'server should be answering. An unreachable server here is a real failure, and',
      'it is deliberately NOT a skip: a guard that stands down when it cannot see is',
      'the pre-guard behaviour wearing a green tick.',
      '',
      'If the port is occupied, the correct way to look is:',
      '    lsof -nP -iTCP:<port> -sTCP:LISTEN',
      'NOT `lsof -ti tcp:<port>`, which also lists the browser CLIENT sockets.',
    ])
  }

  const match = SOURCEMAP_RE.exec(body)
  if (!match) {
    fail(label, 'IDENTITY PROBE FOUND NO INLINE SOURCEMAP.', [
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
    fail(label, 'IDENTITY PROBE COULD NOT DECODE THE INLINE SOURCEMAP.', [`${(err as Error).message}`])
  }

  if (typeof servedFile !== 'string' || servedFile.length === 0) {
    fail(label, 'IDENTITY PROBE READ NO `file` FROM THE SOURCEMAP.', [
      `Got: ${JSON.stringify(servedFile)}`,
      '',
      '⚠ `sources[0]` is only the basename and will NOT do — `file` is the field that',
      'carries the absolute path of the module in the SERVING checkout.',
    ])
  }

  const served = real(servedFile)

  if (served !== expected) {
    fail(label, "THIS RUN IS TALKING TO SOMEBODY ELSE'S CHECKOUT. REFUSING TO MEASURE.", [
      `served by : ${served}`,
      `under test: ${expected}`,
      `port      : ${probeURL}`,
      '',
      'A sibling lane owns the dev server on this port. Any output produced from here',
      'would describe THEIR tree while carrying YOUR branch name — which is exactly the',
      'failure this guard was written for (1 Sep 2026), and it previously presented as a',
      'clean `passed` with plausible output.',
      ...(opts.remediation?.length ? ['', ...opts.remediation] : []),
      '',
      'To see who holds the port — and note the flags, they matter:',
      '    lsof -nP -iTCP:<port> -sTCP:LISTEN',
      'A bare `lsof -ti tcp:<port>` also lists the browser CLIENT sockets, so it reads',
      'as "the port will not free" long after the listener is gone.',
    ])
  }

  return { expected, served, probeURL, repoRoot }
}
