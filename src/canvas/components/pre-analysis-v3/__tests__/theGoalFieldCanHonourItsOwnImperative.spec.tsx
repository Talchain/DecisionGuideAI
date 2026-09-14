/**
 * The hero's goal notice tells the user to edit the goal. This pins that the
 * field it points at can actually be edited, and that the fix is bound to THAT
 * field rather than to "some hero field became writable".
 *
 * ─── THE DEFECT ─────────────────────────────────────────────────────────────
 * One constant gated both hero fields:
 *
 *   const GOAL_SUCCESS_EDIT_CONNECTED =
 *     hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.goalSuccessTarget)
 *
 * `goalSuccessTarget` is `'disabled'`, and it is a hard-coded constant rather
 * than a flag — `import.meta.env`, `isFeatureEnabled` and `flag` all return
 * zero in `mutations/mutationAuthority.ts`, so no deployed posture moved it.
 * The goal field therefore shipped as `<span role="textbox"
 * aria-readonly="true">` while `GOAL_LABEL_FROM_BRIEF_COPY.notice`, rendered
 * directly beneath it, said *"Edit it to say what you want to achieve."*
 *
 * ⚠ THE KEY WAS WRONG, NOT THE VALUE — which is why the repair is not a flip.
 * `goalSuccessTarget`'s frozen contract is *"no local threshold editor or local
 * Define-success modal action mounts"*: it governs the SUCCESS THRESHOLD, and
 * it is right about it. The goal field renames (`store.updateNodeLabel` →
 * `structural_rename`, key `canvasNodeRenameWithServerHash`) or adds a named
 * goal (`store.addNode` → `structural_add`, key `preAnalysisV3StructuralAdd`).
 * Both keys are `'server_graph'`, and `canvasNodeRenameWithServerHash`'s own
 * frozen contract already lists `'pre-analysis hero'` among its `entrySurfaces`.
 * Two questions under one constant — CLAUDE.md trap 21.
 *
 * ─── WHAT THESE TESTS DO AND DO NOT CLAIM ───────────────────────────────────
 * Every assertion binds by IDENTITY: the field by its accessible name, the
 * notice by `GOAL_LABEL_FROM_BRIEF_TESTID`, the written node by its id `g1`
 * against a decision node seeded with the SAME new label, so a value predicate
 * would land on the wrong object. Copy is asserted as LITERALS, never through
 * the constant it is testing, so a reworded sentence REDs instead of agreeing
 * with itself.
 *
 * ⚠ jsdom CANNOT PROVE VISIBILITY. The claim here is that the goal field is an
 * editable `<input>` in the rendered tree, that a commit reaches the canonical
 * store write, and that the write queues a durable rename intent. It is NOT a
 * claim that a user can see or reach it on a real screen.
 */

import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import type { Node } from '@xyflow/react'
import { PreAnalysisPanelV3 } from '../PreAnalysisPanelV3'
import { ToastProvider } from '../../../ToastContext'
import { useCanvasStore } from '../../../store'
import { useReadinessStore } from '../../../stores/readinessStore'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { useSignalSessionStore } from '../signals/signalSessionStore'
import { GOAL_LABEL_FROM_BRIEF_TESTID } from '../../../domain/goalLabelProvenance'

vi.mock('../../../../v5/v5Adapter', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  callV5Turn: vi.fn(() => new Promise(() => {})),
}))

/** The exact sentence the notice must render, as a literal. */
const NOTICE =
  'Taken from your brief — not yet confirmed as your goal. Edit it to say what you want to achieve.'

/** The exact sentence the success field's authority note must render. */
const SUCCESS_NOTE =
  'Set the success measure through the Model tab, or ask Olumi, so the shared model stays in sync.'

/**
 * ⚠ A CONFUSABLE SIBLING, DELIBERATELY. `d1` carries the label the test is
 * about to type into the goal field, so an assertion that searched for "a node
 * labelled X" would find the decision and pass while the goal was untouched
 * (CLAUDE.md trap 19). Every assertion below addresses `g1` by id.
 */
const NEW_GOAL_LABEL = 'Cut delivery lead time by a quarter'

function node(id: string, kind: string, label: string, data: Record<string, unknown> = {}): Node {
  return { id, type: kind, position: { x: 0, y: 0 }, data: { kind, label, ...data } } as Node
}

function seed() {
  useCanvasStore.setState({
    nodes: [
      node('d1', 'decision', NEW_GOAL_LABEL),
      // `provenance: 'from_brief'` is what makes the notice render at all —
      // `goalLabelIsUnconfirmedBriefExtract` classifies it `kind: 'brief'`.
      node('g1', 'goal', 'Increase delivery output', { provenance: 'from_brief' }),
      node('o1', 'option', 'Hire a tech lead'),
      node('o2', 'option', 'Hire two developers'),
    ],
    edges: [],
    preAnalysisSensitivity: null,
    ceeAnalysisReady: null,
    draftCoaching: null,
    currentBriefText: null,
    goalThreshold: null,
    goalConstraints: null,
    pendingStructuralRenames: [],
    currentScenarioId: 'scenario-a',
  })
}

function renderPanel() {
  return render(
    <ToastProvider>
      <PreAnalysisPanelV3 onAnalyse={vi.fn()} isAnalysing={false} canRun blockedReason={undefined} />
    </ToastProvider>,
  )
}

function goalNode() {
  return useCanvasStore.getState().nodes.find(n => n.id === 'g1')
}

function decisionNode() {
  return useCanvasStore.getState().nodes.find(n => n.id === 'd1')
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })))
})

beforeEach(() => {
  cleanup()
  useSignalSessionStore.getState().reset()
  useGuidanceStore.setState({ _sendChip: null, _prefillChat: null, _dispatchAction: null } as never)
  useReadinessStore.setState({
    readiness: {
      readiness_score: 72,
      readiness_level: 'ready',
      can_run_analysis: true,
      confidence_explanation: 'Looks consistent.',
      improvements: [],
    },
    loading: false,
    error: null,
  })
  seed()
})

describe('the goal field can honour the imperative printed under it', () => {
  it('renders the imperative AND an editable goal field on the same surface', () => {
    renderPanel()

    // The imperative, verbatim, on the surface OutputsDock mounts.
    expect(screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).toHaveTextContent(NOTICE)

    // The field it points at, addressed by its accessible name.
    const goal = screen.getByLabelText('Goal')
    expect(goal.tagName).toBe('INPUT')
    expect(goal).not.toHaveAttribute('aria-readonly')
  })

  it('a committed edit writes the label onto the GOAL node, not onto its namesake', () => {
    renderPanel()
    const before = decisionNode()?.data

    const goal = screen.getByLabelText('Goal')
    fireEvent.change(goal, { target: { value: NEW_GOAL_LABEL } })
    fireEvent.keyDown(goal, { key: 'Enter' })

    expect((goalNode()?.data as { label?: string })?.label).toBe(NEW_GOAL_LABEL)
    // The confusable sibling is untouched — proves the binding is by id.
    expect(decisionNode()?.data).toEqual(before)
  })

  it('the same commit stamps user_set, so the brief notice stops claiming the label is unconfirmed', () => {
    renderPanel()
    expect(screen.getByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).toBeInTheDocument()

    const goal = screen.getByLabelText('Goal')
    fireEvent.change(goal, { target: { value: NEW_GOAL_LABEL } })
    fireEvent.keyDown(goal, { key: 'Enter' })

    expect((goalNode()?.data as { provenance?: string })?.provenance).toBe('user_set')
    expect(screen.queryByTestId(GOAL_LABEL_FROM_BRIEF_TESTID)).not.toBeInTheDocument()
  })

  it('the commit queues a durable rename intent for g1, so the edit is not local-only', () => {
    renderPanel()
    expect(useCanvasStore.getState().pendingStructuralRenames).toHaveLength(0)

    const goal = screen.getByLabelText('Goal')
    fireEvent.change(goal, { target: { value: NEW_GOAL_LABEL } })
    fireEvent.keyDown(goal, { key: 'Enter' })

    const queued = useCanvasStore.getState().pendingStructuralRenames
    expect(queued).toHaveLength(1)
    // Addressed by node id, and carrying the label the user was LOOKING AT as
    // the concurrency assertion — never the one just written.
    expect(queued[0]).toMatchObject({ nodeId: 'g1', label: NEW_GOAL_LABEL })
    expect((queued[0] as { expectedLabel?: string }).expectedLabel).toBe('Increase delivery output')
  })
})

describe('the success field is a different question and keeps its own answer', () => {
  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN. Widening the goal field must not widen the
   * success field: `goalSuccessTarget` stays `'disabled'` because
   * `commitSuccess` is a local store write plus a FREE-TEXT `add_constraint`,
   * with none of the typed parameters or applied receipt
   * `modelGoalMinimumTarget` requires. A mutation that swaps BOTH gates REDs
   * here; one that swaps only the goal's does not.
   */
  it('stays read-only, offers no Save affordance and writes no threshold', () => {
    renderPanel()
    const success = screen.getByLabelText('Success measure')
    expect(success.tagName).toBe('SPAN')
    expect(success).toHaveAttribute('aria-readonly', 'true')
    expect(screen.queryByRole('button', { name: 'Save success' })).not.toBeInTheDocument()
    expect(useCanvasStore.getState().goalThreshold).toBeNull()
  })

  it('says where the success measure IS set, and names it rather than saying "this"', () => {
    renderPanel()
    const note = screen.getByTestId('pre-analysis-v3-authority-note')
    expect(note).toHaveTextContent(SUCCESS_NOTE)
    // The shared sentence's opener is unqualified. With the goal field now
    // writable, an unnamed "this" under two fields would newly claim the goal
    // is set elsewhere.
    expect(note.textContent).not.toContain('Change this through the Model tab')
    // One note, so it cannot be read as covering both fields.
    expect(screen.getAllByTestId('pre-analysis-v3-authority-note')).toHaveLength(1)
  })
})

describe('the deployed posture mounts the surface these tests drive', () => {
  /**
   * A green suite says nothing about a component the deployment does not
   * render. `OutputsDock.tsx:3174` chooses `PreAnalysisPanelV3` on
   * `isPreAnalysisV3Enabled()`, whose env key is `VITE_FEATURE_PRE_ANALYSIS_V3`.
   * Derived from `netlify.toml` rather than restated, so a posture change REDs
   * here instead of silently making these tests about a dark component.
   */
  it('netlify.toml switches the v3 pre-analysis panel on', () => {
    const toml = fs.readFileSync(path.resolve(__dirname, '../../../../../netlify.toml'), 'utf8')
    expect(toml).toContain('VITE_FEATURE_PRE_ANALYSIS_V3 = "1"')
  })

  it('OutputsDock reaches this panel through that flag', () => {
    const dock = fs.readFileSync(
      path.resolve(__dirname, '../../OutputsDock.tsx'),
      'utf8',
    )
    expect(dock).toContain('isPreAnalysisV3Enabled() ? (')
    expect(dock).toContain('<PreAnalysisPanelV3')
  })
})
