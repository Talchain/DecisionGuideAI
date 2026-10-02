/**
 * The saved read, fetched when the decision brief opens — the SAME read the boot and poll legs use
 * (`fetchScenarioGraph`), with the SAME identity accessor (`getSessionIdentity`, read at request time). No new endpoint,
 * no store write: the answer lives in this hook's state and dies with the panel.
 *
 * Why a fresh read rather than the canvas store: the brief describes the SAVED version and its latest Run. The store
 * holds the canvas (which may carry edits CEE has not yet acknowledged) and restores a Run's figures only under the
 * boot currency proof; the read states both facts for the saved bytes directly.
 */
import { useEffect, useState } from 'react'

import { fetchScenarioGraph, type ScenarioGraphResult } from '../../adapters/cee/scenarioGraph'
import { getSessionIdentity } from '../../lib/supabase'
import { isCeeAddressableScenarioId } from '../hydrate/bootGraphRead'

export type SavedScenarioReadState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'done'; readonly result: ScenarioGraphResult }

export function useSavedScenarioRead(scenarioId: string | null, enabled: boolean): SavedScenarioReadState {
  const [state, setState] = useState<SavedScenarioReadState>({ status: 'idle' })

  useEffect(() => {
    if (!enabled || !isCeeAddressableScenarioId(scenarioId)) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    void (async () => {
      const identity = await getSessionIdentity().catch(() => ({ userId: null, accessToken: null }))
      const result = await fetchScenarioGraph(scenarioId, {
        userId: identity.userId,
        accessToken: identity.accessToken,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) setState({ status: 'done', result })
    })()
    return () => controller.abort()
  }, [scenarioId, enabled])

  return state
}
