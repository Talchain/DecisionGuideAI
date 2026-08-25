/**
 * RESOLVE-NEXT — the ACT step. INTERVENE -> ACT, on the signal that already has
 * canonical identity.
 *
 * ## Why this signal and not `defaulted_assumptions`
 *
 * The obvious candidate was the defaulted-assumption row, whose producer sentence
 * already says a value was defaulted. It is BLOCKED: `defaulted_assumptions`
 * carries `factor_label` and no id (26/26 fixtures), so binding a control to it
 * would mean matching on a label — and a label is not a durable key. PLoT emitting
 * `factor_id` would remove that risk class; it has not landed.
 *
 * `VoiRankingRow` already carries what that one lacks: `factorId` ("carried for
 * canvas focus ONLY — never displayed"), a resolved canvas `label` ("a row without
 * one is dropped, never id-shaped"), and `canFocus` ("true when the id maps to a
 * canvas node that can be focused"). Identity is already resolved, already
 * validated, and already FAIL-CLOSED by construction. No label matching, no new
 * producer contract.
 *
 * ## What the copy may and may not say
 *
 * ⚠ THE ROW IS RANKED BY VALUE OF INFORMATION, NOT BY DEFAULTEDNESS. A high-EVPPI
 * factor may hold a value the USER set. So the label must be provenance-neutral:
 * "Review Olumi's estimate" would be false on exactly those rows. It says
 * "Review this value" and nothing more.
 *
 * ⚠ AND IT PROMISES NO CONSEQUENCE. The destination accepts input without
 * validating plausibility — `-999999999` was committed without refusal in a live
 * trial — so the copy must not claim Olumi checks the number, nor that entering
 * one "improves" the analysis. The action offered is REVIEWING and replacing a
 * provisional value with the user's own judgement; what follows from that is the
 * user's to see, not ours to assert.
 *
 * ## What it must not become
 *
 * The existing row button is a CROSSHAIR that focuses the canvas — an honest
 * promise, kept. This control is separate and distinctly labelled, because the
 * estate has already ruled (`focusOnCanvasCopy.ts`) that a chip labelled "Edit"
 * wired to the camera-focus handler was a FALSE PROMISE.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import { HeroEvidenceDisclosure } from '../HeroEvidenceDisclosure'
import type { HeroEvidenceModel } from '../heroTypes'

const row = (factorId: string, label: string, canReviewValue = true) =>
  ({ factorId, label, canFocus: true, canReviewValue })

function model(partial: Partial<HeroEvidenceModel> = {}): HeroEvidenceModel {
  return {
    drivers: partial.drivers ?? [],
    flipRisks: partial.flipRisks ?? [],
    fragileEdgeRefs: partial.fragileEdgeRefs ?? [],
    tradeOffs: partial.tradeOffs ?? null,
    resolveNext: partial.resolveNext ?? null,
    ...partial,
  } as HeroEvidenceModel
}

const ranking = (rows: ReturnType<typeof row>[]) => ({
  resolved: rows, belowResolution: [], someFactorsUnassessed: false,
})

/**
 * The disclosure opens closed and defaults to another view, so the resolve-next
 * rows are reached the way a user reaches them — two clicks. `fireEvent`, not
 * `node.click()`: the raw DOM call escapes React's `act()`.
 */
function openResolveNext() {
  fireEvent.click(screen.getByRole('button', { name: /why and what could change it/i }))
  // With resolve-next as the ONLY present view it is already active and the strip
  // renders no tab, so the click is conditional. Asserted after, not assumed: the
  // rows must actually be on screen or every case below is vacuous.
  const tab = screen.queryByTestId('hero-evidence-tab-resolveNext')
  if (tab) fireEvent.click(tab)
  expect(screen.getByTestId('hero-evidence-resolve-next')).toBeInTheDocument()
}

function renderResolveNext(rows: ReturnType<typeof row>[], onReviewValue = vi.fn()) {
  render(
    <HeroEvidenceDisclosure
      evidence={model({ resolveNext: ranking(rows) as never })}
      onFocusTarget={vi.fn()}
      onReviewValue={onReviewValue}
    />,
  )
  openResolveNext()
  return onReviewValue
}

describe('the ACT control appears on a resolvable row', () => {
  it('offers one review control per resolvable row, bound to that row', () => {
    renderResolveNext([row('fac_budget', 'Available Growth Budget'), row('fac_churn', 'Churn Trend')])
    const controls = screen.getAllByRole('button', { name: /review this value/i })
    expect(controls).toHaveLength(2)
  })

  it('BINDS BY IDENTITY — the control on a row sends that row\'s factor id', () => {
    const onReviewValue = renderResolveNext([
      row('fac_budget', 'Available Growth Budget'),
      row('fac_churn', 'Churn Trend'),
    ])
    const rows = screen.getAllByTestId('hero-resolve-next-row')
    fireEvent.click(within(rows[1]).getByRole('button', { name: /review this value/i }))
    expect(onReviewValue).toHaveBeenCalledTimes(1)
    expect(onReviewValue).toHaveBeenCalledWith('fac_churn')
  })

  it('does not offer it on a row whose value cannot be reviewed', () => {
    renderResolveNext([row('fac_unset', 'Unset Factor', /* canReviewValue */ false)])
    expect(screen.queryByRole('button', { name: /review this value/i })).toBeNull()
  })

  it('does not offer it when no handler is wired', () => {
    render(
      <HeroEvidenceDisclosure
        evidence={model({ resolveNext: ranking([row('fac_budget', 'Available Growth Budget')]) as never })}
        onFocusTarget={vi.fn()}
      />,
    )
    openResolveNext()
    expect(screen.queryByRole('button', { name: /review this value/i })).toBeNull()
  })
})

describe('the copy claims only what is true', () => {
  it('is provenance-neutral — never attributes the value to Olumi', () => {
    renderResolveNext([row('fac_budget', 'Available Growth Budget')])
    const control = screen.getByRole('button', { name: /review this value/i })
    // The row is ranked by value of information, not defaultedness; the value may
    // be the user's own.
    expect(control.textContent ?? '').not.toMatch(/olumi'?s|our |we (?:set|chose|guessed)|default/i)
  })

  it('promises no validation and no improvement', () => {
    renderResolveNext([row('fac_budget', 'Available Growth Budget')])
    const body = document.body.textContent ?? ''
    expect(body).not.toMatch(/improve[sd]? the analysis|more accurate|more trustworthy|we(?:'ll| will) check|valid(?:ate|ates|ated)/i)
  })

  it('keeps the crosshair focus control distinct from the review control', () => {
    const onReviewValue = vi.fn()
    const onFocusTarget = vi.fn()
    render(
      <HeroEvidenceDisclosure
        evidence={model({ resolveNext: ranking([row('fac_budget', 'Available Growth Budget')]) as never })}
        onFocusTarget={onFocusTarget}
        onReviewValue={onReviewValue}
      />,
    )
    openResolveNext()
    const r = screen.getByTestId('hero-resolve-next-row')
    fireEvent.click(within(r).getByRole('button', { name: /review this value/i }))
    // The review control must NOT fire canvas focus — a separate promise.
    expect(onReviewValue).toHaveBeenCalledWith('fac_budget')
    expect(onFocusTarget).not.toHaveBeenCalled()
  })
})
