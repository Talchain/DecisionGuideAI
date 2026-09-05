/**
 * THE ASK ROUTE MUST CARRY THE FINDING, LIKE THE FOCUS ROUTES ALREADY DO.
 *
 * `StrengthenContainer` sends one recommendation to the canvas by three doors.
 * Two of them (`canvas-focus`, `inline-edit`) already pass
 * `attentionNoteForRecommendation(rec)`, so the element is held under attention
 * with the producer's finding anchored beside it. The third — "Work through
 * this with Olumi", which opens the Ask drawer — passed the why-line as PROSE
 * only. If the user then pressed "Focus on canvas" in that drawer, the camera
 * moved and the finding stayed behind in the drawer they had just left.
 *
 * Same recommendation, same producer text, two outcomes decided by which door
 * the user happened to take.
 *
 * ⚠ THIS MOUNTS THE CONTAINER ON PURPOSE, AND AN EARLIER DRAFT DID NOT.
 * That draft asserted a payload builder written INSIDE the test file that
 * mirrored the container's call. It was green, and it would have stayed green
 * with the container's wiring deleted — a hand-maintained mirror of the code
 * under test, which is the defect class this estate pays for most often
 * (CLAUDE.md trap 12). The assertion now reads the store the real component
 * wrote, so removing the wiring REDs it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import { StrengthenContainer } from '../StrengthenContainer'
import { attentionNoteForRecommendation } from '../recommendationAttention'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useStrengthenStore, selectActive } from '../../../../canvas/stores/strengthenStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

const makeData = (): ResultsSectionDataReturn =>
  ({
    recommendation: { goalThreshold: null, analysisStatus: 'computed' },
    confidence: { challengeFragileEdges: [], robustnessStatus: null, robustnessLevel: null },
    drivers: { drivers: [] },
  }) as unknown as ResultsSectionDataReturn

beforeEach(() => {
  useStrengthenStore.getState()._reset()
  try { sessionStorage.clear() } catch { /* jsdom */ }
  useGuidanceStore.setState({ guidanceItems: [], _dispatchAction: null, _sendMessage: null } as never)
  useAskOlumiStore.setState({ isOpen: false, context: '', draft: '', label: '', targetId: null, attentionNote: null })
  useCanvasStore.setState({
    currentStage: null,
    draftCoaching: null,
    results: { ...useCanvasStore.getState().results, hash: 'h-test' },
  } as never)
})

describe('the Strengthen ask route carries the finding to the canvas', () => {
  it('puts the SAME note on the drawer that the focus routes pass to the canvas', () => {
    useGuidanceStore.setState({ _dispatchAction: vi.fn() } as never)
    render(<StrengthenContainer data={makeData()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Work through this with Olumi' }))

    const drawer = useAskOlumiStore.getState()
    expect(drawer.isOpen).toBe(true)

    // ⭐ THE PRECONDITION, PINNED IN-TEST. This assertion is only meaningful if
    // the rec that actually rendered can PRODUCE a note. If the helper refuses
    // it (an unmapped `helpType`, or no why-line) then `null === null` would
    // pass while the wiring was absent — a guard agreeing with itself
    // (CLAUDE.md trap 13b). Deriving the expectation from the rec the store
    // holds, rather than from a literal, keeps it bound to what rendered.
    const rendered = selectActive(useStrengthenStore.getState())[0]
    const expected = attentionNoteForRecommendation(rendered.snapshot)
    expect(expected, 'the rendered rec produces no note — this test cannot discriminate').not.toBeNull()

    expect(drawer.attentionNote).toEqual(expected)
  })

  it('CONTRAST — the note is the PRODUCER\'s, not copy this route composed', () => {
    useGuidanceStore.setState({ _dispatchAction: vi.fn() } as never)
    render(<StrengthenContainer data={makeData()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Work through this with Olumi' }))

    const rendered = selectActive(useStrengthenStore.getState())[0]
    const note = useAskOlumiStore.getState().attentionNote!
    expect(note).not.toBeNull()
    // Bound by IDENTITY to the rec's own fields. A note the UI wrote — however
    // plausible — fails this.
    expect(note.title).toBe(rendered.snapshot.title)
    expect(note.move).toBe(attentionNoteForRecommendation(rendered.snapshot)!.move)
  })
})
