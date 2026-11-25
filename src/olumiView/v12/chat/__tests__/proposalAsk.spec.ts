import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { askProposalReview, askProposalReviewOf, useProposalAsk } from '../proposalAsk'
import * as proposalAsk from '../proposalAsk'

const view: View = JSON.parse(readFileSync('src/olumiView/golden/proposal.view.json', 'utf8'))
const initialUI = useUIStore.getState()

beforeEach(() => {
  useProposalAsk.setState({ id: 2, n: 3 })
  useUIStore.setState({ activeOutputTab: 'results' })
})

afterEach(() => {
  useViewStore.setState({ view: null })
  useProposalAsk.setState(useProposalAsk.getInitialState())
  useUIStore.setState(initialUI)
})

it('leaves the ask and active tab unchanged when there is no pending proposal', () => {
  useViewStore.setState({ view: { ...view, proposal: null } })
  const before = useProposalAsk.getState()
  const ui = useUIStore.getState()
  expect(askProposalReview()).toBe(false)
  expect(useProposalAsk.getState()).toBe(before)
  expect(useUIStore.getState()).toBe(ui)
})

it('records the proposal id, increments each ask and activates the Olumi tab', () => {
  useViewStore.setState({ view })
  const { n } = useProposalAsk.getState()
  expect(askProposalReview()).toBe(true)
  expect(useProposalAsk.getState()).toEqual({ id: view.proposal!.id, n: n + 1 })
  expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  expect(askProposalReview()).toBe(true)
  expect(useProposalAsk.getState()).toEqual({ id: view.proposal!.id, n: n + 2 })
})

it('leaves both stores untouched for a different proposal id and requests review for the matching id', () => {
  useViewStore.setState({ view })
  const before = useProposalAsk.getState()
  const ui = useUIStore.getState()

  expect(askProposalReviewOf(view.proposal!.id + 1)).toBe(false)
  expect(useProposalAsk.getState()).toBe(before)
  expect(useUIStore.getState()).toBe(ui)

  expect(askProposalReviewOf(view.proposal!.id)).toBe(true)
  expect(useProposalAsk.getState()).toEqual({ id: view.proposal!.id, n: before.n + 1 })
  expect(useUIStore.getState().activeOutputTab).toBe('olumi')
})

it('requests only the shown saved version, leaves both stores untouched on rejection, and exposes no generic Review action', () => {
  expect(proposalAsk.askVersionReview).toBeTypeOf('function')
  expect(proposalAsk).not.toHaveProperty('askReview')
  const { askVersionReview, useVersionAsk } = proposalAsk
  const saved: View = JSON.parse(readFileSync('src/olumiView/golden/capacity-v3.view.json', 'utf8'))
  const review = { changes: [
    ...view.proposal!.changes,
    { id: 'demand', top: false, text: 'Add weekend demand.', detail: '', family: 'quantity', olumi: { glyph: '✦', title: 'Olumi estimated demand' } },
  ], groups: null }
  const version = { ...saved.version!, review }
  const before = useVersionAsk.getState()
  const heldAsk = useProposalAsk.getState()
  const ui = useUIStore.getState()

  try {
    useViewStore.setState({ view: { ...saved, proposal: null, version } })
    expect(askVersionReview(version.id + 1)).toBe(false)
    expect(useVersionAsk.getState()).toBe(before)
    expect(useProposalAsk.getState()).toBe(heldAsk)
    expect(useUIStore.getState()).toBe(ui)

    useViewStore.setState({ view: { ...saved, proposal: view.proposal, version } })
    expect(askVersionReview(version.id)).toBe(false)
    expect(useVersionAsk.getState()).toBe(before)
    expect(useProposalAsk.getState()).toBe(heldAsk)
    expect(useUIStore.getState()).toBe(ui)

    useViewStore.setState({ view: { ...saved, proposal: null, version } })
    expect(askVersionReview(version.id)).toBe(true)
    expect(useVersionAsk.getState()).toEqual({ id: version.id, n: before.n + 1 })
    expect(useProposalAsk.getState()).toBe(heldAsk)
    expect(useUIStore.getState().activeOutputTab).toBe('olumi')
  } finally {
    useVersionAsk.setState(useVersionAsk.getInitialState())
  }
})
