import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { graphOf } from '../../../scripts/olumi-core/lib/model.mjs'
import { changeRows, num, percent } from '../../../scripts/olumi-core/lib/words.mjs'
import { factorDisplayText } from '../../utils/formatFactorDisplayValue'

const here = path.dirname(fileURLToPath(import.meta.url))
const fx = (n) => JSON.parse(fs.readFileSync(path.join(here, 'fixtures', n), 'utf8'))
const formOf = () => JSON.parse(JSON.stringify(fx('view-approved.json').version.form))
const quantity = (id, label, value, by, extra = {}) => ({
  family: 'quantity', id, label, unit: null, role: 'fact', assertion: { kind: 'point', value, approximate: false }, domain: null, stated_time: null, direction: null,
  origin: by === 'person' ? { by, quote: `I said ${value}`, party: null } : { by, basis: 'because' }, ...extra,
})
const cardText = (n) => factorDisplayText({ ...n, observedState: n.observed_state })

describe('a figure Olumi or the model supplies shows at most 3 significant figures (Paul, 1 Nov 23:45Z: "4.33333333333333")', () => {
  it('a non-integer is tidied to 3 significant figures; a whole number, and the size of a large one, are untouched', () => {
    expect(num(13 / 3)).toBe('4.33')
    expect(num(0.123456)).toBe('0.123')
    expect(num(-13 / 3)).toBe('-4.33')
    expect(num(1234567.5)).toBe('1,234,568')
    expect(num(1234567)).toBe('1,234,567')
    expect(num(80)).toBe('80')
  })
  it('never rounds a small figure to 0: 0.0000001 stays', () => {
    expect(num(0.0000001)).toBe('0.0000001')
    expect(num(-0.00000042123)).toBe('-0.000000421')
  })
  it('a chance keeps 3 significant figures, 12.5% and 0.4% stay, and a chance just under certain is never "100%"', () => {
    expect(percent(1 / 3)).toBe('33.3%')
    expect(percent(0.125)).toBe('12.5%')
    expect(percent(0.004)).toBe('0.4%')
    expect(percent(0.9997)).not.toBe('100%')
    expect(percent(0.99996)).toBe('over 99.99%')
    expect(percent(0.000001)).toBe('under 0.01%')
  })
  it('a figure the person typed is exactly as they gave it', () => {
    expect(num(2.71828, true)).toBe('2.71828')
    expect(num(3.14159265, true)).toBe('3.14159265')
    expect(percent(0.1234, true)).toBe('12.34%')
  })
  it('on the canvas: Olumi\'s 4.333… shows as 4.33 on the card, in the value the card reads and in the reading card', () => {
    const form = formOf()
    form.records.push(quantity('weeks', 'Weeks per month for the funding window', 13 / 3, 'olumi'))
    const n = graphOf(form).nodes.find((x) => x.id === 'weeks')
    expect(n.display_value).toBe('4.33')
    expect(n.observed_state.value).toBe(4.33)
    expect(n.observed_state.raw_value).toBe(4.33)
    expect(cardText(n)).not.toMatch(/4\.3\d\d/)
    expect(cardText(n)).toMatch(/4\.33/)
  })
  it('a range Olumi gave is tidied at both ends and at the likeliest value', () => {
    const form = formOf()
    form.records.push(quantity('span', 'Span', 0, 'olumi', { assertion: { kind: 'interval', low: 1 / 3, high: 10 / 3, range_kind: 'plausible', likely: 13 / 3 } }))
    const n = graphOf(form).nodes.find((x) => x.id === 'span')
    expect(n.display_value).toBe('between 0.333 and 3.33, most likely 4.33')
    expect(n.observed_state.range).toMatchObject({ low: 0.333, high: 3.33 })
  })
  it('the person\'s own figure is exactly as they typed it, on the card and in the value', () => {
    const form = formOf()
    form.records.push(quantity('mine', 'My figure', 4.33333333, 'person'))
    const n = graphOf(form).nodes.find((x) => x.id === 'mine')
    expect(n.display_value).toBe('4.33333333')
    expect(n.observed_state.value).toBe(4.33333333)
  })
  it('an aim\'s target that Olumi proposed reads to 3 significant figures', () => {
    const form = formOf()
    form.records.find((r) => r.id === 'capacity_target').origin = { by: 'olumi', basis: 'a round-ish aim' }
    form.records.find((r) => r.id === 'capacity_target').assertion = { kind: 'point', value: 13 / 3, approximate: false }
    const goal = graphOf(form).nodes.find((x) => x.kind === 'goal')
    expect(goal.display_value).toMatch(/4\.33( |$)/)
    expect(goal.display_value).not.toMatch(/4\.333/)
  })
})
