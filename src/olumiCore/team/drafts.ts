/**
 * What a person has typed into the Team tab and not sent, kept while the tab is away. Switching to Model or Analysis unmounts the tab, and a
 * draft held only in a component's state went with it. A draft lives here, keyed by scenario and form, until it is sent or cleared; it is
 * in this page only (never saved, never sent), and a reload forgets it.
 */
import { useCallback, useRef } from 'react'
import { create } from 'zustand'

interface Drafts { readonly values: Readonly<Record<string, unknown>> }
const useDraftStore = create<Drafts>()(() => ({ values: {} }))

/** For specs. */
export function resetDrafts(): void { useDraftStore.setState({ values: {} }) }
/** What is held under a key (specs and the tab's own reads). */
export const draftOf = <T,>(key: string): T | undefined => useDraftStore.getState().values[key] as T | undefined

/** Change a draft from outside its form (another panel of the tab opening it). */
export function putDraft<T>(key: string, next: (prev: T | undefined) => T): void {
  useDraftStore.setState((s) => ({ values: { ...s.values, [key]: next(s.values[key] as T | undefined) } }))
}

/** A draft: its value (the initial one until something is typed), a setter that takes a value or an update, and a way to drop it once sent. */
export function useDraft<T>(key: string, initial: T): readonly [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const held = useDraftStore((s) => s.values[key]) as T | undefined
  const init = useRef(initial)
  init.current = initial
  const put = useCallback((next: T | ((prev: T) => T)) => useDraftStore.setState((s) => {
    const cur = (s.values[key] === undefined ? init.current : s.values[key]) as T
    return { values: { ...s.values, [key]: typeof next === 'function' ? (next as (p: T) => T)(cur) : next } }
  }), [key])
  const drop = useCallback(() => useDraftStore.setState((s) => {
    const { [key]: _gone, ...rest } = s.values
    return { values: rest }
  }), [key])
  return [held === undefined ? initial : held, put, drop] as const
}
