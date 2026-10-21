/**
 * Core's option switch is the engine's working, not the model (Paul, 21 Oct 2026). The ids and labels are the served courier
 * board's (scenario fb768105, core mapper.ts:263–267: `<option>__on`, "<option> in place", value 0).
 */
import { describe, expect, it } from 'vitest'
import { coreSwitchOptionOf, withoutCoreSwitches } from '../coreSwitch'
import { excludeNonModelNodes } from '../../utils/fitTargets'
import { allUnlockedNodesMeasured } from '../../utils/measureLayoutGate'

const n = (id: string, type: string, label: string) => ({ id, type, data: { label } })
const NODES = [
  n('decision_on_time_goal', 'decision', 'Decision'),
  n('on_time_goal', 'goal', 'On time'),
  n('new_courier_partner', 'option', 'Switching to a new courier partner'),
  n('new_courier_partner__on', 'factor', 'Switching to a new courier partner in place'),
  n('live_parcel_tracking', 'option', 'Adding live parcel tracking'),
  n('live_parcel_tracking__on', 'factor', 'Adding live parcel tracking in place'),
  n('delivery_speed', 'factor', 'Delivery speed'),
]
const EDGES = [
  { id: 'e1', source: 'decision_on_time_goal', target: 'new_courier_partner' },
  { id: 'e2', source: 'new_courier_partner', target: 'new_courier_partner__on' },
  { id: 'e3', source: 'new_courier_partner__on', target: 'delivery_speed' },
  { id: 'e4', source: 'live_parcel_tracking', target: 'live_parcel_tracking__on' },
  { id: 'e5', source: 'delivery_speed', target: 'on_time_goal' },
]

describe('core option switches: never drawn, never laid out, never framed; their links start at the option', () => {
  it('⭐ each option\'s `__on` factor is its switch, by identity', () => {
    expect([...coreSwitchOptionOf(NODES)]).toEqual([['new_courier_partner__on', 'new_courier_partner'], ['live_parcel_tracking__on', 'live_parcel_tracking']])
  })

  it('⭐ drawn without them: the switch\'s link runs from the option; the option→switch edge is gone; the rest is untouched', () => {
    const drawn = withoutCoreSwitches(NODES, EDGES)
    expect(drawn.nodes.map((n) => n.id)).toEqual(['decision_on_time_goal', 'on_time_goal', 'new_courier_partner', 'live_parcel_tracking', 'delivery_speed'])
    expect(drawn.edges).toEqual([EDGES[0], { ...EDGES[2], source: 'new_courier_partner' }, EDGES[4]])
    expect(drawn.hidden.map((n) => n.id)).toEqual(['new_courier_partner__on', 'live_parcel_tracking__on'])
  })

  it('⛔ a factor that only looks like one is the person\'s model: no option of that id, or not an option, or no `__on` suffix', () => {
    const nodes = [
      n('pricing__on', 'factor', 'Pricing in place'),
      n('goal_x', 'goal', 'Goal'), n('goal_x__on', 'factor', 'Goal in place'),
      n('opt', 'option', 'Opt'), n('opt_on', 'factor', 'Opt in place'),
      // Codex R1: the right id, but not the mapper's switch: the person's own factor, or not a factor at all.
      n('b', 'option', 'Bonus'), n('b__on', 'factor', 'Bonus uptake'),
      n('c', 'option', 'Cut'), n('c__on', 'risk', 'Cut in place'),
    ]
    expect(coreSwitchOptionOf(nodes).size).toBe(0)
    expect(withoutCoreSwitches(nodes, [])).toEqual({ nodes, edges: [], hidden: [] })
  })

  it('⛔ Codex R1: a link the option already has and the switch\'s own link are BOTH kept, each with its own id', () => {
    const edges = [{ id: 'own', source: 'new_courier_partner', target: 'delivery_speed' }, ...EDGES]
    const drawn = withoutCoreSwitches(NODES, edges).edges
    expect(drawn.filter((e) => e.target === 'delivery_speed').map((e) => e.id)).toEqual(['own', 'e3'])
  })

  it('⛔ Codex R1: a switch is never waited on for measurement (it is never rendered)', () => {
    const measured = new Map(NODES.filter((x) => !x.id.endsWith('__on')).map((x) => [x.id, { measured: { width: 100, height: 50 } }]))
    expect(allUnlockedNodesMeasured(NODES as never, measured as never)).toBe(true)
    measured.delete('delivery_speed')
    expect(allUnlockedNodesMeasured(NODES as never, measured as never)).toBe(false)
  })

  it('a switch is not framed or counted as part of the model', () => {
    expect(excludeNonModelNodes(NODES).map((n) => n.id)).not.toContain('new_courier_partner__on')
    expect(excludeNonModelNodes(NODES)).toHaveLength(5)
  })
})
