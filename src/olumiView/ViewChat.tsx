/**
 * The Olumi tab on the olumi-core lane, drawn from the View (olumi.view/2) and writing straight to core (View API design §2): the
 * conversation exactly as core wrote it, the change card for a proposal Olumi holds, and the composer. Every word is core's; each
 * drawn View string carries `data-view`, the path to the string it shows. Nothing is composed here.
 *
 * One write at a time. After a write the View, and the team's read (which moves the canvas to a newly approved model), are read again.
 * A write that fails keeps what was typed and says core's own words; one whose answer never came may have been saved, and is sent again
 * only with the same op id, so core saves it once.
 */
import { useRef, useState } from 'react'
import { newOp, TeamApiError } from '../olumiCore/team/api'
import { useTeamStore } from '../olumiCore/team/store'
import { writes, type View, type ViewTurn } from './client'
import { useViewStore } from './store'
import { typography } from '../styles/typography'

type Said = NonNullable<ViewTurn['answer']>['answer']

function Words({ parts, at }: { parts: Said; at: string }) {
  return (
    <>
      {parts.map((p, i) => ('cite' in p
        ? <sup key={i} data-view-cite={`${at}.${i}.cite`} title={p.cite} aria-label={p.cite}>◦</sup>
        : <span key={i} data-view={`${at}.${i}.text`}>{p.text}</span>))}
    </>
  )
}

/** The conversation, oldest first, as the View holds it. */
export function ViewTurns({ chat }: { chat: View['chat'] }) {
  return (
    <ol className={`${typography.panelBody} space-y-4`} data-testid="view-chat-turns">
      {chat.map((t, i) => {
        const at = `chat.${i}`
        return (
          <li key={t.id} data-view-turn={at}>
            <div className={typography.panelMeta}>
              <span data-view={`${at}.by`}>{t.by}</span> · <span data-view={`${at}.version`}>{t.version}</span>
              {t.status === null ? null : <> · <span data-view={`${at}.status`}>{t.status}</span></>}
            </div>
            <p data-view={`${at}.said`}>{t.said}</p>
            {t.answer === null ? null : (
              <div className="mt-2 space-y-2">
                <p><Words parts={t.answer.answer} at={`${at}.answer.answer`} /></p>
                {t.answer.why.length === 0 ? null : (
                  <details>
                    <summary>Why</summary>
                    <ul className="list-disc pl-4">{t.answer.why.map((w, j) => <li key={j}><Words parts={w} at={`${at}.answer.why.${j}`} /></li>)}</ul>
                  </details>
                )}
                <p><span className={typography.panelHeader} data-view={`${at}.answer.next.label`}>{t.answer.next.label}</span> <Words parts={t.answer.next.text} at={`${at}.answer.next.text`} /></p>
              </div>
            )}
            {t.broke === null ? null : <p data-view={`${at}.broke`}>{t.broke}</p>}
            {t.problem === null ? null : <p role="alert" data-view={`${at}.problem`}>{t.problem}</p>}
            {t.marks.map((m, j) => <p key={j} title={m.title}><span data-view={`${at}.marks.${j}.what`}>{m.what}</span>: <span data-view={`${at}.marks.${j}.status`}>{m.status}</span></p>)}
          </li>
        )
      })}
    </ol>
  )
}

/** The change card for the proposal Olumi holds, with core's words and marks, and the two acts on it. */
function Proposal({ p, act, busy }: { p: NonNullable<View['proposal']>; act: (f: () => Promise<unknown>) => void; busy: boolean }) {
  return (
    <div className={`${typography.panelBody} rounded border border-border p-3 space-y-2`} data-testid="view-chat-proposal">
      <div><span className={typography.panelHeader} data-view="proposal.heading">{p.heading}</span> <span data-view="proposal.on">{p.on}</span>
        {p.removed === null ? null : <> <span title={p.removed.title} data-view="proposal.removed.text">{p.removed.text}</span></>}</div>
      {p.problem === null ? null : <p role="alert" data-view="proposal.problem">{p.problem}</p>}
      {p.marks.map((m, j) => <p key={j} title={m.title}><span data-view={`proposal.marks.${j}.what`}>{m.what}</span>: <span data-view={`proposal.marks.${j}.status`}>{m.status}</span></p>)}
      <div className="flex gap-2">
        <button type="button" disabled={busy} className="rounded px-3 py-2 bg-primary text-text-on-color disabled:opacity-50" onClick={() => act(() => writes.approve(p.id, p.base))}>Approve</button>
        <button type="button" disabled={busy} className="rounded px-3 py-2 border border-border disabled:opacity-50" onClick={() => act(() => writes.discard(p.id))}>Set aside</button>
      </div>
    </div>
  )
}

/** The tab on the core lane: the page's View of this scenario, or nothing until one is read. */
export function ViewChat() {
  const view = useViewStore((s) => s.view), sid = useViewStore((s) => s.sid)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  // One op id per message as typed: the same words sent again after a dropped connection are saved once.
  const ops = useRef(new Map<string, string>())
  if (view === null || sid === null) return null

  const act = async (f: () => Promise<unknown>): Promise<boolean> => {
    if (busy) return false
    setBusy(true); setSaid(null)
    try {
      await f()
      await Promise.all([useViewStore.getState().refresh(), useTeamStore.getState().refresh()])
      return true
    } catch (e) {
      setSaid(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
      return false
    } finally { setBusy(false) }
  }
  const send = async () => {
    if (text.trim() === '') return
    const op = ops.current.get(text) ?? newOp()
    ops.current.set(text, op)
    if (await act(() => writes.message(sid, text, op))) { ops.current.delete(text); setText('') }
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="view-chat">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <ViewTurns chat={view.chat} />
        {view.proposal === null ? null : <Proposal p={view.proposal} act={(f) => void act(f)} busy={busy} />}
      </div>
      <div className={`${typography.panelBody} border-t border-border p-3 space-y-2`}>
        {said === null ? null : <p role="alert" data-testid="view-chat-said">{said}</p>}
        <label className="sr-only" htmlFor="view-chat-text">Message Olumi</label>
        <textarea id="view-chat-text" className="w-full rounded border border-border p-2" rows={3} value={text} disabled={busy} onChange={(e) => setText(e.target.value)} />
        <button type="button" disabled={busy || text.trim() === ''} className="rounded px-3 py-2 bg-primary text-text-on-color disabled:opacity-50" onClick={() => void send()}>Send</button>
      </div>
    </div>
  )
}
