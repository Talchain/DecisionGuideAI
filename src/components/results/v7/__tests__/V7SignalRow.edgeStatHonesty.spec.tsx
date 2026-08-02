/**
 * ROADMAP 2.291 (Codex A8) — an EDGE statistic may not display under a FACTOR
 * label called "flip risk".
 *
 * THE DEFECT: `selectFlipRisk` uses `flip_thresholds` only as an ID gate and
 * then returns `fragile_edges[].switch_probability`; the chip printed
 * "N% flip risk · {from_label}". PLoT defines `switch_probability` as the
 * probability that flipping an EDGE switches the recommendation — the number
 * belongs to the edge, not the factor, and "flip risk" attributes it to the
 * factor's own flip evidence.
 *
 * THE FIX, arm by arm:
 *   · `flips_present` — the chip states the FACTOR'S OWN flip evidence: the
 *     producer's threshold, its direction against the current value, and the
 *     alternative winner where present, via the SAME register sentences and
 *     the same formatter the hero uses (`FLIP_THRESHOLD_COPY.*`,
 *     `formatFlipValue` — one threshold must never render two ways in one
 *     panel). The edge percentage is NOT mixed into the factor statement.
 *   · `no_producer_flip_data` — the percentage is the only signal, so it is
 *     retained, but labelled with the register's own name for the quantity
 *     ("N% switch", `FLIP_THRESHOLD_COPY.switchMeta`) and attributed to the
 *     EDGE it belongs to, named "{from} → {to}". The words "flip risk" leave
 *     this arm.
 *
 * ⚠ #557's attestation machinery (`classifyFlipEvidence`, `flips_absent`
 * gating) is NOT touched — its specs (`V7SignalRow.flipHonesty.spec.tsx`,
 * `selectFlipRisk.spec.ts`) must stay green alongside this file.
 *
 * CLAIM TYPE: jsdom text presence/absence only (trap 3).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V7SignalRow } from '../V7SignalRow'
import { FLIP_THRESHOLD_COPY } from '../../utils/flipThresholdDisplay'

const EDGE = {
  edge_id: 'fac_vendor_fit->out_success',
  from_id: 'fac_vendor_fit',
  from_label: 'Vendor Fit',
  to_label: 'Deal Success',
  switch_probability: 0.4,
}

const FLIPPING_THRESHOLD = {
  node_id: 'fac_vendor_fit',
  label: 'Vendor Fit',
  current_value: 2000,
  flip_value: 4000,
  unit: '£',
  flip_reason: 'found',
  alternative_winner_label: 'Option B',
}

describe('V7SignalRow — flips_present states the factor threshold, not the edge stat (2.291)', () => {
  it('RED-first: the chip no longer reads "N% flip risk · factor"', () => {
    render(
      <V7SignalRow
        fragileEdges={[EDGE]}
        flipThresholds={[FLIPPING_THRESHOLD]}
        topDrivers={[]}
      />,
    )
    const chip = screen.getByTestId('v7-signal-flip-risk')
    expect(chip.textContent).not.toContain('flip risk')
    // The edge percentage is not mixed into the factor statement.
    expect(chip.textContent).not.toContain('40%')
  })

  it('RED-first: threshold + direction + alternative winner, in the hero register sentence', () => {
    render(
      <V7SignalRow
        fragileEdges={[EDGE]}
        flipThresholds={[FLIPPING_THRESHOLD]}
        topDrivers={[]}
      />,
    )
    const chip = screen.getByTestId('v7-signal-flip-risk')
    // flip_value 4,000 > current 2,000 → "rises above"; £-symbol prefix.
    expect(chip.textContent).toContain(
      FLIP_THRESHOLD_COPY.flipRiskWithAlternative(
        'Vendor Fit',
        FLIP_THRESHOLD_COPY.risesAbove,
        '£4,000',
        'Option B',
        false,
      ),
    )
  })

  it('withheld designations use the withheld register arm', () => {
    render(
      <V7SignalRow
        fragileEdges={[EDGE]}
        flipThresholds={[FLIPPING_THRESHOLD]}
        topDrivers={[]}
        designationsWithheld
      />,
    )
    const chip = screen.getByTestId('v7-signal-flip-risk')
    expect(chip.textContent).toContain(
      FLIP_THRESHOLD_COPY.flipRiskWithAlternative(
        'Vendor Fit',
        FLIP_THRESHOLD_COPY.risesAbove,
        '£4,000',
        'Option B',
        true,
      ),
    )
    // The permitted arm's designation verb must not appear.
    expect(chip.textContent).not.toContain('becomes the likely leader')
  })

  it('direction: below-current flip value reads "falls below"; missing baseline reads "crosses"', () => {
    const { unmount } = render(
      <V7SignalRow
        fragileEdges={[EDGE]}
        flipThresholds={[{ ...FLIPPING_THRESHOLD, flip_value: 1000 }]}
        topDrivers={[]}
      />,
    )
    expect(screen.getByTestId('v7-signal-flip-risk').textContent).toContain(
      `${FLIP_THRESHOLD_COPY.fallsBelow} £1,000`,
    )
    unmount()
    render(
      <V7SignalRow
        fragileEdges={[EDGE]}
        flipThresholds={[{ ...FLIPPING_THRESHOLD, current_value: null }]}
        topDrivers={[]}
      />,
    )
    // No producer baseline → a direction claim is unknowable (UI-SEM-074).
    expect(screen.getByTestId('v7-signal-flip-risk').textContent).toContain(
      `${FLIP_THRESHOLD_COPY.crosses} £4,000`,
    )
  })

  it('no alternative winner → the no-alternative register sentence', () => {
    render(
      <V7SignalRow
        fragileEdges={[EDGE]}
        flipThresholds={[{ ...FLIPPING_THRESHOLD, alternative_winner_label: undefined }]}
        topDrivers={[]}
      />,
    )
    expect(screen.getByTestId('v7-signal-flip-risk').textContent).toContain(
      FLIP_THRESHOLD_COPY.flipRiskNoAlternative(
        'Vendor Fit',
        FLIP_THRESHOLD_COPY.risesAbove,
        '£4,000',
        false,
      ),
    )
  })

  it('the chip still focuses the factor node', () => {
    const onFocusNode = vi.fn()
    render(
      <V7SignalRow
        fragileEdges={[EDGE]}
        flipThresholds={[FLIPPING_THRESHOLD]}
        topDrivers={[]}
        onFocusNode={onFocusNode}
      />,
    )
    screen.getByTestId('v7-signal-flip-risk').click()
    expect(onFocusNode).toHaveBeenCalledWith('fac_vendor_fit')
  })
})

describe('V7SignalRow — legacy payloads label the retained percentage as the edge quantity (2.291)', () => {
  it('RED-first: no flip thresholds → "N% switch" naming the EDGE, never "flip risk"', () => {
    render(<V7SignalRow fragileEdges={[EDGE]} topDrivers={[]} />)
    const chip = screen.getByTestId('v7-signal-flip-risk')
    expect(chip.textContent).not.toContain('flip risk')
    // The register's own name for the quantity, attributed to its edge.
    expect(chip.textContent).toContain(FLIP_THRESHOLD_COPY.switchMeta('40%'))
    expect(chip.textContent).toContain('Vendor Fit → Deal Success')
  })

  it('POSITIVE CONTROL (#557 unchanged): all-attested-no-flip still renders no chip at all', () => {
    render(
      <V7SignalRow
        fragileEdges={[EDGE]}
        flipThresholds={[
          { node_id: 'fac_vendor_fit', flip_value: null, flip_reason: 'structurally_invariant' },
        ]}
        topDrivers={[]}
      />,
    )
    expect(screen.queryByTestId('v7-signal-flip-risk')).toBeNull()
  })
})
