import { ringFrom } from '../reasoning/tabRing'
import { useViewStore } from '../store'
import { useStoredFocusSubject } from './state'

export type FocusKind = 'card' | 'link' | 'option' | 'gap' | 'disagreement'
export type FocusSubject = { kind: FocusKind; id: string; cards: readonly string[]; source: 'canvas' | 'panel'; sid: string } | null

export function useFocusSubject(): FocusSubject {
  const sid = useViewStore((state) => state.sid)
  return useStoredFocusSubject(({ subject }) => subject?.sid === sid ? subject : null)
}

export function setFocusSubject(s: Omit<NonNullable<FocusSubject>, 'sid'> | null): void {
  const { sid } = useViewStore.getState()
  if (sid === null) return
  ringFrom('focus-subject', [])
  if (s?.source === 'panel') ringFrom('focus-subject', s.cards)
  useStoredFocusSubject.setState({ subject: s === null ? null : { ...s, sid } })
}
