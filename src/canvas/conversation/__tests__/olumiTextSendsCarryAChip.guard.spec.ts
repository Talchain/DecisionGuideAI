/**
 * T1H-2 (14 Oct) — SHRINK-ONLY guard: every call into a conversation send entry
 * point that passes a MESSAGE must carry a chip identity, unless the site is on
 * the short allow-list of TYPED-COMPOSER sources below (the person's own words).
 *
 * Why: a chipless send reaches CEE as `source: 'composer'` — byte-identical to
 * words the user typed (CEE `turn-source-authorship.ts`: only `composer` is
 * "freshly authored") — so Olumi's sentence, and any figure in it, is counted as
 * something the user said. #2792 and T1H-2 fixed the census; this closes the class.
 *
 * WHAT IS SCANNED (derived from the code, 14 Oct census): every non-test `.ts`/
 * `.tsx` under `src`, and in each, every CALL whose callee resolves to
 *   · the SEND family — `sendMessage`, `onSendMessage`, `_sendMessage`, `onSend`,
 *     a binding declared with the `OlumiSend` / `OlumiTextSend` type, or a local
 *     alias whose initialiser only REFERENCES one of these (`const send = s._sendMessage`,
 *     or a store selector `useGuidanceStore(s => s._sendMessage)`);
 *   · the DISPATCH family — `dispatchAction`, `_dispatchAction`, or such an alias.
 * A SEND call carries a chip iff its options literal has `chipMeta`. A DISPATCH call
 * (one `DispatchActionOpts` argument) carries a chip iff that object has `id`, a
 * string-literal `action_type`, an object-literal `parameters`, or `source: 'chip' |
 * 'chip_click'` — the inputs from which `buildChipMeta` / `buildV5Payload` produce a
 * chip whatever the runtime values. (`action_type: x.y` alone is NOT enough: it may
 * be undefined, and then the turn goes out as `composer` — CoachingCard did.)
 *
 * NOT a message send, by signature (skipped): a zero-argument call (the composer
 * chain's own trigger); a dispatch call with ≠ 1 argument (not `DispatchActionOpts`);
 * a call whose message/opts argument is the enclosing function's own parameter
 * (a forwarder — its callers are scanned at their own sites).
 *
 * LIMIT, stated: a send function passed under a prop name outside both families
 * (e.g. `onSendFollowUp`, `onArtefactMessage`) is not followed; on 14 Oct every
 * such prop was fed by ConversationPanel's chip handler.
 *
 * ⇄ SYMMETRIC (T1H-3, 14 Oct): the OPPOSITE misattribution is closed here too — a
 * send whose MESSAGE comes from user input must never be a chip, because CEE
 * credits a turn's words to the user only when it is chipless `composer`
 * (CEE `stated-by-user.ts` `typedByUser`; `turn-executor.ts` runs its typed-
 * constraint door only off chip sources). User-input PROVENANCE, derived per file:
 * a `useState` value whose setter is called with an input's `.target.value`
 * (onChange state), `consumeBrief()`, a `.userWords` read, a direct
 * `.target.value`, or a local `const` whose initialiser reaches one of these.
 * SuccessTarget's typed constraint and the Respond door (`askAi` userWords with
 * parameters) were chips until T1H-3.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..', '..', '..')
/** Text prefilter BEFORE any AST parse (a tree-scan guard once timed out on CI). */
const PREFILTER = /[sS]endMessage|onSend\b|[dD]ispatchAction|OlumiSend\b|OlumiTextSend\b/
const SEND_NAMES = new Set(['sendMessage', 'onSendMessage', '_sendMessage', 'onSend'])
const DISPATCH_NAMES = new Set(['dispatchAction', '_dispatchAction'])
const SEND_TYPE = /\b(?:OlumiSend|OlumiTextSend)\b/

/**
 * TYPED-COMPOSER sources only — the person's own words. Key = `file::callee(firstArg)`
 * (no line numbers). Shrink-only: a count may only fall, a new key fails, and a
 * count that falls must be lowered here (an entry the code no longer has is stale).
 */
const ALLOWED: Record<string, { count: number; reason: string }> = {
  'canvas/components/AIInputBar.tsx::sendMessage(text)': { count: 2,
    reason: 'the AI input bar\'s draft — the words the person typed (plain send, and the empty-canvas brief).' },
  'canvas/components/DraftChat.tsx::conversation.sendMessage(briefText)': { count: 1,
    reason: 'the DraftChat textarea — the brief the person typed.' },
  'canvas/components/FirstUseComposer.tsx::sendMessage(composedBrief)': { count: 1,
    reason: 'the first-use structured fields — the person\'s own typed words joined under field labels.' },
  'canvas/components/pre-analysis/SuccessTarget.tsx::send(trimmed)': { count: 1,
    reason: 'the constraint the person typed, alone (T1H-3: was an add_constraint chip); on chipless `composer` CEE\'s typed-constraint door saves it as user_explicit (explicit-constraint-edit.ts), a chip or a frame defeats it.' },
  'canvas/conversation/ConversationPanel.tsx::sendMessage(brief)': { count: 1,
    reason: 'Generate model sends `consumeBrief()` — the composer text the person typed.' },
  'canvas/conversation/askAi.ts::state._sendMessage(req.userWords)': { count: 1,
    reason: '`req.userWords` — the person\'s own typed words, every one (T1H-3: the Respond door\'s typed-parameter chip is gone).' },
  'canvas/conversation/hooks/useComposerState.ts::onSend(value.trim())': { count: 1,
    reason: 'the composer\'s own submit — the words the person typed.' },
  'canvas/conversation/zones/ChatComposer.tsx::sendMessage(text)': { count: 1,
    reason: 'the chat composer\'s submit — the words the person typed.' },
  'components/results/coaching/AskOlumiDrawer.tsx::sendMessage(text)': { count: 1,
    reason: 'the drawer\'s editable textarea — what the person typed or edited and chose to send (recordsUserWords spec).' },
}

/**
 * USER-INPUT sends that still carry a chip — the baseline found when this check was written (T1H-3, 14 Oct). Shrink-
 * only, like `ALLOWED`: a count may only fall, a new key fails. Each entry is a KNOWN demotion of the person's words,
 * not an endorsement.
 */
const USER_INPUT_CHIP_ALLOWED: Record<string, { count: number; reason: string }> = {
  "components/results/coaching/AskOlumiDrawer.tsx::dispatchAction({ action_type: 'discuss', ...(intent ? { intent } : {}), parameters, label: text, message: text, source, })": { count: 1,
    reason: 'KNOWN, open: the drawer\'s textarea is prefilled with Olumi\'s prompt and editable; its chip carries the `intent` that makes CEE run a coaching method (only on chip turns), so the person\'s edits travel demoted. Needs a ruling on mixed authorship — not fixed here.' },
}

export interface SendSite { key: string; family: 'send' | 'dispatch'; chip: boolean; userInput: boolean; line: number }

function calleeName(expr: ts.Expression): string | null {
  let c = expr
  while (ts.isNonNullExpression(c) || ts.isParenthesizedExpression(c)) c = c.expression
  if (ts.isIdentifier(c)) return c.text
  if (ts.isPropertyAccessExpression(c)) return c.name.text
  return null
}
/** True when `init` only REFERENCES names in `names` (no call, no function literal). */
function referencesOnly(init: ts.Expression, names: Set<string>): boolean {
  let e = init
  while (ts.isNonNullExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression
  if (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e)) { const n = calleeName(e); return n !== null && names.has(n) }
  if (ts.isBinaryExpression(e) && ['??', '||'].includes(e.operatorToken.getText()))
    return referencesOnly(e.left, names) || referencesOnly(e.right, names)
  if (ts.isConditionalExpression(e)) return referencesOnly(e.whenTrue, names) || referencesOnly(e.whenFalse, names)
  // A store selector: `useGuidanceStore(s => s._dispatchAction)`.
  if (ts.isCallExpression(e) && e.arguments.length === 1) {
    const sel = e.arguments[0]
    if (ts.isArrowFunction(sel) && !ts.isBlock(sel.body)) return referencesOnly(sel.body, names)
  }
  return false
}
function prop(obj: ts.ObjectLiteralExpression, name: string): ts.ObjectLiteralElementLike | undefined {
  return obj.properties.find(p => (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name.getText() === name)
}
function isEnclosingParam(id: ts.Identifier): boolean {
  for (let n: ts.Node | undefined = id.parent; n; n = n.parent)
    if (ts.isFunctionLike(n)) return n.parameters.some(p => p.name.getText() === id.text)
  return false
}
function resolveObject(raw: ts.Expression, sf: ts.SourceFile): ts.ObjectLiteralExpression | 'param' | null {
  let arg = raw
  while (ts.isAsExpression(arg) || ts.isSatisfiesExpression(arg) || ts.isParenthesizedExpression(arg) || ts.isNonNullExpression(arg)) arg = arg.expression
  if (ts.isObjectLiteralExpression(arg)) return arg
  if (!ts.isIdentifier(arg)) return null
  if (isEnclosingParam(arg)) return 'param'
  let found: ts.ObjectLiteralExpression | null = null
  const walk = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === arg.text && n.initializer) {
      let i = n.initializer
      while (ts.isAsExpression(i) || ts.isSatisfiesExpression(i) || ts.isParenthesizedExpression(i)) i = i.expression
      if (ts.isObjectLiteralExpression(i)) found = i
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return found
}
function dispatchCarriesChip(obj: ts.ObjectLiteralExpression): boolean {
  const lit = (p: ts.ObjectLiteralElementLike | undefined) => p && ts.isPropertyAssignment(p) ? p.initializer : undefined
  if (prop(obj, 'id')) return true
  const at = lit(prop(obj, 'action_type'))
  if (at && (ts.isStringLiteral(at) || ts.isNoSubstitutionTemplateLiteral(at))) return true
  const params = lit(prop(obj, 'parameters'))
  if (params && ts.isObjectLiteralExpression(params)) return true
  const src = lit(prop(obj, 'source'))
  return !!src && ts.isStringLiteral(src) && (src.text === 'chip' || src.text === 'chip_click')
}

/** Direct user-input sources: an input's `.target.value`, `consumeBrief()`, a `.userWords` read. */
function isDirectUserInput(n: ts.Node): boolean {
  if (ts.isPropertyAccessExpression(n)) {
    if (n.name.text === 'userWords') return true
    if (n.name.text === 'value' && ts.isPropertyAccessExpression(n.expression)
      && ['target', 'currentTarget'].includes(n.expression.name.text)) return true
  }
  return ts.isCallExpression(n) && calleeName(n.expression) === 'consumeBrief'
}
/** True when `expr` reaches user input: a direct source, or an identifier in `tainted` (not a property name). */
function reachesUserInput(expr: ts.Node, tainted: Set<string>): boolean {
  let hit = false
  const visit = (n: ts.Node) => {
    if (hit) return
    if (isDirectUserInput(n)) { hit = true; return }
    // A test ON user input is not its value: skip a conditional's condition, a comparison, `typeof`, and `&&`'s guard.
    if (ts.isConditionalExpression(n)) { visit(n.whenTrue); visit(n.whenFalse); return }
    if (ts.isTypeOfExpression(n)) return
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind
      if ([ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.LessThanToken, ts.SyntaxKind.GreaterThanToken,
        ts.SyntaxKind.LessThanEqualsToken, ts.SyntaxKind.GreaterThanEqualsToken].includes(op)) return
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) { visit(n.right); return }
    }
    if (ts.isPropertyAccessExpression(n) && tainted.has(n.getText().replace(/\?\./g, '.'))) { hit = true; return }
    if (ts.isIdentifier(n) && tainted.has(n.text)
      && !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
      && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) { hit = true; return }
    ts.forEachChild(n, visit)
  }
  visit(expr)
  return hit
}
/**
 * Per-file names (or `a.b` paths) whose value is user input: a `useState` value — or any `x` beside a `setX` — whose
 * setter is fed an input's `.target.value`; a controlled input's `value={…}` (an element with `onChange`); then any
 * `const` initialised from one (fixpoint).
 */
function userInputNames(sf: ts.SourceFile): Set<string> {
  const setterOf = new Map<string, string>()
  const fed = new Set<string>()
  const tainted = new Set<string>()
  const scan = (n: ts.Node) => {
    if (ts.isJsxAttributes(n) && n.properties.some(a => ts.isJsxAttribute(a) && a.name.getText(sf) === 'onChange')) {
      const v = n.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(sf) === 'value')
      const e = v && ts.isJsxAttribute(v) && v.initializer && ts.isJsxExpression(v.initializer) ? v.initializer.expression : undefined
      if (e && (ts.isIdentifier(e) || ts.isPropertyAccessExpression(e))) tainted.add(e.getText(sf).replace(/\?\./g, '.'))
    }
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && ts.isCallExpression(n.initializer)
      && calleeName(n.initializer.expression) === 'useState') {
      const [value, setter] = n.name.elements
      if (value && setter && ts.isBindingElement(value) && ts.isBindingElement(setter) && ts.isIdentifier(value.name) && ts.isIdentifier(setter.name))
        setterOf.set(setter.name.text, value.name.text)
    }
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.arguments.some(a => reachesUserInput(a, new Set())))
      fed.add(n.expression.text)
    ts.forEachChild(n, scan)
  }
  scan(sf)
  for (const [setter, value] of setterOf) if (fed.has(setter)) tainted.add(value)
  for (const setter of fed) if (/^set[A-Z]/.test(setter)) tainted.add(setter[3].toLowerCase() + setter.slice(4))
  for (let grew = true; grew;) {
    grew = false
    const visit = (n: ts.Node) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && !tainted.has(n.name.text)
        && !ts.isFunctionLike(n.initializer) && reachesUserInput(n.initializer, tainted)) { tainted.add(n.name.text); grew = true }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return tainted
}

export function scanSource(rel: string, text: string): SendSite[] {
  if (!PREFILTER.test(text)) return []
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const send = new Set(SEND_NAMES), dispatch = new Set(DISPATCH_NAMES)
  // Aliases + typed bindings: two passes so an alias of an alias is followed.
  for (let pass = 0; pass < 2; pass++) {
    const visit = (n: ts.Node) => {
      if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isPropertySignature(n)) && ts.isIdentifier(n.name)) {
        if (n.type && SEND_TYPE.test(n.type.getText(sf))) send.add(n.name.text)
        const init = (ts.isVariableDeclaration(n) || ts.isParameter(n)) ? n.initializer : undefined
        if (init && referencesOnly(init, send)) send.add(n.name.text)
        else if (init && referencesOnly(init, dispatch)) dispatch.add(n.name.text)
      }
      if (ts.isBindingElement(n) && ts.isIdentifier(n.name)) {
        const from = (n.propertyName ?? n.name).getText(sf)
        if (SEND_NAMES.has(from)) send.add(n.name.text)
        if (DISPATCH_NAMES.has(from)) dispatch.add(n.name.text)
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  const tainted = userInputNames(sf)
  const sites: SendSite[] = []
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const name = calleeName(n.expression)
      const family = name && send.has(name) ? 'send' : name && dispatch.has(name) ? 'dispatch' : null
      const callee = n.expression.getText(sf).replace(/\s+/g, '').replace(/!/g, '').replace(/\?\./g, '.')
      const first = n.arguments[0]?.getText(sf).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ')
      const key = `${rel}::${callee}(${first ?? ''})`
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
      if (family === 'send' && n.arguments.length > 0) {
        const opts = n.arguments[1]
        const resolved = opts ? resolveObject(opts, sf) : null
        const firstIsParam = ts.isIdentifier(n.arguments[0]) && isEnclosingParam(n.arguments[0]) && resolved === 'param'
        if (!firstIsParam) sites.push({ key, family, line, userInput: reachesUserInput(n.arguments[0], tainted),
          chip: resolved !== null && resolved !== 'param' && !!prop(resolved, 'chipMeta') })
      } else if (family === 'dispatch' && n.arguments.length === 1) {
        const resolved = resolveObject(n.arguments[0], sf)
        const m = resolved !== null && resolved !== 'param' ? prop(resolved, 'message') : undefined
        const message = m && ts.isPropertyAssignment(m) ? m.initializer : m && ts.isShorthandPropertyAssignment(m) ? m.name : undefined
        if (resolved !== 'param') sites.push({ key, family, line, chip: resolved !== null && dispatchCarriesChip(resolved),
          userInput: !!message && reachesUserInput(message, tainted) })
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return sites
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') walk(p, out) }
    else if (/\.(ts|tsx)$/.test(name) && !/\.(spec|test)\.tsx?$/.test(name) && !name.endsWith('.d.ts')) out.push(p)
  }
  return out
}
let cache: SendSite[] | null = null
function scanTree(): SendSite[] {
  if (cache) return cache
  cache = walk(SRC).flatMap(f => scanSource(f.slice(SRC.length + 1).replace(/\\/g, '/'), readFileSync(f, 'utf8')))
  return cache
}

describe('Olumi\'s text never reaches CEE as the user\'s typed words (shrink-only)', () => {
  it('every chipless message send is a TYPED-COMPOSER source on the allow-list, at its recorded count', () => {
    const counts = new Map<string, number>()
    for (const s of scanTree()) if (!s.chip) counts.set(s.key, (counts.get(s.key) ?? 0) + 1)
    const over = [...counts].filter(([k, n]) => n > (ALLOWED[k]?.count ?? 0)).map(([k, n]) => `${k}: ${n} > ${ALLOWED[k]?.count ?? 0}`)
    const stale = Object.entries(ALLOWED).filter(([k, v]) => (counts.get(k) ?? 0) < v.count).map(([k, v]) => `${k}: ${counts.get(k) ?? 0} < ${v.count} — lower it`)
    expect(over).toEqual([])
    expect(stale).toEqual([])
  }, 60_000)

  it('each allow-list entry says it is the person\'s own typed words', () => {
    for (const [k, v] of Object.entries(ALLOWED)) expect(v.reason, k).toMatch(/typed|own words/)
  })

  it('CONTRAST: the scan sees the known chip sites (guidance_discuss, proposal_confirm, the Model-tab hand-off, a dispatch)', () => {
    const sites = scanTree()
    const chips = sites.filter(s => s.chip)
    const has = (re: RegExp) => chips.some(s => re.test(s.key))
    expect(has(/^canvas\/conversation\/GuidanceStrip\.tsx::onSendMessage\(action\.prompt\)$/)).toBe(true)
    expect(has(/^canvas\/conversation\/ConversationPanel\.tsx::sendMessage\(`confirm:\$\{proposalId\}`\)$/)).toBe(true)
    expect(has(/^canvas\/conversation\/olumiHandOff\.ts::send\(message\)$/)).toBe(true)
    expect(has(/^canvas\/conversation\/ConversationPanel\.tsx::dispatchAction\(/)).toBe(true)
    // Magnitude, not just presence: the 14 Oct tree has ~50 sites across both families.
    expect(chips.filter(s => s.family === 'send').length).toBeGreaterThanOrEqual(20)
    expect(chips.filter(s => s.family === 'dispatch').length).toBeGreaterThanOrEqual(15)
  }, 60_000)

  it('POSITIVE CONTROL: a synthetic chipless send and dispatch are flagged; their chip twins are not', () => {
    const fixture = [
      "const dispatch = useGuidanceStore.getState()._dispatchAction",
      "useGuidanceStore.getState()._sendMessage?.('Olumi asks: is 20% realistic?')",
      "useGuidanceStore.getState()._sendMessage?.('Olumi asks: is 20% realistic?', { chipMeta: { id: 'x' } })",
      "dispatch({ label: 'Ask', message: 'Olumi asks', source: 'insight', action_type: maybe.type })",
      "dispatch({ label: 'Ask', message: 'Olumi asks', source: 'insight', id: 'x' })",
    ].join('\n')
    const sites = scanSource('fixture.ts', fixture)
    expect(sites.map(s => [s.family, s.chip])).toEqual([['send', false], ['send', true], ['dispatch', false], ['dispatch', true]])
  })
})

describe('⇄ SYMMETRIC — the person\'s own words never reach CEE as a chip (shrink-only)', () => {
  it('no send whose message comes from user input carries a chip, beyond the recorded baseline', () => {
    const counts = new Map<string, number>()
    for (const s of scanTree()) if (s.userInput && s.chip) counts.set(s.key, (counts.get(s.key) ?? 0) + 1)
    const over = [...counts].filter(([k, n]) => n > (USER_INPUT_CHIP_ALLOWED[k]?.count ?? 0)).map(([k, n]) => `${k}: ${n}`)
    const stale = Object.entries(USER_INPUT_CHIP_ALLOWED).filter(([k, v]) => (counts.get(k) ?? 0) < v.count).map(([k]) => `${k} — lower it`)
    expect(over).toEqual([])
    expect(stale).toEqual([])
  }, 60_000)

  it('CONTRAST: the provenance scan sees the known user-input sends (typed constraint, Respond/askAi words, Generate brief, composer)', () => {
    const typed = scanTree().filter(s => s.userInput)
    const has = (key: string) => typed.some(s => s.key === key)
    expect(has('canvas/components/pre-analysis/SuccessTarget.tsx::send(trimmed)')).toBe(true)
    expect(has('canvas/conversation/askAi.ts::state._sendMessage(req.userWords)')).toBe(true)
    expect(has('canvas/conversation/ConversationPanel.tsx::sendMessage(brief)')).toBe(true)
    // Magnitude: most allow-listed typed-composer sources are seen as user input by provenance, not by the list.
    expect(Object.keys(ALLOWED).filter(has).length).toBeGreaterThanOrEqual(7)
    // …and Olumi-text chip sites are NOT (the predicate does not answer yes for everything).
    expect(typed.some(s => /GuidanceStrip\.tsx::onSendMessage\(action\.prompt\)$/.test(s.key))).toBe(false)
    expect(scanTree().filter(s => s.chip && !s.userInput).length).toBeGreaterThanOrEqual(30)
  }, 60_000)

  it('POSITIVE CONTROL: a synthetic user-input send or dispatch with a chip is flagged; its chipless twin and an Olumi-text chip are not', () => {
    const fixture = [
      "const [draft, setDraft] = useState('')",
      "const typed = <input onChange={(e) => setDraft(e.target.value)} />",
      "const words = draft.trim()",
      "const dispatch = useGuidanceStore.getState()._dispatchAction",
      "sendMessage(words, { chipMeta: { id: 'x' } })",
      "dispatch({ label: 'Add', message: `Add: ${words}`, source: 'chip' })",
      "sendMessage(words)",
      "sendMessage('Olumi asks: is 20% realistic?', { chipMeta: { id: 'y' } })",
      "const brief = composerRef.current?.consumeBrief()",
      "sendMessage(brief, { chipMeta: { id: 'z' } })",
      "askAi({ userWords: 'x' }); state._sendMessage(req.userWords, { chipMeta: { id: 'w' } })",
    ].join('\n')
    const sites = scanSource('fixture.tsx', fixture)
    expect(sites.map(s => [s.family, s.userInput, s.chip])).toEqual([
      ['send', true, true], ['dispatch', true, true], ['send', true, false], ['send', false, true],
      ['send', true, true], ['send', true, true],
    ])
  })
})
