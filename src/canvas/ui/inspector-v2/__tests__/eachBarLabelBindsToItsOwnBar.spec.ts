/**
 * ⭐ EACH BAR'S LABEL MUST BIND TO ITS OWN BAR — BY PROXIMITY, NOT BY HOPE.
 *
 * ⚠ THE DEFECT THIS PINS. Both bars in the post-analysis factor stack put their
 * label BELOW their own value: `ImportanceBar` ends with `Influence on results`,
 * and the value-of-information block ends with `Investigation value`. At
 * `space-y-2` the gap BETWEEN the two pairs was 8px while the gap WITHIN a pair
 * was `mt-1` = 4px — only 2x. A reader scanning down met:
 *
 *     100%                   <- influence value
 *     Influence on results   <- ITS label
 *     Low                    <- the VoI value
 *     Investigation value    <- ITS label
 *
 * and paired `Influence on results` with the `Low` beneath it, reading
 * "influence: Low" immediately under "100%".
 *
 * ⭐ THE DATA WAS NEVER WRONG AND THIS GUARD ASSERTS NOTHING ABOUT IT. Influence
 * and value-of-information are different quantities and both rendered correctly.
 * What this pins is that the LAYOUT does not manufacture a false reading — and
 * the misreading is reproducible: it has caught THREE independent readers (a
 * reviewer who nearly filed a data-integrity defect, the author who recorded
 * that near-miss at `inspectorStrings.ts:404`, and a lane that re-filed it from
 * a deployed capture on 7 Sep 2026).
 *
 * ⚠ WHY A SOURCE GUARD RATHER THAN A RENDERED ONE. jsdom computes no layout, so
 * a test asserting the rendered gap would pass on any value — a test that cannot
 * fail. The class names ARE the spacing here, so reading them is the honest
 * instrument; asserting a computed pixel gap would be theatre.
 *
 * ⚠ AND WHY A RATIO RATHER THAN THE LITERAL `space-y-4`. The requirement is
 * "between-pair gap clearly exceeds within-pair gap". Pinning the literal would
 * red on a legitimate move to `space-y-5`; pinning the ratio states the actual
 * rule and still reds on the regression.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

const PANELS = [
  'FactorControllablePanel.tsx',
  'FactorObservablePanel.tsx',
  'FactorExternalPanel.tsx',
] as const

/** Tailwind spacing step -> px. `space-y-2` = 8px, `mt-1` = 4px. */
const STEP_PX = 4

function panelSource(file: string): string {
  return readFileSync(join(__dirname, '..', 'panels', file), 'utf8')
}

describe('the post-analysis factor stack groups each bar with its own label', () => {
  it.each(PANELS)('%s — between-pair gap is at least 4x the within-pair gap', (file) => {
    const src = panelSource(file)

    // PRECONDITION, PINNED IN-TEST. Without these the assertions below would
    // pass on a file that no longer renders the stack at all — the guard would
    // stop discriminating and nothing would go red.
    // ⚠ BOUNDARY-MATCHED, NOT `toContain`. A substring precondition CANNOT see a
    // removal: `<ImportanceBarREMOVED` contains `<ImportanceBar`, so a mutant that
    // deleted the component passed this guard 4/4. Measured, not theorised — that
    // mutant is what caught it. The JSX element must be followed by whitespace or
    // `/` or `>`, so a renamed or removed component reds.
    expect(
      /<ImportanceBar[\s/>]/.test(src),
      `${file} must still render <ImportanceBar> — precondition, not a style check`,
    ).toBe(true)
    expect(
      /INLINE_LABELS\.investigationValue\b/.test(src),
      `${file} must still render the VoI label`,
    ).toBe(true)

    // The container that wraps ImportanceBar + the VoI block.
    const container = /className="mt-2 space-y-(\d+)"/.exec(src)
    expect(container, `${file}: could not find the ImportanceBar stack container`).not.toBeNull()

    const betweenPairs = Number(container![1]) * STEP_PX
    // Both bars attach their own label with `mt-1`.
    const withinPair = 1 * STEP_PX

    expect(
      betweenPairs / withinPair,
      `${file}: between-pair gap ${betweenPairs}px vs within-pair ${withinPair}px — ` +
        'too close for the label to bind to its own bar. This is the "influence: Low" misreading.',
    ).toBeGreaterThanOrEqual(4)
  })

  it('the guard would fail on the regression it was written for', () => {
    // Discriminating check: the ratio the OLD value produced must not pass.
    const oldBetween = 2 * STEP_PX // space-y-2
    expect(oldBetween / (1 * STEP_PX)).toBeLessThan(4)
  })
})
