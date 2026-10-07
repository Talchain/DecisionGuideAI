import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readPremortemWorksheet } from '../readPremortemWorksheet'
import { worksheetFixture } from './premortemFixture'

describe('pre-mortem v1 reader', () => {
  it('reads the validated carrier verbatim', () => {
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: worksheetFixture() }), { status: 'available', worksheet: worksheetFixture() })
  })
  for (const name of ['version', 'stamp', 'malformed', 'binding', 'copy']) it(`refuses ${name} without throwing`, () => {
    const raw = worksheetFixture()
    if (name === 'version') raw.version = 2
    if (name === 'stamp') Reflect.deleteProperty(raw.run, 'computed_at')
    if (name === 'malformed') Reflect.deleteProperty(raw.rows[0], 'early_warning')
    if (name === 'binding') raw.binding.graph_revision = 'fedcba9876543210'
    if (name === 'copy') raw.rows[0].failure_way = 'This is the most likely failure.'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'unavailable' })
  })
  it('missing carrier is unavailable', () => assert.deepEqual(readPremortemWorksheet({}), { status: 'unavailable' }))
})
