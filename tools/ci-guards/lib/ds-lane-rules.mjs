import { readFileSync } from 'node:fs'
import ts from 'typescript'
import postcss from 'postcss'
import defaultTheme from 'tailwindcss/defaultTheme.js'

// Resolve from the production token definitions even when --root points at fixtures.
// Tailwind's named sizes are in rem. Arbitrary canvas sizes declare their base px
// before multiplying by the canvas label scale.
const typographyPath = new URL('../../../src/styles/typography.ts', import.meta.url)
const sizes = new Map(Object.entries(defaultTheme.fontSize).map(([name, value]) => [
  `text-${name}`, Number.parseFloat(Array.isArray(value) ? value[0] : value) * 16,
]))
const weights = Object.fromEntries(Object.entries(defaultTheme.fontWeight).map(([name, weight]) => [
  `font-${name}`, Number(weight),
]))

function resolveTypography() {
  const source = ts.createSourceFile('typography.ts', readFileSync(typographyPath, 'utf8'), ts.ScriptTarget.Latest, true)
  const declaration = source.statements.filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((entry) => entry.name.getText(source) === 'typography')
  const initializer = declaration?.initializer
  const object = initializer && ts.isAsExpression(initializer) ? initializer.expression : initializer
  if (!object || !ts.isObjectLiteralExpression(object)) throw new Error('Expected a typography object literal')
  return new Map(object.properties.map((entry) => {
    if (!ts.isPropertyAssignment(entry) || !ts.isStringLiteralLike(entry.initializer)) {
      throw new Error(`Expected a literal typography token: ${entry.getText(source)}`)
    }
    const classes = entry.initializer.text.split(/\s+/)
    const size = classes.map((cls) => sizes.get(cls) ??
      Number(/^(?:text-\[)(?:length:)?(?:calc\()?(\d+(?:\.\d+)?)px/.exec(cls)?.[1]))
      .find(Number.isFinite)
    const weight = classes.map((cls) => weights[cls] ?? Number(/^font-\[(\d+)\]$/.exec(cls)?.[1]))
      .find(Number.isFinite) ?? 400
    return [entry.name.getText(source), { size, weight }]
  }))
}

const typography = resolveTypography()
const FLAGGED_SIZES = new Set([11, 13, 16])
const FLAGGED_WEIGHTS = new Set([600, 700])
const IMPORTANT = /(?:^|\s)((?:[^\s]+:)?!-?[\w\[][^\s]*)(?=\s|$)/g
const IMPORTANT_DECLARATION = /([\w-]+)\s*:[^;{}]*?!\s*important\b/gi
const BLUE = /(?:^|\s)(?<token>(?:[^\s]+:)?!?(?:bg|text|border|ring|fill|stroke|outline|decoration|from|to|via|accent|shadow|caret|divide|placeholder)-(?:info|primary)(?:-[\w-]+)?(?:\/(?:\d+|\[[^\s]+?\]))?)(?=$|[\s!])/g
const PANEL = /^(?:article|aside|details|div|form|main|nav|section)$/
const PANEL_PADDING = /(?:^|[\s:])!?(p(?:x)?-4)(?=$|[\s!])/g
const COPY_PROPS = new Set(['words', 'label', 'aria-label', 'placeholder', 'tip'])
const UI_WORDS = /—|(?<=[\p{L}\p{N}]\s*)&(?=\s*[\p{L}\p{N}])|(?<![\p{L}\p{N}_])(?:color|behavior|center|organize|analyze|favorite|gray|recommend|best|winner|you\s+should|go\s+with)(?![\p{L}\p{N}_])/giu
const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu
const PRODUCT_NAMES = new Set(['Olumi', "Olumi's", 'Olumi’s'])
const SPACING_UTILITY = /(?:^|:)!?-?(?:[pm][xytrblse]?|gap(?:-[xy])?|space-[xy])-(\[.*\]|0\.5|px|3\.5|7|9|11|14)!?$/
const CLASS_RECIPE_NAME = /(?:^|_)CLASS(?:ES)?(?:_|$)|^class(?:Names?|es)?$|Class(?:Names?|es|Recipes)?$/
const CLASS_HELPERS = new Set(['clsx', 'cn', 'classNames', 'classnames', 'twMerge'])
const BUTTON_WRAPPER = /^(?:button|Button|HoverButton|OkIconButton|MenuItem|SubMenu|MenuRow|CanvasToolButton|ViewSummaryTrigger|VersionsTrigger|SizeEditButton|LaneLinkRemoveButton|AskButton|RecordStepButton|UseAsActionButton|CommitToThisButton)$/
const NON_FACE_VARIANT = /(?:^|:)(?:(?:before|after|\*{1,2}):|\[&[>_+~])/
const BUTTON_HEIGHT = /(?:^|:)!?(?:(?:h|min-h|size)-.+|\[(?:height|min-height):.+\])!?$/

function isButtonSite(tag, attribute) {
  return BUTTON_WRAPPER.test(tag) ||
    (tag === 'Hover' && attribute('as') === 'button') ||
    (tag === 'input' && /^(?:button|submit|reset)$/.test(attribute('type') ?? '')) ||
    /^(?:button|tab|menuitem(?:radio|checkbox)?)$/.test(attribute('role') ?? '')
}
const SPACE_VAR = /\bvar\(\s*--space-[\w-]+(?=\s*[,)]|_)/
const STYLE_SPACING = /^(?:(?:padding|margin)(?:[A-Z]\w*)?|gap|rowGap|columnGap)$/
const CSS_SPACING = /^(?:(?:padding|margin)(?:-[a-z-]+)?|gap|row-gap|column-gap)$/i

function scanSpacingUtilities(text, add) {
  for (const token of text.split(/\s+/)) {
    const value = SPACING_UTILITY.exec(token)?.[1]
    if (value === undefined) continue
    if (!value.startsWith('[')) add(`off-scale utility: ${token}`)
    else if (!SPACE_VAR.test(value)) add(`arbitrary utility: ${token}`)
  }
}

function scanStyleSpacing(node, add) {
  if (ts.isPropertyAssignment(node) && STYLE_SPACING.test(node.name.text ?? '')) {
    let value = node.initializer
    while (ts.isParenthesizedExpression(value) || ts.isAsExpression(value) || ts.isSatisfiesExpression(value)) {
      value = value.expression
    }
    const number = ts.isPrefixUnaryExpression(value) &&
      (value.operator === ts.SyntaxKind.MinusToken || value.operator === ts.SyntaxKind.PlusToken) ? value.operand : value
    if (ts.isNumericLiteral(number) && Number(number.text) !== 0) {
      add(node, `numeric style: ${node.name.text}: ${value.getText()}`)
    }
  }
  ts.forEachChild(node, (child) => scanStyleSpacing(child, add))
}

function hasOffScalePixels(value) {
  // Skip strings and comments, and keep track of nested calls within a spacing var() fallback.
  const parts = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\bvar\(\s*--space-[\w-]+(?=\s*[,)]|_)|[()]|(?<![\w.#-])[+-]?(?:\d*\.\d+|\d+)px\b/gi
  let tokenDepth = 0
  for (const [part] of value.matchAll(parts)) {
    if (part.toLowerCase().startsWith('var(')) tokenDepth++
    else if (part === '(' && tokenDepth > 0) tokenDepth++
    else if (part === ')' && tokenDepth > 0) tokenDepth--
    else if (tokenDepth === 0 && /^[+-]?\d*\.?\d+px$/i.test(part) && ![0, 1].includes(Math.abs(Number.parseFloat(part)))) return true
  }
  return false
}

function spacingDeclarationToken({ prop, value }) {
  if (CSS_SPACING.test(prop) && hasOffScalePixels(value)) {
    return `pixel declaration: ${prop}: ${value.replace(/\s+/g, ' ').trim()}`
  }
}

const TEMPLATE_HOLE = '__ds_css_interpolation__'

function scanTemplateSpacing(node, source, add) {
  const first = ts.isTemplateExpression(node) ? node.head : node
  let css = first.rawText ?? first.text
  if (ts.isTemplateExpression(node)) {
    for (const { expression, literal } of node.templateSpans) {
      const lines = source.text.slice(expression.pos, literal.getStart(source)).replace(/[^\r\n]/g, '')
      css += TEMPLATE_HOLE + lines + (literal.rawText ?? literal.text)
    }
  }
  if (!css.includes('{') || !/px\b/i.test(css)) return

  // A complete interpolation can stand between rules or declarations. Keep
  // the marker in names and values so declarations with holes are skipped.
  css = css.replace(/(^|[;{}])(\s*)__ds_css_interpolation__(?=\s*(?:[;}]|$)|\s+[\w-]+\s*:)/g, '$1$2/*__ds_css_interpolation__*/')
  let stylesheet
  try {
    stylesheet = postcss.parse(css)
  } catch (error) {
    if (error.name !== 'CssSyntaxError') throw error
    return
  }
  const firstLine = source.getLineAndCharacterOfPosition(first.getStart(source)).line
  stylesheet.walkDecls((declaration) => {
    if (declaration.parent.type === 'root') return
    const { start, end } = declaration.source
    if (css.slice(start.offset, end.offset).includes(TEMPLATE_HOLE)) return
    const token = spacingDeclarationToken(declaration)
    if (token) add(token, firstLine + start.line - 1)
  })
}

// Only an object literal whose every property explicitly names a CSS variable is exempt.
// Computed keys, spreads and variables can introduce ordinary properties and still count.
function customPropertiesOnly(attribute) {
  const expr = attribute.initializer
  let object = expr && ts.isJsxExpression(expr) ? expr.expression : undefined
  while (object && (ts.isAsExpression(object) || ts.isSatisfiesExpression(object) || ts.isParenthesizedExpression(object))) {
    object = object.expression
  }
  return object && ts.isObjectLiteralExpression(object) && object.properties.length > 0 &&
    object.properties.every((property) => ts.isPropertyAssignment(property) &&
      ts.isStringLiteral(property.name) && /^--[\w-]+$/.test(property.name.text))
}

const OLUMI_OWNED_BLUE_ALLOWLIST = {
  'olumiView/Badge.tsx': ['border-info', 'text-info'], // Olumi's proposed badge and its change words.
  'olumiView/DraftingBoard.tsx': ['bg-info'], // Status of the board Olumi is laying.
  'olumiView/ViewChat.tsx': ['text-info'], // Olumi's mark beside its pre-mortem story.
  'olumiView/ViewFigureFirst.tsx': ['border-info/40', 'bg-info'], // Olumi's request and its side of the figure comparison.
  'olumiView/ViewReasoning.tsx': ['fill-info', 'text-info'], // Olumi's figure, premise and challenge marks.
  'olumiView/look/icons.tsx': ['text-info'], // Registry mapping for Olumi's ink.
  'olumiView/port/AnalysisReaders.tsx': ['text-info'], // Olumi's analysis marks.
  'olumiView/port/ChanceChart.tsx': ['text-info'], // Olumi's figure and inference marks.
  'olumiView/port/PortAnalysisTab.tsx': ['text-info'], // Olumi's marks in analysis rows and comparisons.
  'olumiView/port/WhatMovesIt.tsx': ['text-info'], // Olumi's figure and science marks.
  'olumiView/previous/CoreCard.tsx': ['border-info', 'text-info'], // Olumi's proposals, rests-on provenance and pre-mortem marks.
  'olumiView/reasoning/StateStrip.tsx': ['border-info'], // Olumi's held proposal.
  'olumiView/strategy/overview/StrategyOverviewPage.tsx': ['border-info/30'], // Strategy row marked as Olumi's.
  'olumiView/v12/bands/BandNodes.tsx': ['border-info'], // Olumi's band proposal.
  'olumiView/v12/cards/marks.tsx': ['text-info'], // Olumi's change glyph.
  'olumiView/v12/chat/OlumiAsks.tsx': ['border-info/30', 'bg-info', 'bg-info/30'], // Olumi's question and its question progress marks.
  'olumiView/v12/chat/richText.tsx': ['text-info'], // A source link rendered inside Olumi's reply.
  'olumiView/v12/journey/JourneyRecord.tsx': ['border-info/40', 'text-info'], // Olumi-authored timeline entries and its kept suggestions.
}
const FLOATING_TOOLBAR_LANE_BLUE_ALLOWLIST = {
  'olumiView/ViewPreMortemKey.tsx': [
    'text-info', // Olumi's story and response. Also used by the existing prompt control pending its migration.
    'border-info/40', 'focus-visible:ring-info/50', 'bg-info', 'focus-visible:ring-info', // The unmigrated pre-mortem tray controls.
  ],
  'olumiView/v12/lenses/LensesMenu.tsx': ['text-info'], // Olumi or mixed provenance and Olumi's assumptions.
}
const EDITING_LANE_BLUE_ALLOWLIST = {
  'olumiView/SelectedRename.tsx': ['text-info'], // Olumi author attribution.
  'olumiView/model/editors.tsx': ['text-info'], // Action originating from Olumi.
  'olumiView/v12/edit/LaneInspector.tsx': ['text-info'], // Olumi sources and proposed values.
  'olumiView/v12/frame/FramePage.tsx': ['border-info'], // Olumi's proposed-card borders.
}
const OLDER_LOOK_BLUE_ALLOWLIST = {
  'olumiView/AddFigure.tsx': ['focus-visible:ring-info/50'], // Only the older Add form still uses this field focus.
  'olumiView/FigureEdit.tsx': ['text-info', 'focus-visible:ring-info/50'], // Older in-place edit actions and field focus.
  'olumiView/LinkRemove.tsx': ['text-info'], // Older inline link removal.
  'olumiView/Rename.tsx': ['text-info', 'focus-visible:ring-info/50'], // Older rename action and field focus.
  'olumiView/look/Menu.tsx': ['focus-visible:ring-primary/50'], // Shared menu's older focus.
  'olumiView/v12/edit/EditForm.tsx': ['focus-visible:ring-info/50'], // The older field recipe, separate from the lane's neutral field.
  'olumiView/v12/inspect/FigureInspector.tsx': ['focus-visible:ring-info/50'], // The older inspector's field focus.
  'olumiView/v12/frame/FramePage.tsx': ['focus-visible:ring-info/50'], // The older Frame controls' focus.
}

function blueAllowed(file, token) {
  return [OLUMI_OWNED_BLUE_ALLOWLIST, FLOATING_TOOLBAR_LANE_BLUE_ALLOWLIST, EDITING_LANE_BLUE_ALLOWLIST, OLDER_LOOK_BLUE_ALLOWLIST]
    .some((allowlist) => allowlist[file]?.includes(token))
}

function isStringSegment(node) {
  return ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
}

function readClassStrings(node, read, helperArgument = false, resolve) {
  const visit = (value) => readClassStrings(value, read, helperArgument, resolve)
  if (!node) return
  if (isStringSegment(node)) return read(node)
  if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node) ||
      ts.isSpreadElement(node)) return visit(node.expression)
  if (ts.isTemplateExpression(node)) {
    read(node.head)
    for (const span of node.templateSpans) {
      visit(span.expression)
      read(span.literal)
    }
  } else if (ts.isTaggedTemplateExpression(node) && node.tag.getText() === 'String.raw') {
    visit(node.template)
  } else if (ts.isConditionalExpression(node)) {
    visit(node.whenTrue)
    visit(node.whenFalse)
  } else if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind
    if ([ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(op)) visit(node.left)
    if ([ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.AmpersandAmpersandToken].includes(op)) visit(node.right)
  } else if (ts.isArrayLiteralExpression(node)) {
    node.elements.forEach(visit)
  } else if (ts.isObjectLiteralExpression(node)) {
    for (const entry of node.properties.filter(ts.isPropertyAssignment)) {
      // A helper's object keys are classes. A recipe's keys name its variants.
      if (helperArgument) {
        if (ts.isStringLiteralLike(entry.name)) read(entry.name)
      } else {
        visit(entry.initializer)
      }
    }
  } else if (ts.isCallExpression(node) && node.expression.getText() === 'Object.freeze') {
    visit(node.arguments[0])
  } else if (resolve && ts.isCallExpression(node) && CLASS_HELPERS.has(node.expression.getText())) {
    for (const argument of node.arguments) readClassStrings(argument, read, true, resolve)
  } else if (resolve && ts.isIdentifier(node)) {
    visit(resolve(node.text))
  }
}

function jsxCopy(text) {
  return text.replace(/&(?:amp|#0*38|#x0*26);/gi, '&')
    .replace(/&(?:mdash|#0*8212|#x0*2014);/gi, '—')
    .replace(/&apos;/g, "'")
}

// Follow the values an expression can render, leaving conditions, calls and View reads alone.
function readCopy(node, read, started = false) {
  if (!node) return started
  if (ts.isJsxText(node) || isStringSegment(node)) return read(node, started)
  if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) {
    return readCopy(node.expression, read, started)
  }
  if (ts.isConditionalExpression(node)) {
    const whenTrue = readCopy(node.whenTrue, read, started)
    const whenFalse = readCopy(node.whenFalse, read, started)
    return whenTrue && whenFalse
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) {
      readCopy(node.right, read, started)
    } else if (op === ts.SyntaxKind.PlusToken) {
      return readCopy(node.right, read, readCopy(node.left, read, started))
    } else if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      const left = readCopy(node.left, read, started)
      const right = readCopy(node.right, read, started)
      return left && right
    }
  }
  if (ts.isTemplateExpression(node)) {
    return node.templateSpans.reduce((seen, span) =>
      read(span.literal, readCopy(span.expression, read, seen)), read(node.head, started))
  }
  return started
}

function isViewCopy(opening) {
  return opening.attributes.properties.some((prop) => ts.isJsxAttribute(prop) && prop.name.getText() === 'data-view')
}

function isViewChild(node) {
  // Fragments can group a marked element's content. A nested element owns its own copy.
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxElement(parent)) return isViewCopy(parent.openingElement)
  }
  return false
}

/** Collect the lane's syntax-sensitive rules in a single traversal. Each hit has a source offset. */
export function scanLaneSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const hits = {}
  const addAtLine = (rule, token, line) => {
    const occurrences = hits[rule] ??= []
    occurrences.push({ line, token })
  }
  const add = (rule, node, token) => addAtLine(rule, token, source.getLineAndCharacterOfPosition(node.getStart(source)).line)
  const localClasses = new Map()
  function collectLocalClasses(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const name = node.name.text
      // Skip ambiguous names such as `className` declared in several components.
      localClasses.set(name, localClasses.has(name) ? undefined : node.initializer)
    }
    ts.forEachChild(node, collectLocalClasses)
  }
  if (file.endsWith('.tsx')) collectLocalClasses(source)
  const spacingClassStrings = new Set()
  const readSpacingClass = (node) => {
    if (spacingClassStrings.has(node)) return
    spacingClassStrings.add(node)
    scanSpacingUtilities(node.text, (token) => add('v12-spacing', node, token))
  }
  const scanStrings = (node, regex, rule) => {
    if (isStringSegment(node)) {
      for (const match of node.text.matchAll(regex)) add(rule, node, match[1])
    } else {
      ts.forEachChild(node, (child) => scanStrings(child, regex, rule))
    }
  }
  const copyText = (node) => ts.isJsxText(node) || ts.isJsxAttribute(node.parent) ? jsxCopy(node.text) : node.text
  const checkWords = (node) => {
    for (const [match] of copyText(node).matchAll(UI_WORDS)) {
      add('v12-ui-words', node, match.toLowerCase().replace(/\s+/g, ' '))
    }
  }
  const checkCase = (node, started) => {
    for (const [word] of copyText(node).matchAll(WORD)) {
      if (started && /^\p{Lu}/u.test(word) && !PRODUCT_NAMES.has(word)) {
        add('v12-sentence-case', node, word)
      }
      started = true
    }
    return started
  }
  const checkCaseChildren = (started, child) => {
    if (ts.isJsxElement(child)) {
      // An inline element can hold part of a heading or button's text.
      return isViewCopy(child.openingElement) ? started : child.children.reduce(checkCaseChildren, started)
    }
    if (ts.isJsxFragment(child)) return child.children.reduce(checkCaseChildren, started)
    return readCopy(child, checkCase, started)
  }
  function visit(node) {
    if (file.endsWith('.tsx') && (ts.isTemplateExpression(node) || ts.isNoSubstitutionTemplateLiteral(node))) {
      scanTemplateSpacing(node, source, (token, line) => addAtLine('v12-spacing', token, line))
    }
    if ((ts.isVariableDeclaration(node) || ts.isPropertyAssignment(node)) && CLASS_RECIPE_NAME.test(node.name.text ?? '')) {
      readClassStrings(node.initializer, readSpacingClass)
    }
    if (ts.isCallExpression(node) && CLASS_HELPERS.has(node.expression.getText(source))) {
      for (const argument of node.arguments) readClassStrings(argument, readSpacingClass, true)
    }
    if ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
        ts.isIdentifier(node.expression) && node.expression.text === 'typography') {
      const name = ts.isPropertyAccessExpression(node) ? node.name.text
        : ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined
      const resolved = typography.get(name)
      if (resolved && (FLAGGED_SIZES.has(resolved.size) || FLAGGED_WEIGHTS.has(resolved.weight))) {
        add('v12-typography-token', node, `typography.${name} (${resolved.size ?? 'inherited'}px/${resolved.weight})`)
      }
    }
    if (file.endsWith('.tsx') && (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
      const tag = node.tagName.getText(source)
      const attributes = node.attributes.properties.filter(ts.isJsxAttribute)
      const localCopy = !isViewCopy(node)
      const role = attributes.find((attribute) => attribute.name.getText(source) === 'role')?.initializer
      const attribute = (name) => {
        let value = attributes.find((entry) => entry.name.getText(source) === name)?.initializer
        if (value && ts.isJsxExpression(value)) value = value.expression
        return value && ts.isStringLiteralLike(value) ? value.text : undefined
      }
      if (isButtonSite(tag, attribute) || (file === 'olumiView/look/Menu.tsx' && tag === 'Row')) {
        const size = attributes.some((entry) => entry.name.getText(source) === 'size') ? attribute('size') : 'md'
        if (tag === 'Button' && (size === 'sm' || size === 'md')) {
          add('v12-button-size', node, `<Button size="${size}">`)
        }
        const seen = new Set()
        const read = (literal) => {
          for (const token of literal.text.split(/\s+/)) {
            if (!NON_FACE_VARIANT.test(token) && BUTTON_HEIGHT.test(token)) {
              add('v12-button-size', node, token)
            }
          }
        }
        const resolve = (name) => {
          if (seen.has(name)) return undefined
          seen.add(name)
          return localClasses.get(name)
        }
        const classes = attributes.find((entry) => /^(?:className|class)$/.test(entry.name.getText(source)))
        readClassStrings(classes?.initializer, read, false, resolve)
        const style = attributes.find((entry) => entry.name.getText(source) === 'style')?.initializer
        const readHeight = (value) => {
          if (ts.isPropertyAssignment(value) && /^(?:height|minHeight)$/.test(value.name.text ?? '')) {
            add('v12-button-size', node, `style: ${value.name.text}`)
          }
          ts.forEachChild(value, readHeight)
        }
        if (style) readHeight(style)
      }
      const sentenceCase = /^(?:h[1-6]|button|Button|HoverButton|OkIconButton)$/.test(tag) ||
        (role && ts.isStringLiteral(role) && /^(?:heading|button)$/.test(role.text))
      for (const attribute of attributes) {
        const name = attribute.name.getText(source)
        if (localCopy && COPY_PROPS.has(name)) {
          readCopy(attribute.initializer, checkWords)
          if (sentenceCase && (name === 'label' || name === 'aria-label')) readCopy(attribute.initializer, checkCase)
        }
        if (/^[a-z][\w-]*$/.test(tag)) {
          if (name === 'style' && !customPropertiesOnly(attribute)) add('v12-inline-style', attribute, `<${tag} style>`)
          if (name === 'title') add('v12-native-title', attribute, `<${tag} title>`)
        }
        if (name === 'className' && PANEL.test(tag) && attribute.initializer) {
          scanStrings(attribute.initializer, PANEL_PADDING, 'v12-panel-padding')
        }
        if (name === 'className' || name === 'class') readClassStrings(attribute.initializer, readSpacingClass)
        if (name === 'style' && attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression) {
          scanStyleSpacing(attribute.initializer.expression, (property, token) => add('v12-spacing', property, token))
        }
      }
      if (localCopy && sentenceCase && ts.isJsxOpeningElement(node)) {
        node.parent.children.reduce(checkCaseChildren, false)
      }
    }
    if (file.endsWith('.tsx') && (ts.isJsxText(node) || ts.isJsxExpression(node))) {
      const parent = node.parent
      if ((ts.isJsxFragment(parent) || ts.isJsxElement(parent)) && !isViewChild(node)) {
        readCopy(node, checkWords)
      }
    }
    if (isStringSegment(node)) {
      if (file.endsWith('.tsx')) {
        for (const match of node.text.matchAll(IMPORTANT)) add('v12-important-utility', node, match[1])
        for (const match of node.text.matchAll(IMPORTANT_DECLARATION)) add('v12-important-css', node, `${match[1]} !important`)
      }
      for (const { groups: { token } } of node.text.matchAll(BLUE)) {
        if (!blueAllowed(file, token)) add('v12-blue-utility', node, token)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return hits
}


// PostCSS recognises multiline declarations, while quoted text and comments are
// distinct from the declaration's important flag.
export function scanLaneStylesheet(file, text) {
  const hits = { 'v12-important-css': [], 'v12-blue-css-var': [], 'v12-spacing': [] }
  const stylesheet = postcss.parse(text, { from: file })
  stylesheet.walkAtRules('apply', (rule) => {
    scanSpacingUtilities(rule.params, (token) => hits['v12-spacing'].push({ line: rule.source.start.line - 1, token }))
  })
  stylesheet.walkDecls((declaration) => {
    const line = declaration.source.start.line - 1
    const spacing = spacingDeclarationToken(declaration)
    if (spacing) hits['v12-spacing'].push({ line, token: spacing })
    if (declaration.important) {
      hits['v12-important-css'].push({ line, token: `${declaration.prop} !important` })
    }
    // Match actual var() reads and skip quoted strings and comments in declaration values.
    const blue = /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\/\*[\s\S]*?\*\/|\bvar\(\s*(--info(?:-ink)?)(?=\s*[,)])/g
    for (const [, name] of declaration.value.matchAll(blue)) {
      if (name !== undefined) hits['v12-blue-css-var'].push({ line, token: `var(${name})` })
    }
  })
  return hits
}
