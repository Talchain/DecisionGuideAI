/** Rule 7 and D1: whether the person has opened a fold, per scenario (this visit only): the folded inputs, and each row's group card (groups.ts). */
import { create } from 'zustand'
import type { ViewModel } from '../../client'
import { foldsInputs } from './bands'

export const useInputsOpen = create<{ open: Readonly<Record<string, boolean>> }>(() => ({ open: {} }))
export const setInputsOpen = (sid: string, open: boolean): void => useInputsOpen.setState((s) => ({ open: { ...s.open, [sid]: open } }))
/** Simple draws the inputs as one folded group: 15 or more of them and the person has not opened them. */
export const inputsFolded = (sid: string | null, model: ViewModel, open: Readonly<Record<string, boolean>> = useInputsOpen.getState().open): boolean =>
  foldsInputs(model) && !(sid !== null && open[sid] === true)
/** A row's group card (groups.ts), opened in place by one press, in the same store as the inputs' fold, keyed by scenario and group. */
const groupKey = (sid: string, group: string): string => `${sid}#${group}`
export const setGroupOpen = (sid: string, group: string, open = true): void => useInputsOpen.setState((s) => ({ open: { ...s.open, [groupKey(sid, group)]: open } }))
export const groupOpen = (sid: string | null, group: string, open: Readonly<Record<string, boolean>> = useInputsOpen.getState().open): boolean =>
  sid !== null && open[groupKey(sid, group)] === true
