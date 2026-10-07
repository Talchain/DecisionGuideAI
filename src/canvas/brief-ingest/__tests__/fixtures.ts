/** Tiny Office files built in-test (no binary fixtures committed). */
import JSZip from 'jszip'

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export interface SlideSpec {
  title?: string
  bullets?: string[]
  table?: string[][]
  picture?: boolean
  chart?: boolean
  hidden?: boolean
  notes?: string
}

const textShape = (paras: string[], title: boolean) =>
  `<p:sp><p:nvSpPr><p:cNvPr id="2" name="s"/><p:cNvSpPr/><p:nvPr>${title ? '<p:ph type="title"/>' : ''}</p:nvPr></p:nvSpPr>` +
  `<p:txBody>${paras.map((t) => `<a:p><a:r><a:t>${esc(t)}</a:t></a:r></a:p>`).join('')}</p:txBody></p:sp>`

export async function buildPptx(slides: SlideSpec[]): Promise<ArrayBuffer> {
  const zip = new JSZip()
  const ids = slides.map((_, i) => `<p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`).join('')
  zip.file('ppt/presentation.xml', `<?xml version="1.0"?><p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst>${ids}</p:sldIdLst></p:presentation>`)
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${slides
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="slide" Target="slides/slide${i + 1}.xml"/>`)
      .join('')}</Relationships>`,
  )
  slides.forEach((s, i) => {
    let tree = ''
    if (s.title) tree += textShape([s.title], true)
    if (s.bullets) tree += textShape(s.bullets, false)
    if (s.table) {
      tree += `<p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>${s.table
        .map((row) => `<a:tr>${row.map((c) => `<a:tc><a:txBody><a:p><a:r><a:t>${esc(c)}</a:t></a:r></a:p></a:txBody></a:tc>`).join('')}</a:tr>`)
        .join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
    }
    if (s.chart) tree += `<p:graphicFrame><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"/></a:graphic></p:graphicFrame>`
    if (s.picture) tree += `<p:pic><p:nvPicPr><p:cNvPr id="9" name="Picture"/></p:nvPicPr></p:pic>`
    zip.file(
      `ppt/slides/slide${i + 1}.xml`,
      `<?xml version="1.0"?><p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"${s.hidden ? ' show="0"' : ''}><p:cSld><p:spTree>${tree}</p:spTree></p:cSld></p:sld>`,
    )
    if (s.notes) {
      zip.file(`ppt/notesSlides/notesSlide${i + 1}.xml`, `<?xml version="1.0"?><p:notes xmlns:p="${P}" xmlns:a="${A}"><a:t>${esc(s.notes)}</a:t></p:notes>`)
    }
  })
  return zip.generateAsync({ type: 'arraybuffer' })
}

export type DocxBlock = string | { hidden: string } | { table: string[][] } | { drawing: true }

export async function buildDocx(blocks: DocxBlock[]): Promise<ArrayBuffer> {
  const body = blocks
    .map((b) => {
      if (typeof b === 'string') return `<w:p><w:r><w:t xml:space="preserve">${esc(b)}</w:t></w:r></w:p>`
      if ('hidden' in b) return `<w:p><w:r><w:rPr><w:vanish/></w:rPr><w:t>${esc(b.hidden)}</w:t></w:r></w:p>`
      if ('drawing' in b) return `<w:p><w:r><w:drawing/></w:r></w:p>`
      return `<w:tbl>${b.table
        .map((row) => `<w:tr>${row.map((c) => `<w:tc><w:p><w:r><w:t>${esc(c)}</w:t></w:r></w:p></w:tc>`).join('')}</w:tr>`)
        .join('')}</w:tbl>`
    })
    .join('')
  const zip = new JSZip()
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`)
  return zip.generateAsync({ type: 'arraybuffer' })
}

export function asFile(bytes: ArrayBuffer | Uint8Array | string, name: string): File {
  return new File([bytes as BlobPart], name)
}
