/**
 * THE PRECONDITION THE MOUNT KEY RESTS ON, PINNED SO IT CANNOT DRIFT SILENTLY.
 *
 * `heldProposalMountKey(turnId, proposalId)` scopes a held proposal's
 * settlement to `message.id`. That is only durable while a message's `id` is
 * stable for the life of the message — if an id were ever rewritten, the card
 * would silently revert to `proposed`, its buttons would come back over a hold
 * the user has already resolved, and pressing one would end in a CEE refusal.
 *
 * At the bytes today the precondition HOLDS: every writer patches by id and
 * none rewrites it. But nothing enforces it. `updateMessage` is
 *
 *     (id: string, patch: Partial<ConversationMessage>) =>
 *       setMessages(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)))
 *
 * — a spread of a `Partial<ConversationMessage>`, and `ConversationMessage`
 * has `id` on it. So `updateMessage(x, { id: 'other' })` type-checks, runs, and
 * rewrites the id. Mounting would revert with **no red anywhere**: no type
 * error, no runtime error, and every existing settlement spec still green,
 * because they all construct their own messages and never exercise this path.
 *
 * That is precisely the shape CLAUDE.md trap 13b names — a guard whose
 * discrimination depends on a fact nothing pins. So the fact is pinned HERE,
 * derived from the source rather than mirrored from it (trap 12), and it FAILS
 * LOUD on drift rather than assuming good.
 *
 * ── WHY A SOURCE-DERIVED GUARD AND NOT A BEHAVIOURAL ONE ────────────────────
 * A behavioural test can only prove that `updateMessage` preserves the id for
 * the patches it is GIVEN. The risk is a FUTURE CALL SITE passing `{ id }`,
 * which no behavioural test can reach. The call sites are the thing to check,
 * so the call sites are what this reads.
 *
 * Hardening `updateMessage` to strip `id` was the alternative. It is deliberately
 * NOT done here: it is a behaviour change to a hot path in a file this PR does
 * not otherwise touch, and CLAUDE.md's scope-expansion rule bans "while we're
 * here" work. This guard makes the drift LOUD, which is what the lane needs;
 * the hardening is a separate, rowable change.
 *
 * SCOPE, stated precisely (trap 20 — an absence claim must name what it
 * searched): every PRODUCT `.ts`/`.tsx` file under `src/`, read from disk at
 * test time. Specs are excluded — they are not writers of the live message
 * list, and their own prose about `updateMessage(` is not a call site. Not a
 * claim about any built artefact, and not a claim about the deployed bundle.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const SRC_ROOT = resolve(__dirname, '../../..')

const IS_SPEC = /(\.spec\.|\.test\.)tsx?$/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    // `statSync` follows symlinks deliberately — a symlinked source dir is
    // still source. `lstat` would skip it and read as a clean zero (trap 9f).
    const st = statSync(full)
    if (st.isDirectory()) walk(full, out)
    else if (/\.tsx?$/.test(entry) && !IS_SPEC.test(entry)) out.push(full)
  }
  return out
}

/**
 * Blank out comments and string/template bodies, preserving offsets and
 * newlines so the result still parses positionally.
 *
 * Without this the scan cannot tell a CALL from PROSE ABOUT a call — and this
 * repo has both: `useSmartScroll.ts:123` carries the sentence
 * "`block` → `updateMessage(msgId, { blocks })`" in a comment, and it was
 * scored as a call site until this stripper existed. A guard that counts
 * documentation as code is measuring the wrong population.
 */
function stripCommentsAndStrings(source: string): string {
  const out = source.split('')
  let i = 0
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to && k < out.length; k += 1) {
      if (out[k] !== '\n') out[k] = ' '
    }
  }
  while (i < source.length) {
    const c = source[i]
    const d = source[i + 1]
    if (c === '/' && d === '/') {
      const end = source.indexOf('\n', i)
      blank(i, end === -1 ? source.length : end)
      i = end === -1 ? source.length : end
    } else if (c === '/' && d === '*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      blank(i, stop)
      i = stop
    } else if (c === '"' || c === "'" || c === '`') {
      let k = i + 1
      while (k < source.length) {
        if (source[k] === '\\') k += 2
        else if (source[k] === c) break
        else k += 1
      }
      blank(i + 1, k)
      i = k + 1
    } else {
      i += 1
    }
  }
  return out.join('')
}

/**
 * The second argument of every `updateMessage(…)` CALL in `source`.
 *
 * The declaration reads `const updateMessage = useCallback(…)` and therefore
 * contains no `updateMessage(` substring, so it is not picked up as a call.
 * Dependency-array mentions (`[updateMessage]`) are likewise not followed by
 * `(`.
 */
function updateMessagePatchArgs(rawSource: string): string[] {
  const source = stripCommentsAndStrings(rawSource)
  const NEEDLE = 'updateMessage('
  const args: string[] = []
  let from = 0
  for (;;) {
    const at = source.indexOf(NEEDLE, from)
    if (at === -1) break
    const open = at + NEEDLE.length - 1
    from = open + 1

    // Balanced scan to the matching ')'. Depth counts every bracket family so a
    // nested call, array or object literal cannot terminate the scan early.
    let depth = 0
    let end = -1
    let splitAt = -1
    for (let i = open; i < source.length; i += 1) {
      const c = source[i]
      if (c === '(' || c === '[' || c === '{') depth += 1
      else if (c === ')' || c === ']' || c === '}') {
        depth -= 1
        if (depth === 0) {
          end = i
          break
        }
      } else if (c === ',' && depth === 1 && splitAt === -1) {
        splitAt = i
      }
    }
    if (end === -1) throw new Error('unbalanced updateMessage( call — guard cannot read this source')
    args.push(splitAt === -1 ? '' : source.slice(splitAt + 1, end).trim())
  }
  return args
}

/**
 * Every TOP-LEVEL key of an object-literal patch argument.
 *
 * Runs over the STRIPPED text, so a `}` or `,` inside a string value cannot
 * throw the depth count off. The cost is that a QUOTED key (`'id':`) has had
 * its body blanked and reads as `''`; that is reported rather than skipped, so
 * an unreadable key REDs instead of passing silently (trap 12 — a mirror that
 * cannot see must fail loud, never assume good).
 */
function topLevelKeys(patchArg: string): string[] {
  if (!patchArg.startsWith('{')) return []
  const keys: string[] = []
  let depth = 0
  // A key can only begin immediately after the opening brace or after a
  // depth-1 comma. Binding to POSITION rather than to "an identifier followed
  // by a colon at depth 1" is what makes this correct: the first cut used the
  // colon, and `{ deliveryState: a ? 'sent' : 'failed' }` gave a FALSE POSITIVE
  // because a ternary's `:` also sits at depth 1. Trap 19 at the character
  // level — a predicate another construct satisfies.
  let atKeyPosition = false
  for (let i = 0; i < patchArg.length; i += 1) {
    const c = patchArg[i]
    if (c === '{' || c === '[' || c === '(') {
      depth += 1
      if (depth === 1) atKeyPosition = true
      continue
    }
    if (c === '}' || c === ']' || c === ')') {
      depth -= 1
      continue
    }
    if (depth === 1 && c === ',') {
      atKeyPosition = true
      continue
    }
    if (!atKeyPosition || depth !== 1 || /\s/.test(c)) continue

    const rest = patchArg.slice(i)
    atKeyPosition = false
    // `...spread` could smuggle in an id, so it is reported, never skipped.
    if (rest.startsWith('...')) {
      keys.push('<spread>')
      continue
    }
    // A quoted key has had its body blanked by the stripper, and a computed
    // key is not statically readable. Both are reported rather than skipped —
    // a mirror that cannot see must fail loud, never assume good (trap 12).
    const quoted = /^(['"])\s*\1/.exec(rest)
    if (quoted) {
      keys.push('<unreadable quoted key>')
      i += quoted[0].length - 1
      continue
    }
    const ident = /^([A-Za-z_$][\w$]*)/.exec(rest)
    if (ident) {
      keys.push(ident[1])
      i += ident[0].length - 1
      continue
    }
    keys.push('<unreadable key>')
  }
  return keys
}

/**
 * Could this patch argument set a TOP-LEVEL `id`? A literal `id` key, and also
 * any key this guard could not read — because "I cannot tell" must fail the
 * same way as "yes", or the guard quietly stops discriminating.
 */
function rewritesId(patchArg: string): boolean {
  return topLevelKeys(patchArg).some((k) => k === 'id' || k.startsWith('<'))
}

describe('MOUNT-KEY PRECONDITION — a message id is never rewritten', () => {
  const files = walk(SRC_ROOT)
  const callSites = files
    .map((f) => ({ file: f, args: updateMessagePatchArgs(readFileSync(f, 'utf8')) }))
    .filter((r) => r.args.length > 0)

  it('POSITIVE CONTROL — the guard can SEE an id rewrite, and does not cry wolf', () => {
    // An absence claim from a probe with no positive control is vacuous
    // (trap 13). Every case below has its opposite-direction twin, so the guard
    // is shown to DISCRIMINATE rather than merely to fire.
    expect(updateMessagePatchArgs("updateMessage(a, { id: 'nope' })").map(rewritesId)).toEqual([
      true,
    ])
    // ⚠ THIS EXPECTATION WAS WRITTEN AS `false` AND THE GUARD REFUTED IT.
    // Shorthand `{ id }` desugars to `{ id: id }` — it rewrites the id just as
    // surely as the longhand. The oracle was wrong, not the instrument
    // (trap 13c: a kit measures whether a check can DETECT a change, never
    // whether the EXPECTATION is right).
    expect(updateMessagePatchArgs('updateMessage(a, { id })').map(rewritesId)).toEqual([true])
    expect(updateMessagePatchArgs('updateMessage(a, { blocks })').map(rewritesId)).toEqual([false])
    expect(
      updateMessagePatchArgs("updateMessage(a, { deliveryState: 'failed' })").map(rewritesId),
    ).toEqual([false])
    // Multi-line, nested, and a trailing `id` — the shapes this file really has.
    expect(
      updateMessagePatchArgs(
        "updateMessage(ref.current, {\n  blocks: f(x, y),\n  meta: { id: 'inner' },\n  id: 'outer',\n})",
      ).map(rewritesId),
    ).toEqual([true])
    // …and the SAME shape without the top-level `id` must read false, so the
    // nested `id` is proven not to be what fired above.
    expect(
      updateMessagePatchArgs(
        "updateMessage(ref.current, {\n  blocks: f(x, y),\n  meta: { id: 'inner' },\n})",
      ).map(rewritesId),
    ).toEqual([false])
    // A brace or comma inside a string value must not throw the depth count off.
    expect(
      updateMessagePatchArgs('updateMessage(a, { content: "a } b, c", id: x })').map(rewritesId),
    ).toEqual([true])
    expect(
      updateMessagePatchArgs('updateMessage(a, { content: "a } b, c" })').map(rewritesId),
    ).toEqual([false])
    // An unreadable quoted key, a computed key and a spread are all reported
    // rather than skipped — "cannot tell" must fail like "yes".
    expect(updateMessagePatchArgs("updateMessage(a, { 'id': x })").map(rewritesId)).toEqual([true])
    expect(updateMessagePatchArgs('updateMessage(a, { [k]: x })').map(rewritesId)).toEqual([true])
    expect(updateMessagePatchArgs('updateMessage(a, { ...patch })').map(rewritesId)).toEqual([true])
    // A TERNARY's colon sits at depth 1 too. Binding by colon rather than by
    // key POSITION made this a false positive on the real `deliveryState` call
    // site at useConversation.ts:4981-4987.
    expect(
      updateMessagePatchArgs(
        "updateMessage(a, {\n  deliveryState:\n    k !== 'typed_error' || p\n      ? 'sent'\n      : u\n        ? 'unconfirmed'\n        : 'failed',\n})",
      ).map(rewritesId),
    ).toEqual([false])
    expect(
      updateMessagePatchArgs("updateMessage(a, { deliveryState: k ? 'sent' : 'failed' })").map(
        topLevelKeys,
      ),
    ).toEqual([['deliveryState']])
    // PROSE about a call is not a call — the case that was miscounted before
    // the stripper existed (`useSmartScroll.ts:123`).
    expect(updateMessagePatchArgs('// see updateMessage(msgId, { blocks })\nconst x = 1')).toEqual(
      [],
    )
    expect(updateMessagePatchArgs('/* updateMessage(a, { id: 1 }) */')).toEqual([])
  })

  it('the instrument is not blind — it reads EVERY call the source contains', () => {
    // Magnitude, not just sign (trap 13e): a probe that found two call sites
    // would report the same clean "no rewrites" as one that found twenty.
    //
    // ⚠ DERIVED, NOT REMEMBERED. This assertion was `total >= 15` — a
    // hand-maintained magnitude. Deleting the V4 orchestration path on
    // 2026-08-29 took `useConversation.ts` from 7034 to 5414 lines and the true
    // count from 15 to 6, and the guard went red. Quietly re-baselining `15` to
    // `6` was the wrong repair: a floor nobody can re-defend is exactly the
    // hand-maintained mirror this file's own header warns about (trap 12), and
    // the next deletion would have silently walked it toward zero.
    //
    // What must actually be true is not "the source contains N calls" — that is
    // a fact about product code, and product code is allowed to change. It is
    // that the BALANCED-SCAN PARSER reads every call the source contains. So
    // count the occurrences independently, with a different implementation
    // (regex) over the same comment/stripped text the parser consumed, and
    // require exact agreement. That is a completeness check with no number in
    // it, so it cannot drift.
    //
    // SCOPE, precisely (trap 20): this proves the parser is not dropping calls
    // it can see. It does NOT prove the STRIPPER is well-behaved — an over-
    // blanking stripper would hide calls from both implementations alike. The
    // raw-vs-stripped assertion below is what makes that visible.
    const total = callSites.reduce((n, r) => n + r.args.length, 0)

    const independentStripped = callSites.reduce(
      (n, r) => n + (stripCommentsAndStrings(readFileSync(r.file, 'utf8')).match(/updateMessage\(/g) ?? []).length,
      0,
    )
    // Positive control: the probe sees SOMETHING. A zero here means the scan is
    // blind (file moved, symbol renamed, stripper over-blanking) and every
    // "no rewrites" verdict below would be vacuous.
    expect(total).toBeGreaterThan(0)
    // Completeness: it sees EVERYTHING it can see.
    expect(total).toBe(independentStripped)

    // Stripper sanity: the raw file must mention `updateMessage(` at least as
    // often as the stripped one. If the stripper ever blanked live code, the
    // stripped count would collapse while raw stayed high — visible here rather
    // than passing as a clean, smaller-but-plausible number.
    const rawMentions = callSites.reduce(
      (n, r) => n + (readFileSync(r.file, 'utf8').match(/updateMessage\(/g) ?? []).length,
      0,
    )
    expect(rawMentions).toBeGreaterThanOrEqual(total)
    // Derived scope, not a mirrored list: `useConversation.ts` is the only
    // file that calls it today. If a second one appears this REDs, which is the
    // point — a new writer is exactly what this guard exists to notice.
    expect(callSites.map((r) => relative(SRC_ROOT, r.file)).sort()).toEqual([
      'canvas/conversation/useConversation.ts',
    ])
  })

  it('no updateMessage call site rewrites `id`', () => {
    const offenders = callSites.flatMap((r) =>
      r.args.filter(rewritesId).map((a) => `${relative(SRC_ROOT, r.file)}: ${a.slice(0, 80)}`),
    )
    expect(offenders).toEqual([])
  })

  it('every patch is an object LITERAL this guard can actually read', () => {
    // The failure mode that would hollow the guard out without a red: a call
    // site passing a variable (`updateMessage(id, patch)`) is opaque to a
    // source scan, so it would pass silently. Fail LOUD instead and force a
    // re-derivation — never assume-good (trap 12).
    const opaque = callSites.flatMap((r) =>
      r.args
        .filter((a) => !a.startsWith('{'))
        .map((a) => `${relative(SRC_ROOT, r.file)}: ${a.slice(0, 80)}`),
    )
    expect(opaque).toEqual([])
  })
})
