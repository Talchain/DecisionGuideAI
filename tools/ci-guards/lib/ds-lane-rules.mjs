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
const BLUE = /(?:^|[\s:])!?(?<utility>(?:bg|text|border|ring|fill|stroke|outline|decoration|from|to|via|accent|shadow|caret|divide|placeholder)-(?:info|primary)(?:-[\w-]+)?(?:\/(?:\d+|\[[^\s]+?\]))?)(?=$|[\s!])/g
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

// These files use blue for Olumi's status, proposal, words, marks or provenance.
const OLUMI_OWNED_BLUE_FILES = new Set([
  'olumiView/Badge.tsx', 'olumiView/DraftingBoard.tsx', 'olumiView/ViewChat.tsx',
  'olumiView/ViewFigureFirst.tsx', 'olumiView/ViewReasoning.tsx', 'olumiView/look/icons.tsx',
  'olumiView/port/AnalysisReaders.tsx', 'olumiView/port/ChanceChart.tsx',
  'olumiView/port/PortAnalysisTab.tsx', 'olumiView/port/WhatMovesIt.tsx',
  'olumiView/previous/CoreCard.tsx', 'olumiView/reasoning/StateStrip.tsx',
  'olumiView/strategy/overview/StrategyOverviewPage.tsx', 'olumiView/v12/bands/BandNodes.tsx',
  'olumiView/v12/cards/marks.tsx', 'olumiView/v12/chat/OlumiAsks.tsx',
  'olumiView/v12/chat/richText.tsx', 'olumiView/v12/journey/JourneyRecord.tsx',
])

// Keep tracking exact exception tokens during the handoff. A new blue utility in these
// files still gates, and the owning lane removes the entry after migrating the control.
const FLOATING_TOOLBAR_LANE_BLUE_ALLOWLIST = {
  'olumiView/ViewLensBar.tsx': ['border-info/30'],
  'olumiView/ViewZoomNotice.tsx': ['text-info', 'ring-info'],
  'olumiView/ViewWhatIfKey.tsx': ['ring-info/50', 'border-info/30', 'text-info'],
  'olumiView/ViewPreMortemKey.tsx': ['border-info/40', 'text-info', 'ring-info/50', 'bg-info', 'ring-info'],
  'olumiView/v12/lenses/LensesMenu.tsx': ['text-info'], // Olumi or mixed provenance.
}
const EDITING_LANE_BLUE_ALLOWLIST = {
  'olumiView/AddFigure.tsx': ['ring-info/50'], // Shared handoff with the floating-toolbar lane.
  'olumiView/Rename.tsx': ['text-info', 'ring-info/50'],
  'olumiView/LinkRemove.tsx': ['text-info'],
  'olumiView/SelectedRename.tsx': ['text-info'], // Olumi author attribution.
  'olumiView/model/editors.tsx': ['text-info'], // Action originating from Olumi.
  'olumiView/v12/edit/EditForm.tsx': ['ring-info/50'], // Neutralised by the lane stylesheet until handoff.
  'olumiView/v12/edit/LaneInspector.tsx': ['text-info'], // Olumi sources and proposed values.
  'olumiView/v12/frame/FrameStage.tsx': ['ring-info/50'],
  'olumiView/v12/frame/FramePage.tsx': ['ring-info/50', 'border-info'], // Keep proposed-card borders.
}
// Shared Menu has neutral focus in its lane branch. Keep the older branch intact.
const OLDER_LOOK_BLUE_ALLOWLIST = { 'olumiView/look/Menu.tsx': ['ring-primary/50'] }

function blueAllowed(file, utility) {
  return OLUMI_OWNED_BLUE_FILES.has(file) ||
    [FLOATING_TOOLBAR_LANE_BLUE_ALLOWLIST, EDITING_LANE_BLUE_ALLOWLIST, OLDER_LOOK_BLUE_ALLOWLIST]
      .some((allowlist) => allowlist[file]?.includes(utility))
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
      for (const { groups: { utility } } of node.text.matchAll(BLUE)) {
        if (!blueAllowed(file, utility)) add('v12-blue-utility', node, utility)
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
  const hits = { 'v12-important-css': [] }
  postcss.parse(text, { from: file }).walkDecls((declaration) => {
    if (declaration.important) {
      hits['v12-important-css'].push({ line: declaration.source.start.line - 1, token: `${declaration.prop} !important` })
    }
  })
  return hits
}
