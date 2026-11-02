/**
 * When the page reads the View again. For the scenario on screen; again whenever the canvas's model changes (a figure saved here); and
 * again whenever core's approved version moves (an approval, here or by another member). The approved version's identity is the key
 * for an approval: an approved change to an aim's bound can leave every node and link on the canvas as it was (review 00053 #1).
 */
import { useEffect } from 'react'
import { useTeamStore } from '../olumiCore/team/store'
import { useViewStore } from './store'

export function useViewFollows(on: boolean, uuid: string | null, modelKey: string): void {
  const approved = useTeamStore((s) => (s.uuid === uuid ? s.scenario?.version?.id ?? null : null))
  useEffect(() => {
    if (!on) return
    const v = useViewStore.getState()
    void (v.uuid === uuid && v.status !== 'none' ? v.modelChanged() : v.use(uuid))
  }, [on, uuid, modelKey, approved])
}
