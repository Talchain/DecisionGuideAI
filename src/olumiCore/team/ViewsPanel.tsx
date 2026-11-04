import { useState } from 'react'
import { Lock, Share2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { View } from '../../olumiView/client'
import { teamApi, TeamApiError } from './api'
import { useDraft } from './drafts'
import { MAY_HAVE_SAVED, runWrite, useWriteLocked, useWrites, useWriteSending } from './writes'
import { AVATAR, BODY, CARD, ERR, FIELD, H, META } from './ui'

type Figure = View['collab']['shared'][number]['figures'][number]

/** The figures a person gave with their view, each in core's words (its `text`, with core's `title` on hover), in core's order. */
function Figures({ at, figures }: { at: string; figures: Figure[] }): JSX.Element | null {
  if (figures.length === 0) return null
  return (
    <ul className="m-0 grid list-none gap-0.5 p-0" data-testid={`${at}-figures`}>
      {figures.map((f, i) => (
        <li key={i} className={META} title={f.title} data-testid={`${at}-figure-${i}`}>
          <span className="text-text-header">{f.label}</span>: {f.text}
        </li>
      ))}
    </ul>
  )
}

/**
 * Each person's own view, given before they see anyone else's, then revealed together (spec §8 steps 1 and 2). Everything here is the
 * View's `collab`: the heading, the placeholder, your own views still private to you, the team's revealed views, whether the reveal is
 * open (`can_reveal`) and whom it waits for. Words go to core exactly as typed; a given view is never edited.
 */
/** `collab.mine[].can_share` (olumi-core, github-3c, olumi.view/3): sharing one's own view before the reveal. Until core's schema carries
 *  it the field is read here, and only `true` offers the share; a core without it offers nothing. */
const canShare = (v: View['collab']['mine'][number]): boolean => (v as { can_share?: unknown }).can_share === true

export function ViewsPanel({ sid, view, onWrote }: { sid: string; view: View; onWrote: () => Promise<boolean> }): JSX.Element {
  const c = view.collab
  const [text, setText, dropText] = useDraft(`${sid}:view`, '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // A view and a reveal have no operation id in core: one whose answer was lost may have been saved, so it is not sent again (`writes.ts`).
  const viewLocked = useWriteLocked(`${sid}:view`)
  // A write still on its way (this panel drawn again meanwhile) keeps its buttons held: it is never sent twice.
  const viewSending = useWriteSending(`${sid}:view`), revealSending = useWriteSending(`${sid}:reveal`)
  const sending = viewSending || revealSending
  // A share has no operation id either: one whose answer was lost is not sent again.
  const locks = useWrites((s) => s.locked)
  const shareLocked = (id: number) => locks[`${sid}:share:${id}`] === true

  const run = async (key: string, write: () => Promise<unknown>, after?: () => void) => {
    setBusy(true); setError(null)
    try { await runWrite(key, { op: false }, null, write); after?.(); await onWrote() } catch (e) {
      setError(e instanceof TeamApiError ? e.message : 'That did not go through. Nothing was saved.')
    } finally { setBusy(false) }
  }

  return (
    <section data-testid="team-views" aria-label={c.heading} className="grid gap-2">
      <h3 className={H} data-testid="team-views-heading">{c.heading}</h3>
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" data-testid="team-members">
        {view.members.map((m) => (
          <li key={m.id} data-testid={`team-member-${m.id}`} className={`${META} inline-flex items-center gap-1.5`}>
            <span aria-hidden="true" className={AVATAR}>{m.name.slice(0, 1).toUpperCase()}</span>
            {m.name}{m.id === view.you_id ? ' (you)' : ''}
          </li>
        ))}
      </ul>

      {c.shared.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-revealed">
          {c.shared.map((v) => (
            <li key={v.id} data-testid={`team-revealed-${v.id}`} className={CARD}>
              <p className={`${BODY} text-text-header`}>{v.by}</p>
              {v.skip ? <p className={META}>Chose not to answer.</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
              <Figures at={`team-revealed-${v.id}`} figures={v.figures} />
            </li>
          ))}
        </ul>
      )}

      {c.mine.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0" data-testid="team-mine">
          {c.mine.map((v) => (
            <li key={v.id} data-testid={`team-mine-${v.id}`} className={CARD}>
              <p className={`${META} flex items-center gap-1.5 text-text-header`}><Lock aria-hidden="true" className="h-3 w-3 flex-none" />Private to you until everyone’s views are revealed</p>
              {v.skip ? <p className={META}>You chose not to answer.</p> : <p className={`${BODY} whitespace-pre-wrap break-words`}>{v.text}</p>}
              <Figures at={`team-mine-${v.id}`} figures={v.figures} />
              {canShare(v) && !v.skip && (
                <div>
                  <Button size="sm" variant="secondary" data-testid={`team-share-${v.id}`} disabled={busy || sending || shareLocked(v.id)}
                    title="Shows this view to the team now, before the others are revealed. Olumi does not read it until then."
                    onClick={() => void run(`${sid}:share:${v.id}`, () => teamApi.shareView(sid, v.id))}>
                    <span className="inline-flex items-center gap-1.5"><Share2 aria-hidden="true" className="h-3.5 w-3.5" />Share with the team now</span>
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className={CARD}>
        <textarea
          aria-label={c.placeholder} placeholder={c.placeholder} data-testid="team-view-text" className={`${FIELD} min-h-[72px]`}
          value={text} disabled={busy || sending || viewLocked} onChange={(e) => { setText(e.target.value); if (error) setError(null) }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" data-testid="team-view-give" disabled={busy || sending || viewLocked || text.trim() === ''} onClick={() => void run(`${sid}:view`, () => teamApi.giveView(sid, text), dropText)}>Add my view</Button>
          <button
            type="button" data-testid="team-view-skip" disabled={busy || sending || viewLocked}
            className={`${META} cursor-pointer underline underline-offset-2 hover:text-text-body disabled:opacity-50`}
            onClick={() => void run(`${sid}:view`, () => teamApi.skipView(sid))}
          >I would rather not answer this</button>
        </div>
        {viewLocked ? <p role="alert" data-testid="team-views-error" className={ERR}>{MAY_HAVE_SAVED}</p> : error && <p role="alert" data-testid="team-views-error" className={ERR}>{error}</p>}
      </div>
    </section>
  )
}
