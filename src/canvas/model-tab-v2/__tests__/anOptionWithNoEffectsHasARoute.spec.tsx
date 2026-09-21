/**
 * An option that changes nothing must have somewhere to say what it changes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT — measured on the founder's board, and it is a SYSTEM defect
 * ─────────────────────────────────────────────────────────────────────────────
 * 3 of 5 options carried ZERO interventions, so the analysis could not tell
 * them apart. Eleven user-facing strings reported that gap. **One** offered a
 * route, and it pointed at chat.
 *
 * The one connected editor in the product is this surface —
 * `modelOptionIntervention: 'server_graph'` — and `ModelDetailRegion` rendered
 * its intervention section only when `interventions.length > 0`. So the editor
 * was invisible on exactly the options that needed it: the product could change
 * a number it already had and could never acquire one.
 *
 * ⚠⚠ THE OLD GATE'S REASONING WAS SOUND AND ITS PREMISE HAD GONE STALE. It
 * deferred to *"the repair queue that collects it"* — `set-option-values`.
 * That queue is **never mounted**: `MountedQueueId` is
 * `Extract<RepairQueue['id'], 'confirm-estimates'>`, and a sweep with a
 * contrast control finds `'set-option-values'` in five definitional places with
 * zero call sites, against `'confirm-estimates'`'s twelve including the mount.
 * A gate that defers to a surface which does not render is not a gate.
 *
 * ⛔ THE PICKER OFFERS WIRED FACTORS ONLY, AND THAT IS THE AUTHORITY'S RULE.
 * `proposeOptionIntervention`: *"The SERVER additionally requires the option to
 * be WIRED to it and refuses otherwise."* Offering an unwired factor would be
 * an enabled control the server declines — preamble P8, the defect class this
 * increment closes, rebuilt by its own fix.
 *
 * ⛔ AND IT SEEDS AN EMPTY EDITOR, NEVER THE FACTOR'S BASELINE. An option that
 * changes a factor TO its current value is not an effect; it is a claim that
 * there is none. The same reasoning keeps `OptionPanel.handleAddFactor` local.
 *
 * CLAIM SCOPE (trap 3): jsdom proves PRESENCE, DISPATCH ARGUMENTS and TEXT —
 * never layout.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Edge, Node } from '@xyflow/react'
import { toRowDetail, type ModelProjectionInput } from '../adapters'
import { ModelDetailRegion } from '../ModelDetailRegion'
import type { ModelRow } from '../types'

// ── Fixtures, shaped like the producer ──────────────────────────────────────

const option = (id: string, label: string, interventions?: Record<string, number>): Node => ({
  id,
  type: 'option',
  position: { x: 0, y: 0 },
  data: { label, type: 'option', ...(interventions ? { interventions } : {}) },
})

const factor = (id: string, label: string): Node => ({
  id,
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label, type: 'factor', category: 'controllable' },
})

const goal = (id = 'g1'): Node => ({
  id,
  type: 'goal',
  position: { x: 0, y: 0 },
  data: { label: 'Reach £2m ARR', type: 'goal' },
})

const edge = (id: string, source: string, target: string): Edge => ({ id, source, target, data: {} })

const input = (over: Partial<ModelProjectionInput> = {}): ModelProjectionInput =>
  ({ nodes: [], edges: [], goalThreshold: null, ...over }) as ModelProjectionInput

const OPT = 'opt_hire'
const F_A = 'fac_capacity'
const F_B = 'fac_spend'

/** The founder's case: an option wired to two factors, changing neither. */
const boardWithNoEffects = () =>
  input({
    nodes: [option(OPT, 'Hire a marketing manager'), factor(F_A, 'Team capacity'), factor(F_B, 'Monthly spend')],
    edges: [edge('e1', OPT, F_A), edge('e2', OPT, F_B)],
  })

describe('the projection offers the factors the server will accept', () => {
  it('⭐ names both wired factors on an option that changes nothing — RED at pristine, where the list was empty', () => {
    const detail = toRowDetail(boardWithNoEffects(), OPT)!
    expect(detail.interventionCandidates.map(c => c.factorId).sort()).toEqual([F_A, F_B].sort())
    expect(detail.interventionCandidates.find(c => c.factorId === F_A)!.factorLabel).toBe('Team capacity')
  })

  it('⛔ withholds a factor the option is NOT wired to — the server would refuse it', () => {
    /*
     * ⚠⚠ THE FIRST VERSION OF THIS FIXTURE COULD NOT FAIL, AND A MUTANT PROVED
     * IT. It gave F_B no edge at all, so dropping the `e.source === option`
     * test changed nothing: there was no edge for the loosened predicate to
     * let through. The corpus shared the code's blind spot and therefore
     * certified it (trap 13d).
     *
     * F_B now has a REAL edge from ANOTHER option. With the wired test
     * removed, that edge leaks it into this option's picker — which is the
     * whole failure mode, and it is now reachable.
     */
    const board = input({
      nodes: [
        option(OPT, 'Hire'),
        option('opt_other', 'Do nothing'),
        factor(F_A, 'Team capacity'),
        factor(F_B, 'Monthly spend'),
      ],
      edges: [edge('e1', OPT, F_A), edge('e2', 'opt_other', F_B)],
    })
    const detail = toRowDetail(board, OPT)!
    expect(detail.interventionCandidates.map(c => c.factorId)).toEqual([F_A])
  })

  it('drops a factor the option ALREADY changes, so the picker never offers a duplicate', () => {
    const board = input({
      nodes: [option(OPT, 'Hire', { [F_A]: 0.6 }), factor(F_A, 'Team capacity'), factor(F_B, 'Monthly spend')],
      edges: [edge('e1', OPT, F_A), edge('e2', OPT, F_B)],
    })
    const detail = toRowDetail(board, OPT)!
    expect(detail.interventionCandidates.map(c => c.factorId)).toEqual([F_B])
  })

  it('offers a factor ONCE when two edges reach it — a well-formed graph, a defective picker', () => {
    const board = input({
      nodes: [option(OPT, 'Hire'), factor(F_A, 'Team capacity')],
      edges: [edge('e1', OPT, F_A), edge('e2', OPT, F_A)],
    })
    expect(toRowDetail(board, OPT)!.interventionCandidates).toHaveLength(1)
  })

  it('⛔ offers only FACTORS — an option wired to the goal cannot be given a target on it', () => {
    const board = input({
      nodes: [option(OPT, 'Hire'), goal()],
      edges: [edge('e1', OPT, 'g1')],
    })
    expect(toRowDetail(board, OPT)!.interventionCandidates).toEqual([])
  })

  it('CONTRAST — a factor row offers nothing, because an intervention belongs to an option', () => {
    const detail = toRowDetail(boardWithNoEffects(), F_A)!
    expect(detail.interventionCandidates).toEqual([])
  })
})

// ── The surface ─────────────────────────────────────────────────────────────

const row = (id: string, label: string): ModelRow =>
  ({
    id,
    kind: 'option',
    label,
    primaryValue: null,
    provenanceSource: undefined,
    attention: [],
    editable: true,
  }) as unknown as ModelRow

const renderRegion = (
  detailInput: ModelProjectionInput,
  rowId: string,
  onBeginInterventionEdit?: (factorId: string, seed: string) => void,
  interventionEdit?: { factorId: string; draft: string; phase?: 'editing' },
) =>
  render(
    <ModelDetailRegion
      row={row(rowId, 'Hire a marketing manager')}
      detail={toRowDetail(detailInput, rowId)!}
      tier="full"
      onBeginInterventionEdit={onBeginInterventionEdit}
      onInterventionDraftChange={vi.fn()}
      onCommitIntervention={vi.fn()}
      onDiscardInterventionEdit={vi.fn()}
      interventionEdit={interventionEdit ?? null}
    />,
  )

describe('the section appears on the options that need it', () => {
  it('⭐ renders on an option with ZERO interventions — the case the old gate hid', () => {
    renderRegion(boardWithNoEffects(), OPT, vi.fn())
    expect(screen.getByTestId('model-detail-v2-interventions')).toBeTruthy()
    expect(screen.getByTestId('model-detail-v2-intervention-candidates')).toBeTruthy()
  })

  it('⛔ SEEDS AN EMPTY EDITOR — opening at the factor’s baseline would assert an effect nobody chose', () => {
    const begin = vi.fn()
    renderRegion(boardWithNoEffects(), OPT, begin)
    fireEvent.click(screen.getByTestId(`model-detail-v2-intervention-add-${F_B}`))
    // Bound by IDENTITY: the fixture carries two candidates, so a handler that
    // fired for "some factor" would not satisfy this (trap 19).
    expect(begin).toHaveBeenCalledWith(F_B, '')
  })

  it('CONTRAST — stays silent for an option wired to nothing, where the answer really is elsewhere', () => {
    const board = input({ nodes: [option(OPT, 'Hire')], edges: [] })
    renderRegion(board, OPT, vi.fn())
    expect(screen.queryByTestId('model-detail-v2-interventions')).toBeNull()
  })

  it('⛔ disables the picker when the host passed NO handler, rather than offering a dead button', () => {
    renderRegion(boardWithNoEffects(), OPT, undefined)
    const button = screen.getByTestId(`model-detail-v2-intervention-add-${F_A}`) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('title') ?? '').toMatch(/reading only/i)
  })

  it('names the factor on the button, never its id', () => {
    renderRegion(boardWithNoEffects(), OPT, vi.fn())
    const button = screen.getByTestId(`model-detail-v2-intervention-add-${F_A}`)
    expect(button.textContent).toBe('Team capacity')
    expect(button.textContent).not.toContain(F_A)
  })
})

/**
 * ⚠⚠ THE HALF THE FIRST CUT MISSED, AND IT WOULD HAVE SHIPPED THE DEFECT
 * INSIDE ITS OWN FIX. The editor renders inside `interventions.map`, so an
 * edit begun on a factor the option does not YET change had nowhere to appear:
 * the reader presses a live button and the surface does not move. Found by
 * asking what the click RENDERS rather than trusting that the state was set.
 */
describe('the row the picker opens actually appears', () => {
  it('⭐ shows an editable row for a factor the option does not yet change', () => {
    renderRegion(boardWithNoEffects(), OPT, vi.fn(), { factorId: F_B, draft: '', phase: 'editing' })
    const input_ = screen.getByTestId(`model-detail-v2-intervention-${F_B}-input`) as HTMLInputElement
    expect(input_.value).toBe('')
    expect(screen.getByTestId(`model-detail-v2-intervention-${F_B}-save`)).toBeTruthy()
  })

  it('names the factor on that row, so the reader knows what they are setting', () => {
    renderRegion(boardWithNoEffects(), OPT, vi.fn(), { factorId: F_B, draft: '', phase: 'editing' })
    const row_ = screen.getByTestId(`model-detail-v2-intervention-${F_B}`)
    expect(row_.textContent).toContain('Monthly spend')
  })

  it('⛔ takes that factor OUT of the picker while its row is open — never both at once', () => {
    renderRegion(boardWithNoEffects(), OPT, vi.fn(), { factorId: F_B, draft: '', phase: 'editing' })
    expect(screen.queryByTestId(`model-detail-v2-intervention-add-${F_B}`)).toBeNull()
    // CONTRAST: the other candidate is untouched, so this is a removal of ONE
    // row and not a collapse of the picker.
    expect(screen.getByTestId(`model-detail-v2-intervention-add-${F_A}`)).toBeTruthy()
  })

  it('⛔ DEMONSTRATES THE EQUIVALENT MUTANT rather than asserting it', () => {
    /*
     * Seeding the composed row with `'0'` / `0` instead of absence leaves this
     * file green, and an unexplained survivor is a claim either way (trap 13c).
     * The reason is structural: the composed row EXISTS only while
     * `interventionEdit` names its factor, and in that state the row renders
     * the input from `draft` — the value cell and the seed-from-`numericValue`
     * button are both on the NOT-editing branch and are unreachable for it.
     *
     * That reachability is what this test pins. If a later change renders the
     * composed row outside the editing state, this REDs — and the survivor
     * stops being equivalent, which is exactly when someone needs to know.
     */
    renderRegion(boardWithNoEffects(), OPT, vi.fn(), { factorId: F_B, draft: '', phase: 'editing' })
    expect(screen.queryByTestId(`model-detail-v2-intervention-${F_B}-value`)).toBeNull()
    expect(screen.getByTestId(`model-detail-v2-intervention-${F_B}-input`)).toBeTruthy()
  })

  it('CONTRAST — an edit on a factor the option ALREADY changes still renders from the projection', () => {
    const board = input({
      nodes: [option(OPT, 'Hire', { [F_A]: 0.6 }), factor(F_A, 'Team capacity'), factor(F_B, 'Monthly spend')],
      edges: [edge('e1', OPT, F_A), edge('e2', OPT, F_B)],
    })
    renderRegion(board, OPT, vi.fn(), { factorId: F_A, draft: '0.6', phase: 'editing' })
    const input_ = screen.getByTestId(`model-detail-v2-intervention-${F_A}-input`) as HTMLInputElement
    expect(input_.value).toBe('0.6')
  })
})
