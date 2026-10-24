/**
 * A BIAS RISK IS ITS OWN GLYPH IN THE CARD'S ROW (Paul, 24 Oct 2026). Only a finding CEE serves and grounds on the element
 * (a `behavioural` attention reason); the glyph is the design system §9.6 icon the registry maps its CODE to, never read
 * from its words. A click asks Olumi about it, with the element attached.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { NodeBiasMarks, BIAS_MARK_REFLECTIVE } from '../NodeBiasMarks'
import { useCanvasStore } from '../../../store'
import type { AttentionReason } from '../nodeAttention'

const asks: unknown[] = []
vi.mock('../../../ui/inspector-v2/askSemantic', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  requestAsk: (req: unknown) => { asks.push(req) },
}))

const finding = (biasCode: string, label = 'Worth checking: anchoring. What would show whether it applies here?'): AttentionReason =>
  ({ kind: 'behavioural', order: 4, label, biasCode })

beforeEach(() => {
  asks.length = 0
  useCanvasStore.setState({ lodRung: 'full' } as never)
})

describe('NodeBiasMarks', () => {
  it.each([
    ['anchoring', 'lucide-anchor'],
    ['narrow_framing', 'lucide-frame'],
    ['overconfidence', 'lucide-gauge'],
    ['status_quo_bias', 'lucide-eye-off'],
  ])('%s → its §9.6 glyph, with the finding’s words and the reflective close on hover and name', (code, glyph) => {
    render(<NodeBiasMarks nodeId="f1" label="Trial conversion" reasons={[finding(code)]} />)
    const mark = screen.getByTestId('node-bias-f1')
    expect(mark.querySelector(`svg.${glyph}`)).not.toBeNull()
    expect(mark).toHaveAttribute('data-bias-code', code)
    expect(mark.getAttribute('aria-label')).toBe(`Worth checking: anchoring. What would show whether it applies here? ${BIAS_MARK_REFLECTIVE}`)
  })

  it('the glyph follows the CODE, never the words: a framing finding worded about anchoring draws the frame', () => {
    render(<NodeBiasMarks nodeId="f1" label="Trial conversion" reasons={[finding('framing', 'Worth checking: anchoring.')]} />)
    const mark = screen.getByTestId('node-bias-f1')
    expect(mark.querySelector('svg.lucide-frame')).not.toBeNull()
    expect(mark.querySelector('svg.lucide-anchor')).toBeNull()
  })

  it('a click asks Olumi about the finding, with the element attached', () => {
    render(<NodeBiasMarks nodeId="f1" label="Trial conversion" reasons={[finding('anchoring')]} />)
    fireEvent.click(screen.getByTestId('node-bias-f1'))
    expect(asks).toEqual([{
      text: 'Worth checking: anchoring. What would show whether it applies here? This is about Trial conversion.',
      label: 'Worth checking',
      targetId: 'f1',
      source: 'node-bias-mark',
    }])
  })

  it('NEGATIVE: no grounded bias finding (only an evidence gap) draws no bias mark', () => {
    const { container } = render(<NodeBiasMarks nodeId="f1" label="Trial conversion" reasons={[{ kind: 'evidence_gap', order: 3, label: 'Evidence here would narrow the comparison.' }]} />)
    expect(screen.queryByTestId('node-bias-f1')).toBeNull()
    expect(container.innerHTML).toBe('')
  })

  it('NEGATIVE: a code the registry does not know draws no glyph (the UI never guesses a bias)', () => {
    render(<NodeBiasMarks nodeId="f1" label="Trial conversion" reasons={[finding('opt_raise_price')]} />)
    expect(screen.queryByTestId('node-bias-f1')).toBeNull()
  })
})
