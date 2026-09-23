/**
 * ⛔ THE CONNECTOR COPY-HONESTY PREDICATES — one definition, imported by every
 * spec that guards what a connection or its key may SAY.
 *
 * WHY A SECOND HELPER RATHER THAN EXTENDING `nodes/__tests__/__helpers__/
 * canvasCopyHonesty.ts`: that predicate bans `result|analysis|confiden|likel|
 * probab` because it guards a DECISION card that must not describe the
 * analysis. A connection legitimately says "80% confident" and a fragility cue
 * legitimately says "the result flips" — so reusing it would either RED on
 * honest copy or be weakened for every node caller. Two questions, two
 * predicates (trap 21), each defined once (trap 12).
 *
 * ⚠ NOT A `.spec.` FILE — the vitest include glob would collect it as a suite.
 *
 * ⛔ EXTENDED, NEVER WEAKENED. Adding an alternative is a tightening and always
 * safe; removing one silently retires a guard every caller depends on.
 */

/**
 * "Contested" is reserved for ATTRIBUTABLE HUMAN disagreement (Experience
 * Design, 23 Sep 2026: *no "contested" without attributable human
 * disagreement*; spec §5 "Gated": design-ready, must not ship as factual state
 * until a canonical carrier exists). Olumi's two review passes are not people,
 * so no connector surface may use the word — in any inflection.
 */
export const CONTESTED_WORD = /contest/i

/** A string that talks about fragility — the only strings rule B polices. */
const FRAGILITY_TOPIC = /sensitiv|flip/i

/**
 * The nouns the code itself gives `fragileEdgeSwitchProb` (`fragileEdgeMatch`
 * docblock: "NN% flip risk"; the chip sentence: "NN% chance the result flips").
 * A figure followed by one of these is LABELLED; anything else is bare.
 */
const FIGURE_WITH_NOUN = /^\d{1,3}%\s(flip risk|chance the result flips)/

/**
 * Every figure in a fragility string that is NOT immediately followed by its
 * noun. The founder's "Sensitive · 70%" sat beside "Strong boost est." and was
 * read as a strength: a bare percentage beside a strength label IS a strength
 * claim to a reader, whatever the code meant by it.
 */
export function bareFragilityFigures(text: string): string[] {
  const bare: string[] = []
  // PER SENTENCE. A composed `title` / `aria-label` joins several sentences
  // ("Weight: 0.60, Belief: 80%\nSensitive assumption: …"), and the 80% there
  // is a likelihood in a sentence that says nothing about fragility. Judging
  // the whole string would flag it; judging each sentence asks the question
  // this rule is about.
  for (const sentence of text.split(/\n|\.\s/)) {
    if (!FRAGILITY_TOPIC.test(sentence)) continue
    const figure = /\d{1,3}%/g
    let m: RegExpExecArray | null
    while ((m = figure.exec(sentence)) !== null) {
      if (!FIGURE_WITH_NOUN.test(sentence.slice(m.index))) bare.push(m[0])
    }
  }
  return bare
}

/**
 * Every string a person can perceive inside `root`: each element's OWN text
 * (its direct text nodes, joined — never `textContent`, which glues a word to
 * the next element's first letter and destroys word boundaries), plus the
 * attributes a pointer, a screen reader or touch can surface.
 */
export function perceivableStrings(root: ParentNode): string[] {
  const out: string[] = []
  const elements = Array.from(root.querySelectorAll('*'))
  for (const el of elements) {
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent ?? '')
      .join('')
      .trim()
    if (own) out.push(own)
    for (const attr of ['aria-label', 'title', 'alt', 'placeholder']) {
      const v = el.getAttribute(attr)
      if (v) out.push(v)
    }
  }
  // (An SVG `<title>` child is an element with its own text, so it is covered
  // by the loop above — the structural-link tooltip is read that way.)
  return out
}
