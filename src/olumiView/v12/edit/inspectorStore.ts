/** What the lane's details panel is showing: a card (by its record id) or a link (by its canvas edge id, `from->to:kind`). Null: nothing. */
import { create } from 'zustand'

export type DetailsTarget = { readonly kind: 'card' | 'link'; readonly id: string }
export const useLaneInspector = create<{ readonly target: DetailsTarget | null; readonly open: (t: DetailsTarget) => void; readonly close: () => void }>()((set) => ({
  target: null, open: (target) => set({ target }), close: () => set({ target: null }),
}))
