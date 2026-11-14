/**
 * DL journey (6), 14 Nov (Codex 085d4c57e, ported): on the reveal dock, keeping a disagreement is core's own differences step, never a
 * pretend save. On core's served strategy reveal (fixtures/strategy growth-reveal-n1), opened from the disagreement chip, with core's
 * differences for that record: the dock offers core's "Keep this as a disagreement" (differences.headings.dissent); pressing it posts
 * `{ step: 'dissent' }` to that record's steps once, then draws core's receipt in the dock; the button is then pressed and disabled.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { revealOf, useReveal } from '../reveal'
import { RevealDock } from '../RevealDock'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetDifferences } from '../../olumiCore/team/differences'
import { resetWrites } from '../../olumiCore/team/writes'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal-n1.view3.json'), 'utf8')) as View
const CORE = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/debate/differences.core.json'), 'utf8'))
const chip = [...(revealOf(view)?.cardChips.values() ?? [])].flat().find((c) => c.kind === 'disagreement') ?? [...(revealOf(view)?.cardChips.values() ?? [])].flat().find((c) => c.kind !== 'evidence')!
const RECEIPT = `${view.you} kept this as a disagreement: both views stay as they are, and neither is taken as the model's.`
let posts: Array<{ path: string; body: unknown }> = []
let kept = false
const differences = () => ({ ...CORE, scenario: view.id, differences: [{ ...CORE.differences[0], record: chip.record, label: 'The disagreeing record', status: 'not_run',
  steps: kept ? [{ id: 1, at: '2026-11-14T04:00:00Z', by: view.you, by_id: view.you_id, step: 'dissent', version: 1, text: RECEIPT }] : [] }] })
beforeEach(() => {
  posts = []; kept = false; resetDifferences(); resetWrites()
  setTeamFetch((async (u: unknown, init?: RequestInit) => {
    if ((init?.method ?? 'GET') === 'POST') { posts.push({ path: String(u), body: JSON.parse(String(init!.body)) }); kept = true; return new Response('{"step":1}', { status: 201 }) }
    if (String(u).includes('/differences')) return new Response(JSON.stringify(differences()), { status: 200 })
    return new Response(JSON.stringify(view), { status: 200 })
  }) as unknown as typeof fetch)
})
afterEach(() => { cleanup(); setTeamFetch(null); useReveal.setState({ selected: null, evidence: null, card: null, chip: null }); useViewStore.setState(useViewStore.getInitialState(), true) })

describe('keeping a disagreement from the reveal dock (journey 6)', () => {
  it('K1 core\'s keep action posts the dissent step for that record once, then the dock draws core\'s receipt and the action reads pressed', async () => {
    useViewStore.setState({ view, sid: view.id, at: null })
    useReveal.setState({ selected: chip.views[0]!, evidence: null, card: chip.card, chip: chip.key })
    render(<RevealDock view={view} />)
    const keep = await screen.findByTestId('reveal-dock-keep-open')
    expect(keep.textContent).toBe(CORE.headings.dissent)
    expect(screen.getByTestId('reveal-dock-heading').textContent).toBe('The disagreeing record')
    fireEvent.click(keep)
    await waitFor(() => expect(screen.getByTestId('reveal-dock-kept')).toHaveTextContent(RECEIPT))
    expect(posts).toEqual([{ path: `/api/scenarios/${view.id}/differences/${chip.record}/steps`, body: { step: 'dissent', op: expect.any(String) } }].map((p) => expect.objectContaining({ path: p.path })))
    expect(posts[0]!.body).toMatchObject({ step: 'dissent' })
    expect(screen.getByTestId('reveal-dock-keep-open')).toBeDisabled()
    expect(screen.getByTestId('reveal-dock-keep-open')).toHaveAttribute('aria-pressed', 'true')
  })
})
