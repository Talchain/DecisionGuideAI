/// <reference types="vitest" />
import { expect, test } from 'vitest'
import { setGhost, ghost } from '../state'

test('setGhost stores drafts', () => {
  setGhost({
    drafts: [
      {
        id: 'd1',
        title: 't',
        why: 'w',
        suggestion_confidence: 0.5,
        parse_json: {},
        parse_json_hash: 'h',
        critique: [],
      },
    ],
  })
  expect(ghost.drafts[0].id).toBe('d1')
  // reset
  setGhost({ drafts: [] })
})
