/**
 * ⛔⛔ THE VISUAL SUITE MUST RENDER THE POSTURE STAGING SERVES.
 *
 * `playwright.visual.config.ts` boots its own Vite dev server and hands it an
 * explicit `env` block. That block is a HAND-MAINTAINED MIRROR of the deployed
 * flag posture in `netlify.toml`, and it drifted: `VITE_FEATURE_PRE_ANALYSIS_V3`
 * was simply absent.
 *
 * `makeFlag` resolves an unset env var to `defaultValue`, which defaults to
 * FALSE and which `preAnalysisV3` does not override. So the flag read OFF, the
 * dock's pre-run branch (`isPreAnalysisV3Enabled() ? <V3> : <legacy>`) rendered
 * the LEGACY panel, and every state this suite captures is seeded PRE-RUN.
 *
 * ⇒ Two consequences, and the second is why this guard exists rather than a
 * one-line fix and a note:
 *   1. `blocked-provisional` (x2) could never capture — its anchor
 *      `[data-testid="pre-analysis-v3"]` never became visible, so the
 *      completeness guard read `8/10` at every head for weeks.
 *   2. ⛔ The four states that DID capture were references for a component
 *      staging does not serve. A green visual suite would have been evidence
 *      about the wrong panel — CLAUDE.md trap 3b, and the estate has now shipped
 *      that defect three times.
 *
 * ⚠ THIS GUARD IS DERIVED FROM BOTH SOURCES, never from a list kept here. It
 * cannot prove the visual env is COMPLETE — only that it does not CONTRADICT the
 * deployed posture, plus one named assertion for the flag that gates a captured
 * surface. Derivation moves the risk; it does not remove it (trap 12d).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../..')
const read = (rel: string): string => {
  const text = readFileSync(resolve(root, rel), 'utf8')
  // ⛔ BOTH INPUTS NON-EMPTY BEFORE ANY AGREEMENT IS BELIEVED. An unreadable
  // file agrees with every assertion below.
  expect(text.length, `${rel} read empty`).toBeGreaterThan(500)
  return text
}

/**
 * ⛔⛔ COMMENTS ARE STRIPPED FIRST, AND THE FIRST VERSION OF THIS FILE DID NOT DO
 * THAT — WHICH MADE THE GUARD READ ITS OWN PROSE AND PASS ON THE VERY DEFECT IT
 * WAS WRITTEN FOR.
 *
 * The explanatory comment beside the fix quotes `netlify.toml` verbatim, so the
 * string `VITE_FEATURE_PRE_ANALYSIS_V3 = "1"` appears in `playwright.visual.config.ts`
 * as PROSE. Deleting the real setting therefore left the guard GREEN: it matched
 * the comment describing the setting instead of the setting.
 *
 * Caught by a mutant that removed the flag and expected RED, not by reading —
 * the file looked obviously correct. A guard whose evidence comes from its own
 * documentation cannot fail (CLAUDE.md trap 13b).
 */
function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')  // block comments (the TS config's prose)
    .replace(/^\s*\/\/.*$/gm, ' ')      // line comments
    .replace(/^\s*#.*$/gm, ' ')        // netlify.toml comments
}

/**
 * Every `VITE_*` var, not only `VITE_FEATURE_*`.
 *
 * ⚠ THE NARROWER PATTERN WAS A REAL HOLE, found by a mutant that failed for the
 * wrong reason. `netlify.toml` ships flags that gate whole code paths WITHOUT the
 * FEATURE infix — `VITE_V5_CANONICAL_ANALYSIS` among them — so a prefix-scoped
 * guard was blind to exactly the class most likely to change which component
 * mounts. A guard that cannot see a variable cannot report it as divergent.
 */
function flagsIn(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of stripComments(text).matchAll(/(VITE_[A-Z0-9_]+)\s*[:=]\s*['"]([^'"]*)['"]/g)) {
    out.set(m[1], m[2])
  }
  return out
}

describe('the visual suite renders the deployed flag posture', () => {
  const deployed = flagsIn(read('netlify.toml'))
  const suite = flagsIn(read('playwright.visual.config.ts'))

  it('the probe can see flags in both files — or every assertion below is vacuous', () => {
    expect(deployed.size, 'no VITE_* parsed from netlify.toml').toBeGreaterThan(3)
    expect(suite.size, 'no VITE_* parsed from the visual config').toBeGreaterThan(0)
  })

  it('⛔ PRE_ANALYSIS_V3 is set, because it decides WHICH pre-run panel is captured', () => {
    // Named explicitly rather than left to the agreement rule below: absence is
    // the exact failure that happened, and an agreement check cannot see a flag
    // that is missing from one side.
    expect(deployed.get('VITE_FEATURE_PRE_ANALYSIS_V3'), 'netlify.toml no longer ships this flag — re-derive this guard').toBe('1')
    expect(
      suite.get('VITE_FEATURE_PRE_ANALYSIS_V3'),
      'the visual dev server must set VITE_FEATURE_PRE_ANALYSIS_V3=1 or it captures the legacy pre-analysis panel',
    ).toBe('1')
  })

  /**
   * ⚠ A DIVERGENCE IS NOT AUTOMATICALLY A DEFECT — and the first version of this
   * guard said it was, which is the failure-mode-shaped rule this repo keeps
   * paying for (trap 13d: write the invariant against the SPEC, not against the
   * instance you happened to find). Some divergences are correct: the dev server
   * points every service URL at an unreachable host, so a streaming flag would
   * make captures hang rather than differ.
   *
   * ⇒ The rule is not "never diverge". It is "never diverge SILENTLY". Each
   * entry states its reason, and the assertion pins the set EXACTLY — so it REDs
   * when a divergence is ADDED without a reason, and equally when one is fixed
   * and its exemption is left behind to rot.
   */
  const DELIBERATE_DIVERGENCE: Record<string, string> = {
    // ⚠ REASON INFERRED, NOT ESTABLISHED. Present since the harness was created
    // (#757) with no stated justification. The dev server sets every service URL
    // to an unreachable host, so streaming would hang the capture rather than
    // change it — which makes OFF the coherent choice. Recorded here so the next
    // reader inherits the uncertainty rather than the guess.
    VITE_FEATURE_SSE: 'dev server has no reachable stream source; ON would hang captures, not alter them',
    // ⭐ CORRECT AND OBVIOUS, AND IT WAS INVISIBLE UNTIL THE PATTERN WIDENED.
    // A harness must not carry the real publishable credential; it uses a dummy
    // so the ~24 spec files that vanish at COLLECT without a key still collect
    // (trap 2b). Recorded rather than assumed, because "obviously deliberate" is
    // what every undeclared divergence looks like until one of them is not.
    VITE_SUPABASE_ANON_KEY: 'test harness must not hold the real credential; a dummy keeps collection healthy',
  }

  it('every divergence from the deployed posture is DECLARED, and every declaration is live', () => {
    const found: string[] = []
    for (const [name, suiteValue] of suite) {
      const deployedValue = deployed.get(name)
      if (deployedValue !== undefined && deployedValue !== suiteValue) found.push(name)
    }
    // Grows  ⇒ an undeclared divergence: the suite would capture a posture
    //           staging does not serve, which is how this guard was earned.
    // Shrinks ⇒ a stale exemption: the divergence is gone and the declaration
    //           now excuses nothing, so the next real one would hide behind it.
    expect(found.sort()).toEqual(Object.keys(DELIBERATE_DIVERGENCE).sort())
  })

  it('every declared divergence carries a non-empty reason', () => {
    for (const [name, reason] of Object.entries(DELIBERATE_DIVERGENCE)) {
      expect(reason.trim().length, `${name} is exempted with no reason`).toBeGreaterThan(20)
    }
  })
})
