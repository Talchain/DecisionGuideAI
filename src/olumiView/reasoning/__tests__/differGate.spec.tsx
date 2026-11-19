/**
 * The Reasoning tab's "Where your views differ" goes through the Team tab's own read and reveal gate (`useRevealedDifferences`), never
 * around it: with the REAL hook (no mock), a gated View draws no difference and no private position, and the same View ungated and revealed
 * draws core's sentence and each person's figure. Mutant pair: reading `useDifferences` directly in TowardsCommitment turns the gated row red.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'

import type { View } from '../../client'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { differencesKey, resetDifferences, useDifferences } from '../../../olumiCore/team/differences'
import { TowardsCommitment } from '../TowardsCommitment'

const PRIVATE = 'Tobias: about 4% (his private figure)'
const base = (gated: boolean): View => {
  const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/app-launch.view.json'), 'utf8')) as View
  ;(view as { gated: boolean }).gated = gated
  const shared = (id: number, by: string) => ({ id, by, by_id: by, text: '', skip: false, figures: [] })
  ;(view.collab as { shared: unknown[] }).shared = [shared(1, 'p1'), shared(2, 'p2')]
  return view
}
const show = (view: View) => {
  const sid = view.id, cid = view.model!.cards[0]!.id, key = differencesKey(sid, view)
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  // The read already made for this very View (so no fetch fires): core's answer, with one person's private figure in it.
  useDifferences.setState({ sid, key, read: key, error: null, data: { scenario: sid, version: 1, gated: view.gated, heading: 'Where your views differ', empty: '',
    headings: { sides: '', options: '', model: '', settle: '', steps: '', dissent: '', research: '', commit: '' },
    differences: [{ kind: 'figure', cards: [cid], record: cid, label: 'Paid conversion', goal: 'g1', goal_label: '', status: 'changes', status_text: 'Your figures change which option is most likely.',
      sides: [{ view: 2, holder: 'Tobias', holder_id: 'p2', figure: cid, title: '', leader: null, text: PRIVATE }], options: [], settle: [], steps: [] }] } as never })
  render(<TowardsCommitment view={view} />)
}
afterEach(() => { cleanup(); resetDifferences(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

describe('where your views differ: only behind the Team tab\'s reveal gate', () => {
  it('revealed and ungated: core\'s sentence and each person\'s figure are drawn', () => {
    show(base(false))
    expect(screen.getByTestId('reasoning-commitment-differ')).toBeInTheDocument()
    expect(document.body.textContent).toContain(PRIVATE)
  })
  it('MUTANT PAIR: the same View gated draws no difference and no private position', () => {
    show(base(true))
    expect(screen.queryByTestId('reasoning-commitment-differ')).toBeNull()
    expect(document.body.textContent).not.toContain(PRIVATE)
  })
})
