/**
 * V11 change 1, the evidence chain in the dock: one piece of the team's evidence, opened from its mark on a card (./RevealMarks.tsx), as a
 * chain from what was seen to what the model uses. Every model word and value is core's; the step names are the dock's own labels.
 *
 * With core's requested `chain` (./evidence.ts chainOf), each step is core's words and status (claim "Supported", inference "Not
 * established", estimate "unchanged", ...). Until core sends it, what core has: the words and source as given; each card it concerns with
 * that card's figure and the person's stance; and Olumi's reply when asked to consider it (`considered.why`), or the proposal it led to.
 */
import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { OlumiAiIcon } from '../components/results/analysisNew/OlumiAiIcon'
import { STANCES, linkOf } from '../olumiCore/team/EvidencePanel'
import { AVATAR, BODY, CARD, H, META } from '../olumiCore/team/ui'
import type { View } from './client'
import { chainOf, type ChainStep, type Evidence } from './evidence'
import { cardOfQuantity, openChipOf, revealOf, useReveal } from './reveal'
import { useReturnFocus } from './RevealDock'

const initial = (by: string) => (Array.from(by)[0] ?? '').toUpperCase()

/** The dock's own names for the four steps (Paul's V11: observation → claim → causal inference → model estimate). */
const STEP: Record<ChainStep['level'], string> = {
  observation: 'What was seen',
  claim: 'What it supports',
  inference: 'What it would imply',
  estimate: 'What the model uses',
}

/** True when the dock should draw the open evidence: one is open and the View holds it. */
export function evidenceDockShown(view: View | null, open: number | null): boolean {
  return open !== null && view !== null && !view.gated && view.evidence.some((e) => e.id === open)
}

function Step({ label, children, at }: { label: string; children: ReactNode; at: string }): JSX.Element {
  return (
    <li className="grid gap-1.5" data-evidence-step={at}>
      <p className={`${META} font-medium`}>{label}</p>
      {children}
    </li>
  )
}

/** What was seen: the person, their words, and the source (a link only where core gives one). */
function Seen({ e }: { e: Evidence }): JSX.Element {
  // Only a plain web address core gives is a link (the Team tab's own rule).
  const link = e.link === null ? null : linkOf(e.link)
  return (
    <div className={CARD} data-testid="evidence-dock-seen">
      <p className={`${BODY} flex items-center gap-2 font-medium text-text-header`}><span aria-hidden="true" className={AVATAR}>{initial(e.by)}</span>{e.by}</p>
      <p className={`${BODY} whitespace-pre-wrap break-words`} data-testid="evidence-dock-words">{e.text}</p>
      {e.source === null ? null : link !== null
        ? <a className={`${META} break-all underline underline-offset-2 hover:text-text-body`} href={link} target="_blank" rel="noreferrer noopener" data-testid="evidence-dock-source">{e.source}</a>
        : <p className={`${META} break-words`} data-testid="evidence-dock-source">{e.source}</p>}
    </div>
  )
}

/** Core's chain, step by step, each in core's words with its status; the card a step sits on by its heading. */
function Chain({ view, e, steps }: { view: View; e: Evidence; steps: readonly ChainStep[] }): JSX.Element {
  const heading = (id: string | null) => (id === null ? null : view.model?.cards.find((c) => c.id === id)?.heading ?? null)
  return (
    <ol className="m-0 grid list-none gap-4 p-0" data-testid="evidence-dock-chain">
      {steps.map((st, i) => (
        <Step key={i} label={STEP[st.level]} at={st.level}>
          {st.level === 'observation' ? <Seen e={e} /> : (
            <div className={`${CARD} gap-1.5`}>
              {heading(st.card) === null ? null : <p className={`${META} text-text-header`}>{heading(st.card)}</p>}
              <p className={BODY}>{st.text}</p>
              {st.status === null ? null : <p className={`${META} font-medium text-text-header`} data-evidence-status="">{st.status}</p>}
            </div>
          )}
        </Step>
      ))}
    </ol>
  )
}

/**
 * Without core's chain: each record it concerns by core's own label for it (`collab.records`), the card it sits on beneath when that is
 * another card (an option's own figure sits on the option), the card's figure when the record is the card itself, and the person's stance.
 */
function BearsOn({ view, e }: { view: View; e: Evidence }): JSX.Element | null {
  const rows = e.concerns.flatMap((id) => {
    const at = cardOfQuantity(view, id), card = at === null ? null : view.model?.cards.find((k) => k.id === at) ?? null
    const label = view.collab.records.find((r) => r.id === id)?.label ?? card?.heading ?? null
    return label === null ? [] : [{ id, label, card }]
  })
  if (rows.length === 0) return null
  const stance = STANCES.find((s) => s.value === e.stance)?.words ?? null
  return (
    <div className={`${CARD} gap-2`} data-testid="evidence-dock-bears">
      {rows.map(({ id, label, card }) => (
        <div key={id} className="grid gap-0.5" data-evidence-record={id} data-evidence-card={card?.id}>
          <p className={`${BODY} font-medium text-text-header`}>{label}</p>
          {card === null ? null : card.id === id
            ? (card.figure === null ? null : <p className={META} title={card.figure.title}>{card.figure.text}</p>)
            : <p className={META}>{card.heading}</p>}
        </div>
      ))}
      {stance === null ? null : <p className={`${META} text-text-header`} data-testid="evidence-dock-stance">{e.by}: {stance}</p>}
    </div>
  )
}

/** What Olumi made of it: its reply when asked to consider it, in its words; or the proposal it led to, by the proposal's own heading. */
function Considered({ view, e }: { view: View; e: Evidence }): JSX.Element | null {
  const c = e.considered
  if (c == null) return null
  const proposal = c.proposal !== null && view.proposal?.id === c.proposal ? view.proposal : null
  const text = c.why?.text ?? proposal?.heading ?? null
  if (text === null) return null
  return (
    <p className={`${BODY} flex items-start gap-2`} title={c.why?.title} data-testid="evidence-dock-considered">
      <OlumiAiIcon size={16} aria-hidden="true" className="mt-[3px] flex-none" />
      <span className="whitespace-pre-wrap break-words">{text}</span>
    </p>
  )
}

/** The other evidence core gathers in the same chip ("Priya and Tom added evidence"): each opens in its bringer's name. */
function AlsoHere({ view, e, card, chip, ids }: { view: View; e: Evidence; card: string; chip: string; ids: readonly number[] }): JSX.Element | null {
  const select = useReveal((s) => s.selectEvidence)
  const rest = ids.flatMap((id) => { const x = view.evidence.find((y) => y.id === id); return x === undefined || x.id === e.id ? [] : [x] })
  if (rest.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="evidence-dock-also">
      {rest.map((x) => (
        <button key={x.id} type="button" data-evidence-also={x.id} onClick={() => select(x.id, card, chip)}
          className={`${META} inline-flex min-h-6 cursor-pointer items-center gap-1.5 text-text-body underline underline-offset-2 hover:text-text-header`}>
          <span aria-hidden="true" className={AVATAR}>{initial(x.by)}</span>{x.by}’s evidence
        </button>
      ))}
    </div>
  )
}

export function EvidenceDock({ view }: { view: View }): JSX.Element | null {
  const at = useReveal((s) => s)
  const open = at.evidence
  const head = useRef<HTMLHeadingElement>(null)
  const returning = useReturnFocus(open)
  useEffect(() => { if (open !== null) head.current?.focus() }, [open])
  const e = view.evidence.find((x) => x.id === open) ?? null
  if (e === null) return null
  const close = () => returning(() => at.selectEvidence(null))
  const chip = openChipOf(revealOf(view), at)
  const steps = chainOf(e)
  return (
    <section data-testid="evidence-dock" aria-label="Evidence" className="grid min-h-full content-start gap-5">
      <div className="flex items-center justify-between gap-2">
        <h2 ref={head} tabIndex={-1} className={`${H} outline-none`} data-testid="evidence-dock-heading">Evidence</h2>
        <button type="button" aria-label="Close" data-testid="evidence-dock-close" onClick={close}
          className="inline-grid h-7 w-7 cursor-pointer place-items-center rounded-full text-text-light hover:bg-panel-hover hover:text-text-header">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      {steps !== null ? <Chain view={view} e={e} steps={steps} /> : (
        <ol className="m-0 grid list-none gap-4 p-0" data-testid="evidence-dock-plain">
          <Step label={STEP.observation} at="observation"><Seen e={e} /></Step>
          <Step label="What it bears on" at="bears"><BearsOn view={view} e={e} /></Step>
        </ol>
      )}
      <Considered view={view} e={e} />
      {chip === null ? null : <AlsoHere view={view} e={e} card={chip.card} chip={chip.key} ids={chip.evidence} />}
    </section>
  )
}
