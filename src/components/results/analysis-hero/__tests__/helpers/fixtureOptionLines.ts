/**
 * SELF-AUTHORED FIXTURE WORDS, never served evidence and never production copy. #2747 re-scope 2 round 2 deleted
 * `goalChanceOptionLines` from production (it lost its last caller when the chat card moved to CEE's served cells, and it
 * composed "chance of meeting your goal" lines of its own). `canonicalTestCells` still needs SOME per-option sentence to put
 * in a synthetic canonical cell's `face`; this is that sentence generator, moved here verbatim from 369c17d0 so the fixtures
 * that compare a surface's text with its cell's text keep their words. No production module may import it.
 */
import type { GoalChanceLicence } from '../../../utils/goalChanceLicence'
import { shortfallNoteLabel } from '../../../utils/goalChanceLicence'
import { GOAL_CHANCE_LABEL } from '../../../utils/goalAnchorCopy'
import { readGoalChanceByDate, type GoalChanceTarget } from '../../../utils/goalChanceTarget'

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

/**
 * c6's per-option line (or, for an option CEE withheld for its own path, c6's withheld line), in the MODEL'S option order (`licence.optionIds`) — never sorted by chance: below the 10-point
 * licence a sort is a ranking the Run does not grant. `null` when any label cannot be said.
 * `includeQuotedDrivers` keeps a named driver's line for a quoted option, without repeating its headline percentage.
 */
/** The spread note as the card says it: CEE's served without-downside sentence (`spreadNoteByOption`), verbatim. */
export const FIXTURE_SPREAD_NOTE =
  'Its typical result falls short of your target: this chance comes from its wider spread, which also means it could fall further short.'

export function fixtureOptionLines(
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
    const served = licence.spreadNoteByOption?.[id]
    const spread = served === FIXTURE_SPREAD_NOTE ? ` ${served}` : ''
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
