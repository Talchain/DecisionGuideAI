/**
 * ⭐ CEE STAMPS A GOAL TARGET THE BRIEF WRITES — AND THE UI SAYS SO (served `823bc028`, 29 Sep: the MRR goal holds
 * `threshold_source: 'brief_extraction'`, yet the card said "no source" and the Success row said "Olumi's estimate").
 *
 * CEE writes the stamp ONLY when the brief writes that figure in the goal's unit (`holdStatedGoalAttributes`,
 * `figureTheUserWrote`), so it is the carried field `resolveGoalTarget` waited for. Without it: unchanged.
 */
import { describe, it, expect } from 'vitest'
import { resolveGoalTarget } from '../goalTarget'
import { goalTargetSourceMark } from '../../nodes/shared/valueSourceMark'
import { computeSuccessState } from '../../components/pre-analysis-v3/selectors/computeSuccessState'

const SERVED = { label: 'MRR', goal_threshold_raw: 85000, goal_threshold_unit: '£/month', goal_threshold_frame: 'change_abs', goal_direction: '>=', threshold_source: 'brief_extraction' }
const UNSTAMPED = { ...SERVED, threshold_source: undefined }
const goalNode = (data: Record<string, unknown>) => ({ id: 'mrr', type: 'goal', position: { x: 0, y: 0 }, data }) as never

describe('the brief stamp on a goal target', () => {
  it('resolveGoalTarget: brief_extraction → `brief`; no stamp → `unrecorded` (unchanged)', () => {
    expect(resolveGoalTarget(SERVED)?.source).toBe('brief')
    expect(resolveGoalTarget(UNSTAMPED)?.source).toBe('unrecorded')
  })

  it("the user's own typed target still wins over the brief stamp", () => {
    expect(resolveGoalTarget({ ...SERVED, threshold_source: 'user', success_threshold: 90000 })?.source).toBe('user')
  })

  it('the card mark: "From your brief" on the stamp; CONTRAST "Source not recorded" without it', () => {
    expect(goalTargetSourceMark(SERVED)).toMatchObject({ kind: 'brief', label: 'From your brief' })
    expect(goalTargetSourceMark(UNSTAMPED)).toMatchObject({ kind: 'unknown' })
  })

  it("the Success row credits the user (not 'Olumi's estimate') for the node's own stamped figure", () => {
    expect(computeSuccessState(goalNode(SERVED), null, null, null).attribution?.kind).toBe('person')
    // AIQ 5904308095: "Olumi's estimate" needs a typed Olumi source (an inferred/proxy constraint); with none, no attribution.
    expect(computeSuccessState(goalNode(UNSTAMPED), null, null, null).attribution).toBeNull()
  })

  // Recovery Batch C, SYS3 L5 (#94 6115410093): served hiring (CEE 50530b5f, scenario 68759863) stored Paul's "increase
  // productivity by at least 10%" as this node, and the reopened card said "Source not recorded · Target: up 10% from today".
  const HIRING = { label: 'productivity', goal_direction: '>=', threshold_source: 'brief_extraction', goal_threshold_raw: 0.1, goal_threshold_frame: 'change_rel', goal_deadline_as_stated: 'three months' }

  it('L5 (served hiring): Paul\'s own "up 10% from today" wears "From your brief", and the Success row credits him', () => {
    expect(resolveGoalTarget(HIRING)).toMatchObject({ raw: 0.1, source: 'brief', frame: 'change_rel' })
    expect(goalTargetSourceMark(HIRING)).toMatchObject({ kind: 'brief', label: 'From your brief' })
    expect(computeSuccessState(goalNode(HIRING), null, null, null)).toMatchObject({ displayText: 'up 10% from today', attribution: { kind: 'person' } })
  })

  it('a RELATIVE-change target is printed as the change itself, so the brief stamp holds (supersedes AIQ 5900578934 for the relative print)', () => {
    const CUT = { label: 'Monthly cloud bill', goal_threshold_raw: -0.2, goal_threshold_unit: '£/month', goal_threshold_frame: 'change_rel', goal_direction: '<=', threshold_source: 'brief_extraction', goal_baseline_raw: 45000 }
    // What the brief wrote is "20%": every surface says "down 20% from today", never a £ figure read off today's level.
    expect(computeSuccessState(goalNode(CUT), null, null, null).displayText).toBe('down 20% from today')
    expect(resolveGoalTarget(CUT)?.source).toBe('brief')
    expect(goalTargetSourceMark(CUT)).toMatchObject({ kind: 'brief' })
    // NEGATIVES kept: with no stamp it is nobody's (AIQ 5904308095: never "Olumi's estimate" either), and a frame this UI
    // cannot read credits nothing.
    expect(resolveGoalTarget({ ...CUT, threshold_source: undefined })?.source).toBe('unrecorded')
    expect(goalTargetSourceMark({ ...CUT, threshold_source: undefined })).toMatchObject({ kind: 'unknown' })
    expect(computeSuccessState(goalNode({ ...CUT, threshold_source: undefined }), null, null, null).attribution).toBeNull()
    expect(goalTargetSourceMark({ ...CUT, goal_threshold_frame: 'share_of_runs' })).toMatchObject({ kind: 'unknown' })
    // CONTROL (same file, same stamp): the MRR absolute change keeps it.
    expect(goalTargetSourceMark(SERVED)).toMatchObject({ kind: 'brief' })
  })

  it("CONTRAST — the stamp is on the NODE's figure: an analysis-ready fallback figure is never credited by it", () => {
    const noRaw = { ...SERVED, goal_threshold_raw: undefined }
    expect(computeSuccessState(goalNode(noRaw), { goal_threshold_raw: 85000 }, null, null).attribution?.kind).not.toBe('person')
  })
})
