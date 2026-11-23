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

/** Collect the lane's syntax-sensitive rules in a single traversal. Each hit has a source offset. */
export function scanLaneSource(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
  const hits = {}
  const add = (rule, node, token) => {
    const occurrences = hits[rule] ??= []
    occurrences.push({ line: source.getLineAndCharacterOfPosition(node.getStart(source)).line, token })
  }
  const scanStrings = (node, regex, rule) => {
    if (isStringSegment(node)) {
      for (const match of node.text.matchAll(regex)) add(rule, node, match[1])
    } else {
      ts.forEachChild(node, (child) => scanStrings(child, regex, rule))
    }
  }
  function visit(node) {
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
      for (const attribute of node.attributes.properties.filter(ts.isJsxAttribute)) {
        const name = attribute.name.getText(source)
        if (/^[a-z][\w-]*$/.test(tag)) {
          if (name === 'style' && !customPropertiesOnly(attribute)) add('v12-inline-style', attribute, `<${tag} style>`)
          if (name === 'title') add('v12-native-title', attribute, `<${tag} title>`)
        }
        if (name === 'className' && PANEL.test(tag) && attribute.initializer) {
          scanStrings(attribute.initializer, PANEL_PADDING, 'v12-panel-padding')
        }
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
  const hits = { 'v12-important-css': [], 'v12-blue-css-var': [] }
  postcss.parse(text, { from: file }).walkDecls((declaration) => {
    const line = declaration.source.start.line - 1
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
