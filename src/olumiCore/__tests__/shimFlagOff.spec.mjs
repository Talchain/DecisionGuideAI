import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PIN_FIXTURES, runShimBattery } from './shimPinHarness.mjs'

/**
 * With every core flag off, the shim's whole response is what tier-c 6fc742e88 gave: the saved-model read and the turns (the Run view, the thread,
 * the cards and the approve/decline writes) for every captured scenario view, compared as exact JSON text (key order included). The pinned file was made by
 * running shimPinHarness.mjs against 6fc742e88's own `scripts/olumi-core/lib` (extracted with `git archive`), never against this tree.
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const pin = JSON.parse(fs.readFileSync(path.join(here, 'fixtures', 'pin-shim-flag-off.json'), 'utf8'))
const lib = path.resolve(here, '../../../scripts/olumi-core/lib')

describe('flag-off invariance: the shim\'s full responses equal 6fc742e88\'s, byte for byte', () => {
  it('pins every response of the battery (16: a read and a Run turn for each of 7 captured views, an approval and a decline)', async () => {
    const now = await runShimBattery(lib)
    expect(Object.keys(pin.responses)).toHaveLength(PIN_FIXTURES.length * 2 + 2)
    expect(Object.keys(now)).toEqual(Object.keys(pin.responses))
    for (const name of Object.keys(pin.responses)) expect(JSON.stringify(now[name]), name).toBe(JSON.stringify(pin.responses[name]))
  })
  it('the pinned responses carry the Run, the thread and the cards (a pin of errors or empty bodies would prove nothing)', () => {
    const r = pin.responses
    expect(r['graphRead view-rich-approved'].status).toBe(200)
    expect(r['graphRead view-rich-approved'].body.canonical_analysis_view.options.length).toBeGreaterThan(1)
    expect(r['graphRead view-markers-v2'].body.conversation_turns.length).toBeGreaterThan(1)
    expect(r['graphRead view-markers-v2'].body.olumi_note).toBeDefined()
    expect(r['graphRead view-first-pending'].body.proposal_fields.proposals).toHaveLength(1)
    expect(r['approve first model'].model.canonical_analysis_view).toBeTruthy()
    expect(r['approve first model'].error).toBeNull()
    for (const v of Object.values(r)) expect(JSON.stringify(v)).not.toMatch(/"about":\{[^}]*"form":"labels"/)
  })
})
