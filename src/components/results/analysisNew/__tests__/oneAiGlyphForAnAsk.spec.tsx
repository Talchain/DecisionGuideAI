/**
 * ⭐ ONE AI GLYPH FOR AN ASK — Design System v5 §9.8 and the V2 prototype's
 * single `ai` icon. `Sparkles` is the AI-ESTIMATE provenance glyph
 * (`OlumiAiIcon.tsx`); a row's "work on this with Olumi" act drawn with it
 * put two AI icons on the Reasoning tab (design audit B13) and read as
 * "Olumi estimated this". Bound by identity: `data-icon="olumi-ai"` and the
 * Lucide `sparkles` class, on the act's own testid.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DisclosureRow } from '../DisclosureRow'
import type { AnalysisNewFinding } from '../analysisNewTypes'

const withIntervention: AnalysisNewFinding = {
  id: 'driver:f_adopt',
  headline: 'Customer adoption',
  implication: 'Among the strongest influences in this run; raises the outcome.',
  groundedIn: 'factor sensitivity, ranked within this run',
  inspect: [],
  intervention: { recommendationId: 'strengthen:voi', label: 'Gather evidence', targetId: 'f_adopt' },
}
const askOnly: AnalysisNewFinding = { ...withIntervention, id: 'insight:x', intervention: undefined, detail: 'These numbers are sensitive to this relationship.' }

const glyphOf = (el: HTMLElement) => ({
  olumi: el.querySelector('[data-icon="olumi-ai"]') !== null,
  sparkles: el.querySelector('svg.lucide-sparkles') !== null,
})

describe('one AI glyph for an ask', () => {
  it('the intervention act uses the Olumi AI glyph, never Sparkles', () => {
    render(<DisclosureRow finding={withIntervention} testIdPrefix="row" onFocusTarget={vi.fn()} onRunIntervention={vi.fn()} />)
    fireEvent.click(screen.getByTestId('row-row-toggle'))
    expect(glyphOf(screen.getByTestId('row-intervention'))).toEqual({ olumi: true, sparkles: false })
  })

  it('the ask act uses the Olumi AI glyph, never Sparkles', () => {
    render(<DisclosureRow finding={askOnly} testIdPrefix="row" onFocusTarget={vi.fn()} onAskOlumi={vi.fn()} />)
    fireEvent.click(screen.getByTestId('row-row-toggle'))
    expect(glyphOf(screen.getByTestId('row-ask'))).toEqual({ olumi: true, sparkles: false })
  })
})
