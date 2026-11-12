import { useEffect, useState } from 'react'
import { Button } from '../components/ui/Button'
import { useViewStore } from '../olumiView/store'
import { ChangeItem, ComparedLists, CoreCompare, SideText, what, whoOf, type Compared } from './compare'
import { call, TeamApiError } from './team/api'
import { BODY, ERR, META } from './team/ui'

/**
 * VERSION HISTORY ON THE OLUMI-CORE LANE: the scenario's approved versions as core stores them (olumi-core API.md v1.7, "Stored versions",
 * `GET /api/scenarios/:s/versions`), oldest first, any one opened on its record, and any two compared by core (`./compare.tsx`). Every
 * approval is a version, so there is nothing to save here, and core is append-only, so nothing to restore. Read again whenever the View's
 * version changes. Reading the history only reads: the View, and so the canvas, stay on the version in use.
 */
/** `lines` (API v1.10): the version's own change lines, from the producer /record and /compare use; absent on a core before it. */
type Version = { id: number; n: number; at: string; by: string; base: number | null; lines?: Compared['changes'] }

/** When a version was approved, as the version panel writes a time (`WhatChangedPanel` formatTimestamp). */
const when = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/**
 * One version's record, from core's comparison (`GET /compare`), every word core's. A version approved over an earlier one is that
 * version against it: who proposed and approved it, its change lines (the change card `/s/:s/record` prints for it, worked out the same
 * way) and how each result moved. The first version has no earlier one: who proposed it, its own change lines (`lines`, every record
 * added over nothing) and its saved results, read as the earlier side of its comparison with the next version.
 * Draw puts the model as it stood at this version on the canvas: the View store reads that version's own View (core API v1.10,
 * `view?at=n`) and the canvas follows it, until the person goes back to the latest. Nothing is written either way.
 */
function VersionRecord({ sid, v, versions, drawn }: { sid: string; v: Version; versions: Version[]; drawn: boolean }): JSX.Element {
  const over = v.base === null ? null : versions.find((x) => x.id === v.base)?.n ?? null
  const next = over === null ? versions.find((x) => x.n > v.n)?.n ?? null : null
  const [c, setC] = useState<Compared | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refused, setRefused] = useState<string | null>(null)
  const latest = versions[versions.length - 1]!.n
  const draw = async () => { setRefused(await useViewStore.getState().look(v.n === latest ? null : v.n)) }
  useEffect(() => {
    const pair = over !== null ? [over, v.n] : next !== null ? [v.n, next] : null
    if (!pair) return
    let live = true
    call<Compared>('GET', `/api/scenarios/${encodeURIComponent(sid)}/compare?from=${pair[0]}&to=${pair[1]}`)
      .then((r) => { if (live) { setC(r); setError(null) } })
      .catch((e) => { if (live) setError(e instanceof TeamApiError ? e.message : 'That did not go through.') })
    return () => { live = false }
  }, [sid, v.n, over, next])
  const id = `core-version-${v.n}`
  const mine = c?.versions.find((x) => x.n === v.n) ?? null
  const said = mine ? whoOf(mine) : `approved by ${v.by}`
  return (
    <div className="grid gap-2 pb-2 pl-3" data-testid={`${id}-record`}>
      {error && <p role="alert" className={ERR} data-testid={`${id}-error`}>{error}</p>}
      {!drawn && <div><Button size="sm" variant="secondary" data-testid={`${id}-draw`} onClick={() => void draw()}>Draw on the canvas</Button></div>}
      {refused && <p role="alert" className={ERR} data-testid={`${id}-draw-error`}>{refused}</p>}
      {(c || (over === null && next === null)) && <p className={BODY} data-testid={`${id}-who`}>{said.charAt(0).toUpperCase() + said.slice(1)}</p>}
      {c && over !== null && <>
        <p className={META}>Against version {over}</p>
        <ComparedLists c={c} id={id} who={false} />
      </>}
      {over === null && v.lines && <>
        <p className={`${BODY} text-text-header`}>What changed</p>
        {v.lines.length
          ? <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${id}-changes`}>{v.lines.map((l, i) => <ChangeItem key={i} l={l} />)}</ul>
          : <p className={META} data-testid={`${id}-changes-none`}>No change to the model</p>}
      </>}
      {c && over === null && (c.results.some((r) => r.before)
        ? <ul className="m-0 grid list-none gap-1 p-0" data-testid={`${id}-found`}>
            {c.results.filter((r) => r.before).map((r, i) => <li key={i} className={BODY}>{what(r)}: <SideText s={r.before} /></li>)}
          </ul>
        : <p className={META} data-testid={`${id}-found-none`}>No results in this version</p>)}
      {/* Core's printable record, at this version's heading (`#version-n`, API v1.10); a core before it opens the record at its top. */}
      <p className={META}>
        <a href={`/s/${encodeURIComponent(sid)}/record#version-${v.n}`} target="_blank" rel="noopener noreferrer" className="text-info underline underline-offset-2" data-testid={`${id}-record-link`}>On the printable record</a>
      </p>
    </div>
  )
}

export function CoreVersions(): JSX.Element {
  const sid = useViewStore((s) => s.sid)
  const current = useViewStore((s) => s.view?.version ?? null)
  const past = useViewStore((s) => s.at)
  const latestId = current?.id ?? null
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<Set<number>>(new Set())
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
  const toggle = (n: number) => setOpen((o) => { const x = new Set(o); if (x.has(n)) x.delete(n); else x.add(n); return x })
  return (
    <div className="grid gap-3" data-testid="core-versions">
      {past !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" data-testid="core-versions-back" onClick={() => void useViewStore.getState().look(null)}>Back to the latest</Button>
        </div>
      )}
      <ul className="m-0 grid list-none gap-1 p-0" data-testid="core-versions-list">
        {[...versions].reverse().map((v) => {
          const inUse = current?.id === v.id
          return (
            <li key={v.id} data-testid="core-version-row" data-version={v.n} aria-current={inUse ? 'true' : undefined}>
              {/* The version the canvas draws (the latest, or the one the person drew): core's label for it, set in the heavier weight. */}
              <button type="button" data-testid={`core-version-open-${v.n}`} aria-expanded={open.has(v.n)} title={inUse ? current?.label : undefined}
                className={`${BODY} w-full rounded px-1 py-0.5 text-left hover:bg-panel-hover ${inUse ? 'font-semibold text-text-header' : ''}`} onClick={() => toggle(v.n)}>
                Version {v.n} <span className="font-normal text-text-light">· {when(v.at)} · approved by {v.by}</span>
              </button>
              {open.has(v.n) && <VersionRecord sid={sid} v={v} versions={versions} drawn={inUse} />}
            </li>
          )
        })}
      </ul>
      {versions.length >= 2 && <CoreCompare sid={sid} latest={versions[versions.length - 1]!.n} id="versions-compare" />}
      <p className={META}>
        <a href={`/s/${encodeURIComponent(sid)}/record`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[24px] items-center text-info underline underline-offset-2" data-testid="core-versions-record-link">Printable record</a>
      </p>
    </div>
  )
}
