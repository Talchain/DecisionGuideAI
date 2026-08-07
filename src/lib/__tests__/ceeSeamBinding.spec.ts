/**
 * ROADMAP 2.710 — every CEE-bound browser call binds to the credential-
 * injecting same-origin seam (`/bff/cee`), never the env-resolved base.
 *
 * THE DEFECT (fresh-journey P0 diagnosis §5, wire-witnessed 2026-08-06): the
 * Netlify DASHBOARD sets `VITE_CEE_BFF_BASE` to PLoT's bearer-authenticated
 * origin (`https://plot-lite-service-staging.onrender.com/v1/cee`), Vite
 * inlines it at BUILD time, and every credential-less consumer riding
 * `import.meta.env.VITE_CEE_BFF_BASE || '/bff/cee'` shipped pointed at a
 * host that 401s it (prompt warm-up — Codex's S5) or 404s it (/ask,
 * /health, /suggest-edge-function are not PLoT routes at all). The
 * `/bff/cee` edge seam (netlify/edge-functions/cee-proxy.ts) injects
 * `X-Olumi-Assist-Key` server-side and was probed 200 the same day.
 *
 * ⚠ WHY SOURCE-LEVEL: measured in scenarioGraph.spec.ts — Vite substitutes
 * `import.meta.env.VITE_*` member reads at TRANSFORM time, so under vitest
 * the hazardous form and the safe form BOTH evaluate to `'/bff/cee'`; no
 * runtime assertion can tell them apart, ever. The deployed-bundle guard is
 * `pnpm run ci:guard:bundle-env` (VITE_CEE_BFF_BASE is no longer on the
 * allowlist, so ANY read reappearing in src fails that gate at build) —
 * this suite is the fast, per-module half of the same invariant.
 *
 * Audit trail (all endpoints verified served by CEE under /assist/v1 at
 * CEE `4c835ced`, reachable through the edge rewrite):
 *   prompt-preloader   /prompts/warm            → /bff/cee (probed 200)
 *   readinessStore     /graph-readiness         → /bff/cee
 *   useFormRecommendations /suggest-edge-function → /bff/cee
 *   useAsk             /ask                     → /bff/cee (PLoT 404s it)
 *   service-health     /health                  → /bff/cee (PLoT 404s it)
 *   adapters/cee/client biasCheck·sensitivityCoach·draftModel-fallback
 *                                               → /bff/cee (CEE serves both;
 *                        the PLoT-direct + VITE_PLOT_BEARER path remains only
 *                        where PLoT is genuinely the server: VITE_CEE_DRAFT_BASE)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(HERE, '..', '..')

/** Comment-stripped view so prose (including corrected-hazard notes that
 *  deliberately NAME the env var) never satisfies or trips a code guard. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/([^:'"])\/\/(?![^'"\n]*['"`]).*$/gm, '$1')
}

const CONSUMERS: ReadonlyArray<{ rel: string; mustUseLiteral: string }> = [
  { rel: 'lib/prompt-preloader.ts', mustUseLiteral: "'/bff/cee'" },
  { rel: 'canvas/stores/readinessStore.ts', mustUseLiteral: "'/bff/cee'" },
  { rel: 'canvas/hooks/useFormRecommendations.ts', mustUseLiteral: "'/bff/cee'" },
  { rel: 'hooks/useAsk.ts', mustUseLiteral: "'/bff/cee'" },
  { rel: 'lib/service-health.ts', mustUseLiteral: "'/bff/cee'" },
  { rel: 'adapters/cee/client.ts', mustUseLiteral: "'/bff/cee'" },
]

describe('CEE seam binding — no module resolves a CEE base from VITE_CEE_BFF_BASE (2.710)', () => {
  for (const { rel, mustUseLiteral } of CONSUMERS) {
    it(`${rel} binds to the literal same-origin seam`, () => {
      const code = stripComments(readFileSync(path.join(SRC, rel), 'utf8'))
      expect(code, `${rel} still reads VITE_CEE_BFF_BASE`).not.toContain('VITE_CEE_BFF_BASE')
      expect(code, `${rel} lost its /bff/cee literal`).toContain(mustUseLiteral)
    })
  }

  it('NOTHING under src/ reads VITE_CEE_BFF_BASE any more (complete manifest, executable-code scope)', () => {
    // Derived, not hand-listed: walk every .ts/.tsx under src/ and assert the
    // read is gone from executable code everywhere — so a NEW consumer cannot
    // reintroduce the hazard without failing here. vite-env.d.ts (the type
    // declaration) and prose comments are out of scope by construction.
    const { readdirSync, statSync } = require('node:fs') as typeof import('node:fs')
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry)
        const st = statSync(full)
        if (st.isDirectory()) {
          if (entry === 'node_modules' || entry === '__tests__') continue
          walk(full)
        } else if (/\.(ts|tsx)$/.test(entry) && !/\.d\.ts$/.test(entry) && !/\.spec\./.test(entry)) {
          const code = stripComments(readFileSync(full, 'utf8'))
          if (code.includes('VITE_CEE_BFF_BASE')) offenders.push(path.relative(SRC, full))
        }
      }
    }
    walk(SRC)
    expect(offenders, `env-resolved CEE base reads survive in: ${offenders.join(', ')}`).toEqual([])
  })

  it('POSITIVE CONTROL (trap 13): the stripped matcher CAN see a live read', () => {
    const hazardous =
      "const CEE_BASE_URL = (import.meta as any).env?.VITE_CEE_BFF_BASE || '/bff/cee'"
    expect(stripComments(hazardous)).toContain('VITE_CEE_BFF_BASE')
    // …and comment-stripping really does exempt prose that names the var:
    expect(stripComments('// VITE_CEE_BFF_BASE is set in the dashboard')).not.toContain(
      'VITE_CEE_BFF_BASE',
    )
  })

  it('the bundle-level guard is armed: VITE_CEE_BFF_BASE is OFF the bundle-env allowlist', () => {
    // With the entry removed, `pnpm run ci:guard:bundle-env` REDs on any
    // deploy whose bundle carries the variable — the deployed-artefact half
    // of this invariant (a source guard cannot see the dashboard).
    const allowlist = JSON.parse(
      readFileSync(path.join(SRC, '..', 'scripts', 'ci', 'bundle-env-allowlist.json'), 'utf8'),
    ) as { allowed: string[] }
    expect(allowlist.allowed).not.toContain('VITE_CEE_BFF_BASE')
  })

  it('the preloader’s warm URL is built from the literal (live binding, not a dead constant)', () => {
    const code = stripComments(readFileSync(path.join(SRC, 'lib/prompt-preloader.ts'), 'utf8'))
    // The fetch must interpolate the SAME constant the literal defines —
    // a dead literal beside an imported base would pass the spelling guard
    // (scenarioGraph.spec review A4's lesson).
    expect(code).toMatch(/CEE_BASE_URL = '\/bff\/cee'/)
    expect(code).toMatch(/fetch\(`\$\{CEE_BASE_URL\}\/prompts\/warm`/)
  })
})
