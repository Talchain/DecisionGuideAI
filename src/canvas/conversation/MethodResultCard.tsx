/**
 * The typed rows of a probe's reply, as a card under it (accel P24 / SCI-10): "Test without this link" and "What would
 * change this?". Each row is one of the reply's own lines, verbatim; the heading is the only string the chat does not
 * say. Rows render as plain text nodes, never from the inner `result`.
 *
 * ⛔ HEADINGS ARE SCIENCE-RULED (393023, 7 Oct; AIQ rules the final strings): the comparison card names the
 * COMPARISON, never a goal chance, because its rows are run-share orderings.
 */
import { useMemo } from 'react'
import type { MethodItemRef, MethodResultV1 } from '../../v5/readMethodResult'
import { useCanvasStore } from '../store'
import styles from './Conversation.module.css'

export const METHOD_RESULT_CARD_TESTID = 'message-method-result'

export const WHAT_CHANGES_HEADING = 'What would change the comparison between options, in this model'
/** When the canvas cannot name both ends (the link was removed since, or the labels are absent). AIQ to rule. */
export const TESTED_LINK_HEADING_UNNAMED = 'Tested in this model without this link'
export function testedLinkHeading(from: string, to: string): string {
  return `Tested in this model without the link from ‘${from}’ to ‘${to}’`
}

type LinkRef = Extract<MethodItemRef, { kind: 'link' }>

/** The one link a result's rows are about, or `null` when they name none or more than one. */
export function linkOfMethodResult(m: Pick<MethodResultV1, 'rows'>): LinkRef | null {
  const links = new Map<string, LinkRef>()
  for (const row of m.rows) for (const ref of row.item_refs) if (ref.kind === 'link') links.set(`${ref.from_id}->${ref.to_id}`, ref)
  return links.size === 1 ? [...links.values()][0] : null
}

export function methodResultHeading(m: Pick<MethodResultV1, 'action_id' | 'rows'>, labelOf: (nodeId: string) => string | null): string | null {
  if (m.action_id === 'what_changes') return WHAT_CHANGES_HEADING
  if (m.action_id !== 'test_link') return null
  const link = linkOfMethodResult(m)
  const from = link ? labelOf(link.from_id) : null
  const to = link ? labelOf(link.to_id) : null
  return from && to ? testedLinkHeading(from, to) : TESTED_LINK_HEADING_UNNAMED
}

export function MethodResultCard({ methodResult, labelOf }: {
  /** Already through `displayableMethodResult`: a known action, a figure-bearing outcome, every row in the reply. */
  methodResult: MethodResultV1
  labelOf: (nodeId: string) => string | null
}): JSX.Element | null {
  const heading = methodResultHeading(methodResult, labelOf)
  if (heading === null) return null
  return (
    <div
      className={styles.reasoningPanel}
      role="note"
      aria-label={heading}
      data-testid={METHOD_RESULT_CARD_TESTID}
      data-action-id={methodResult.action_id}
      data-outcome={methodResult.outcome}
    >
      <p className={styles.reasoningPanelHeading} data-testid={`${METHOD_RESULT_CARD_TESTID}-heading`}>{heading}</p>
      <ul className="list-none p-0 m-0" data-testid={`${METHOD_RESULT_CARD_TESTID}-rows`}>
        {methodResult.rows.map((row) => (
          <li
            key={row.row_id}
            className={styles.reasoningPanelBody}
            data-row-id={row.row_id}
            data-item-refs={row.item_refs.map(r => (r.kind === 'link' ? `link:${r.from_id}->${r.to_id}` : `${r.kind}:${r.id}`)).join(' ')}
          >
            {row.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The card as the conversation mounts it: link ends named from the canvas as it is now (InsightsStrip's pattern). */
export function ConversationMethodResultCard({ methodResult }: { methodResult: MethodResultV1 }): JSX.Element | null {
  const nodes = useCanvasStore(s => s.nodes)
  const labels = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of nodes) if (typeof n.data?.label === 'string' && n.data.label.trim()) m.set(n.id, n.data.label)
    return m
  }, [nodes])
  return <MethodResultCard methodResult={methodResult} labelOf={(id) => labels.get(id) ?? null} />
}
