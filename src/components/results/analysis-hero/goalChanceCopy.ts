/**
 * ⭐ D3 MILESTONE 1, STEP 2 — THE GOAL-CHANCE HEADLINE'S WORDS (Wording c6 #87 6005196947, amendment 6005256134, and the
 * 6 Oct rulings for the no-superlative headline; DL 0df0e1 6005048156). Each sentence is SELECTED by the `form` CEE
 * decided (`readGoalChanceLicence`, by identity) and FILLED with the option labels, the percentage CEE stored for each
 * option and the target as the user stated it. Nothing here compares a number.
 *
 * Every line is model-relative ("In this model, on current information") and says "chance of MEETING your goal" —
 * never "reaching" (`goalFigureSaysModelRuns` bans it, DL 6005048156 + c6 6005196947), never a contest word.
 */
import type { GoalChanceLicence } from '../utils/goalChanceLicence'
import { shortfallNoteLabel } from '../utils/goalChanceLicence'
import { GOAL_CHANCE_LABEL } from '../utils/goalAnchorCopy'
import { goalChanceTargetBound, readGoalChanceByDate, type GoalChanceTarget } from '../utils/goalChanceTarget'
import type { GoalChanceRangeEntry } from '../utils/goalChanceRange'
import type { CanonicalGoalChanceDetail } from '../../../canvas/runView/canonicalAnalysisView'

/** Date words use UTC so the producer's calendar day cannot shift with the viewer's timezone. */
function shareByDateWords(target: GoalChanceTarget | undefined): { deliverable: string; date: string } | null {
  if (target === undefined || !target.unit.startsWith('% of ') || target.unit.slice(5).trim() === ''
    || readGoalChanceByDate(target.by_date) === undefined) return null
  return {
    deliverable: target.unit.slice(5),
    date: new Date(`${target.by_date}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
    }),
  }
}

/** The target as the user stated it, in their unit and its own frame: "at most 400 cancellations/month" (`goalChanceTargetBound`). */
export function goalChanceTargetWords(licence: GoalChanceLicence): string | null {
  const share = shareByDateWords(licence.target)
  if (share !== null) return `${share.deliverable} done by ${share.date}`
  return goalChanceTargetBound(licence.target)
}

/** "a and b" / "a, b and c" — British, no serial comma. */
const listOf = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`

/**
 * The headline for a licensed Run, or `null` when a label, the target or a quoted figure cannot be said (the surface then
 * keeps the headline it had). `labelOf` returns the option's display label, or null. `wordsOf` is the authority gate's
 * words for an option's figure (`RunView.chanceFigureOf`), never the licence's own number (#2747 re-scope).
 */
function unlabelledGoalChanceHeadline(licence: GoalChanceLicence, labelOf: (optionId: string) => string | null, wordsOf: (id: string) => string | null): string | null {
  const target = goalChanceTargetWords(licence)
  if (target === null) return null
  const figure = (id: string): string => wordsOf(id) ?? ''
  const quoted = licence.form === 'highest' ? [licence.leaderOptionId!, licence.nextOptionId!]
    : licence.form === 'highest_all_likely_to_miss' ? [licence.leaderOptionId!]
    : licence.form === 'similar' ? licence.similarOptionIds : []
  if (quoted.some(id => wordsOf(id) === null)) return null
  const lead = 'In this model, on current information,'
  switch (licence.form) {
    case 'highest': {
      const leader = labelOf(licence.leaderOptionId as string)
      const next = labelOf(licence.nextOptionId as string)
      if (leader === null || next === null) return null
      return `${lead} ‘${leader}’ has the highest chance of meeting your goal (${target}): `
        + `${figure(licence.leaderOptionId as string)}, against ${figure(licence.nextOptionId as string)} for ‘${next}’.`
    }
    case 'highest_all_likely_to_miss': {
      const leader = labelOf(licence.leaderOptionId as string)
      if (leader === null) return null
      return `${lead} every option is more likely to miss your goal (${target}) than meet it: `
        + `the highest chance is ${figure(licence.leaderOptionId as string)}, for ‘${leader}’.`
    }
    case 'all_likely_to_miss':
      return `${lead} every option is more likely to miss your goal (${target}) than meet it.`
    case 'similar': {
      // H2 (DL 0df0e1 6 Oct, below 10 points; c6 6 Oct: "similar", never "about the same" — 43 vs 48 is not the same): the
      // options in CEE's order, the figures in the same order, never one singled out.
      const labels = licence.similarOptionIds.map((id) => labelOf(id))
      if (labels.some((l) => l === null)) return null
      const named = listOf(labels.map((l) => `‘${l}’`))
      const figures = listOf(licence.similarOptionIds.map((id) => figure(id)))
      return `${lead} ${named} have similar chances of meeting your goal (${target}): ${figures}.`
    }
    case 'each':
      return `${lead} each option’s chance of meeting your goal (${target}):`
  }
}

/**
 * The shared renderer reads the Run's RC4 counts, never a count of current canvas links. Recovery Batch C (C CEE
 * amendment 7): Olumi's estimated starting values, and an option's own Olumi settings on that option's line, make the
 * chance provisional too, said in CEE's words (`olumiEstimateWords`): "1 starting value, 2 option settings and 3
 * relationships".
 */
function estimateLinkAttribution(licence: GoalChanceLicence, optionId?: string): string {
  const part = (n: number | undefined, one: string, many: string): string[] => (n !== undefined && n > 0 ? [`${n} ${n === 1 ? one : many}`] : [])
  const parts = [...part(licence.olumiEstimateValueCount, 'starting value', 'starting values'),
    ...part(optionId === undefined ? undefined : licence.olumiEstimateSettingsByOption?.[optionId], 'option setting', 'option settings'),
    ...part(licence.olumiEstimateLinkCount, 'relationship', 'relationships')]
  if (parts.length === 0) return ''
  const words = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
  return `, using Olumi's estimates for ${words} (see Check estimates)`
}

export function goalChanceHeadline(licence: GoalChanceLicence, labelOf: (optionId: string) => string | null, wordsOf: (id: string) => string | null,
  chanceWords?: string | null): string | null {
  // Recovery Batch C (rulings 18 to 22): when the Run's licence carries its own words for what the chance is a chance OF
  // (a change from today, several targets), they replace "chance of meeting your goal (target)", whose target words would
  // misstate a change as a level. Every form is then said as each option's chance; no summary is composed here.
  const text = chanceWords ? `In this model, on current information, each option’s ${chanceWords}:`
    : unlabelledGoalChanceHeadline(licence, labelOf, wordsOf)
  const attribution = estimateLinkAttribution(licence)
  if (text === null || attribution === '') return text
  return text.endsWith(':') ? `${text.slice(0, -1)}${attribution}:` : `${text.slice(0, -1)}${attribution}.`
}

/**
 * Recovery Batch C: the Run's goal-chance detail as the screen says it, in CEE's order and words
 * (`goalChanceNotesForAgent`): with several targets, the joint's withheld line and its bound, then each target on its own;
 * the status quo by assumption; then the licence's disclosures. A licensed joint adds no line here (each option's cell
 * already says it). An option with no sayable label is left out of a target's line, as CEE does.
 */
export type GoalChanceDetailLine = { readonly kind: 'joint_withheld' | 'joint_bound' | 'target' | 'status_quo' | 'note'; readonly text: string }

export function goalChanceDetailLines(
  detail: CanonicalGoalChanceDetail, labelOf: (optionId: string) => string | null,
  /** True when the status-quo option's own cell already says CEE's status-quo line (its "Why?"): it is not said twice. */
  statusQuoSaidByItsCell = false,
): GoalChanceDetailLine[] {
  const lines: GoalChanceDetailLine[] = []
  const targets = detail.targets
  if (targets !== undefined) {
    if (targets.joint.status === 'withheld') {
      lines.push({ kind: 'joint_withheld', text: targets.joint.line })
      if (targets.joint.frechet_line !== undefined) lines.push({ kind: 'joint_bound', text: targets.joint.frechet_line })
    }
    for (const t of targets.per_target) {
      const each = t.options.flatMap((o) => {
        const label = labelOf(o.option_id)
        return label === null || label.trim() === '' ? [] : [`‘${label}’ ${o.display}`]
      })
      if (each.length > 0) lines.push({ kind: 'target', text: `On its own, the chance of ${t.words}, in this model: ${each.join('; ')}.` })
    }
  }
  if (detail.status_quo !== undefined && !statusQuoSaidByItsCell) lines.push({ kind: 'status_quo', text: detail.status_quo.line })
  for (const note of detail.notes ?? []) lines.push({ kind: 'note', text: note })
  return lines
}

/**
 * c6's per-option line (or, for an option CEE withheld for its own path, c6's withheld line), in the MODEL'S option order (`licence.optionIds`) — never sorted by chance: below the 10-point
 * licence a sort is a ranking the Run does not grant. `null` when any label cannot be said.
 * `includeQuotedDrivers` keeps a named driver's line for a quoted option, without repeating its headline percentage.
 */
/** The spread note as the card says it (CEE decides where it applies; `spreadNoteOptionIds`). */
export const GOAL_CHANCE_SPREAD_NOTE =
  'Its typical result falls short of your target: this chance comes from its wider spread, which also means it could fall further short.'

export function goalChanceOptionLines(
  licence: GoalChanceLicence, labelOf: (optionId: string) => string | null,
  /** The authority gate's words for each option's figure (`RunView.chanceFigureOf`); null: the set cannot be said. */
  wordsOf: (optionId: string) => string | null,
  except: readonly string[] = [],
  driverLines: Readonly<Record<string, string>> = {},
  includeQuotedDrivers = false,
  cellOf?: (id: string) => { readonly kind: 'figure' | 'range' | 'withheld' | 'none'; readonly text: string | null },
  /** Recovery Batch C (#2747 r1): the Run's own words for what the chance is OF, and its status quo, from its licence. */
  batchC?: { readonly chanceWords?: string; readonly statusQuo?: { readonly option_id: string; readonly line: string } },
): string[] | null {
  const lines: string[] = []
  for (const id of licence.optionIds) {
    if (cellOf) {
      const label = labelOf(id)
      if (label === null || label.trim() === '') continue
      const cell = cellOf(id)
      if (label.trim() !== '' && cell.text !== null) {
        const prefix = `‘${label}’: `
        lines.push(cell.text.startsWith(prefix) ? cell.text : prefix + cell.text)
      }
      continue
    }
    if (except.includes(id)) {
      const driver = driverLines[id]
      if (includeQuotedDrivers && driver !== undefined) {
        const label = labelOf(id)
        if (label === null) return null
        lines.push(`‘${label}’: ${driver}`)
      }
      continue
    }
    const label = labelOf(id)
    if (label === null) return null
    // c6 (6 Oct): an option withheld for its own path keeps its place, and says so — never "unknown", never "0%".
    if (licence.withheldOptionIds.includes(id)) {
      lines.push(batchC?.statusQuo?.option_id === id ? batchC.statusQuo.line
        : batchC?.chanceWords ? `‘${label}’: Olumi can’t yet say its ${batchC.chanceWords}, in this model.`
          : `‘${label}’: Olumi can’t yet say its chance of meeting your goal, in this model.`)
      continue
    }
    // P3: what this option's chance rests on most follows its own line, when CEE named one that can be worded.
    const driver = driverLines[id]
    const share = shareByDateWords(licence.target)
    const chance = batchC?.chanceWords ? `${batchC.chanceWords}, in this model`
      : share === null ? GOAL_CHANCE_LABEL : `${shareChanceWords(share)}, in this model`
    // Science 393023 (1): CEE's spread note follows the chance it qualifies, before the driver. Worded by identity; the
    // card never says "see its downside", because a downside is not always beside this line.
    const spread = licence.spreadNoteOptionIds?.includes(id) === true ? ` ${GOAL_CHANCE_SPREAD_NOTE}` : ''
    // B19 (Science 393023 (3)): CEE's shortfall sentence follows the spread note, verbatim, only when it names THIS label.
    const note = licence.shortfallNoteByOption?.[id]
    const shortfall = note !== undefined && shortfallNoteLabel(note) === label ? ` ${note}` : ''
    const words = wordsOf(id)
    if (words === null) return null
    lines.push(`‘${label}’: ${words} ${chance}${estimateLinkAttribution(licence, id)}.${spread}${shortfall}`
      + (driver === undefined ? '' : ` ${driver}`))
  }
  return lines
}

/** CEE `deliverableIsALaunch` twin (#2762 r6, the closed whole-deliverable grammar, copied from CEE
 * share-goal-chance-words.ts): "[the|our|a] (≤2 modifiers) launch [in|across <place>]" or "launching <the|our|a> ≤2 words";
 * anything else says "finishing <deliverable> by". */
const ARTICLES = new Set(['the', 'our', 'a'])
const PREPOSITIONS_AND_CONJUNCTIONS = new Set([
  'aboard', 'about', 'above', 'absent', 'across', 'after', 'against', 'albeit', 'along', 'alongside', 'although',
  'amid', 'amidst', 'among', 'amongst', 'and', 'around', 'as', 'astride', 'at', 'atop', 'barring', 'because',
  'before', 'behind', 'below', 'beneath', 'beside', 'besides', 'between', 'beyond', 'both', 'but', 'by', 'circa',
  'concerning', 'considering', 'despite', 'down', 'during', 'either', 'except', 'excepting', 'excluding',
  'following', 'for', 'from', 'given', 'if', 'in', 'including', 'inside', 'into', 'lest', 'like', 'minus', 'near',
  'neither', 'nor', 'notwithstanding', 'of', 'off', 'on', 'once', 'onto', 'opposite', 'or', 'out', 'outside',
  'over', 'past', 'pending', 'per', 'plus', 'provided', 'providing', 'regarding', 'respecting', 'round', 'save',
  'since', 'so', 'supposing', 'than', 'that', 'though', 'through', 'throughout', 'till', 'to', 'touching',
  'toward', 'towards', 'under', 'underneath', 'unless', 'unlike', 'until', 'unto', 'up', 'upon', 'versus', 'via',
  'when', 'whenever', 'where', 'whereas', 'wherever', 'whether', 'while', 'with', 'within', 'without', 'yet',
])
const WORD = /^[\p{L}][\p{L}\p{N}]*(?:[-'’][\p{L}\p{N}]+)*$/u
const isWord = (word: string): boolean => WORD.test(word) && !/^(?:pre|post)-/u.test(word)
const isModifier = (word: string): boolean => isWord(word) && !PREPOSITIONS_AND_CONJUNCTIONS.has(word)

/** A closed whole-deliverable grammar; an unrecognised phrase keeps the full finishing wording. */
function deliverableIsALaunch(deliverable: string): boolean {
  const words = deliverable.trim().toLowerCase().split(/\s+/u)
  if (words[0] === 'launching') {
    const object = words.slice(2)
    return ARTICLES.has(words[1] ?? '') && object.length <= 2 && object.every(isModifier)
  }
  const launch = words.indexOf('launch')
  if (launch < 0) return false
  const modifiers = words.slice(ARTICLES.has(words[0] ?? '') ? 1 : 0, launch)
  if (modifiers.length > 2 || !modifiers.every(isModifier)) return false
  const place = words.slice(launch + 1)
  return place.length === 0 || ((place[0] === 'in' || place[0] === 'across')
    && place.length >= 2 && place.length <= 4 && place.slice(1).every(isWord))
}

/**
 * The ruled share-by-date words (DL #2762 r3, CEE `shareGoalChanceWords` twin): a deliverable that names a launch reads
 * "chance of launching by <date>"; any other reads "chance of finishing <deliverable> by <date>".
 */
function shareChanceWords(share: { readonly deliverable: string; readonly date: string }): string {
  return deliverableIsALaunch(share.deliverable)
    ? `chance of launching by ${share.date}`
    : `chance of finishing ${share.deliverable} by ${share.date}`
}

export const GOAL_CHANCE_RANGE_ACTION: Readonly<Record<Exclude<GoalChanceRangeEntry['kind'], 'stated_time'>, string>> = {
  link_strength: 'Size it to see where it lands',
  link_existence: 'Confirm or remove it to see where it lands',
}
