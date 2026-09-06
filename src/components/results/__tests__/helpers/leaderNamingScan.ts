/**
 * ⭐⭐ THE CLASS INSTRUMENT: "does this view model NAME an option anywhere?"
 *
 * Three PRs in one week each fixed ONE surface that asserted a leader the run
 * did not license. Each fix was correct and each was a per-field gate, so the
 * NEXT field added to the same model inherited nothing. A per-field guard is a
 * hand-maintained mirror of the model's shape — the defect this estate keeps
 * paying for — and the field that broke the rule was always the one nobody
 * remembered to add to the list.
 *
 * So this scanner takes NO list of fields. It walks the whole view model and
 * applies ONE derived rule:
 *
 *   ⭐ A PER-OPTION RECORD MAY CARRY ITS OWN IDENTITY. NOTHING ELSE MAY NAME
 *     AN OPTION.
 *
 * A "per-option record" is derived, not enumerated: any object whose own `id`
 * is one of the analysed option ids. Inside such a record, a string equal to
 * that record's OWN id or OWN label is DATA (the row has to be able to say
 * which option it is). Everywhere else — and for any OTHER option's identity
 * even inside a record — a string that
 *
 *   · equals an option id            is a POINTER designation (`leaders.goal`)
 *   · equals an option label         is a bare NAME
 *   · contains an option label       is PROSE that names it (a headline)
 *
 * is a violation. A field added tomorrow is covered the day it is added,
 * whatever it is called.
 *
 * ## The failure direction is LOUD, deliberately
 *
 * A future per-option record that keys its identity off something other than
 * `id` (say `optionId`) will not be recognised as a record, so its own label
 * reads as a violation and the guard REDs. That is the correct direction: a
 * human adjudicates a red, and nobody ever adjudicates a silent green.
 *
 * ## What it CANNOT see (stated, so nobody infers coverage it does not have)
 *
 * A designation that uses neither the id nor the label — "the first option",
 * a colour, an icon with no accessible name, an ordinal — is invisible to any
 * string scan. It also cannot see a name a component composes at RENDER time
 * from data the model carries legitimately. It is an instrument over one view
 * model, not over a screen.
 */

export interface OptionIdentity {
  id: string
  label: string
}

export type NamingKind = 'id-pointer' | 'label-verbatim' | 'label-in-prose'

export interface NamingHit {
  /** Dotted path into the model, e.g. `headline`, `rows[0].label`. */
  path: string
  value: string
  kind: NamingKind
  /** The option this string names. */
  optionId: string
}

export interface NamingScan {
  /** Strings that name an option where nothing licenses naming one. */
  violations: NamingHit[]
  /** A per-option record carrying its OWN identity — data, never a claim. */
  exempt: NamingHit[]
  /** Instrument precondition: a scan of nothing agrees with every other scan of nothing. */
  stringsScanned: number
}

/**
 * Walk `model` and classify every string that names one of `options`.
 *
 * Pure: it makes no assertion. The caller decides whether `violations` may be
 * non-empty on this run, which is the whole point — the same instrument reads
 * the licensed run (where names are EXPECTED, and their presence is the
 * positive control) and the withheld run (where the set must be empty).
 */
export function scanForOptionNaming(model: unknown, options: readonly OptionIdentity[]): NamingScan {
  const labelById = new Map(options.map((o) => [o.id, o.label]))
  const violations: NamingHit[] = []
  const exempt: NamingHit[] = []
  let stringsScanned = 0
  const seen = new WeakSet<object>()

  const classify = (value: string, path: string, ownerId: string | null): void => {
    stringsScanned += 1
    for (const opt of options) {
      const ownsThis = ownerId === opt.id
      if (value === opt.id) {
        ;(ownsThis ? exempt : violations).push({ path, value, kind: 'id-pointer', optionId: opt.id })
        continue
      }
      if (value === opt.label) {
        ;(ownsThis ? exempt : violations).push({ path, value, kind: 'label-verbatim', optionId: opt.id })
        continue
      }
      if (opt.label.length > 0 && value.includes(opt.label)) {
        // Prose naming an option is a claim even inside that option's own
        // record: "Hedge … is ahead" printed on the Hedge row is still a
        // designation, so `ownsThis` does NOT exempt it.
        violations.push({ path, value, kind: 'label-in-prose', optionId: opt.id })
      }
    }
  }

  const walk = (node: unknown, path: string, ownerId: string | null): void => {
    if (typeof node === 'string') {
      classify(node, path, ownerId)
      return
    }
    if (node == null || typeof node !== 'object') return
    if (seen.has(node)) return
    seen.add(node)

    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`, ownerId))
      return
    }

    const record = node as Record<string, unknown>
    // DERIVED, not listed: this object is a per-option record iff its own id
    // is one of the analysed options. Ownership then applies to its whole
    // subtree until a nested record claims it.
    const ownId = typeof record.id === 'string' && labelById.has(record.id) ? record.id : null
    const nextOwner = ownId ?? ownerId
    for (const [key, value] of Object.entries(record)) {
      walk(value, path === '' ? key : `${path}.${key}`, nextOwner)
    }
  }

  walk(model, '', null)
  return { violations, exempt, stringsScanned }
}
