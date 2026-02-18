/**
 * normaliseGoalLabel — strips redundant leading verbs from goal labels.
 *
 * CEE goal labels often start with a verb like "Achieve 800 Pro Customers".
 * When the hero template already provides "To achieve ...", the verb duplicates:
 * "To achieve Achieve 800 Pro Customers". This utility removes the known leading
 * verb so the result reads naturally: "To achieve 800 Pro Customers".
 *
 * Strips verbs that are semantically equivalent to "achieve" plus
 * optimisation verbs (maximise/minimize etc.) that also duplicate the template.
 */

/** Verbs to strip (case-insensitive). Multi-word entries must come before single-word prefixes. */
const LEADING_VERBS = [
  'to achieve',
  'get to',
  'grow to',
  'achieve',
  'maximise',
  'maximize',
  'minimise',
  'minimize',
  'reach',
  'hit',
  'attain',
  'deliver',
  'get',
]

/**
 * Strip a known leading verb from a goal label.
 *
 * @param label — raw goal label from CEE (may be null/undefined/empty)
 * @returns cleaned label with leading verb removed, or original label if no match
 */
export function normaliseGoalLabel(label: string | null | undefined): string {
  if (!label) return ''
  const trimmed = label.trim()
  if (!trimmed) return ''

  for (const verb of LEADING_VERBS) {
    // Case-insensitive prefix match followed by whitespace
    if (trimmed.toLowerCase().startsWith(verb + ' ')) {
      return trimmed.slice(verb.length).trimStart()
    }
  }

  // No known verb — return as-is
  return trimmed
}
