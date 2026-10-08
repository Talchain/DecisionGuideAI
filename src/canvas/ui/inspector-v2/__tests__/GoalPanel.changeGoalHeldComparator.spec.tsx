/**
 * ⛔ UI #2287 CHANGES_REQUIRED — A CHANGE-FRAMED GOAL'S SUCCESS BOUND COMES FROM ITS HELD COMPARATOR.
 *
 * Finding 1: the panel read `goal_threshold_strict` off the node. GraphV3 has no such node field (CEE #2260 sends
 * strict as a top-level analysis request key), so the words were always non-strict, and a change_rel +0.1 goal held
 * as `<=` read "up at least 10% from today" — the reverse of its bound ("up no more than 10%").
 * DL ruling: read the persisted held comparator `goal_direction` with `goal_threshold_frame` from the canonical goal
 * node (the authored inputs CEE uses); pair absent/unreadable → no numeric bound and no edit.
 *
 * Finding 2: the tech-mode disclosure (`GoalAdvancedEditor`) read `goal_threshold_raw` / `goal_threshold` with no
 * frame guard, so an unread frame (`CHANGE_REL`) still showed −0.15 as a "Raw threshold".
 *
 * Every row renders the REAL `GoalPanel` (part A directly — the arm that says the bound; part B through the real
 * `InspectorRouter`, the path a user opens, with technical detail toggled on).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Node } from '@xyflow/react'

vi.mock('@xyflow/react', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))
vi.mock('../../../conversation/ConversationContext', async importOriginal => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useOptionalConversationContext: () => ({ dispatchAction: vi.fn(), sendSystemEvent: vi.fn() }),
}))
vi.mock('../../../../contexts/AuthContext', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../contexts/AuthContext')>()
  return { ...actual, useAuth: vi.fn(() => ({ authenticated: true, user: { id: 'u-1', email: 'a@b.io' } })) }
})

import { GoalPanel } from '../panels/GoalPanel'
import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

const GOAL_ID = 'goal_cloud_bill'

function goalNode(extra: Record<string, unknown>): Node {
  return {
    id: GOAL_ID,
    type: 'goal',
    position: { x: 0, y: 0 },
    data: { kind: 'goal', label: 'Cloud bill', ...extra },
  } as unknown as Node
}

function seed(extra: Record<string, unknown>, goalThreshold: number | null) {
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    currentScenarioId: 'scenario-a',
    nodes: [goalNode(extra)] as never[],
    edges: [] as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold,
    goalThresholdRepresentation: goalThreshold === null ? null : 'normalised',
    goalConstraints: null,
    confirmedNodeIds: new Set(),
  } as never)
}

/** The ONE "Success …" sentence the panel's readout arm renders — bound by position in the readout, not by a value. */
function successSentence(container: HTMLElement): string {
  const lines = Array.from(container.querySelectorAll('[data-panel-group="input"] p'))
    .map(p => p.textContent ?? '')
    .filter(t => /^Success (means|is)\b/.test(t))
  expect(lines, 'PRECONDITION: exactly one success sentence is rendered').toHaveLength(1)
  return lines[0]
}

function mountPanel(extra: Record<string, unknown>) {
  // A store scalar beside a node-held target → the readout arm (`showsTargetReadout`), the arm that says the bound.
  seed(extra, typeof extra.goal_threshold_raw === 'number' ? extra.goal_threshold_raw : 1)
  return render(<GoalPanel nodeId={GOAL_ID} techMode={false} onClose={() => {}} onNavigate={() => {}} />)
}

const WITHHELD = 'Success is a change from today — its bound was not captured'

beforeEach(() => cleanup())
afterEach(() => cleanup())

describe('A · the mounted panel says the bound the HELD comparator states', () => {
  it('⭐ DL discriminating pair — the same +10% held `>` vs `>=` reads "more than" vs "at least"', () => {
    const strict = successSentence(mountPanel({ goal_threshold_frame: 'change_rel', goal_threshold_raw: 0.1, goal_direction: '>' }).container)
    cleanup()
    const nonStrict = successSentence(mountPanel({ goal_threshold_frame: 'change_rel', goal_threshold_raw: 0.1, goal_direction: '>=' }).container)
    expect(strict).toBe('Success means going up more than 10% from today')
    expect(nonStrict).toBe('Success means going up at least 10% from today')
  })

  it('⭐ reviewer\'s row — change_rel +0.1 held `<=` is a CEILING: "up no more than 10%", never "up at least"', () => {
    const said = successSentence(mountPanel({ goal_threshold_frame: 'change_rel', goal_threshold_raw: 0.1, goal_direction: '<=' }).container)
    expect(said).toBe('Success means going up no more than 10% from today')
    expect(said).not.toContain('at least')
  })

  it.each([
    ['>=', 0.1, 'up at least 10%'],
    ['>', 0.1, 'up more than 10%'],
    ['<=', -0.15, 'down at least 15%'],
    ['<', -0.15, 'down more than 15%'],
    ['<=', 0.1, 'up no more than 10%'],
    ['<', 0.1, 'up less than 10%'],
    ['>=', -0.15, 'down no more than 15%'],
    ['>', -0.15, 'down less than 15%'],
  ])('the wording table: held %s on change_rel %s → "%s from today"', (op, raw, words) => {
    const said = successSentence(mountPanel({ goal_threshold_frame: 'change_rel', goal_threshold_raw: raw, goal_direction: op }).container)
    expect(said).toBe(`Success means going ${words} from today`)
  })

  it('change_abs keeps the metric\'s unit — held `<=` −5000 GBP → "down at least £5,000 from today"', () => {
    const said = successSentence(mountPanel({
      goal_threshold_frame: 'change_abs', goal_threshold_raw: -5000, goal_threshold_unit: 'GBP', goal_direction: '<=',
    }).container)
    expect(said).toBe('Success means going down at least £5,000 from today')
  })

  it('⛔ a UI-only `goal_threshold_strict` is NOT read — held `<=` stays "at least" beside it', () => {
    const said = successSentence(mountPanel({
      goal_threshold_frame: 'change_rel', goal_threshold_raw: -0.15, goal_direction: '<=', goal_threshold_strict: true,
    }).container)
    expect(said).toBe('Success means going down at least 15% from today')
  })

  it.each([
    ['absent', undefined, -0.15],
    ['the objective sense, not a comparator', 'minimise', -0.15],
    ['a glyph CEE does not write', '≤', -0.15],
    ['a reversed spelling', '=<', -0.15],
    ['a held comparator on a zero change', '>=', 0],
  ])('⛔ pair unreadable (%s) → the numeric bound is withheld: no number in the sentence', (_why, op, raw) => {
    const said = successSentence(mountPanel({
      goal_threshold_frame: 'change_rel', goal_threshold_raw: raw, ...(op === undefined ? {} : { goal_direction: op }),
    }).container)
    expect(said).toBe(WITHHELD)
    expect(said).not.toMatch(/\d/)
  })

  it('CONTRAST — a LEVEL goal keeps its readout byte-for-byte ("reaching ≥ £250,000")', () => {
    const said = successSentence(mountPanel({
      goal_threshold_frame: 'level', goal_threshold_raw: 250000, goal_threshold_unit: '£', goal_direction: '>=',
    }).container)
    expect(said).toBe('Success means reaching ≥ £250,000')
  })
})

describe('B · the tech-mode disclosure, opened through the real Router', () => {
  async function openDisclosure(extra: Record<string, unknown>) {
    seed(extra, null)
    const utils = render(<InspectorRouter nodeId={GOAL_ID} edgeId={null} onClose={vi.fn()} />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'More' }))
    await user.click(screen.getByRole('button', { name: 'Show technical detail' }))
    await user.click(screen.getByRole('button', { name: /Show model detail/i }))
    const fence = utils.container.querySelector('fieldset[data-writer-fence="advanced-editor"]') as HTMLElement | null
    expect(fence, 'PRECONDITION: the advanced editor is mounted').not.toBeNull()
    const inputValues = Array.from(fence!.querySelectorAll('input')).map(i => i.value)
    return { ...utils, fence: fence!, inputValues }
  }

  const UNREAD = {
    goal_threshold_frame: 'CHANGE_REL', goal_threshold_raw: -0.15, goal_threshold: -0.15,
    goal_threshold_unit: 'GBP/month', goal_direction: '<=',
  }
  const NO_COMPARATOR = {
    goal_threshold_frame: 'change_rel', goal_threshold_raw: -0.15, goal_threshold: -0.15, goal_threshold_unit: 'GBP/month',
  }

  it('⭐ reviewer\'s negative contrast — an UNREAD frame shows no −0.15 and no "Raw threshold": "Target not captured"', async () => {
    const { fence, inputValues, container } = await openDisclosure(UNREAD)
    expect(fence.textContent).toContain('Target not captured')
    expect(within(fence).queryByLabelText('Raw threshold')).toBeNull()
    expect(fence.textContent).not.toContain('Normalised threshold')
    expect(fence.textContent).not.toMatch(/0\.15/)
    expect(inputValues.some(v => v.includes('0.15')), `inputs: ${JSON.stringify(inputValues)}`).toBe(false)
    // …and nowhere else on the opened pane either.
    expect(container.textContent).not.toMatch(/0\.15/)
  })

  it('⭐ a recognised change frame is said as its bound, not a level threshold', async () => {
    const { fence, inputValues } = await openDisclosure({ ...UNREAD, goal_threshold_frame: 'change_rel' })
    expect(fence.textContent).toContain('down at least 15% from today')
    expect(within(fence).queryByLabelText('Raw threshold')).toBeNull()
    expect(fence.textContent).not.toContain('Normalised threshold')
    expect(fence.textContent).not.toMatch(/0\.15/)
    expect(inputValues.some(v => v.includes('0.15'))).toBe(false)
  })

  it('⛔ a change frame with NO held comparator shows no number in the disclosure either', async () => {
    const { fence } = await openDisclosure(NO_COMPARATOR)
    expect(fence.textContent).toContain('Bound not captured')
    expect(fence.textContent).not.toMatch(/15|0\.15/)
    expect(within(fence).queryByLabelText('Raw threshold')).toBeNull()
  })

  it('⛔ edit stays refused for a change goal whose pair is unreadable — no target edit control', async () => {
    await openDisclosure(NO_COMPARATOR)
    expect(screen.queryByTestId('goal-panel-target-edit')).toBeNull()
  })

  it('CONTROL — a LEVEL goal still shows its Raw threshold row with the figure (the probe sees the rows)', async () => {
    const { fence } = await openDisclosure({
      goal_threshold_raw: 250000, goal_threshold: 0.8, goal_threshold_unit: '£', goal_threshold_cap: 312500,
    })
    expect((within(fence).getByLabelText('Raw threshold') as HTMLInputElement).value).toBe('250000')
    expect(fence.textContent).toContain('Normalised threshold')
  })
})
