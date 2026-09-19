/**
 * ⭐⭐ A RECORDER WITH NO READER IS NOT A DIAGNOSTIC.
 *
 * "Layout failed. Try again." was open from 26 Aug to 19 Sep 2026. Two theories
 * were refuted by execution. It stayed open because the evidence never reached
 * anybody: the rejection was DEV-only until #1479, and after #1479 the ring it
 * wrote to had **33 writers across `src/` and zero readers under
 * `src/components/debug/`** — so the founder could hit the defect, export the
 * bundle, and hand over an artefact with no trace of it.
 *
 * ⚠ AND A COMMENT IN `main.tsx` STATED THE WIRE EXISTED. That is why nobody
 * checked. The guard below therefore does not test the comment; it tests the
 * WIRE, two ways, because each is blind to a different way of losing it:
 *   · STRUCTURAL — the export layer must contain a real read of the ring. A
 *     refactor that drops the call site reds here even if no behaviour test
 *     happens to cover the collector.
 *   · BEHAVIOURAL — a failure entry must survive selection and reach the
 *     output, including when the ring is dominated by render spam, which is
 *     exactly the shape a real canvas session produces.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { collectCanvasBreadcrumbs } from '../canvasBreadcrumbs'

type Ring = { logs: Array<{ t: number; m: string; data?: unknown }> }
const win = () => globalThis as unknown as { __SAFE_DEBUG__?: Ring }

describe('the canvas breadcrumb ring reaches the exported bundle', () => {
  beforeEach(() => { delete win().__SAFE_DEBUG__ })
  afterEach(() => { delete win().__SAFE_DEBUG__ })

  describe('STRUCTURAL: the export layer really reads the ring', () => {
    it('some file under src/components/debug/ reads __SAFE_DEBUG__', () => {
      // This assertion is the one that was FALSE for months. Derived by walking
      // the directory, not from a hand-kept list of files.
      const root = resolve(process.cwd(), 'src/components/debug')
      const walk = (d: string): string[] =>
        readdirSync(d, { withFileTypes: true }).flatMap(e => {
          const p = resolve(d, e.name)
          if (e.isDirectory()) return e.name === '__tests__' ? [] : walk(p)
          return /\.tsx?$/.test(e.name) ? [p] : []
        })
      const files = walk(root)
      // ⚠ PRECONDITION, AND IT BIT ON ITS FIRST RUN — the floor was set from a
      // guess (3 files in one subdirectory) rather than measured, and the scan
      // reported a wrong place that was in fact the right place. Derived at
      // `f22e15fd`: 25 non-test files under this tree. A floor of 10 leaves room
      // to delete a few without turning this guard into a tautology.
      expect(files.length, 'too few files found — the scan is looking in the wrong place').toBeGreaterThan(10)
      const readers = files.filter(f => readFileSync(f, 'utf8').includes('__SAFE_DEBUG__'))
      expect(readers, 'nothing under src/components/debug reads the breadcrumb ring').not.toHaveLength(0)
    })

    it('exportBundle assembles the field, by name', () => {
      const src = readFileSync(resolve(process.cwd(), 'src/components/debug/utils/exportBundle.ts'), 'utf8')
      expect(src).toContain('canvas_breadcrumbs: collectCanvasBreadcrumbs()')
    })
  })

  describe('BEHAVIOURAL: a failure survives a ring full of render spam', () => {
    it('keeps a layout failure buried under 500 render entries', () => {
      const logs = [
        { t: 1, m: 'canvas:trace:layout:failed', data: { phase: 'rejected', err: 'ELK: boom' } },
        ...Array.from({ length: 500 }, (_, i) => ({ t: 100 + i, m: 'canvas:render', data: { i } })),
      ]
      win().__SAFE_DEBUG__ = { logs }

      const out = collectCanvasBreadcrumbs()
      expect(out.available).toBe(true)
      expect(out.total_in_ring).toBe(501)
      expect(out.failure_count, 'the failure was dropped by selection').toBe(1)
      const failure = out.entries.find(e => e.m.includes('layout:failed'))
      expect(failure, 'the ONE entry this whole file exists for is missing').toBeTruthy()
      expect(JSON.stringify(failure!.data)).toContain('rejected')
      // A dropped entry must never be silent.
      expect(out.truncated).toBe(true)
    })

    it('DISCRIMINATION: "ring absent" and "ring empty" are different answers', () => {
      // These two were indistinguishable in `console_logs` for months, and that
      // ambiguity is a large part of why the incident stayed open.
      const absent = collectCanvasBreadcrumbs()
      expect(absent.available).toBe(false)
      expect(absent.unavailable_reason).toContain('no_ring_on_window')

      win().__SAFE_DEBUG__ = { logs: [] }
      const empty = collectCanvasBreadcrumbs()
      expect(empty.available).toBe(true)
      expect(empty.entries).toHaveLength(0)
      expect(empty.unavailable_reason).toBeUndefined()
    })

    it('a short ring is carried whole and reports truncated: false', () => {
      win().__SAFE_DEBUG__ = { logs: [{ t: 1, m: 'boot:start' }, { t: 2, m: 'canvas:render' }] }
      const out = collectCanvasBreadcrumbs()
      expect(out.entry_count).toBe(2)
      expect(out.truncated).toBe(false)
    })

    it('⛔ the collector NEVER throws, whatever is in the ring', () => {
      // A diagnostic that breaks the export it belongs to loses the whole
      // bundle for the user who was chasing a defect.
      const cyclic: Record<string, unknown> = { m: 'canvas:trace:layout:failed' }
      cyclic.self = cyclic
      win().__SAFE_DEBUG__ = { logs: [cyclic as never, null as never, 42 as never, { t: 1, m: 'ok' }] }
      expect(() => collectCanvasBreadcrumbs()).not.toThrow()
      const out = collectCanvasBreadcrumbs()
      expect(out.available).toBe(true)
      // Malformed entries are dropped, well-formed ones survive beside them.
      expect(out.entries.some(e => e.m === 'ok')).toBe(true)
    })
  })
})
