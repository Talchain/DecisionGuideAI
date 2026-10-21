/**
 * Core's option switch is the engine's working, not the model (Paul, 21 Oct 2026). The ids and labels are the served courier
 * board's (scenario fb768105, core mapper.ts:263–267: `<option>__on`, "<option> in place", value 0).
 */
import { describe, expect, it } from 'vitest'
import { coreSwitchOptionOf, withoutCoreSwitches } from '../coreSwitch'
import { excludeNonModelNodes } from '../../utils/fitTargets'

const NODES = [
  { id: 'decision_on_time_goal', type: 'decision' },
  { id: 'on_time_goal', type: 'goal' },
  { id: 'new_courier_partner', type: 'option' },
  { id: 'new_courier_partner__on', type: 'factor' },
  { id: 'live_parcel_tracking', type: 'option' },
  { id: 'live_parcel_tracking__on', type: 'factor' },
  { id: 'delivery_speed', type: 'factor' },
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
      { id: 'pricing__on', type: 'factor' },
      { id: 'goal_x', type: 'goal' }, { id: 'goal_x__on', type: 'factor' },
      { id: 'opt', type: 'option' }, { id: 'opt_on', type: 'factor' },
    ]
    expect(coreSwitchOptionOf(nodes).size).toBe(0)
    expect(withoutCoreSwitches(nodes, [])).toEqual({ nodes, edges: [], hidden: [] })
  })

  it('a switch is not framed or counted as part of the model', () => {
    expect(excludeNonModelNodes(NODES).map((n) => n.id)).not.toContain('new_courier_partner__on')
    expect(excludeNonModelNodes(NODES)).toHaveLength(5)
  })
})
