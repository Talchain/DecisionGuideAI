/**
 * ⭐ CEE STAMPS A GOAL TARGET THE BRIEF WRITES — AND THE UI SAYS SO (served `823bc028`, 29 Sep: the MRR goal holds
 * `threshold_source: 'brief_extraction'`, yet the card said "no source" and the Success row said "Olumi estimate").
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

  it("the Success row credits the user (not 'Olumi estimate') for the node's own stamped figure", () => {
    expect(computeSuccessState(goalNode(SERVED), null, null, null).attribution?.kind).toBe('person')
    // AIQ 5904308095: "Olumi estimate" needs a typed Olumi source (an inferred/proxy constraint); with none, no attribution.
    expect(computeSuccessState(goalNode(UNSTAMPED), null, null, null).attribution).toBeNull()
  })

  it('AIQ 5900578934 — a RELATIVE-change target ("cut by 20%" → "£36,000 / month or less") never wears "From your brief"', () => {
    const CUT = { label: 'Monthly cloud bill', goal_threshold_raw: -0.2, goal_threshold_unit: '£/month', goal_threshold_frame: 'change_rel', goal_direction: '<=', threshold_source: 'brief_extraction', goal_baseline_raw: 45000 }
    expect(resolveGoalTarget(CUT)?.source).toBe('unrecorded')
    expect(goalTargetSourceMark(CUT)).toMatchObject({ kind: 'unknown' })
    expect(computeSuccessState(goalNode(CUT), null, null, null).attribution?.kind).not.toBe('person')
    // ⛔ AIQ 5904308095 (R3 served cut-costs `5ae7b582`: "down 20% from today · Olumi estimate"): nor Olumi's.
    expect(computeSuccessState(goalNode(CUT), null, null, null).attribution).toBeNull()
    expect(computeSuccessState(goalNode({ ...CUT, threshold_source: undefined }), null, null, null).attribution).toBeNull()
    // CONTROL (same file, same stamp): the MRR absolute change keeps it.
    expect(goalTargetSourceMark(SERVED)).toMatchObject({ kind: 'brief' })
  })

  it("CONTRAST — the stamp is on the NODE's figure: an analysis-ready fallback figure is never credited by it", () => {
    const noRaw = { ...SERVED, goal_threshold_raw: undefined }
    expect(computeSuccessState(goalNode(noRaw), { goal_threshold_raw: 85000 }, null, null).attribution?.kind).not.toBe('person')
  })
})
