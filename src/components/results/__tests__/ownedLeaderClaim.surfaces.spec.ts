/**
 * OWNED LEADER CLAIM — the cross-surface half (ROADMAP 1.223, gate G-CEE-1).
 *
 * `src/lib/__tests__/ownedLeaderClaim.spec.ts` pins the VERDICT. This file
 * pins the SURFACES: on a withheld turn none of them may render comparative
 * leader language, and on a permitted turn every one of them must still
 * render it.
 *
 * Both halves drive the same wire fixture pair
 * (`src/lib/__fixtures__/ownedLeaderClaim.fixtures.ts`), so the two suites are
 * provably describing one run.
 *
 * ## Scope of the claim these tests make
 *
 * These are TEXT-level assertions on pure builders. They prove which strings
 * are composed, and nothing about layout — jsdom cannot prove visibility
 * (CLAUDE.md trap 3), and no assertion here should be read as one.
 *
 * ## SURFACES 3+4 ARE GONE WITH THEIR HOST (V7 retirement) — declared, not silent
 *
 * `buildV7Headline`'s re-anchored leader headline and its numeric subline had a
 * describe here. The builder and its host are DELETED. The equivalent claim on
 * the SURVIVING leader headline — `buildHeroModel`, under both verdicts, with
 * the same withheld/permitted pairing — is pinned in
 * `analysis-hero/__tests__/ownedLeaderClaim.hero.spec.ts`, so the claim did not
 * leave the suite with the builder. Surface 5 (the certainty headline) is deleted with its builder.
 *
 * ## The over-suppression control is not optional
 *
 * Every `WITHHELD` case below has a `PERMITTED` twin. A change that silences
 * the withheld turn by silencing the permitted one too is a failure, not a
 * fix — it would cost the user the product's single most useful sentence.
 */
import { describe, expect, it } from 'vitest'
import { deriveDecisionVerdict } from '../../../lib/decisionVerdict'
import { PERMITTED_REPORT, WITHHELD_REPORT } from '../../../lib/__fixtures__/ownedLeaderClaim.fixtures'

const WITHHELD_VERDICT = deriveDecisionVerdict(WITHHELD_REPORT)
const PERMITTED_VERDICT = deriveDecisionVerdict(PERMITTED_REPORT)

// ── Surface 5: the results-panel certainty headline — DELETED ──────────────
// Run-4 judge (DL 12 Oct, the class): `buildCertaintyCopy` is deleted (no production caller; its permitted headlines were
// leader claims from a win share), so its rows went with it. The verdict it quoted is still pinned below.

// ── The verdict every surface quotes ──────────────────────────────────────

describe('one verdict, quoted everywhere', () => {
  it('WITHHELD: hasLeadingOption is false, so every gated surface agrees', () => {
    expect(WITHHELD_VERDICT.hasLeadingOption).toBe(false)
    expect(PERMITTED_VERDICT.hasLeadingOption).toBe(true)
  })
})
