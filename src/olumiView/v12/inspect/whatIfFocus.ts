/** "What if" pressed on a figure (the inspector): turns the What if lens on and tells its key which figure to try. The key takes it once and clears it. */
import { create } from 'zustand'
import { useViewLens } from '../../lens'

export const useWhatIfFocus = create<{ readonly id: string | null }>()(() => ({ id: null }))
export const openWhatIf = (id: string): void => { useWhatIfFocus.setState({ id }); useViewLens.setState({ lens: 'what_if' }) }
export const takeWhatIfFocus = (): void => useWhatIfFocus.setState({ id: null })
