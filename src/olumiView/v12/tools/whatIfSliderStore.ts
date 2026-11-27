import { create } from 'zustand'
import { TeamApiError } from '../../../olumiCore/team/api'
import { useViewStore } from '../../store'
import { runWhatIf, WHAT_IF_STALE, type WhatIfVariant } from '../../whatif'

type Preview = {
  position: number | null
  pending: boolean
  stale: boolean
  notice?: string
  variant?: WhatIfVariant
}

type VersionPreviews = { base: number; records: ReadonlyMap<string, Preview> }
export const useWhatIfSliderStore = create<{ scenarios: ReadonlyMap<string, VersionPreviews> }>()(() => ({ scenarios: new Map() }))

export function syncWhatIfBase(sid: string, base: number) {
  const { scenarios } = useWhatIfSliderStore.getState()
  const previous = scenarios.get(sid)
  if (previous?.base === base) return
  const records = new Map<string, Preview>()
  for (const [record, preview] of previous?.records ?? []) {
    if (preview.pending || preview.stale) {
      records.set(record, { position: null, pending: false, stale: true, notice: preview.notice ?? WHAT_IF_STALE })
    }
  }
  useWhatIfSliderStore.setState({ scenarios: new Map(scenarios).set(sid, { base, records }) })
}

// The approved View can advance while both hosts of the control are closed.
useViewStore.subscribe(({ view, sid, at, error, stale }) => {
  const base = view?.version?.id
  if (sid !== null && view?.id === sid && base != null && at === null && error === null && !stale
    && view.proposal == null && view.model?.edit_base === base && useWhatIfSliderStore.getState().scenarios.has(sid)) {
    syncWhatIfBase(sid, base)
  }
})

function put(sid: string, base: number, record: string, preview: Preview | null) {
  const { scenarios } = useWhatIfSliderStore.getState()
  const current = scenarios.get(sid)
  if (current?.base !== base) return
  const records = new Map(current.records)
  if (preview === null) records.delete(record)
  else records.set(record, preview)
  useWhatIfSliderStore.setState({ scenarios: new Map(scenarios).set(sid, { base, records }) })
}

export const clearSliderPreview = (sid: string, base: number, record: string) => put(sid, base, record, null)

export async function trySliderPoint(sid: string, base: number, record: string, value: number) {
  const current = useWhatIfSliderStore.getState().scenarios.get(sid)
  if (current?.base !== base || current.records.get(record)?.position === value) return
  const request: Preview = { position: value, pending: true, stale: false }
  put(sid, base, record, request)
  let preview: Preview
  try {
    const variant = await runWhatIf(sid, base, record, { kind: 'point', value })
    preview = { position: variant === null ? null : value, pending: false, stale: false, variant: variant ?? undefined }
  } catch (error) {
    const coreMessage = error instanceof TeamApiError && (error.body as { error?: unknown } | null)?.error
    const notice = typeof coreMessage === 'string' && coreMessage ? coreMessage
      : error instanceof TeamApiError && !error.uncertain ? error.message : undefined
    preview = { position: null, pending: false, stale: error instanceof TeamApiError && error.status === 409
      && (typeof coreMessage === 'string' || error.message === WHAT_IF_STALE), notice }
  }
  if (useWhatIfSliderStore.getState().scenarios.get(sid)?.records.get(record) === request) put(sid, base, record, preview)
}
