/**
 * The 0.70.0 link-row words, ONE module for every reader of a `RunDeltaInputRow` (the Compare tab's What changed, the
 * canvas "Since the last run" card, and the Panel's commitment sentence). Pure: no store, no React.
 * Without it, a reader that formats `before → after` itself prints the raw enum (`olumi_estimate → olumi_accepted`).
 */
import type { StrengthBand } from '@talchain/schemas'
import { CANVAS_STRENGTH_BANDS, type CanvasStrengthBandId } from '../../../canvas/domain/vocabulary'
import { inlineStrengthLabel } from '../../../canvas/domain/strengthBandSpan'
import type { RunDeltaInputRow } from './runDeltaView'

/**
 * A `strength` row's raw is the contract's `StrengthBand` literal (52f8cd #85 5937970750: CEE `strengthBandFromEdgeBand`).
 * It reads in the canvas's ONE band table's words, inline ("moderate → very strong"), never the literal (`very_strong`).
 * Typed `Record<StrengthBand, …>`, so a fifth contract literal fails the typecheck here instead of printing raw.
 */
const BAND_ID: Record<StrengthBand, CanvasStrengthBandId> = {
  very_strong: 'veryStrong',
  strong: 'strong',
  moderate: 'moderate',
  slight: 'slight',
}

export function strengthBandWords(raw: string | null): string | null {
  if (raw === null) return null
  const id = (BAND_ID as Record<string, CanvasStrengthBandId | undefined>)[raw]
  const band = id ? CANVAS_STRENGTH_BANDS.find((b) => b.id === id) : undefined
  return band ? inlineStrengthLabel(band.label) : raw.replace(/_/g, ' ')
}

const SIZING_WORDS: Record<string, string> = {
  user: 'your own estimate',
  placeholder: 'not yet sized',
  olumi_estimate: "Olumi's estimate",
  olumi_accepted: "Olumi's estimate, accepted",
  unmarked: 'not recorded',
}

/**
 * 0.70.0 link rows, in RC's contract words (`RERUN-EXPLANATION.change_label_templates`), by FIELD IDENTITY:
 *   sizing → olumi_accepted   "You accepted Olumi's estimate for how much {from} changes {to}."
 *   sizing → user (+ strength) "You gave your own estimate for how much {from} changes {to}[: {before} → {after}]."
 *   strength alone            "You changed how much {from} changes {to}: {before} → {after}."
 * `null` = not one of these (the generic row wording applies).
 */
export function linkRowText(row: RunDeltaInputRow): string | null {
  if (row.kind !== 'link' || row.change !== 'changed') return null
  const from = row.linkLabels?.from ?? 'one factor'
  const to = row.linkLabels?.to ?? 'another'
  if (row.field === 'sizing') {
    if (row.after === 'olumi_accepted') return `You accepted Olumi's estimate for how much ${from} changes ${to}.`
    if (row.after === 'user') {
      return row.strength
        ? `You gave your own estimate for how much ${from} changes ${to}: ${strengthBandWords(row.strength.before)} → ${strengthBandWords(row.strength.after)}.`
        : `You gave your own estimate for how much ${from} changes ${to}.`
    }
    const b = row.before !== null ? SIZING_WORDS[row.before] ?? row.before : null
    const a = row.after !== null ? SIZING_WORDS[row.after] ?? row.after : null
    return `How much ${from} changes ${to}: ${b} → ${a}`
  }
  if (row.field === 'strength') return `You changed how much ${from} changes ${to}: ${strengthBandWords(row.before)} → ${strengthBandWords(row.after)}.`
  return null
}
