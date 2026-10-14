/**
 * Compare's "not shown" reason line with its named links pressable (DL 7 Oct, Paul on prod: the line said "Set them"
 * and gave no way to). The sentence is still the shared one (`selectWinShareWithheldReason` → `goalPathUnsizedCause`);
 * this only finds, in that exact text, each link phrase the sentence names ("from ‘A’ to ‘B’", Science's phrasing) and
 * pairs it with the link's two ends from the same Run's `GOAL_FIGURES_PLACEHOLDER_PATH` warning. Joined back, the
 * segments are the sentence character for character; a phrase it cannot find stays plain text.
 */
import { unsizedLinksOf } from '../../components/results/analysisNew/analysisNewCopy'

export type ReasonSegment = { text: string; link?: { fromId: string; toId: string } }

/** The label as the shared sentence prints it (`nameLinks`: trimmed, 1 to 120 characters), or null when it names none. */
function shownLabel(raw: string | null | undefined): string | null {
  const text = typeof raw === 'string' ? raw.trim() : ''
  return text.length > 0 && text.length <= 120 ? text : null
}

export function withheldReasonSegments(
  reason: string,
  inferenceWarnings: unknown,
  labelOf: (nodeId: string) => string | null | undefined,
): ReasonSegment[] {
  const segments: ReasonSegment[] = []
  let rest = reason
  for (const link of unsizedLinksOf(inferenceWarnings)) {
    const from = shownLabel(labelOf(link.from))
    const to = shownLabel(labelOf(link.to))
    if (from === null || to === null) continue
    const phrase = `from ‘${from}’ to ‘${to}’`
    const at = rest.indexOf(phrase)
    if (at < 0) continue
    if (at > 0) segments.push({ text: rest.slice(0, at) })
    segments.push({ text: phrase, link: { fromId: link.from, toId: link.to } })
    rest = rest.slice(at + phrase.length)
  }
  if (rest.length > 0) segments.push({ text: rest })
  return segments
}
