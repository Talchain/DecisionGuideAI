/**
 * ⭐ CEE's typed provisional marker survives the UI's OWN turn parser at the
 * pinned `@talchain/schemas` — RC 5821538156 §3: "confirm whether the UI's
 * turn parser strips unknown keys".
 *
 * `parseV5Response` returns Zod's `parsed.data`, which drops keys a
 * `z.object` does not declare. The marker rides
 * `analysis_result.enrichment.run_provenance`, and the block's `enrichment` is
 * `z.record(z.string(), z.unknown())` (`boundary/blocks.js`), so a key the pin
 * has never heard of is carried. This pins that by execution, on a real
 * captured analysis turn, through the same chain the conversation uses
 * (parser → block → `mapV5AnalysisToReport`), not by reading the schema.
 */
import { describe, it, expect } from 'vitest'
import { parseV5Response } from '../responseParser'
import { mapV5AnalysisToReport } from '../mapV5AnalysisToReport'
import liveTurnBody from './fixtures/live-analysis-turn-T3-20260808T155759Z.json'

type Json = Record<string, unknown>

const RUN_PROVENANCE = { initiated_by: 'system', provisional: true, construction_turn_id: 'turn_construct_1' }

const withMarker = (): Json => {
  const body = JSON.parse(JSON.stringify(liveTurnBody)) as Json
  const block = (body.blocks as Json[]).find((b) => b.type === 'analysis_result') as Json
  block.enrichment = { ...(block.enrichment as Json), run_provenance: RUN_PROVENANCE }
  return body
}

const parse = async (body: Json) => {
  const parsed = await parseV5Response(
    new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
  if (parsed.kind !== 'response') throw new Error(`capture failed to parse: ${parsed.kind}`)
  const block = (parsed.response.blocks as unknown as Json[]).find((b) => b.type === 'analysis_result')
  if (!block) throw new Error('no analysis_result block after parsing')
  return block
}

describe('run_provenance survives the UI turn parser at the pinned schemas', () => {
  it('PRESENT CONTROL: a key the pin DOES declare on the enrichment survives the parse', async () => {
    const raw = (liveTurnBody.blocks as Json[]).find((b) => b.type === 'analysis_result') as Json
    const known = Object.keys(raw.enrichment as Json)
    expect(known.length, 'the capture carries enrichment').toBeGreaterThan(0)
    const block = await parse(withMarker())
    for (const k of known) expect(block.enrichment as Json).toHaveProperty(k)
  })

  it('⭐ the marker, unknown to the pin, is carried verbatim on the parsed block', async () => {
    const block = await parse(withMarker())
    expect((block.enrichment as Json).run_provenance).toEqual(RUN_PROVENANCE)
  })

  it('and reaches the report the Reasoning tab reads', async () => {
    const block = await parse(withMarker())
    const report = mapV5AnalysisToReport(block as never) as unknown as { run_provenance?: Json }
    expect(report.run_provenance?.provisional).toBe(true)
  })

  it('CONTRAST: without the marker, the report carries none (the probe is not vacuous)', async () => {
    const block = await parse(JSON.parse(JSON.stringify(liveTurnBody)) as Json)
    const report = mapV5AnalysisToReport(block as never) as unknown as { run_provenance?: Json }
    expect(report.run_provenance).toBeUndefined()
  })
})
