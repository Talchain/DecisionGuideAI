// src/lib/__tests__/posthogKeyUnify.spec.ts
// =============================================================================
// ROADMAP 2.111 — ONE PostHog key name. The activation-day split-brain pin.
// =============================================================================
//
// THE DEFECT THIS EXISTS TO PREVENT
// --------------------------------
// Before this pin the repo read TWO different env names for the same PostHog
// project key:
//
//   src/lib/posthog.ts:10        VITE_POSTHOG_KEY       ← gates posthog.init()
//   src/lib/config.ts:98,104     VITE_POSTHOG_API_KEY   ← observability.*
//   src/observability/metrics.ts VITE_POSTHOG_API_KEY   ← isEnabled()
//
// On activation day exactly one of those names would be set in Netlify, and
// whichever it was, the other consumer stayed DARK — silently, with no error,
// no warning, and a green build. That is the failure mode ROADMAP 1.68's
// collaboration-signal baseline cannot survive: it is measured once, during the
// user-testing window, and an unrecoverable half-dark telemetry path destroys
// the baseline rather than delaying it.
//
// The fix REMOVES the losing name rather than aliasing it. An alias
// (`VITE_POSTHOG_KEY ?? VITE_POSTHOG_API_KEY`) is a hand-maintained mirror: it
// makes both names work today and lets the divergence creep back the next time
// someone copies a read. Removal makes re-divergence a visible edit.
//
// WHY `VITE_POSTHOG_KEY` WON
// --------------------------
// Neither name had any deployment footprint (absent from netlify.toml,
// .env.example, docs/, and the flags:check guard), so the tie was broken on
// call-graph footprint: `VITE_POSTHOG_KEY` is the name read by the ONLY module
// that actually initialises the SDK (src/lib/posthog.ts → posthog.init), and
// that module is imported by ten live product modules. Both
// `VITE_POSTHOG_API_KEY` readers had ZERO importers repo-wide.
//
// WHAT EACH TEST BELOW CLAIMS — the claim types differ, deliberately
// -----------------------------------------------------------------
//   1. BEHAVIOURAL (runtime): with only the chosen name set, BOTH runtime
//      consumers light up; with only the retired name set, BOTH stay dark.
//      Never one-lit-one-dark. This is the split-brain assertion itself.
//   2. DERIVED SOURCE INVARIANT: the set of PostHog env names read anywhere in
//      src/ is exactly {VITE_POSTHOG_KEY, VITE_POSTHOG_HOST}. This is NOT a
//      hand-maintained list of consumers — it is derived by walking src/, so a
//      future third consumer that re-diverges reds this without anyone
//      remembering to add it. It also covers src/observability/metrics.ts,
//      whose isEnabled() short-circuits on MODE === 'test' and therefore cannot
//      be exercised behaviourally from vitest.
//   3. NAMED PER-CONSUMER PINS, so a mutation in either specific file bites by
//      name and the failure message says which file regressed.
//
// Every absence assertion here carries a POSITIVE CONTROL (CLAUDE.md trap 13):
// the source scan proves it can SEE a presence before it is allowed to report
// an absence.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
// Reused, not reinvented: the bundle-env guard already owns a comment stripper
// and a repo-root resolver, and already has its own anti-vacuity spec
// (tests/ci-guards/bundle-env-allowlist.spec.ts). A second copy of either here
// would be a second thing to keep correct. `import.meta.url` is NOT usable for
// this from a vitest-transformed spec — it is not a file: URL there.
import { stripComments, ROOT } from '../../../scripts/ci/assert-bundle-env-allowlist.mjs'

vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    capture: vi.fn(),
  },
}))

import posthog from 'posthog-js'

/** The single sanctioned PostHog key name. */
const CHOSEN = 'VITE_POSTHOG_KEY'
/** The name retired by 2.111. Must appear NOWHERE in src/ as a read. */
const RETIRED = 'VITE_POSTHOG_API_KEY'
/** Shared by both sides; never diverged, asserted so it stays that way. */
const HOST = 'VITE_POSTHOG_HOST'

const REPO_ROOT = ROOT
const SRC_DIR = path.join(REPO_ROOT, 'src')

// ---------------------------------------------------------------------------
// Synthetic-env helpers
// ---------------------------------------------------------------------------
// `import.meta.env` is a live object under vitest (no static replacement — the
// reads under test all use `import.meta.env?.X`, which Vite cannot narrow), so
// assigning to it is how the existing suite already drives these code paths
// (see src/telemetry/__tests__/guidanceEvents.spec.tsx).

const env = import.meta.env as unknown as Record<string, unknown>
const MANAGED = [CHOSEN, RETIRED, HOST] as const
let saved: Record<string, unknown> = {}

function applyEnv(patch: Partial<Record<(typeof MANAGED)[number], string>>): void {
  for (const name of MANAGED) {
    const value = patch[name]
    if (value === undefined) delete env[name]
    else env[name] = value
  }
}

beforeEach(() => {
  saved = {}
  for (const name of MANAGED) {
    if (name in env) saved[name] = env[name]
  }
  vi.resetModules()
  vi.clearAllMocks()
})

afterEach(() => {
  for (const name of MANAGED) {
    if (name in saved) env[name] = saved[name]
    else delete env[name]
  }
})

/**
 * Load both runtime consumers FRESH under the current synthetic env.
 * `src/lib/config.ts` evaluates its `observability` object at module scope, so
 * it must be re-imported after every env change — a stale module would make
 * this whole spec pass by testing the wrong snapshot.
 */
async function loadConsumers(): Promise<{
  initPostHog: () => void
  observability: { postHogKey: string; hasPostHog: boolean }
}> {
  const posthogModule = await import('../posthog')
  const configModule = await import('../config')
  return {
    initPostHog: posthogModule.initPostHog,
    observability: configModule.observability as { postHogKey: string; hasPostHog: boolean },
  }
}

// ---------------------------------------------------------------------------
// 1. BEHAVIOURAL — both consumers resolve the SAME env var
// ---------------------------------------------------------------------------

describe('2.111 · both runtime consumers resolve the same env var', () => {
  it('ONLY the chosen name set → BOTH consumers are configured', async () => {
    applyEnv({ [CHOSEN]: 'phc_chosen_key', [HOST]: 'https://posthog.example.test' })

    const { initPostHog, observability } = await loadConsumers()
    initPostHog()

    // Consumer A — the SDK actually initialises.
    expect(
      posthog.init,
      `posthog.init was not called with only ${CHOSEN} set — src/lib/posthog.ts is dark`,
    ).toHaveBeenCalledTimes(1)
    expect(posthog.init).toHaveBeenCalledWith('phc_chosen_key', expect.anything())

    // Consumer B — config.observability agrees.
    expect(
      observability.hasPostHog,
      `config.observability.hasPostHog is false with only ${CHOSEN} set — split-brain: ` +
        'src/lib/config.ts is reading a different env name',
    ).toBe(true)
    expect(observability.postHogKey).toBe('phc_chosen_key')
  })

  it('ONLY the retired name set → BOTH consumers are dark (never one-lit-one-dark)', async () => {
    applyEnv({ [RETIRED]: 'phc_retired_key', [HOST]: 'https://posthog.example.test' })

    const { initPostHog, observability } = await loadConsumers()
    initPostHog()

    expect(
      posthog.init,
      `posthog.init ran off ${RETIRED} — the retired name is still wired somewhere`,
    ).not.toHaveBeenCalled()
    expect(
      observability.hasPostHog,
      `config.observability lit up from ${RETIRED} while posthog.ts stayed dark — ` +
        'this is exactly the activation-day split-brain 2.111 removes',
    ).toBe(false)
    expect(observability.postHogKey).toBe('')
  })

  it('BOTH names set → still exactly one source of truth, and it is the chosen name', async () => {
    applyEnv({
      [CHOSEN]: 'phc_chosen_key',
      [RETIRED]: 'phc_retired_key',
      [HOST]: 'https://posthog.example.test',
    })

    const { initPostHog, observability } = await loadConsumers()
    initPostHog()

    expect(posthog.init).toHaveBeenCalledWith('phc_chosen_key', expect.anything())
    expect(observability.postHogKey).toBe('phc_chosen_key')
  })

  it('neither name set → both dark (the pre-activation state today)', async () => {
    applyEnv({ [HOST]: 'https://posthog.example.test' })

    const { initPostHog, observability } = await loadConsumers()
    initPostHog()

    expect(posthog.init).not.toHaveBeenCalled()
    expect(observability.hasPostHog).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. DERIVED SOURCE INVARIANT — covers every consumer, including untestable ones
// ---------------------------------------------------------------------------

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

/** Walk src/, skipping test trees (a spec is allowed to NAME the retired var). */
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'tests' || entry === '__fixtures__') continue
      collectSourceFiles(full, out)
      continue
    }
    if (/\.(test|spec)\.[cm]?tsx?$/.test(entry)) continue
    if (SOURCE_EXTENSIONS.has(path.extname(entry))) out.push(full)
  }
  return out
}

describe('2.111 · derived invariant: exactly one PostHog key name exists in src/', () => {
  const files = collectSourceFiles(SRC_DIR)
  const hits: Array<{ file: string; name: string }> = []
  for (const file of files) {
    // Comments stripped: the files below deliberately NAME the retired variable
    // in prose to explain why it was removed. A prose mention is not a read,
    // and counting it would make this invariant impossible to document.
    const text = stripComments(readFileSync(file, 'utf8'))
    for (const match of text.matchAll(/VITE_POSTHOG[A-Z0-9_]*/g)) {
      hits.push({ file: path.relative(REPO_ROOT, file), name: match[0] })
    }
  }

  it('POSITIVE CONTROL — the scan can see a presence before it reports an absence', () => {
    // Trap 13: without these floors, a broken walker (wrong root, wrong
    // extension filter) would report "zero occurrences of the retired name"
    // by scanning nothing at all, and every assertion below would pass vacuously.
    expect(files.length, 'source walk collected suspiciously few files').toBeGreaterThan(300)
    expect(
      hits.filter((h) => h.name === CHOSEN).length,
      `scan found no ${CHOSEN} occurrences — the walker is not seeing the real source`,
    ).toBeGreaterThanOrEqual(3)
  })

  it(`the retired name ${RETIRED} appears NOWHERE in non-test src/`, () => {
    const offenders = hits.filter((h) => h.name === RETIRED)
    expect(
      offenders.map((h) => h.file),
      `${RETIRED} was re-introduced. 2.111 removed it deliberately: two names for one ` +
        'key means whichever is set on activation day leaves the other consumer dark. ' +
        `Use ${CHOSEN}.`,
    ).toEqual([])
  })

  it('the complete set of PostHog env names read in src/ is exactly {key, host}', () => {
    const distinct = [...new Set(hits.map((h) => h.name))].sort()
    expect(distinct).toEqual([HOST, CHOSEN].sort())
  })
})

// ---------------------------------------------------------------------------
// 3. NAMED PER-CONSUMER PINS — so a mutation names the file that regressed
// ---------------------------------------------------------------------------

describe('2.111 · per-consumer pins', () => {
  const CONSUMERS = [
    'src/lib/posthog.ts',
    'src/lib/config.ts',
    'src/observability/metrics.ts',
  ] as const

  for (const relative of CONSUMERS) {
    it(`${relative} reads ${CHOSEN} and not ${RETIRED}`, () => {
      const text = readFileSync(path.join(REPO_ROOT, relative), 'utf8')
      // The comment blocks in these files NAME the retired variable on purpose
      // (they explain why it went). Only a READ counts as a regression, so
      // match the read shape — `import.meta.env.X` or `import.meta.env?.X`.
      const retiredRead = new RegExp(String.raw`import\.meta\.env\??\.${RETIRED}`)
      const chosenRead = new RegExp(String.raw`import\.meta\.env\??\.${CHOSEN}`)
      expect(
        retiredRead.test(text),
        `${relative} still READS ${RETIRED} — activation-day split-brain reintroduced`,
      ).toBe(false)
      expect(
        chosenRead.test(text),
        `${relative} no longer reads ${CHOSEN} — it will be dark on activation day`,
      ).toBe(true)
    })
  }
})
