import { useEffect, useState } from 'react'
import { useViewStore } from '../olumiView/store'
import { CoreCompare } from './compare'
import { call, TeamApiError } from './team/api'
import { BODY, ERR, META } from './team/ui'

/**
 * VERSION HISTORY ON THE OLUMI-CORE LANE: the scenario's approved versions as core stores them (olumi-core API.md v1.7, "Stored versions",
 * `GET /api/scenarios/:s/versions`), oldest first, and any two compared by core (`./compare.tsx`). Every approval is a version, so there is
 * nothing to save here, and core is append-only, so nothing to restore. Read again whenever the View's version changes.
 */
type Version = { id: number; n: number; at: string; by: string }

/** When a version was approved, as the version panel writes a time (`WhatChangedPanel` formatTimestamp). */
const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function CoreVersions(): JSX.Element {
  const sid = useViewStore((s) => s.sid)
  const latestId = useViewStore((s) => s.view?.version?.id ?? null)
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!sid) return
    let live = true
    call<{ versions: Version[] }>('GET', `/api/scenarios/${encodeURIComponent(sid)}/versions`)
      .then((r) => { if (live) { setVersions(r.versions); setError(null) } })
      .catch((e) => { if (live) setError(e instanceof TeamApiError ? e.message : 'That did not go through.') })
    return () => { live = false }
  }, [sid, latestId])
  if (!sid) return <p className={BODY} data-testid="core-versions-none">Start a model in the chat first. Each change you approve becomes a version.</p>
  if (error) return <p role="alert" className={ERR} data-testid="core-versions-error">{error}</p>
  if (versions === null) return <p className={META} data-testid="core-versions-loading">Reading the versions…</p>
  if (versions.length === 0) return <p className={BODY} data-testid="core-versions-empty">No version yet. Approve Olumi’s first model to make version 1.</p>
  return (
    <div className="grid gap-3" data-testid="core-versions">
      <ul className="m-0 grid list-none gap-1 p-0" data-testid="core-versions-list">
        {[...versions].reverse().map((v) => (
          <li key={v.id} className={BODY} data-testid="core-version-row">Version {v.n} <span className="text-text-light">· {when(v.at)} · approved by {v.by}</span></li>
        ))}
      </ul>
      {versions.length >= 2 && <CoreCompare sid={sid} latest={versions[versions.length - 1]!.n} id="versions-compare" />}
    </div>
  )
}
