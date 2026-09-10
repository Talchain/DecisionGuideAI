/**
 * THE GOAL-EXTRACT NOTICE MUST NAME AN ACT THE SURFACE SHOWING IT CAN HONOUR.
 *
 * One member (`GOAL_LABEL_FROM_BRIEF_COPY.notice`) served three surfaces and
 * ended `"Edit it to say what you want to achieve."` The canvas goal node could
 * honour it but showed it only as a pointer-only `title`; the hero rendered it
 * as VISIBLE PROSE above a read-only `<span>`, and its authority note then sent
 * the user to the Model tab, which holds no goal-LABEL writer either. Both
 * surfaces that talked about editing the goal pointed at each other.
 *
 * ⭐ THE HERO'S HALF WAS THEN FIXED BY GIVING IT A WRITER, not by re-addressing
 * its copy: its Goal field had been gated on `goalSuccessTarget` (the SUCCESS
 * THRESHOLD's key, still `'disabled'`, still correct about its own subject)
 * rather than on the keys for the rename and named-add it actually performs.
 * So TWO surfaces host writers now and they are DIFFERENT ACTS — the hero edits
 * in place, the canvas double-clicks a node — which is why one sentence still
 * cannot serve them, and why the split stands.
 *
 * ⚠⚠ WHAT THIS FILE DELIBERATELY DOES NOT DO: pin two surfaces to AGREEMENT.
 * Such a test REDs on whichever surface is corrected first, which is exactly
 * backwards. The property is that the members are DISTINCT and each is bound by
 * the surface that answers for its own writer.
 *
 * Scope limit (trap 3): jsdom pins presence, binding and text. Nothing here
 * claims anything about layout or visibility.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import {
  GOAL_LABEL_FROM_BRIEF_COPY,
  GOAL_LABEL_FROM_BRIEF_TESTID,
} from '../goalLabelProvenance'
import {
  CANONICAL_EDIT_AUTHORITY,
  hasServerGraphAuthority,
} from '../../mutations/mutationAuthority'
import { HERO_COPY } from '../../components/pre-analysis-v3/constants'
import { GOAL_INPUT_ID } from '../../components/pre-analysis-v3/hero/HeroSection'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const GOAL_ID = 'goal_board_direction'

let storeState: Record<string, unknown>
vi.mock('../../store', () => {
  const useCanvasStore = vi.fn((selector: (s: unknown) => unknown) => selector(storeState))
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => storeState
  return { useCanvasStore }
})

const { GoalNode } = await import('../../nodes/GoalNode')
const { HeroSection } = await import('../../components/pre-analysis-v3/hero/HeroSection')

/** The label is a live capture's, so the fixture is not the author's invention. */
const CAPTURED_FRAGMENT = 'We need a direction before the January board meeting'

const makeStoreState = () => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  lens: { _dimmedNodeIds: new Set() },
  goalThreshold: null,
  goalConstraints: [],
  nodes: [],
  edges: [],
  ceeAnalysisReady: null,
  viewMode: 'expert',
  setShowInspectorPanel: vi.fn(),
})

const heroWith = (provenance: string) => ({
  decisionTitle: 'Pick a direction',
  hasDecision: true,
  goal: {
    nodeId: GOAL_ID,
    label: CAPTURED_FRAGMENT,
    fromBrief: provenance === 'from_brief',
  },
  success: { displayText: null, attribution: null, isSet: false },
  goalNodeId: GOAL_ID,
  coaching: null,
})

function renderHero(provenance: string) {
  storeState = makeStoreState()
  return render(
    <HeroSection
      hero={heroWith(provenance) as never}
      ladder={'draft' as never}
      onSendPrompt={() => {}}
      onLadderAct={() => {}}
    />,
  )
}

function renderGoalNode(provenance: string) {
  storeState = makeStoreState()
  return render(
    <ReactFlowProvider>
      <GoalNode
        {...{
          id: GOAL_ID,
          type: 'goal',
          position: { x: 0, y: 0 },
          selected: false,
          isConnectable: true,
          positionAbsoluteX: 0,
          positionAbsoluteY: 0,
          dragging: false,
          zIndex: 0,
          deletable: true,
          selectable: true,
          draggable: true,
        }}
        data={{ label: CAPTURED_FRAGMENT, type: 'goal', kind: 'goal', provenance }}
      />
    </ReactFlowProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

/**
 * ⭐ POSITIVE CONTROLS, AND THEY RUN FIRST. Every absence assertion below is
 * over rendered text; an absence over an element that never mounted, or over an
 * empty string, passes by testing nothing (trap 13). These prove the probes can
 * see a PRESENCE before anything asserts one is missing.
 */
describe('positive controls — the probes can see a presence', () => {
  it('the hero mounts the notice, and it is not empty', () => {
    renderHero('from_brief')
    const notice = screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)
    expect(notice).toBeInTheDocument()
    expect((notice.textContent ?? '').trim().length).toBeGreaterThan(20)
  })

  it('the canvas goal node mounts the marker with a non-empty title', () => {
    renderGoalNode('from_brief')
    const marker = screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)
    expect((marker.getAttribute('title') ?? '').trim().length).toBeGreaterThan(20)
  })

  it('the hero mounts its success-authority note, and it is not empty', () => {
    renderHero('from_brief')
    const note = screen.getByTestId('pre-analysis-v3-authority-note')
    expect((note.textContent ?? '').trim().length).toBeGreaterThan(20)
  })
})

describe('the members are DISTINCT, one per surface', () => {
  it('no surface shares a sentence with another', () => {
    const { canvasNodeNotice, heroNotice, modelRowNotice } = GOAL_LABEL_FROM_BRIEF_COPY
    const all = [canvasNodeNotice, heroNotice, modelRowNotice]
    expect(new Set(all).size).toBe(3)
    for (const s of all) expect(s.trim().length).toBeGreaterThan(20)
  })

  it('there is no single `notice` member left for a surface to bind by accident', () => {
    expect(
      (GOAL_LABEL_FROM_BRIEF_COPY as Record<string, unknown>).notice,
    ).toBeUndefined()
  })
})

describe('each surface renders the member NAMED for it', () => {
  it('the hero renders `heroNotice`, exactly', () => {
    renderHero('from_brief')
    // Identity binding: exact equality against the named member, never a
    // substring another member could satisfy (trap 19).
    expect(screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID).textContent).toBe(
      GOAL_LABEL_FROM_BRIEF_COPY.heroNotice,
    )
  })

  it('the canvas goal node renders `canvasNodeNotice`, exactly', () => {
    renderGoalNode('from_brief')
    expect(screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID).getAttribute('title')).toBe(
      GOAL_LABEL_FROM_BRIEF_COPY.canvasNodeNotice,
    )
  })

  it('the hero renders its OWN authority note, not the canvas mutation toast copy', () => {
    renderHero('from_brief')
    expect(screen.getByTestId('pre-analysis-v3-authority-note').textContent).toBe(
      HERO_COPY.successAuthorityNote,
    )
  })
})

/**
 * ⭐⭐ DERIVED FROM THE KEY THAT ACTUALLY DECIDES — AND THE KEY MOVED UNDER THIS
 * SPEC, WHICH IS THE WHOLE REASON THIS BLOCK IS WORTH HAVING.
 *
 * It used to read `CANONICAL_EDIT_AUTHORITY.goalSuccessTarget`. That was the
 * key the hero's Goal field was gated on when this spec was drafted, and it is
 * not any more: the field now reads the keys naming the operations it actually
 * performs (a rename and a named add). `goalSuccessTarget` still reads
 * `'disabled'` and still governs the success THRESHOLD, correctly — so a guard
 * pointed at it evaluates false forever and cheerfully asserts a READ-ONLY
 * shape against an EDITABLE field, passing its prose while describing a
 * posture that no longer exists.
 *
 * ⚠⚠ A DERIVED GUARD READING A KEY ITS SUBJECT MOVED AWAY FROM IS WORSE THAN A
 * HARDCODED ONE, BECAUSE IT LOOKS LIVE. The conjunction below is byte-for-byte
 * the one `HeroSection`'s `GOAL_LABEL_EDIT_CONNECTED` evaluates, so this block
 * follows the field rather than a memory of it. Flip either key away from
 * `'server_graph'` and these assertions invert to the read-only shape and RED
 * against the copy, instead of rotting into agreement.
 */
describe('each surface issues only an imperative it can honour', () => {
  const heroGoalIsWritable =
    hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.canvasNodeRenameWithServerHash) &&
    hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.preAnalysisV3StructuralAdd)

  it('the hero goal field has the SHAPE its gating authority implies', () => {
    renderHero('from_brief')
    const field = document.getElementById(GOAL_INPUT_ID)
    expect(field).not.toBeNull()
    if (heroGoalIsWritable) {
      expect(field?.tagName).toBe('INPUT')
      expect(field).not.toHaveAttribute('aria-readonly', 'true')
    } else {
      expect(field?.tagName).toBe('SPAN')
      expect(field).toHaveAttribute('aria-readonly', 'true')
    }
  })

  it('the hero notice names the act THIS surface can perform, not another one', () => {
    renderHero('from_brief')
    // ⚠ LOWERCASED. A copy assertion over prose is case-sensitive, and
    // `not.toContain('edit it')` passes against "Edit it to say…".
    const rendered = (
      screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID).textContent ?? ''
    ).toLowerCase()
    // Positive control: an absence assertion over an empty read passes by
    // testing nothing, so prove the probe can see a presence first.
    expect(rendered).toContain('taken from your brief')
    if (heroGoalIsWritable) {
      // The writer is the field directly above this sentence. Sending the user
      // to the canvas to do what they can do here is the defect inverted.
      expect(rendered).toContain('edit the goal field above')
      expect(rendered).not.toContain('canvas')
    } else {
      // Read-only again: it may not tell the user to edit what they cannot.
      expect(rendered).not.toContain('edit the goal field above')
      expect(rendered).toContain('canvas')
    }
  })

  it('the success authority note makes no claim about the GOAL', () => {
    renderHero('from_brief')
    const note = (
      screen.getByTestId('pre-analysis-v3-authority-note').textContent ?? ''
    ).toLowerCase()
    // Positive control, then the absence it is there to prove.
    expect(note).toContain('success')
    // The Model tab genuinely writes the success TARGET, so naming it is
    // honest. It hosts no goal-LABEL writer, so this note may not reach for
    // the goal at all — that was the original two-questions-under-one-sentence
    // defect, and it is the one that must not come back.
    expect(note).not.toContain('goal')
  })
})

/**
 * ⛔ NO EM DASHES IN PRODUCT CONTENT (standing ruling). This asserts over the
 * copy members themselves, not over a comment — a guard whose evidence is the
 * lane's own prose is a guard agreeing with itself.
 */
describe('the copy honours the standing content rulings', () => {
  it('carries no em dash on any surface', () => {
    for (const value of Object.values(GOAL_LABEL_FROM_BRIEF_COPY)) {
      expect(value).not.toContain('—')
    }
    expect(HERO_COPY.successAuthorityNote).not.toContain('—')
  })
})

/**
 * ⭐ THE DISCRIMINATING TWIN, kept from the surfaces spec because splitting the
 * member must not quietly widen WHEN the notice fires.
 */
describe('the predicate is unchanged by the split', () => {
  it('an Olumi-authored objective still gets no notice on either surface', () => {
    renderHero('ai_inferred')
    expect(screen.queryByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).not.toBeInTheDocument()
    renderGoalNode('ai_inferred')
    expect(screen.queryByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).not.toBeInTheDocument()
  })
})
