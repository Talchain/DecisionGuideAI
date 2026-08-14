/**
 * `SOURCE_CLASSES` vs the shared contract's `OBSERVED_STATE_SOURCE_LITERALS`.
 *
 * ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
 * 0.40.0 minted `OBSERVED_STATE_SOURCE_LITERALS` as the SINGLE OWNER of this
 * vocabulary, and says so in as many words: *"consumers should DERIVE their
 * classifier/validator membership from this list at their >=0.40.0 re-vendor
 * (replacing the two mirrors above)"*. CEE did exactly that — its
 * `ObservedStateV3.source` enum is now `z.enum(OBSERVED_STATE_SOURCE_LITERALS)`.
 *
 * The UI did not. `SOURCE_CLASSES` remains a HAND-WRITTEN map, and
 * `panel_elicited` was hand-added to it. Measured at this tip: the canonical
 * list has **zero** readers anywhere in this repository. The two sets happen to
 * agree today and NOTHING ENFORCES IT — which is CLAUDE.md trap 12 precisely,
 * and the drift would read green.
 *
 * ── WHY A GUARD AND NOT A DERIVATION ──────────────────────────────────────
 * The UI map is not a membership list: it maps each literal to a *classified
 * kind*, and that mapping is a judgement no contract can make (`user_calibration`
 * → `'edited'`, `panel_elicited` → `'panel'`, and deliberately NOT `'edited'`).
 * Deriving membership would produce entries with no honest kind to point at. So
 * the mirror stays and is made FAIL-LOUD instead, which is the other half of the
 * rule: where you cannot derive, the mirror must fail loud on drift, never
 * assume-good.
 *
 * ⚠ AND NOTE WHAT THIS CANNOT SEE (trap 12d, stated rather than discovered
 * later): a guard checked against the canonical list is structurally blind to
 * the canonical list being SHORT. If a literal some producer writes is missing
 * from BOTH sides, every assertion here passes. That is why CEE ships a
 * hand-written corpus alongside its derived guard, and why the corpus — not
 * this file — is what would notice.
 */

import { describe, expect, it } from 'vitest'
import { OBSERVED_STATE_SOURCE_LITERALS } from '@talchain/schemas'

import { VALUE_PROVENANCE_SOURCES, classifyValueProvenance } from '../valueProvenance'

describe('SOURCE_CLASSES completeness against the shared contract', () => {
  it('⭐ classifies EVERY literal the contract declares — a new one cannot land unclassified', () => {
    // The direction that matters most. When the contract mints a literal, this
    // REDs until someone decides what kind it is. Without it, a new producer
    // literal would reach `classifyValueProvenance` as `null` and every surface
    // would silently show its neutral/default copy — which is how
    // `panel_elicited` would have rendered as "Estimated by Olumi".
    const unclassified = OBSERVED_STATE_SOURCE_LITERALS.filter(
      (literal) => classifyValueProvenance(literal) === null,
    )
    expect(
      unclassified,
      `These literals are declared by @talchain/schemas but SOURCE_CLASSES does not ` +
        `classify them:\n${unclassified.map((l) => `  - ${l}`).join('\n')}\n\n` +
        `Add each to SOURCE_CLASSES with a DELIBERATE kind. Do not reach for the ` +
        `nearest-looking neighbour: 'panel_elicited' is not 'edited', because a ` +
        `panel value is somebody else's stated belief and first-person copy on it ` +
        `is an attribution untruth.`,
    ).toEqual([])
  })

  it('classifies NOTHING the contract does not declare — no private vocabulary', () => {
    // The complement. A literal classified here but absent from the contract is
    // either a UI invention no producer writes, or a literal the contract has
    // dropped. Both are drift and both should be looked at consciously.
    const declared = new Set<string>(OBSERVED_STATE_SOURCE_LITERALS)
    const undeclared = VALUE_PROVENANCE_SOURCES.filter((s) => !declared.has(s))
    expect(
      undeclared,
      `SOURCE_CLASSES classifies literals the shared contract does not declare:\n` +
        `${undeclared.map((l) => `  - ${l}`).join('\n')}\n\n` +
        `Either the contract needs widening (a versioned minor) or this is a stale ` +
        `entry. Deleting it silently is how a real producer literal stops being ` +
        `recognised.`,
    ).toEqual([])
  })

  it('the guard is NOT VACUOUS — the canonical list is non-empty and carries the new member', () => {
    // POSITIVE CONTROL. Both assertions above are `toEqual([])`, which passes
    // trivially if the import resolved to an empty array — an absence probe with
    // no proof it can see a presence (trap 13). This is that proof.
    expect(OBSERVED_STATE_SOURCE_LITERALS.length).toBeGreaterThan(5)
    expect(OBSERVED_STATE_SOURCE_LITERALS).toContain('panel_elicited')
    expect(OBSERVED_STATE_SOURCE_LITERALS).toContain('user_override')
    expect(VALUE_PROVENANCE_SOURCES.length).toBeGreaterThan(5)
  })

  it('classifies panel_elicited to its OWN kind, not a neighbour', () => {
    // The specific judgement the first assertion exists to protect. Pinned by
    // identity so a future "tidy-up" that folds 'panel' into 'edited' REDs here
    // rather than quietly restoring first-person copy over a colleague's number.
    expect(classifyValueProvenance('panel_elicited')?.kind).toBe('panel')
    expect(classifyValueProvenance('panel_elicited')?.userOwned).toBe(false)
  })
})
