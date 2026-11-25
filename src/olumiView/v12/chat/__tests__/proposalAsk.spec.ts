import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useUIStore } from '../../../../stores/uiStore'
import type { View } from '../../../client'
import { useViewStore } from '../../../store'
import { askProposalReview, useProposalAsk } from '../proposalAsk'

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
