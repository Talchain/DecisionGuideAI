import { create } from 'zustand'
import { useViewStore } from '../store'

export const useReasoningFocus = create<{ request: { sid: string; key: string } | null }>(() => ({ request: null }))

useViewStore.subscribe((state, previous) => {
  if (state.sid !== previous.sid) useReasoningFocus.setState({ request: null })
})
