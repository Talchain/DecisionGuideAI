/**
 * ONE money rule for compound money units (R3 #72 5888087172, measured on UI staging 3f1872e).
 *
 * `formatMoneyFigure` already read "GBP per subscriber per month" right, but the two `formatValueWithUnit`s (canvas
 * utils; the Model tab's local copy) printed compound money raw — "49 GBP/month" on staging today, and the drafter's new
 * per-subscriber unit (CEE #2291) the same way. Their callers: the Model tab value, Add option's "now …", the option
 * target entry, the Model-tab goal edit. And `formatMoneyFigure` returned null for a multi-word item
 * ("£/Pro subscriber/month"). A probe table over the served shapes, never one example.
 */
import { describe, it, expect } from 'vitest'
import { formatMoneyFigure } from '../unitClassifier'
import { formatValueWithUnit as canvasFormat } from '../../canvas/utils/formatValueWithUnit'
import { formatValueWithUnit as modelTabFormat } from '../../canvas/components/model-tab/utils'
import { toModelRows } from '../../canvas/model-tab-v2/adapters'

const MONEY: Array<[string, string]> = [
  ['GBP per subscriber per month', '£49 per subscriber / month'],
  ['GBP/subscriber/month', '£49 per subscriber / month'],
  ['£/Pro subscriber/month', '£49 per Pro subscriber / month'],
  ['GBP/month', '£49 / month'],
  ['GBP per month', '£49 / month'],
]

describe('compound money reads through the one rule, on every formatter', () => {
  it.each(MONEY)('formatMoneyFigure(49, "%s") → "%s"', (unit, expected) => {
    expect(formatMoneyFigure(49, unit)).toBe(expected)
  })
  it.each(MONEY)('canvas formatValueWithUnit(49, "%s") → "%s" (never raw GBP)', (unit, expected) => {
    expect(canvasFormat(49, unit)).toBe(expected)
  })
  it.each(MONEY)('Model-tab formatValueWithUnit(49, "%s") → "%s" (never raw GBP)', (unit, expected) => {
    expect(modelTabFormat(49, unit)).toBe(expected)
  })
})

describe('CONTROLS — what is not compound money prints exactly as before', () => {
  it.each([
    ['months', '49 months'],
    ['subscribers per month', '49 subscribers per month'],
  ])('canvas: "%s" → "%s"', (unit, expected) => {
    expect(canvasFormat(49, unit)).toBe(expected)
  })
  it('plain currency keeps its existing reading on both formatters', () => {
    expect(canvasFormat(49, '£')).toBe('£49')
    expect(modelTabFormat(49, '£')).toBe('£49')
    expect(modelTabFormat(49, 'GBP')).toBe('GBP 49')
  })
  it('the item stays words only: a number in it is NOT read as money per a thing', () => {
    expect(formatMoneyFigure(49, 'GBP per 1000 users per month')).toBeNull()
  })
  it('a caller that asks for a numeric resolution keeps the numeric path', () => {
    expect(canvasFormat(49, 'GBP/month', 4)).not.toMatch(/^£/)
  })
})

describe('the Model tab goal target (model-tab-v2 adapters) reaches the money rule too', () => {
  const goalRow = (raw: number, unit: string) => {
    const nodes = [{ id: 'g', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'MRR', goal_threshold_raw: raw, goal_threshold_unit: unit } }]
    return toModelRows({ nodes, edges: [], goalThreshold: raw } as never).find((r) => r.id === 'g')?.primaryValue
  }
  it.each(MONEY)('goal target 49 "%s" → "%s"', (unit, expected) => {
    expect(goalRow(49, unit)).toBe(expected)
  })
  it('CONTROLS: plain "£" keeps its reading; a non-money unit keeps the number + unit', () => {
    expect(goalRow(100000, '£')).toBe('£100,000')
    expect(goalRow(800000, 'count')).toBe('800,000')
  })
})
