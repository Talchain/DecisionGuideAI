/**
 * normalisePastedText — UI-SEM-096.
 *
 * ## What this is for
 *
 * The composer is a plain `<textarea>`, and a message's formatting is carried
 * by the tiny markdown dialect `safeRichText` understands on the way OUT
 * (`**bold**`, `- item`, `1. item`, single newline → `<br>`). Those two facts
 * meet at exactly one place: PASTE. Copying a bulleted list from a document or
 * a web page puts a `text/plain` flavour on the clipboard whose items begin
 * with the literal bullet GLYPH the source rendered.
 *
 * ⚠ CORRECTION TO THE FIRST VERSION OF THIS FILE, KEPT BECAUSE THE WRONG
 * PREMISE IS THE INSTRUCTIVE PART. It claimed a pasted list "renders as run-on
 * prose". That is FALSE for the three commonest glyphs: `safeRichText` matches
 * `/^[-*•‣◦]\s+(.+)$/` (safeRichText.ts:264) and already emits a `<ul>` for
 * `•`, `‣` and `◦`. Checking the consumer before describing the defect would
 * have caught it; the claim was written from the shape of the problem rather
 * than from the code.
 *
 * What is actually left, and what this covers:
 *
 *  1. THE GLYPHS THAT CONSUMER DOES NOT KNOW — `▪ ▫ ● ○ ■ □ ∙ · ⁃ −`. Word and
 *     Outlook paste `·` and `▪`; Google Docs pastes `●`, `○` and `■` for its
 *     three list levels. None of those match, so those lists DO arrive as prose
 *     with stray glyphs in them.
 *  2. MAKING THE MARKER VISIBLE IN THE BOX. Rewriting every list marker to the
 *     one canonical `- ` shows the user, before they send, which of their
 *     pasted lines the product understood as a list. A `•` that happens to work
 *     and a `▪` that does not look identical in a textarea.
 *
 * ⛔ THE FIX FOR (1) BELONGS UPSTREAM EVENTUALLY. Widening `safeRichText`'s own
 * character class would serve producer copy too, which this cannot reach. This
 * is the composer-side half, and it is the half that also buys (2).
 *
 * ## Why this is allowed to transform, when the render boundary is not
 *
 * ⚠ THE DISTINCTION IS WHERE IT HAPPENS, AND IT IS THE WHOLE JUSTIFICATION.
 * The rule this estate enforces is that the UI must not transform MEANING
 * between the producer and the screen — the wire and the render must agree.
 * This runs on the USER'S OWN TEXT, in the USER'S OWN BOX, BEFORE they send:
 * the result is visible, editable and discardable in the composer. Nothing is
 * decided on their behalf behind a boundary they cannot see.
 *
 * ⛔ IT IS DELIBERATELY NOT A MARKDOWN CONVERTER. It does not read `text/html`,
 * does not infer headings, does not touch emphasis, and does not re-wrap,
 * re-space or re-order anything — the whitespace after the marker is carried
 * through character for character. Two rewrites, both mechanical, both
 * reversible by typing. Anything cleverer would be guessing at intent, which is
 * the failure mode the boundary rule exists to prevent.
 *
 * ⚠ RETURNS THE INPUT UNCHANGED WHEN THERE IS NOTHING TO DO, by identity. The
 * caller relies on that to leave an ordinary paste entirely to the browser —
 * which keeps native undo intact for every paste that needed no help.
 */

/**
 * Line-leading bullet glyphs, each followed by whitespace.
 *
 * ⚠ THE TRAILING `[ \t]+` IS LOAD-BEARING. Without it `·` at the head of a
 * line — which this estate's own copy uses as a separator ("Olumi is open ·
 * Focus") — would be rewritten mid-sentence. A bullet is a glyph followed by
 * a space; a separator is not at the start of a line with a space after it.
 *
 * ⛔ EN/EM DASHES ARE NOT HERE. `safeRichText` already normalises `–`/`—` to a
 * spaced hyphen for its own reasons; claiming them here would put two owners
 * on one rewrite (CLAUDE.md trap 21) and make a dash-led line silently become
 * a list item, which it is not.
 */
const BULLET_LINE = /^([ \t]*)[•‣◦⁃∙·▪▫●○■□−]([ \t]+)/

export function normalisePastedText(raw: string): string {
  if (!raw) return raw

  // CRLF / lone CR → LF. Left alone, a Windows paste reaches `safeRichText`
  // with `\r\n` pairs, and its `split('\n')` leaves a stray `\r` at the end of
  // every line.
  const unified = raw.indexOf('\r') === -1 ? raw : raw.replace(/\r\n?/g, '\n')

  let touched = unified !== raw
  const lines = unified.split('\n').map((line) => {
    const match = BULLET_LINE.exec(line)
    if (!match) return line
    touched = true
    // `match[1]` is the indent and `match[2]` the run of whitespace that
    // followed the glyph — both carried through verbatim, so the only byte that
    // changes on the line is the marker itself.
    return `${match[1]}-${match[2]}${line.slice(match[0].length)}`
  })

  // Identity when nothing matched — see the header: the caller uses this to
  // hand an ordinary paste straight back to the browser.
  return touched ? lines.join('\n') : raw
}
