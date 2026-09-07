/**
 * ⭐ EVERY SENTENCE IN THE POST-ANALYSIS FACTOR STACK BINDS, BY PROXIMITY, TO THE
 *    BAR IT IS ABOUT.
 *
 * ⚠ THE DEFECT THIS PINS. The stack holds TWO GROUPS, and each is a THREE-ITEM
 * group: a bar, its label below it, and a guidance sentence below that. At
 * `space-y-2` the gap BETWEEN groups was 8px while the gaps WITHIN one were
 * `mt-1` = 4px — only 2x. A reader scanning down met:
 *
 *     100%                   <- influence value
 *     Influence on results   <- ITS label
 *     Low                    <- the VoI value
 *     Investigation value    <- ITS label
 *
 * and paired `Influence on results` with the `Low` beneath it, reading
 * "influence: Low" immediately under "100%".
 *
 * ⚠⚠ AND THE FIRST FIX OF THAT DEFECT INVERTED IT INSTEAD OF CLOSING IT, WHICH IS
 * WHY THIS FILE IS SHAPED THE WAY IT IS. Widening the separator to `space-y-4`
 * fixed the two bars and left the INFLUENCE guidance sentence rendering as the
 * container's next sibling at `mt-2` = 8px — so a sentence about influence ended
 * up TWICE AS CLOSE to the value-of-information group as the two groups were to
 * each other. The absolute gap never moved; the contrast inverted against it, and
 * proximity is comparative. `inspectorStrings.ts:403-419` names that exact pair:
 * *"'influence: Low' directly above 'one of the most influential'"*.
 *
 * ⚠ THE HEADER OF THAT FIRST VERSION SAID the value-of-information block "ends
 * with `Investigation value`". FALSE — it ends with a guidance `<p>`. Its "two
 * PAIRS" model is precisely what made the third element invisible to its author:
 * a group modelled as a pair has no room in it for the thing that is actually
 * there. The model is now THREE-ITEM GROUPS, and this header says so.
 *
 * ⭐ THE DATA WAS NEVER WRONG AND THIS GUARD ASSERTS NOTHING ABOUT IT. Influence
 * and value-of-information are different quantities and both rendered correctly.
 * What is pinned is that the LAYOUT does not manufacture a false reading — and
 * the misreading is reproducible: it has caught FOUR independent readers now (a
 * reviewer who nearly filed a data-integrity defect, the author who recorded that
 * near-miss at `inspectorStrings.ts:404`, a lane that re-filed it from a deployed
 * capture on 7 Sep 2026, and the review that found the inversion above).
 *
 * ⚠ THE THREE PANELS LOOK IDENTICAL AND ARE NOT, and applying one byte-identical
 * change to all three is what produced the inversion. Controllable and Observable
 * carry the guidance INSIDE the group, which is safe by derivation:
 * `sensitivityGuidance` is non-null only when `isResultsMode && sensitivityRank
 * != null`, and the container renders on `isResultsMode && (influence != null ||
 * sensitivityRank != null)` — the first implies the second. NEITHER holds for
 * External, whose guidance is unconditional (its last branch is a plain string)
 * and is not always about influence, so there it is SEPARATED instead. The tests
 * below assert the two shapes separately rather than pretending they are one.
 *
 * ⚠ WHY A SOURCE GUARD RATHER THAN A RENDERED ONE. jsdom computes no layout, so a
 * test asserting a rendered gap would pass on any value — a test that cannot
 * fail. The class names ARE the spacing here, so reading them is the honest
 * instrument.
 *
 * ⚠ AND WHY BOTH TERMS ARE DERIVED. An earlier version computed the between-group
 * gap from source and hardcoded the within-group gap as `1 * STEP_PX`. Executed
 * by review: change the labels' `mt-1` to `mt-4` — within == between, the defect
 * fully restored and worse than the original — and the guard still computed 4 and
 * PASSED. A ratio with a frozen denominator is not a ratio; it is a floor on
 * `space-y-N` wearing a ratio's clothes. Both terms now come from the file, so
 * they move together.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

/** Panels whose guidance sentence lives INSIDE the group (proof in the header). */
const GROUPED_PANELS = ['FactorControllablePanel.tsx', 'FactorObservablePanel.tsx'] as const
/** The panel whose guidance is unconditional, so it is separated instead. */
const SEPARATED_PANEL = 'FactorExternalPanel.tsx'
const ALL_PANELS = [...GROUPED_PANELS, SEPARATED_PANEL] as const

/** Tailwind spacing step -> px. `space-y-2` = 8px, `mt-1` = 4px. */
const STEP_PX = 4
/** The between/within ratio below which proximity stops disambiguating. */
const REQUIRED_RATIO = 4

function panelSource(file: string): string {
  return readFileSync(join(__dirname, '..', 'panels', file), 'utf8')
}

/**
 * The stack's spacing, derived ENTIRELY from a source string — no literals about
 * the file it came from. Exported shape so the discriminating tests below can run
 * the SAME function over synthetic sources; a discriminator that re-implements the
 * arithmetic proves nothing about the guard that ships.
 *
 * `within` is the LARGEST margin inside the group slice, deliberately. The rule is
 * that the biggest gap inside a group must still be clearly smaller than the gap
 * between groups, so the maximum is the term that has to satisfy it — a minimum
 * would let one inner margin grow to the separator's size unnoticed, which is
 * exactly the mutation that defeated the previous version.
 */
function stackSpacing(src: string): { between: number; within: number; ratio: number } | null {
  const container = /className="mt-2 space-y-(\d+)"/.exec(src)
  if (!container) return null
  const between = Number(container[1]) * STEP_PX

  // The group slice: from the end of the container's own className to the close
  // of the banner that wraps the stack. The container's own `mt-2` is therefore
  // outside the slice and cannot be mistaken for an inner margin.
  const from = container.index + container[0].length
  const end = src.indexOf('</StaleGuardBanner>', from)
  const slice = src.slice(from, end === -1 ? src.length : end)

  // ⚠ MARGINS ARE READ OUT OF `className` VALUES ONLY, NEVER OUT OF FREE TEXT —
  // and this guard caught itself doing the latter. A first cut scanned the raw
  // slice for `/\bmt-(\d+)\b/`, which matched the string `` `mt-2` = 8px `` inside
  // the EXPLANATORY COMMENT that documents this very fix, and reported an 8px
  // within-group gap that no element has. A source-reading instrument has to know
  // the difference between code and prose about code; the panels are heavily
  // commented, so this is not a hypothetical.
  const classNames = [...slice.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)].map(
    (m) => m[1] ?? m[2] ?? '',
  )
  const margins = classNames.flatMap((cn) =>
    [...cn.matchAll(/\bmt-(\d+)\b/g)].map((m) => Number(m[1]) * STEP_PX),
  )
  if (margins.length === 0) return null
  const within = Math.max(...margins)
  return { between, within, ratio: between / within }
}

describe('the post-analysis factor stack groups each bar with its own sentences', () => {
  it.each(ALL_PANELS)('%s — the between-group gap is at least 4x the largest within-group gap', (file) => {
    const src = panelSource(file)

    // ── PRECONDITIONS, PINNED IN-TEST ────────────────────────────────────────
    // Without these the assertions below would pass on a file that no longer
    // renders the stack at all — the guard would stop discriminating and nothing
    // would go red.
    //
    // ⚠ BOUNDARY-MATCHED, NOT `toContain`. A substring precondition CANNOT see a
    // removal: `<ImportanceBarREMOVED` contains `<ImportanceBar`, so a mutant that
    // deleted the component passed the first version of this guard 4/4.
    expect(
      /<ImportanceBar[\s/>]/.test(src),
      `${file} must still render <ImportanceBar> — precondition, not a style check`,
    ).toBe(true)

    // ⚠ AND THE VoI PRECONDITION HAD THE SAME HOLE ONE LEVEL DEEPER. It matched
    // `INLINE_LABELS.investigationValue`, which occurs TWICE per panel: once as
    // `DataBar`'s `label={…}` — rendered as an `aria-label` ONLY, never as text
    // (`inspectorStrings.ts:405-407`) — and once as the visible `<div>`. Executed
    // by review: delete the visible `<div>` and the old precondition still passed
    // 3/3, on a file regressed to the exact unlabelled-bar state it claims to
    // prevent. Pinning the COUNT is what closes that: the aria-label alone is 1.
    const voiOccurrences = [...src.matchAll(/INLINE_LABELS\.investigationValue\b/g)].length
    expect(
      voiOccurrences,
      `${file}: expected the VoI label BOTH as DataBar's aria-label AND as the visible ` +
        `<div>, i.e. exactly 2 occurrences — found ${voiOccurrences}. One means the ` +
        'visible label is gone and the bar is unlabelled again.',
    ).toBe(2)

    const spacing = stackSpacing(src)
    expect(spacing, `${file}: could not find the ImportanceBar stack container`).not.toBeNull()

    expect(
      spacing!.ratio,
      `${file}: between-group gap ${spacing!.between}px vs largest within-group gap ` +
        `${spacing!.within}px — too close for a label or a sentence to bind to its own ` +
        'bar. This is the "influence: Low" misreading.',
    ).toBeGreaterThanOrEqual(REQUIRED_RATIO)
  })

  it.each(GROUPED_PANELS)('%s — the influence sentence sits INSIDE the group it describes', (file) => {
    const src = panelSource(file)
    const banner = src.indexOf('</StaleGuardBanner>')
    const guidance = src.indexOf('{sensitivityGuidance}')
    expect(banner, `${file}: no </StaleGuardBanner> — the stack is not where this guard thinks`).toBeGreaterThan(-1)
    expect(guidance, `${file}: the guidance sentence is not rendered at all`).toBeGreaterThan(-1)
    // THE B1 PROPERTY. Rendered after the banner closes, the sentence is a sibling
    // of the whole stack and binds by proximity to whichever group ends last —
    // which is the value-of-information group, not influence.
    expect(
      guidance,
      `${file}: the influence sentence renders AFTER </StaleGuardBanner>, so proximity ` +
        'binds it to the value-of-information group instead of to the influence bar.',
    ).toBeLessThan(banner)
  })

  it(`${SEPARATED_PANEL} — the unconditional guidance is separated by MORE than the group separator`, () => {
    const src = panelSource(SEPARATED_PANEL)
    const spacing = stackSpacing(src)
    expect(spacing).not.toBeNull()
    const banner = src.indexOf('</StaleGuardBanner>')
    const after = src.slice(banner)
    const guidanceMargin = /data-testid="factor-external-guidance"/.test(after)
      ? Number(/className=\{`\$\{typography\.panelBody\} text-text-body mt-(\d+)`\}/.exec(after)?.[1] ?? '0') * STEP_PX
      : 0
    expect(
      guidanceMargin,
      'the external guidance sentence must sit FURTHER from the stack than the stack’s own ' +
        `groups sit from each other (${spacing!.between}px); found ${guidanceMargin}px. ` +
        'Equal or closer and it reads as a third line of the value-of-information bar.',
    ).toBeGreaterThan(spacing!.between)
  })

  // ── DISCRIMINATING PAIR, RUN THROUGH THE SHIPPED FUNCTION ──────────────────
  //
  // ⚠ THE PREVIOUS VERSION OF THIS TEST COULD NOT FAIL. It read
  // `expect(2 * STEP_PX / (1 * STEP_PX)).toBeLessThan(4)` — literals it defined
  // itself, against a second unlinked copy of the threshold. It read no source,
  // imported no panel and never invoked the extraction. Relaxing the real
  // threshold to `>= 2` would have let the regression through while this stayed
  // green. Both halves below now run `stackSpacing`, the function the guard above
  // actually uses.

  it('DISCRIMINATOR: the shipped extraction REDS on the regression it was written for', () => {
    const regressed = `
      <div className="mt-2 space-y-2">
        <ImportanceBar importanceScore={x} />
        <div>
          <DataBar label={INLINE_LABELS.investigationValue} />
          <div className="mt-1">{INLINE_LABELS.investigationValue}</div>
        </div>
      </div>
      </StaleGuardBanner>`
    const spacing = stackSpacing(regressed)
    expect(spacing).not.toBeNull()
    expect(spacing!.between).toBe(8)
    expect(spacing!.within).toBe(4)
    expect(spacing!.ratio).toBeLessThan(REQUIRED_RATIO)
  })

  it('DISCRIMINATOR: the shipped extraction REDS when an INNER margin grows to meet the separator', () => {
    // The mutation that defeated the frozen-denominator version: `mt-1` -> `mt-4`
    // with the separator untouched. within == between, so the ratio is 1.
    const innerGrown = `
      <div className="mt-2 space-y-4">
        <ImportanceBar importanceScore={x} />
        <div>
          <DataBar label={INLINE_LABELS.investigationValue} />
          <div className="mt-4">{INLINE_LABELS.investigationValue}</div>
        </div>
      </div>
      </StaleGuardBanner>`
    const spacing = stackSpacing(innerGrown)
    expect(spacing!.within).toBe(16)
    expect(spacing!.ratio).toBeLessThan(REQUIRED_RATIO)
  })

  it('DISCRIMINATOR: the shipped extraction PASSES a correct stack — it is not simply always red', () => {
    // A control that can only fail is worth as little as one that cannot.
    const good = `
      <div className="mt-2 space-y-4">
        <div>
          <ImportanceBar importanceScore={x} />
          <p className="mt-1">{sensitivityGuidance}</p>
        </div>
        <div>
          <DataBar label={INLINE_LABELS.investigationValue} />
          <div className="mt-1">{INLINE_LABELS.investigationValue}</div>
          <p className="mt-1">evidence</p>
        </div>
      </div>
      </StaleGuardBanner>`
    const spacing = stackSpacing(good)
    expect(spacing!.between).toBe(16)
    expect(spacing!.within).toBe(4)
    expect(spacing!.ratio).toBeGreaterThanOrEqual(REQUIRED_RATIO)
  })
})
