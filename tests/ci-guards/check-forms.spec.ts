import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const script = resolve('tools/ci-guards/check-forms.mjs')
const registryPath = 'docs/Design/system/forms.json'
const chart = 'src/olumiView/v12/scale/RangeBar.tsx'
const links = 'src/olumiView/v12/links/styles.ts'
const legacy = 'src/olumiView/OldChart.tsx'
const css = 'src/olumiView/look/fixture.css'
const cleanChart = "export function RangeBar() { return visible ? <div data-form='CH-range' className='ok-scale-track' /> : null }"
const cleanLinks = "export const LINK_STYLES = { effect: { end: 'arrow' } } satisfies Record<string, object>"
const registry = {
  faces: ['FACE-range'],
  charts: [{ id: 'CH-range', component: chart, status: 'built' }],
  lines: ['LN-effect', 'LN-doubt'],
  tabs: ['TT-compare'],
  renderers: [chart],
  primitives: {
    import_path: 'src/olumiView/v12/scale',
    class_prefixes: ['ok-scale-', 'ok-simple-band', 'ok-chart'],
    svg: { elements: ['rect', 'line', 'circle', 'path'], excluded_directories: ['icon', 'icons', 'marker', 'markers'] },
  },
  legacy: [{ file: legacy, replaced_by: 'CH-range' }],
  dashes: [{ value: '5 4', note: 'LN-doubt' }],
  link_roles: { effect: 'LN-effect' },
}

function run(...args: string[]) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' })
}

describe('forms conformance guard', () => {
  let root: string

  function write(file: string, code: string) {
    const output = join(root, file)
    mkdirSync(dirname(output), { recursive: true })
    writeFileSync(output, code)
  }

  function scan(...args: string[]) {
    return run('--root', root, ...args)
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'check-forms-'))
    write(registryPath, JSON.stringify(registry))
    write(chart, cleanChart)
    write(links, cleanLinks)
    write(legacy, 'export const OldChart = () => <svg><rect /></svg>')
    write(css, '.doubt { stroke-dasharray: 5 4; }')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it.each([
    {
      name: 'an unregistered data-form',
      file: 'src/olumiCore/NewFace.tsx',
      code: '// data-form="comment"\nexport const Face = () => <div data-form="FACE-new" />',
      clean: 'export const Face = () => <div data-form="FACE-range" />',
      line: 2,
      breach: 'form-id unregistered data-form "FACE-new"',
    },
    {
      name: 'a RangeBar import outside the renderers',
      file: 'src/canvas/NewChart.tsx',
      code: "import { RangeBar } from '../olumiView/v12/scale/RangeBar'\nexport const NewChart = RangeBar",
      clean: 'export const NewChart = () => <div />',
      line: 1,
      breach: 'chart-primitive drawing primitive outside renderers and legacy',
    },
    {
      name: 'a chart class outside the renderers',
      file: 'src/canvas/NewChart.css',
      code: '.layout .ok-chart-plot { display: grid; }',
      clean: '.layout { display: grid; }',
      line: 1,
      breach: 'chart-primitive drawing primitive outside renderers and legacy',
    },
    {
      name: 'an SVG chart outside the renderers',
      file: 'src/canvas/NewChart.tsx',
      code: 'export const NewChart = () => <svg><g>\n  <circle />\n</g></svg>',
      clean: 'export const NewChart = () => <><svg /><circle /></>',
      line: 2,
      breach: 'chart-primitive drawing primitive outside renderers and legacy',
    },
    {
      name: 'an unregistered CSS dash',
      file: css,
      code: '.doubt {\n  stroke-dasharray: 3 3;\n}',
      clean: '/* stroke-dasharray: 3 3; */\n.doubt { stroke-dasharray: 5 4; }',
      line: 2,
      breach: 'stroke-dasharray unregistered dash "3 3"',
    },
    {
      name: 'an unregistered JSX dash inside an SVG exception',
      file: 'src/canvas/icons/NewIcon.tsx',
      code: "export const Icon = () => <svg><line strokeDasharray={on ? '5 4' : '3 3'} /></svg>",
      clean: 'export const Icon = () => <svg><line strokeDasharray="5 4" /></svg>',
      line: 1,
      breach: 'stroke-dasharray unregistered dash "3 3"',
    },
    {
      name: 'an unregistered TS style dash',
      file: 'src/canvas/style.ts',
      code: "export const style = { 'stroke-dasharray': '3 3' }",
      clean: "export const style = { strokeDasharray: '5 4' }",
      line: 1,
      breach: 'stroke-dasharray unregistered dash "3 3"',
    },
    {
      name: 'an extra LINK_STYLES key',
      file: links,
      code: 'export const LINK_STYLES = { effect: {},\n  ["extra"]: {},\n} as const',
      clean: cleanLinks,
      line: 2,
      breach: 'link-role LINK_STYLES key "extra" is missing from link_roles',
    },
    {
      name: 'a registry role missing from LINK_STYLES',
      file: links,
      code: 'export const LINK_STYLES = {}',
      clean: cleanLinks,
      line: 1,
      breach: 'link-role link_roles key "effect" is missing from LINK_STYLES',
    },
    {
      name: 'a registered component missing its root ID',
      file: chart,
      code: 'export const RangeBar = () => (\n  <div><span data-form="CH-range" /></div>\n)',
      clean: cleanChart,
      line: 2,
      breach: 'chart-root expected data-form="CH-range" on the component root',
    },
  ])('rejects $name and passes after repair', ({ file, code, clean, line, breach }) => {
    write(file, code)
    const bad = scan()
    expect(bad.stderr.trim()).toBe(`${file}:${line} ${breach}`)
    expect(bad.status).toBe(1)
    write(file, clean)
    const good = scan()
    expect(good.stderr).toBe('')
    expect(good.status).toBe(0)
  })

  it('lists primitive matches and allows a legacy file to shrink or disappear', () => {
    write('src/canvas/NewChart.tsx', "export const Plot = () => <div className='ok-simple-band-plot' />")
    write('src/canvas/__tests__/Ignore.tsx', '<svg><rect data-form="unknown" /></svg>')
    write('src/olumiCore/__fixtures__/Ignore.tsx', '<svg><rect /></svg>')
    write('src/olumiView/fixtures/Ignore.tsx', '<svg><rect /></svg>')
    const listing = scan('--list')
    expect(listing.status).toBe(0)
    expect(listing.stderr).toBe('')
    expect(listing.stdout.trim().split('\n')).toEqual(['src/canvas/NewChart.tsx', legacy, chart])

    rmSync(join(root, 'src/canvas/NewChart.tsx'))
    write(legacy, '<div />')
    expect(scan().status).toBe(0)
    rmSync(join(root, legacy))
    expect(scan().status).toBe(0)
  })
})

it('passes on the real tree', () => {
  const result = run()
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
}, 15_000)
