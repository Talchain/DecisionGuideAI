/**
 * BOTH ASK ROUTES ON THIS SURFACE CARRY THE FINDING, NOT JUST THE FOCUS ONE.
 *
 * `StrengthenTheReasoning` sends one recommendation toward the canvas by three
 * doors: the FOCUS button (`:735`), the primary ACTION (`:333`) and the METHOD
 * chip (`:642`). The focus door already passed
 * `attentionNoteForRecommendation(rec)`, so the element arrives held under
 * attention with the producer's finding beside it. The other two opened the Ask
 * drawer with the why-line as prose, so pressing "Focus on canvas" THERE moved
 * the camera and left the finding behind.
 *
 * ⚠ THIS SPEC EXISTS BECAUSE THE FIRST VERSION OF THIS CHANGE CLOSED ONE
 * INSTANCE OF THE CLASS AND STOPPED. It fixed the sibling container's ask route
 * and shipped, leaving the same asymmetry live on this surface — the exact
 * failure ("close against the enumeration, not the instances found") that a
 * reviewer had blocked a different PR for hours earlier the same night. The
 * enumeration is: every `openAskOlumi` call that HOLDS a recommendation.
 * `:502` is deliberately NOT in it — the completed-limit ask carries no rec, so
 * there is no producer finding to send, and manufacturing one would be the UI
 * inventing a claim.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import type React from 'react'

import type { Recommendation } from '../../strengthen/strengthenTypes'

const records: Record<string, unknown> = {}
vi.mock('../../../../canvas/stores/strengthenStore', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useStrengthenStore: Object.assign(
      (sel: (s: unknown) => unknown) => sel({ records, seedIfAbsent: vi.fn() }),
      { getState: () => ({ records, seedIfAbsent: vi.fn(), dismiss: vi.fn(), restoreDismissed: vi.fn(), dispute: vi.fn() }) },
    ),
  }
})
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))

import { openAskOlumi } from '../../coaching/askOlumiStore'
import { attentionNoteForRecommendation } from '../../strengthen/recommendationAttention'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'

const REC = {
  id: 'strengthen:robustness',
  helpType: 'challenge',
  title: 'Pressure-test the leading option',
  signal: 'The ranking was fragile under perturbation.',
  whyNow: 'Small changes flip which option leads.',
  tryThis: 'Imagine it failed. Write down why.',
  sourceLine: 'From the robustness check.',
  targetId: 'opt_a',
  action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'Pressure-test it' },
  priority: 1,
} as unknown as Recommendation

const renderOpen = (ui: React.ReactElement) => {
  const r = render(ui)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return r
}

beforeEach(() => {
  ;(openAskOlumi as unknown as ReturnType<typeof vi.fn>).mockClear()
  for (const k of Object.keys(records)) delete records[k]
  records['strengthen:robustness'] = { status: 'recommended', history: [] }
})

describe('StrengthenTheReasoning — every rec-bearing ask route carries the note', () => {
  it('the PRIMARY ACTION route sends the producer\'s finding', () => {
    renderOpen(<StrengthenTheReasoning interventions={[REC]} />)

    // The precondition, pinned in-test: if the helper cannot build a note for
    // this fixture then `undefined === undefined` would satisfy the assertion
    // while the wiring was absent (CLAUDE.md trap 13b).
    const expected = attentionNoteForRecommendation(REC)
    expect(expected, 'the fixture produces no note — this test cannot discriminate').not.toBeNull()

    fireEvent.click(screen.getByTestId('analysis-new-strengthen-action'))
    expect(openAskOlumi).toHaveBeenCalledWith(
      expect.objectContaining({ attentionNote: expected }),
    )
  })

  it('the METHOD CHIP route sends it too', () => {
    renderOpen(<StrengthenTheReasoning interventions={[REC]} />)
    const expected = attentionNoteForRecommendation(REC)
    expect(expected, 'the fixture produces no note — this test cannot discriminate').not.toBeNull()

    fireEvent.click(screen.getByTestId('analysis-new-strengthen-method'))
    expect(openAskOlumi).toHaveBeenCalledWith(
      expect.objectContaining({ attentionNote: expected }),
    )
  })
})
