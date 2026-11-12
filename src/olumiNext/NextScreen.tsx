/**
 * THE REDESIGN SLICE (DL 12 Nov), A WORKING PROTOTYPE: the look is not yet chosen and will change by stylesheet (./next.css only).
 * One screen, on its own route (#/next/<core scenario id>), beside the frozen lane screen in the same bundle. It imports only the journey
 * layer, the View types and the store, and its own drawing; no lane component. Core sends every word; this screen formats no model value.
 *
 * Only what works is drawn: the Model lens alone (the others are not wired here), no composer (no AI on this slice), no look-proof switcher.
 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useViewStore } from '../olumiView/store'
import { openScenario } from '../olumiView/journey'
import { Board } from './Board'
import { Panel } from './Panel'
import { OpenDetail, loose } from './Cards'
import { Brand } from './icons'
import './next.css'

export default function NextScreen() {
  const { sid = '' } = useParams<{ sid: string }>()
  const v = useViewStore((s) => s.view), error = useViewStore((s) => s.error)
  const [detail, setDetail] = useState<{ id: string; editing: boolean } | null>(null)
  const [flashing, setFlashing] = useState<string | null>(null)
  useEffect(() => { void openScenario(sid) }, [sid])
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
        {v === null ? <main className="nx-board">{error ? <p role="alert" className="meta">{error}</p> : null}</main> : (
          <OpenDetail.Provider value={(id) => setDetail({ id, editing: false })}>
            <Board v={v} selected={detail?.id ?? null} flashing={flashing} onEdit={(id) => setDetail({ id, editing: true })} />
            <Panel v={v} detail={detail?.id ?? null} editing={detail?.editing ?? false} closeDetail={() => setDetail(null)} flash={flash} />
          </OpenDetail.Provider>
        )}
      </div>
    </div>
  )
}
