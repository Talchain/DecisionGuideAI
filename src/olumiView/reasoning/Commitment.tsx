/**
 * "Move towards commitment" in the previous tab's place (after Challenge Your Thinking), drawn ONLY from what core's View carries and in its
 * words, nothing composed (DL 11 Nov):
 *   - Still open: core's `run.waits_on` (what the chances wait on), head, text and each item, the item's hover core's;
 *   - Next: the newest reply's next step (`chat[].answer.next`): its label, its words, and the one act core offers on it (`move`, the chat's own tap).
 * "What we have" is the strip above (its counts). Nothing is drawn when core holds neither, so the section never says "nothing open" for core.
 */
import type { View } from '../client'
import { MoveTap, Words } from '../ViewChat'
import { typography } from '../../styles/typography'
import { ZoneTitle } from './parts'

export function Commitment({ view, title }: { view: View; title: string }) {
  const waits = view.model?.run?.waits_on ?? null
  const last = view.chat.length === 0 ? null : view.chat[view.chat.length - 1]!
  const next = last?.answer?.next.newest ? last.answer.next : null
  if (waits === null && next === null) return null
  return (
    <section className="space-y-1" data-testid="view-reasoning-commitment" aria-label={title}>
      <ZoneTitle>{title}</ZoneTitle>
      {waits === null ? null : (
        <div className={`${typography.viewPanelBody} space-y-1`} data-testid="view-reasoning-waits">
          <p data-view="run.waits_on.head">{waits.head}</p>
          <p data-view="run.waits_on.text">{waits.text}</p>
          {waits.items.map((w, i) => <p key={w.id} title={w.title} data-view={`run.waits_on.items.${i}.text`}>{w.text}</p>)}
        </div>
      )}
      {next === null || last === null ? null : (
        <div className={`${typography.viewPanelBody} space-y-1`} data-testid="view-reasoning-next">
          <p><span className={typography.panelHeader} data-view={`chat.${view.chat.length - 1}.answer.next.label`}>{next.label}</span>{' '}<Words parts={next.text} at={`chat.${view.chat.length - 1}.answer.next.text`} /></p>
          <MoveTap turn={last.id} next={next} at={`chat.${view.chat.length - 1}.answer.next`} />
        </div>
      )}
    </section>
  )
}
