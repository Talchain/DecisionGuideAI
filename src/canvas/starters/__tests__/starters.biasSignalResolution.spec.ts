/**
 * Every bias code the product SHIPS must resolve to an icon and a title.
 *
 * WHAT THIS DEFENDS, and why the existing guard could not.
 * `biasSignalTitles.parity.spec.ts` checks the registry's INTERNAL consistency
 * — that its keys, titles and icons agree with each other. It never looks at
 * the codes the shipped starter corpus actually carries, so a code present in
 * real data with no registry entry reads GREEN there for ever.
 *
 * `resolveBiasSignal` fails CLOSED by design (hostile prototype-chain codes
 * must not escape as truthy config), which is right — but it means an
 * unregistered code is not a crash. It renders NO icon and NO title. The
 * signal is in the data and invisible on screen, and nothing goes red.
 *
 * Measured 8 Sep 2026 across the five shipped starters: 12 entries under
 * `coaching.bias_signals` and 1 under `analysis_ready.bias_findings`; three of
 * the twelve target an option node. Two codes did not resolve — see
 * KNOWN_UNRESOLVED.
 *
 * This is the derived half of the pair (CLAUDE.md trap 12 — derive, don't
 * mirror): the corpus is read from the fixtures themselves, so a new starter,
 * or a new code in an existing one, is covered the day it lands.
 */

import { describe, it, expect } from 'vitest'
import { STARTERS, loadStarterPayload } from '../loadStarter'
import { resolveBiasSignal } from '../../shared/biasSignalTitles'

interface BiasBearingFixture {
  coaching?: { bias_signals?: Array<{ type?: string }> }
  analysis_ready?: { bias_findings?: Array<{ code?: string }> }
}

/**
 * Codes that are present in shipped data and do NOT resolve, pinned EXACTLY so
 * the suite is green for the right reason. This set must not grow silently —
 * and it must not shrink silently either, because a code leaving it means the
 * defect was fixed and this pin is now describing history.
 *
 * `omission / status-quo bias` (build-vs-buy) is FREE TEXT, not a code: it has
 * a space and a slash, and it names TWO biases. It must not be added to the
 * registry as a key — the registry holds codes. It also cannot simply be
 * rewritten to `status_quo_bias`, because that silently drops the omission
 * half, and the registry has no `omission_bias`. Fixing it is a content
 * decision for whoever owns the fixture's upstream capture, not a mechanical
 * rename. Recorded here so it stays visible until then.
 */
const KNOWN_UNRESOLVED: ReadonlySet<string> = new Set(['omission / status-quo bias'])

async function collectCodes(): Promise<{ codes: string[]; signals: number; findings: number }> {
  const codes: string[] = []
  let signals = 0
  let findings = 0
  for (const s of STARTERS) {
    const g = (await loadStarterPayload(s.id)) as BiasBearingFixture
    for (const e of g.coaching?.bias_signals ?? []) {
      signals += 1
      if (typeof e.type === 'string') codes.push(e.type)
    }
    for (const e of g.analysis_ready?.bias_findings ?? []) {
      findings += 1
      if (typeof e.code === 'string') codes.push(e.code)
    }
  }
  return { codes, signals, findings }
}

describe('shipped starter bias codes resolve to an icon and a title', () => {
  it('CONTROL — the corpus is non-empty, so no assertion below can pass vacuously', async () => {
    const { codes, signals, findings } = await collectCodes()
    expect(STARTERS.length).toBeGreaterThan(0)
    // Measured 8 Sep 2026: 12 signals, 1 finding. Asserted as floors, not
    // equalities, so adding a starter is not a false red — but a corpus that
    // silently empties (a renamed field, a loader returning a stub) fails here
    // instead of turning every check below into a vacuous pass.
    expect(signals).toBeGreaterThanOrEqual(12)
    expect(findings).toBeGreaterThanOrEqual(1)
    expect(codes.length).toBeGreaterThanOrEqual(13)
  })

  it('every shipped code resolves, except exactly the pinned known-unresolved set', async () => {
    const { codes } = await collectCodes()
    const unresolved = [...new Set(codes.filter((c) => resolveBiasSignal(c) === null))].sort()
    expect(unresolved).toEqual([...KNOWN_UNRESOLVED].sort())
  })

  it('a resolved code yields BOTH a title and an icon, never a half-entry', async () => {
    const { codes } = await collectCodes()
    const resolved = [...new Set(codes)].filter((c) => !KNOWN_UNRESOLVED.has(c))
    expect(resolved.length).toBeGreaterThan(0)
    for (const c of resolved) {
      const entry = resolveBiasSignal(c)
      expect(entry, `no registry entry for shipped code ${c}`).not.toBeNull()
      expect(entry!.title.length).toBeGreaterThan(0)
      expect(entry!.icon).toBeTruthy()
    }
  })

  it('resolution is case- and whitespace-insensitive, as both wire conventions arrive', () => {
    // `coaching.bias_signals[].type` arrives lowercase; `bias_findings[].code`
    // arrives SCREAMING_SNAKE (measured: AUTHORITY_BIAS). Both must land.
    expect(resolveBiasSignal('AUTHORITY_BIAS')?.title).toBe('Authority bias')
    expect(resolveBiasSignal('  Narrow_Framing  ')?.title).toBe('Narrow framing')
  })
})
