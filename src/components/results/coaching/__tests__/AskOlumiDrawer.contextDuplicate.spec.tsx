/**
 * AskOlumiDrawer — the seeded question must appear ONCE.
 *
 * Manual test, 2026-08-16: "Work through it with Olumi" showed the framing
 * question twice — as the read-only context line (AskOlumiDrawer.tsx:140-147)
 * and again inside the editable textarea (:156-163).
 *
 * PROVEN PRODUCER of the duplicate, DecisionOverviewCard.tsx:582-591:
 *   context: framingQuestion
 *   draft:   `Help me work through: ${framingQuestion}`   (non-discuss branch)
 * so the drawer renders the same sentence twice by construction.
 *
 * WHY THE FIX SITS IN THE DRAWER AND NOT AT THAT CALL SITE. Seventeen call
 * sites feed this one drawer, and on most of them `context` is NOT a duplicate
 * — it is a heading or a finding the draft does not restate (StressTestSection
 * :173, FragileEdgeGroupCard:162, OptionCards, ActionsMenu, …). Deleting the
 * context line wholesale would strip real information from sixteen surfaces to
 * fix one. Equally, patching only the one branch would miss the sibling
 * 'discuss' branch whenever CEE's `primary_action.prompt` happens to echo the
 * framing question — which this lane has no capture either way about.
 *
 * THE RULE, and why it is safe: suppress the read-only line only when the
 * draft ENDS WITH the context verbatim (equality included). That is a
 * structural string relation, not a judgement about meaning — there is no
 * ambiguity to oscillate on. And it is correct by construction: the
 * suppressed sentence is provably still on screen, in full, in the textarea
 * directly beneath. Nothing is lost; a duplicate is.
 *
 * Deliberately NOT `draft.includes(context)`: a short heading like "Fragile
 * relationships" can appear mid-sentence in a draft while still doing real
 * work as a label. The suffix relation is the one that identifies the
 * "<preamble>: <the very same sentence>" shape actually observed.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { AskOlumiDrawer } from '../AskOlumiDrawer'
import { openAskOlumi, useAskOlumiStore } from '../askOlumiStore'

const QUESTION = 'What would make option B clearly better?'

function open(overrides: { context: string; draft: string }) {
  act(() =>
    openAskOlumi({
      label: 'Work through the framing question',
      ...overrides,
    }),
  )
}

describe('AskOlumiDrawer — the seeded question is not rendered twice', () => {
  beforeEach(() => {
    useAskOlumiStore.setState({ isOpen: false, context: '', draft: '' })
  })

  describe('the reported defect', () => {
    it('drops the read-only line when the draft ends with the same sentence', () => {
      render(<AskOlumiDrawer />)
      open({ context: QUESTION, draft: `Help me work through: ${QUESTION}` })

      expect(screen.queryByTestId('ask-olumi-context')).not.toBeInTheDocument()
      // The question survives exactly once, in the editable field.
      expect(screen.getByTestId('ask-olumi-draft')).toHaveValue(
        `Help me work through: ${QUESTION}`,
      )
    })

    it('drops the read-only line when context and draft are identical', () => {
      render(<AskOlumiDrawer />)
      open({ context: QUESTION, draft: QUESTION })

      expect(screen.queryByTestId('ask-olumi-context')).not.toBeInTheDocument()
      expect(screen.getByTestId('ask-olumi-draft')).toHaveValue(QUESTION)
    })

    it('ignores incidental whitespace around either string', () => {
      render(<AskOlumiDrawer />)
      open({ context: `  ${QUESTION}  `, draft: `Help me work through: ${QUESTION}\n` })

      expect(screen.queryByTestId('ask-olumi-context')).not.toBeInTheDocument()
    })

    it('keeps the honest model-limit caveat when the duplicate is removed', () => {
      render(<AskOlumiDrawer />)
      open({ context: QUESTION, draft: `Help me work through: ${QUESTION}` })

      const caveat = screen.getByTestId('ask-olumi-model-limit')
      expect(caveat).toHaveTextContent(
        'Olumi can point to what the model implies, but not guarantee the real world behaves the same.',
      )
    })
  })

  describe('over-suppression controls — these MUST stay green', () => {
    it('KEEPS the context line when the draft does not restate it', () => {
      // "Answer directly" (DecisionOverviewCard.tsx:566-573): the drawer's only
      // rendering of the question is this line. Removing it would lose it.
      render(<AskOlumiDrawer />)
      open({ context: QUESTION, draft: 'My answer: ' })

      expect(screen.getByTestId('ask-olumi-context')).toHaveTextContent(QUESTION)
    })

    it('KEEPS a short heading that merely appears MID-draft', () => {
      // FragileEdgeGroupCard.tsx:162 passes 'Fragile relationships' as a
      // label. A containment rule would have deleted it; the suffix rule does
      // not.
      render(<AskOlumiDrawer />)
      open({
        context: 'Fragile relationships',
        draft: 'Two Fragile relationships could flip the lead — talk me through them.',
      })

      expect(screen.getByTestId('ask-olumi-context')).toHaveTextContent('Fragile relationships')
    })

    it('KEEPS a finding the draft paraphrases but does not repeat', () => {
      // StressTestSection.tsx:173-177 — context is the finding, draft is the
      // question about it. Different sentences; both earn their place.
      render(<AskOlumiDrawer />)
      open({
        context: 'Leadership capacity — a shift could change the result.',
        draft: 'What if Leadership capacity changes? Walk me through the impact.',
      })

      expect(screen.getByTestId('ask-olumi-context')).toBeInTheDocument()
    })

    it('renders no context line when the caller sent none (unchanged behaviour)', () => {
      render(<AskOlumiDrawer />)
      open({ context: '', draft: 'Anything at all' })

      expect(screen.queryByTestId('ask-olumi-context')).not.toBeInTheDocument()
      expect(screen.getByTestId('ask-olumi-model-limit')).toBeInTheDocument()
    })
  })
})
