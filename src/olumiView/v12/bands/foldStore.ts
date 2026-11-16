/** Rule 7: whether the person has opened the folded inputs, per scenario (this visit only). */
import { create } from 'zustand'
import type { ViewModel } from '../../client'
import { foldsInputs } from './bands'

export const useInputsOpen = create<{ open: Readonly<Record<string, boolean>> }>(() => ({ open: {} }))
export const setInputsOpen = (sid: string, open: boolean): void => useInputsOpen.setState((s) => ({ open: { ...s.open, [sid]: open } }))
/** Simple draws the inputs as one folded group: 15 or more of them and the person has not opened them. */
export const inputsFolded = (sid: string | null, model: ViewModel, open: Readonly<Record<string, boolean>> = useInputsOpen.getState().open): boolean =>
  foldsInputs(model) && !(sid !== null && open[sid] === true)
