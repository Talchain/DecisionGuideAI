/**
 * editPreviewStore — Global state for edit impact preview.
 *
 * Graph Editing Experience Task 5: When a slider is being dragged in the inspector
 * or EdgeEditPopover, this store holds the downstream impact map. BaseNode reads
 * from it to show directional indicators.
 *
 * Debounce is handled by callers (150ms on input, immediate clear on blur).
 */
import { create } from 'zustand'

export type ImpactDirection = 'increase' | 'decrease' | 'mixed'

interface EditPreviewState {
  /** Map of nodeId → directional impact for the current edit */
  impactMap: Map<string, ImpactDirection>
  /** Set the impact map (called by debounced slider handlers) */
  setImpact: (map: Map<string, ImpactDirection>) => void
  /** Clear all impact indicators (called on blur/release) */
  clearImpact: () => void
}

const EMPTY_MAP = new Map<string, ImpactDirection>()

export const useEditPreviewStore = create<EditPreviewState>((set) => ({
  impactMap: EMPTY_MAP,
  setImpact: (map) => set({ impactMap: map }),
  clearImpact: () => set({ impactMap: EMPTY_MAP }),
}))
