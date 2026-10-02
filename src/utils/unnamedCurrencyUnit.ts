/**
 * ⭐ AN UNNAMED CURRENCY, SAID IN WORDS: never the drafter's placeholder (MG owner ruling, #85 5943427770).
 *
 * CEE's drafter schema offers the money template "<currency>/<period>". On a brief that names no currency the drafter
 * copies the placeholder word itself, so a goal can hold `goal_threshold_unit: "currency/quarter"`. That is BY DESIGN on
 * the producer side ("money, currency not named"; CEE `orchestrator-v5/agent-lane/unnamed-currency.ts`), and the level
 * door replaces the head when the user names one ("currency/quarter" + £ → "£/quarter"). The UI's job is DISPLAY: never
 * print the placeholder raw ("More currency/quarter →", served D1, R3 dock-scan 5943368038), and never invent a currency.
 *
 * ⛔ MIRRORS CEE's predicate, structurally: the unit's head (the leading token before a space or "/") is the placeholder
 * word "currency" or "<currency>", any case. Never true for a named currency ("GBP per quarter", "£/quarter") or a word
 * that merely contains it ("cryptocurrency", "currencies").
 */

/**
 * ⛔ COPIED VERBATIM from CEE `src/orchestrator-v5/agent-lane/unnamed-currency.ts` @ `0ec3f0b4887241b890dc658f565427d2ccda6883`
 * (lines 18 and 24). A producer's predicate is a contract: `unnamedCurrencyUnit.spec.ts` pins these exact sources, so
 * an edit here goes RED. When CEE changes its literals, re-copy them and re-cite the sha.
 */
export const PLACEHOLDER_HEAD = /^<?currency>?$/i
/** The placeholder head, one "/", one word (CEE TEMPLATE_FORM). */
export const TEMPLATE_FORM = /^(<currency>|currency)\/([^\s/]+)$/i
/** The period words this display names ("per quarter"); anything else is not named. */
const PERIODS = new Set(['day', 'week', 'month', 'quarter', 'year'])

function unitHead(unit: string): string | null {
  const head = unit.trim().split(/[\s/]/)[0]
  return head ? head : null
}

/** Is this unit the drafter's money template with NO currency named? */
export function isUnnamedCurrencyUnit(unit: unknown): boolean {
  if (typeof unit !== 'string') return false
  const head = unitHead(unit)
  return head !== null && PLACEHOLDER_HEAD.test(head)
}

/**
 * The words that stand in for an unnamed-currency unit: "per quarter (currency not given)" for the exact template with a
 * plain period, else "(currency not given)". `null` for any other unit (print it as before).
 */
export function unnamedCurrencyWords(unit: unknown): string | null {
  if (!isUnnamedCurrencyUnit(unit)) return null
  const period = TEMPLATE_FORM.exec((unit as string).trim())?.[2]?.toLowerCase()
  return period && PERIODS.has(period) ? `per ${period} (currency not given)` : '(currency not given)'
}
