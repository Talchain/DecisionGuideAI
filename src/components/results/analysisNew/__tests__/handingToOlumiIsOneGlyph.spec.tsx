/**
 * ⭐ C3 / R3 — "work this through with Olumi" is ONE act, so it is ONE glyph.
 *
 * Before 23 Sep the panel drew that act three ways: a text link on the Model
 * groups, `MessageCircle` on the Model card, and `Sparkles` on every expanded
 * Reasoning row (16 on the market-entry render) — while `Sparkles` ALSO meant
 * "AI estimate" and "Olumi proposed this option". A reader could not tell the
 * AI-made-this status from the talk-to-Olumi act.
 *
 * The ruling (R3): `Sparkles` = content Olumi originated (a STATUS) only; every
 * hand-to-Olumi ACTION is `MessageCircle`, the glyph the Model card already
 * used. This file binds the Reasoning tab's three act sites to it. The Model
 * tab's group actions are bound in `discussIsASpeechBubble.spec.tsx`.
 *
 * ⚠ BOUND BY IDENTITY: each control is found by its testid AND its exact
 * accessible name, and the glyph by lucide's own class.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DisclosureRow } from '../DisclosureRow'
import { PrimaryIntervention } from '../sections/PrimaryIntervention'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { AnalysisNewFinding } from '../analysisNewTypes'

const finding = (over: Partial<AnalysisNewFinding> = {}): AnalysisNewFinding => ({
  id: 'driver:f_adopt',
  headline: 'Customer adoption',
  implication: 'Among the strongest influences in this run.',
  detail: 'These numbers are sensitive to this relationship.',
  groundedIn: 'factor sensitivity, ranked within this run',
  targetId: 'f_adopt',
  inspect: [],
  ...over,
})

function openRow() {
  fireEvent.click(screen.getByTestId('row-row-toggle'))
}

describe('R3 · the Reasoning row hands a finding to Olumi with the speech bubble', () => {
  it('the ASK act draws MessageCircle, never Sparkles', () => {
    render(<DisclosureRow finding={finding()} testIdPrefix="row" onAskOlumi={vi.fn()} />)
    openRow()
    const ask = screen.getByRole('button', { name: COPY.disclosure.askOlumi })
    expect(ask).toBe(screen.getByTestId('row-ask'))
    expect(ask.querySelector('svg.lucide-message-circle')).not.toBeNull()
    expect(ask.querySelector('svg.lucide-sparkles')).toBeNull()
  })

  it('the INTERVENTION act (same slot, same act) draws MessageCircle, never Sparkles', () => {
    render(
      <DisclosureRow
        finding={finding({
          intervention: { recommendationId: 'strengthen:voi', label: 'Gather evidence', targetId: 'f_adopt' },
        })}
        testIdPrefix="row"
        onRunIntervention={vi.fn()}
      />,
    )
    openRow()
    const run = screen.getByRole('button', { name: 'Gather evidence' })
    expect(run).toBe(screen.getByTestId('row-intervention'))
    expect(run.querySelector('svg.lucide-message-circle')).not.toBeNull()
    expect(run.querySelector('svg.lucide-sparkles')).toBeNull()
  })

  it('CONTRAST: the row\'s other acts keep their own glyphs', () => {
    render(
      <DisclosureRow
        finding={finding({ reviewTargetId: 'f_adopt' })}
        testIdPrefix="row"
        onFocusTarget={vi.fn()}
        onReviewTarget={vi.fn()}
        onAskOlumi={vi.fn()}
      />,
    )
    openRow()
    expect(screen.getByTestId('row-focus').querySelector('svg.lucide-crosshair')).not.toBeNull()
    expect(screen.getByTestId('row-review').querySelector('svg.lucide-pencil')).not.toBeNull()
  })
})

describe('R3 · the glance\'s primary intervention card is the same act', () => {
  it('its leading glyph is MessageCircle, never Sparkles', () => {
    render(
      <PrimaryIntervention
        primaryIntervention={{ id: 'strengthen:voi', label: 'Gather evidence on adoption' }}
        onRunIntervention={vi.fn()}
      />,
    )
    const card = screen.getByTestId('analysis-new-glance-primary-intervention')
    expect(card.querySelector('svg.lucide-message-circle')).not.toBeNull()
    expect(card.querySelector('svg.lucide-sparkles')).toBeNull()
  })
})
