/**
 * S-B, P19 item 2: the LIVE turn path. A turn body carrying CEE's `action_bar` goes through the REAL strict parser and
 * router (as `useConversation` receives it) and the bar comes out whole, ready for `setBar`. `OlumiResponseSchema` is
 * `.strict()`: an undeclared root key must ride the additive sidecar, never fail the turn or vanish.
 * The bar is one CEE captured from its routes (`fixtures/`). The `setBar` call itself is covered by the served
 * two-surface witness (bar under the last reply after a live turn: CHAT-STABLE, 87d58524, B1/B2 PASS).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { parseV5Response } from '../../../../v5/responseParser'
import { routeV5Response } from '../../../../v5/responseRouter'
import { parseActionBar, readActionBar, type ActionBarIssue } from '../actionBarContract'

const CAPTURED = JSON.parse(readFileSync(join(__dirname, 'fixtures/action-bar-v1-withheld-run.json'), 'utf8')) as Record<string, unknown>
const turn = (extra: Record<string, unknown>) => ({
  response_version: 2, assistant_text: 'Here is where the comparison stands.', blocks: [], suggested_actions: [], insights: [],
  stage_indicator: 'analyse', ...extra,
})
const throughTheParser = async (body: unknown) =>
  routeV5Response(await parseV5Response(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })))

describe('the live turn: the bar survives the strict parser', () => {
  it('a turn carrying `action_bar` is a normal reply, and the bar read from it equals the bar CEE sent', async () => {
    const target = await throughTheParser(turn({ action_bar: CAPTURED }))
    expect(target.kind).toBe('text_only')
    const issues: ActionBarIssue[] = []
    const bar = readActionBar((target as { response: unknown }).response, (i) => issues.push(i))
    expect(issues).toEqual([])
    expect(bar).toEqual(parseActionBar(CAPTURED))
    expect(bar!.standard.length + bar!.more.length, 'POSITIVE CONTROL: the bar holds offers').toBeGreaterThanOrEqual(4)
  })

  it('⛔ CONTRAST: the same turn without `action_bar` reads no bar (the surfaces keep their own controls)', async () => {
    const target = await throughTheParser(turn({}))
    expect(target.kind).toBe('text_only')
    expect(readActionBar((target as { response: unknown }).response)).toBeNull()
  })

  it('a bar this build cannot read does not fail the turn: the reply still arrives, with no bar', async () => {
    const target = await throughTheParser(turn({ action_bar: { ...CAPTURED, v: 2 } }))
    expect(target.kind).toBe('text_only')
    const issues: ActionBarIssue[] = []
    expect(readActionBar((target as { response: unknown }).response, (i) => issues.push(i))).toBeNull()
    expect(issues).toEqual([{ kind: 'unknown_version', v: 2 }])
  })
})
