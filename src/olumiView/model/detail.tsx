/**
 * ONE PRESS AWAY: A ROW'S DETAIL, AND THE HELD-CHANGE NOTICE (Paul 7 Nov: the advanced detail "toggled off with an expert view or in
 * progressive disclosure"). The crafted tab's detail region (legacy `ModelDetailRegion.tsx`), in its order and rendered only where it has
 * something to say: what the person can do here, whose it is, what it is linked to, then (Expert) the science behind its figure.
 *
 * Every model word is core's, drawn verbatim under its View path; headings and buttons are core’s `model_words`.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, FileText, LocateFixed, Pencil, Type, User } from 'lucide-react'
import { typography } from '../../styles/typography'
import { ACTION_FOCUS } from '../../components/results/analysisNew/panelSurfaces'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { TeamApiError } from '../../olumiCore/team/api'
import type { ViewCard, ViewLink, ViewModel } from '../client'
import { writes } from '../client'
import { useViewStore } from '../store'
import { linkEndHeading } from '../layout'
import { authorAnyOf } from './author'
import { useModelWords, openEditor, readAfter, useModelEdit } from './editing'
import { ASIDE_WORDS } from '../FigureEdit'
import { RECIPE } from './editors'
import { HELD_PREFIX, heldRow, useModelTab } from './state'
import { linkEndPath, linksOf, strengthCardOf, targetCardOf } from './targets'
import { AskOlumi, RemoveLink, useMounted } from './structure'

const SECTION = `${typography.viewPanelMeta} m-0 mb-1 text-text-light`
const ICON = 'h-3.5 w-3.5 flex-none'

function Section({ title, children, at }: { title: string; children: ReactNode; at: string }) {
  return <section aria-label={title} data-model-detail-section={at}><h4 className={SECTION}>{title}</h4>{children}</section>
}

/** A detail action, as the crafted tab's group actions were: a quiet text action with its icon, never a boxed chip. A label that is a
 *  model word (a link end's heading) carries its View path. */
function Action({ icon, label, onPress, at, path }: { icon: ReactNode; label: string; onPress: () => void; at: string; path?: string }) {
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onPress() }} className={RECIPE.action} data-model-action={at}>
      {icon}<span data-view={path}>{label}</span>
    </button>
  )
}

/**
 * Whose the card is, in core's words (`cards[].author`); before core sent it, Olumi's own mark's words where core gave one. Olumi's and
 * partly Olumi's carry core's own glyph: the card's mark, else core's key entry for that kind; none is drawn where core gives none.
 */
function Whose({ card, expert, keyEntries }: { card: ViewCard; expert: boolean; keyEntries: ViewModel['key'] }) {
  const W = useModelWords()!
  const a = authorAnyOf(card)
  if (a === null && card.olumi === null) return null
  const glyph = card.olumi?.glyph ?? (a === null ? null : keyEntries.find((k) => k.id === (a.by === 'mixed' ? 'partly_olumi' : 'olumi'))?.glyph ?? null)
  const icon = a?.by === 'person' ? <User aria-hidden="true" className={`${ICON} text-text-light`} />
    : a?.by === 'brief' ? <FileText aria-hidden="true" className={`${ICON} text-text-light`} />
      : glyph === null ? null : <span aria-hidden="true" className="w-3.5 flex-none text-center text-text-light">{glyph}</span>
  return (
    <Section title={W.whose} at="whose">
      <p className="m-0 flex items-baseline gap-1.5 text-text-body">
        {icon}
        {a === null ? <span data-view={`${card.id}.olumi.title`}>{card.olumi!.title}</span> : <span data-view={`${card.id}.author.text`}>{a.text}</span>}
      </p>
      {expert && a !== null && a.title !== '' ? <p className={`${typography.viewPanelMeta} m-0 mt-0.5 break-words pl-5 text-text-light`} data-view={`${card.id}.author.title`}>{a.title}</p> : null}
    </Section>
  )
}

/** The lines that start or end at this card, each pressing to the card at its other end, with core's mark for its kind or sign; Expert adds
 *  its strength. A line's removal and strength editor are on its own row in Relationships. */
function Links({ model, card, expert }: { model: ViewModel; card: ViewCard; expert: boolean }) {
  const W = useModelWords()!
  const lines = linksOf(model, card.id)
  if (lines.length === 0) return null
  return (
    <Section title={W.links} at="links">
      <ul className="m-0 list-none space-y-0.5 p-0">
        {lines.map(({ l, i }) => {
          const out = l.from === card.id, other = out ? l.to : l.from
          return (
            <li key={i}>
              <button type="button" onClick={(e) => { e.stopPropagation(); focusNodeById(other) }} title={l.title} data-model-detail-link={`links.${i}`}
                className={`flex w-full items-start gap-1.5 rounded-sm py-1 text-left text-text-body hover:text-text-header ${ACTION_FOCUS}`}>
                <span role="img" aria-label={out ? W.to : W.from} className="mt-1 flex-none text-text-light">
                  {out ? <ArrowRight aria-hidden="true" className={ICON} /> : <ArrowLeft aria-hidden="true" className={ICON} />}
                </span>
                <span className="min-w-0 flex-1 break-words">
                  <span data-view={linkEndPath(model, other)}>{linkEndHeading(model, other)}</span>
                  {l.label !== '' ? <span className="text-text-light">{' '}<span data-view={`links.${i}.label`}>{l.label}</span></span> : null}
                  {expert && l.effect != null ? <span className={`${typography.viewPanelMeta} block tabular-nums text-text-light`} title={l.effect.title} data-view={`links.${i}.effect.text`}>{l.effect.text}</span> : null}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Section>
  )
}

/** Expert: what would change an option's chance most, in core's words (its driver); the figure's own reading is the row's Expert line. */
function Science({ card }: { card: ViewCard }) {
  const W = useModelWords()!
  if (card.driver === null) return null
  return (
    <Section title={W.whatWouldChange} at="science">
      <p className={`${typography.viewPanelMeta} m-0 break-words text-text-body`} title={card.driver.title} data-view={`${card.id}.driver.text`}>{card.driver.text}</p>
    </Section>
  )
}

export function CardDetail({ model, card }: { model: ViewModel; card: ViewCard }) {
  const W = useModelWords()!
  const expert = useModelTab((s) => s.expert)
  const { base } = useModelEdit()
  const canEdit = base !== null
  const target = canEdit ? targetCardOf(model, card) : null
  return (
    <div id={`model-detail-${card.id}`} role="region" aria-label={card.heading} className="mb-2 ml-8 mr-2 mt-0.5 space-y-2.5" data-model-detail={card.id}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); useModelTab.getState().close(card.id) } }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5" data-model-actions={card.id}>
        {canEdit && card.figure?.edit != null ? <Action at="figure" icon={<Pencil aria-hidden="true" className={ICON} />} label={W.changeFigure} onPress={() => openEditor({ row: card.id, what: 'figure', quantity: card.id })} /> : null}
        {target === null ? null : <Action at="target" icon={<Pencil aria-hidden="true" className={ICON} />} label={card.family === 'limit' ? W.changeLimit : W.changeTarget} onPress={() => openEditor({ row: card.id, what: 'figure', quantity: target.id })} />}
        {canEdit ? <Action at="rename" icon={<Type aria-hidden="true" className={ICON} />} label={W.rename} onPress={() => openEditor({ row: card.id, what: 'rename' }, card.heading)} /> : null}
        <Action at="canvas" icon={<LocateFixed aria-hidden="true" className={ICON} />} label={W.showOnCanvas} onPress={() => focusNodeById(card.id)} />
      </div>
      <AskOlumi at={`change:${card.id}`} label={W.askChange} draft={W.askChangeDraft[card.id]!} />
      <Whose card={card} expert={expert} keyEntries={model.key} />
      <Links model={model} card={card} expert={expert} />
      {expert ? <Science card={card} /> : null}
    </div>
  )
}

/** A link's detail: its two ends (each pressing to its card), and where core offers it, its strength's editor (its row shows the
 *  strength while open, so the action names something on screen in Plain too) and its removal. */
export function LinkDetail({ model, link, row }: { model: ViewModel; link: ViewLink; row: string }) {
  const W = useModelWords()!
  const { base } = useModelEdit()
  const strength = base === null ? null : strengthCardOf(model, link)
  return (
    <div id={`model-detail-${row}`} role="region" aria-label={`${linkEndHeading(model, link.from)} → ${linkEndHeading(model, link.to)}`} className="mb-2 ml-8 mr-2 mt-1 space-y-3" data-model-detail={row}
      onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); useModelTab.getState().close(row) } }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5" data-model-actions={row}>
        {strength === null ? null : <Action at="strength" icon={<Pencil aria-hidden="true" className={ICON} />} label={W.changeStrength} onPress={() => openEditor({ row, what: 'figure', quantity: strength.id })} />}
        <Action at="from" icon={<ArrowLeft aria-hidden="true" className={ICON} />} label={linkEndHeading(model, link.from)} path={linkEndPath(model, link.from)} onPress={() => focusNodeById(link.from)} />
        <Action at="to" icon={<ArrowRight aria-hidden="true" className={ICON} />} label={linkEndHeading(model, link.to)} path={linkEndPath(model, link.to)} onPress={() => focusNodeById(link.to)} />
      </div>
      {base === null ? null : <RemoveLink link={link} row={row} />}
    </div>
  )
}

/**
 * Olumi's change is held: core takes no direct edit until it is approved or set aside (`edit_base` null). Said once, at the head of the tab,
 * with core's heading for it, and a two-step set-aside (the canvas's HeldEditOffer route: `POST …/discard`, nothing in it applied). It is
 * one write of the tab's (`useModelTab.busy`), so a notice drawn again while core has it says so and sends nothing more. If the View read
 * after it fails (one a newer read overtook is that read's to settle), the tab draws no View and says, in the canvas's words, that core set
 * it aside; a refusal that lands while no notice is drawn is said on the tab the same way, and on that change's notice once it is drawn
 * again (never on another change's: it goes once the View no longer holds the change it was about).
 */
export function HeldNotice() {
  const W = useModelWords()!
  const { sid, held } = useModelEdit()
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mounted = useMounted()
  const key = sid === null || held === null ? '' : `${sid}:discard:${held.id}`
  const row = held === null ? null : heldRow(held.id)
  const busy = useModelTab((s) => key !== '' && s.busy === key)
  const refused = useModelTab((s) => (row !== null && s.receipt?.row === row && s.receipt.unseen === undefined ? s.receipt.words : null))
  // A refusal about a change this View no longer holds (decided elsewhere meanwhile) is no one's to read: it goes.
  const moot = useModelTab((s) => s.receipt !== null && s.receipt.row.startsWith(HELD_PREFIX) && s.receipt.unseen === undefined && s.receipt.row !== row)
  useEffect(() => { if (moot) useModelTab.getState().say(null) }, [moot])
  if (held === null || sid === null) return null
  const setItAside = async () => {
    if (useModelTab.getState().busy !== null) return
    const id = held.id
    const here = () => useViewStore.getState().sid === sid
    setError(null); if (refused !== null) useModelTab.getState().say(null)
    useModelTab.getState().setBusy(key)
    try {
      await writes.discard(id)
      const shown = await readAfter(sid, () => useViewStore.getState().refresh(), () => useViewStore.getState().view?.proposal?.id !== id)
      if (shown === 'failed') useModelTab.getState().say({ row: heldRow(id), words: ASIDE_WORDS.notShown, tone: 'failed', unseen: { n: null, view: useViewStore.getState().view } })
      setAsking(false)
    } catch (e) {
      const words = e instanceof TeamApiError ? e.message : W.heldFailed
      if (!here()) return
      if (mounted.current) setError(words); else useModelTab.getState().say({ row: heldRow(id), words, tone: 'failed' })
    } finally {
      if (useModelTab.getState().busy === key) useModelTab.getState().setBusy(null)
    }
  }
  const said = error ?? refused
  return (
    <div className="space-y-2 rounded-lg border border-panel-border bg-panel p-3" data-testid="view-model-held">
      <p className="m-0 text-text-header">{W.heldLead}</p>
      <p className={`${typography.viewPanelMeta} m-0 text-text-light`}><span data-view="proposal.heading">{held.heading}</span> · <span data-view="proposal.on">{held.on}</span></p>
      <p className={`${typography.viewPanelMeta} m-0 text-text-body`}>{W.heldBody}</p>
      {said === null ? null : <p role="alert" className={RECIPE.error} data-testid="view-model-held-error">{said}</p>}
      {asking ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" autoFocus aria-disabled={busy || undefined} onClick={() => void setItAside()} className={RECIPE.secondary} data-testid="view-model-held-confirm">{W.heldConfirm}</button>
          <button type="button" aria-disabled={busy || undefined} onClick={() => { if (!busy) { setAsking(false); setError(null) } }} className={RECIPE.quiet}>{W.heldKeep}</button>
        </div>
      ) : (
        <button type="button" aria-disabled={busy || undefined} onClick={() => { if (!busy) setAsking(true) }} className={RECIPE.action} data-testid="view-model-held-aside">{W.heldAside}</button>
      )}
      {busy ? <p role="status" className={RECIPE.status} data-testid="view-model-held-sending">{W.settingAside}</p> : null}
    </div>
  )
}
