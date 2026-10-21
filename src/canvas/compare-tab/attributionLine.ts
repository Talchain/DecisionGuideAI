/**
 * "Which edit moved which chance" (DL lease and wording, 21 Oct 2026): where CEE says the pair is ATTRIBUTABLE
 * (`attribution_case: C1_attributable`) and its input record is COMPLETE, the recorded changes and the chance moves they
 * explain, in one line:
 *
 *   "Changed since the earlier run: <row>. With that change, Option B's chance of meeting your goal in this model moved
 *    from about 61% to about 50%."
 *
 * Several recorded changes are listed and the movement is said "with those changes", never pinned on one change: CEE
 * attributes the movement to the recorded change SET, not each change to an option. The changes are worded by the rows'
 * own sentence (`inputRowSentence`, the words the "What changed in the model" rows say), and the chances are the gate's
 * words (`pairChanceFigures`); an option is named as having moved only where those words differ. No difference is
 * computed. Anything else (not C1, partial or unrecorded coverage, no rows, nothing moved) → null, and today's lines stand.
 */
import type { RunDeltaView } from '../../components/results/analysisNew/runDeltaView'
import { inputRowSentence } from '../../components/results/analysisNew/sections/WhatsChanged'
import type { PairChanceFigures } from '../runView/runView'

export interface AttributionLine {
  readonly changes: readonly string[]
  readonly movement: string
  readonly text: string
}

export function attributionLine(view: RunDeltaView, chances: PairChanceFigures | null): AttributionLine | null {
  const rows = view.inputs?.rows ?? []
  if (!view.attributable || view.inputs?.coverage !== 'complete' || rows.length === 0) return null
  if (chances === null || chances.notCurrent) return null
  const moved = chances.rows.filter(r => r.earlier !== null && r.now !== null && r.earlier.words !== r.now.words)
  // Every moved option is named by its own label, or no line at all (never "An option").
  if (moved.length === 0 || moved.some(r => r.label === null)) return null
  const changes = rows.map(row => inputRowSentence(row))
  const movement = moved.length === 1
    ? `${moved[0].label}'s chance of meeting your goal in this model moved from ${moved[0].earlier!.words} to ${moved[0].now!.words}`
    : `the chances of meeting your goal in this model moved: ${moved.map(r => `${r.label} from ${r.earlier!.words} to ${r.now!.words}`).join('; ')}`
  const text = `Changed since the earlier run: ${changes.join('; ')}. With ${changes.length === 1 ? 'that change' : 'those changes'}, ${movement}.`
  return { changes, movement, text }
}
