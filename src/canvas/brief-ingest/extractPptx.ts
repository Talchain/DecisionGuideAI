import { all, isHeaderRow, kids, openZip, parseXml, plural, readPart, withHeaders } from './ooxml'
import type { Extraction, Segment } from './types'

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'

function paragraphText(p: Element): string {
  return all(p, 't')
    .map((t) => t.textContent ?? '')
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Slide parts in presentation order, from presentation.xml and its rels. */
async function slideOrder(zip: Awaited<ReturnType<typeof openZip>>): Promise<string[]> {
  const pres = await readPart(zip, 'ppt/presentation.xml')
  const rels = await readPart(zip, 'ppt/_rels/presentation.xml.rels')
  if (pres && rels) {
    const targets = new Map<string, string>()
    for (const rel of all(parseXml(rels), 'Relationship')) {
      targets.set(rel.getAttribute('Id') ?? '', rel.getAttribute('Target') ?? '')
    }
    const ordered = all(parseXml(pres), 'sldId')
      .map((s) => targets.get(s.getAttributeNS(REL_NS, 'id') ?? s.getAttribute('r:id') ?? '') ?? '')
      .filter(Boolean)
      .map((t) => `ppt/${t.replace(/^\/?ppt\//, '').replace(/^\.\//, '')}`)
    if (ordered.length) return ordered
  }
  return Object.keys(zip.files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => Number(a.match(/\d+/g)?.pop()) - Number(b.match(/\d+/g)?.pop()))
}

interface SlideRead {
  lines: string[]
  charts: number
  pictures: number
}

function readShapes(container: Element, out: SlideRead, title: string[]): void {
  for (const shape of kids(container)) {
    switch (shape.localName) {
      case 'sp': {
        const ph = all(shape, 'ph')[0]
        const isTitle = ph ? /^(title|ctrTitle)$/.test(ph.getAttribute('type') ?? '') : false
        const paras = all(shape, 'p').filter((p) => p.namespaceURI !== shape.namespaceURI)
        const texts = paras.map(paragraphText).filter(Boolean)
        if (isTitle) title.push(texts.join(' '))
        else out.lines.push(...texts.map((t) => `- ${t}`))
        break
      }
      case 'graphicFrame': {
        const uri = all(shape, 'graphicData')[0]?.getAttribute('uri') ?? ''
        const table = all(shape, 'tbl')[0]
        if (table) {
          let header: string[] | null = null
          all(table, 'tr').forEach((tr, i) => {
            const cells = kids(tr, 'tc').map((tc) => all(tc, 'p').map(paragraphText).filter(Boolean).join(' '))
            if (cells.every((c) => c === '')) return
            if (i === 0 && isHeaderRow(cells)) {
              header = cells
              out.lines.push(`Table: ${cells.join(' | ')}`)
            } else {
              out.lines.push(`Table row: ${withHeaders(cells, header)}`)
            }
          })
        } else if (/chart|diagram|ole/i.test(uri)) {
          out.charts++
        }
        break
      }
      case 'pic':
        out.pictures++
        break
      case 'grpSp':
        readShapes(shape, out, title)
        break
      default:
        break
    }
  }
}

/**
 * Slide titles and text in slide order; tables row by row. Speaker notes are
 * never opened. Charts, SmartArt, embedded objects and pictures are said to be
 * "not read" and never guessed. Hidden slides are skipped and said so.
 */
export async function extractPptx(bytes: ArrayBuffer): Promise<Extraction> {
  const zip = await openZip(bytes)
  const order = await slideOrder(zip)
  const segments: Segment[] = []
  const notes: string[] = []
  const hidden: number[] = []
  const chartNotes: string[] = []
  let imageOnly = 0
  let picturesOnTextSlides = 0

  for (let i = 0; i < order.length; i++) {
    const n = i + 1
    const xml = await readPart(zip, order[i])
    if (!xml) continue
    const doc = parseXml(xml)
    const root = doc.documentElement
    if (root.getAttribute('show') === '0') {
      hidden.push(n)
      continue
    }
    const tree = all(doc, 'spTree')[0]
    const read: SlideRead = { lines: [], charts: 0, pictures: 0 }
    const title: string[] = []
    if (tree) readShapes(tree, read, title)
    const lines = [...title.filter(Boolean), ...read.lines]
    if (lines.length === 0) {
      if (read.charts + read.pictures > 0) imageOnly++
      continue
    }
    segments.push({ marker: `Slide ${n}`, text: lines.join('\n'), unit: n, countable: true })
    if (read.charts > 0) {
      chartNotes.push(`(${read.charts} ${plural(read.charts, 'chart', 'charts')} on Slide ${n} ${plural(read.charts, 'was', 'were')} not read)`)
    }
    if (read.pictures > 0) picturesOnTextSlides++
  }

  if (imageOnly > 0) {
    notes.push(
      imageOnly === 1
        ? '(1 slide is an image; its figures were not read)'
        : `(${imageOnly} slides are images; their figures were not read)`,
    )
  }
  notes.push(...chartNotes)
  if (picturesOnTextSlides > 0) {
    notes.push(`(pictures on ${picturesOnTextSlides} ${plural(picturesOnTextSlides, 'slide', 'slides')} were not read)`)
  }
  if (hidden.length > 0) {
    notes.push(`(${hidden.length} hidden ${plural(hidden.length, 'slide was', 'slides were')} not read: ${hidden.map((h) => `Slide ${h}`).join(', ')})`)
  }
  if (Object.keys(zip.files).some((f) => f.startsWith('ppt/notesSlides/'))) {
    notes.push('(speaker notes were not read)')
  }

  return {
    segments,
    notes,
    noun: ['slide', 'slides'],
    total: order.length,
    extra: imageOnly > 0 ? `${imageOnly} ${plural(imageOnly, 'was an image', 'were images')}` : undefined,
    unitCapped: true,
  }
}
