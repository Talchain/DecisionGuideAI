import { create } from 'zustand'
import { useViewStore } from '../../store'
import { useUIStore } from '../../../stores/uiStore'

export const useProposalAsk = create<{ id: number | null; n: number }>(() => ({ id: null, n: 0 }))

export function clearProposalAsk(): void {
  useProposalAsk.setState({ id: null })
}

export function askProposalReview(): boolean {
  const proposal = useViewStore.getState().view?.proposal
  if (proposal == null) return false
  useProposalAsk.setState(({ n }) => ({ id: proposal.id, n: n + 1 }))
  useUIStore.getState().forceActivateOutputTab('olumi')
  return true
}
