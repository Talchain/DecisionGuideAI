/**
 * resolveNextView — the shared scaffolding for the two "Resolve next" suites
 * (V7-C slice 1, ROADMAP 2.141).
 *
 * `v7/__tests__/V7EvidenceDisclosure.resolveNext.spec.tsx` (the rendering-rules
 * pins) and `results/__tests__/evpiSurfacesRemoved.resolveNext.honesty.spec.tsx`
 * (the refuted-claim pins) both need the same three things: a ranking row, a
 * non-degenerate ranking fixture, and "render the disclosure, open it, switch to
 * the Resolve next view". They arrived in the SAME PR with three private copies
 * that had already diverged (two `row()` signatures, two fixtures with different
 * labels) — so the two suites were asserting against subtly different surfaces
 * while reading as if they shared one.
 *
 * The fixture is NON-DEGENERATE by construction (ROADMAP 2.141 probe limit i:
 * the live rank-order probe was VACUOUS because the run returned two zero-EVPPI
 * factors, so any order passed). It carries FOUR resolved rows with three
 * DISTINCT producer positions, a TIE PAIR at ranks 2-3, TWO below-resolution
 * rows, and enough rows to exercise the row clamp.
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { V7EvidenceDisclosure } from '../../components/results/v7/V7EvidenceDisclosure'
import type { V7EvidenceModel } from '../../components/results/v7/buildV7Lenses'
import type { VoiRanking, VoiRankingRow } from '../../components/results/voi/voiRanking'

/** One ranking row. `canFocus` defaults to true — the focusable case. */
export function voiRow(factorId: string, label: string, canFocus = true): VoiRankingRow {
  return { factorId, label, canFocus }
}

/**
 * Producer wire order. Ranks 2 and 3 are a TIE on the wire (identical evppi
 * upstream) — the reader keeps producer order and so must the view.
 */
export function voiRankingFixture(partial: Partial<VoiRanking> = {}): VoiRanking {
  return {
    resolved: partial.resolved ?? [
      voiRow('n_market', 'Market receptivity'),
      voiRow('n_comp', 'Competitor response'),
      voiRow('n_comp_eu', 'Competitor response (Europe)'),
      voiRow('n_reg', 'Regulatory timeline'),
    ],
    belowResolution: partial.belowResolution ?? [
      voiRow('n_hiring', 'Hiring pace'),
      voiRow('n_brand', 'Brand halo'),
    ],
    someFactorsUnassessed: partial.someFactorsUnassessed ?? false,
  }
}

/** Render the disclosure, open it, and switch to the Resolve next view. */
export function openResolveNext(
  evidence: V7EvidenceModel,
  onFocusNode?: (id: string) => void,
) {
  const utils = render(<V7EvidenceDisclosure evidence={evidence} onFocusNode={onFocusNode} />)
  fireEvent.click(screen.getByRole('button', { name: /Why, and what could change it/i }))
  fireEvent.click(screen.getByTestId('v7-evidence-tab-resolveNext'))
  return utils
}

/**
 * As `openResolveNext`, then EXPAND the row clamp and return the whole
 * document's text. A claim hiding behind "Show N more" is still a claim, so the
 * refuted-claim sweep must scan the clamped rows too.
 */
export function openResolveNextExpanded(evidence: V7EvidenceModel): string {
  openResolveNext(evidence)
  fireEvent.click(screen.getByTestId('v7-resolve-next-toggle'))
  return document.body.textContent ?? ''
}
