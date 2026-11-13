/**
 * THE REDESIGN SLICE (DL 12 Nov), A WORKING PROTOTYPE: the look is not yet chosen and will change by stylesheet (./next.css only).
 * One screen, on its own route (#/next/<core scenario id>), beside the frozen lane screen in the same bundle. It imports only the journey
 * layer, the View types and the store, and its own drawing; no lane component. Core sends every word; this screen formats no model value.
 *
 * Only what works is drawn: the Model lens alone (the others are not wired here) and the conversation (the composer: an answer to one of Olumi's
 * questions, or anything else told to Olumi), no look-proof switcher.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useViewStore } from '../olumiView/store'
import { awaitTurn, draftAgain, openScenario, startScenario, working } from '../olumiView/journey'
import { TeamApiError } from '../olumiCore/team/api'
import { Board } from './Board'
import { Panel } from './Panel'
import { AnswerQuestion, OpenDetail, loose } from './Cards'
import type { QuestionRef } from '../olumiView/journey'
import { Brand } from './icons'
import './next.css'

/** A new scenario (#/next/new): the person's brief, sent to core once; the page then opens the scenario core names and waits for its draft. */
function BriefScreen() {
  const go = useNavigate()
  const [brief, setBrief] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const send = async () => {
    if (brief.trim() === '' || busy) return
    setBusy(true); setError(null)
    try { const sid = await startScenario(brief.trim()); go(`/next/${sid}`, { replace: true }) }
    catch (e) { setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.'); setBusy(false) }
  }
  return (
    <main className="nx-board nx-brief" data-testid="next-brief">
      <form onSubmit={(e) => { e.preventDefault(); void send() }}>
        <h1><Brand s={28} /><span>What are you working on?</span></h1>
        <label className="meta" htmlFor="next-brief-field">Your brief: the situation, what you are weighing, and what matters to you.</label>
        <textarea id="next-brief-field" rows={7} value={brief} onChange={(e) => setBrief(e.target.value)} disabled={busy} data-testid="next-brief-field" />
        <div className="edit-acts"><button type="submit" className="btn btn-primary" disabled={busy || brief.trim() === ''} data-testid="next-brief-send">{busy ? 'Sending…' : 'Start'}</button></div>
        {error ? <p role="alert" className="meta err" data-testid="next-error">{error}</p> : null}
      </form>
    </main>
  )
}

/** While core drafts the first model (the View's `draft`), its own words for where it stands; failed or lost: its reason and Try again. */
function Drafting({ v }: { v: NonNullable<ReturnType<typeof useViewStore.getState>['view']> }) {
  const d = loose(v.draft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ended = d.status === 'failed' || d.status === 'lost' || d.status === 'stopped'
  return (
    <main className="nx-board nx-brief" data-testid={`next-draft-${d.status}`}>
      <section>
        <h1><Brand s={28} /><span>{v.title}</span></h1>
        <p className={ended ? 'say err' : 'say'}>{d.words ?? d.reason ?? ''}</p>
        {ended ? <div className="edit-acts"><button type="button" className="btn btn-primary" disabled={busy} data-testid="next-draft-again" onClick={() => { setBusy(true); setError(null); void draftAgain().catch((e) => setError(e instanceof TeamApiError ? e.message : 'That did not go through.')).finally(() => setBusy(false)) }}>Try again</button></div> : null}
        {error ? <p role="alert" className="meta err">{error}</p> : null}
      </section>
    </main>
  )
}

export default function NextScreen() {
  const { sid = '' } = useParams<{ sid: string }>()
  return sid === 'new' ? <Shell><BriefScreen /></Shell> : <ScenarioScreen sid={sid} />
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="olumi-next" data-testid="next-screen"><div className="nx-app"><header className="nx-bar"><div className="brand"><span><Brand s={20} /></span>Olumi</div></header>{children}</div></div>
}

function ScenarioScreen({ sid }: { sid: string }) {
  const v = useViewStore((s) => s.view), error = useViewStore((s) => s.error)
  const [detail, setDetail] = useState<{ id: string; editing: boolean } | null>(null)
  const [flashing, setFlashing] = useState<string | null>(null)
  const [answering, setAnswering] = useState<QuestionRef | null>(null)
  useEffect(() => { void openScenario(sid) }, [sid])
  // Olumi is drafting or answering (a reopen mid-draft included): the store reads the View again until it is not, once at a time.
  const waiting = useRef(false), busy = v !== null && working(v)
  useEffect(() => { if (busy && !waiting.current) { waiting.current = true; void awaitTurn({ timeoutMs: 600_000 }).finally(() => { waiting.current = false }) } }, [busy])
  const draftOnly = v !== null && v.draft != null && v.draft.status !== 'done' && v.proposal == null && (v.model?.cards ?? []).length === 0
  const flash = (id: string) => { setFlashing(null); requestAnimationFrame(() => { setFlashing(id); document.querySelector(`.olumi-next [data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest' }) }) }
  const lw = loose(v?.lens_words), ver = v?.version ? loose(v.version) : null
  return (
    <div className="olumi-next" data-testid="next-screen">
      <div className="nx-app">
        <header className="nx-bar">
          <div className="brand"><span><Brand s={20} /></span>Olumi</div>
          {v ? <div className="scn"><span className="scn-title">{v.title}</span>{ver?.label ? <span className="meta">{ver.label}</span> : null}{ver?.at_text ? <span className="meta">{ver.at_text}</span> : null}</div> : null}
          {lw.label?.full ? <nav className="nx-lenses" aria-label={lw.bar}><button type="button" title={lw.hint?.full} aria-current="true"><span>{lw.label.full}</span></button></nav> : null}
        </header>
        {v === null ? <main className="nx-board">{error ? <p role="alert" className="meta">{error}</p> : null}</main> : draftOnly ? <Drafting v={v} /> : (
          <OpenDetail.Provider value={(id) => setDetail({ id, editing: false })}><AnswerQuestion.Provider value={setAnswering}>
            <Board v={v} selected={detail?.id ?? null} flashing={flashing} onEdit={(id) => setDetail({ id, editing: true })} />
            <Panel v={v} detail={detail?.id ?? null} editing={detail?.editing ?? false} closeDetail={() => setDetail(null)} flash={flash} answering={answering} setAnswering={setAnswering} />
          </AnswerQuestion.Provider></OpenDetail.Provider>
        )}
      </div>
    </div>
  )
}
