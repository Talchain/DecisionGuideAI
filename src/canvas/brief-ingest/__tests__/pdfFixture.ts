/** A minimal valid PDF, built in-test with correct xref offsets. */
export function buildPdf(pages: Array<string[] | null>): Uint8Array {
  const objects: string[] = []
  const pageIds: number[] = []
  // 1 catalog, 2 pages, 3 font, then per page: page + content
  let next = 4
  const pageObjs: Array<[number, string]> = []
  for (const lines of pages) {
    const pageId = next++
    const contentId = next++
    pageIds.push(pageId)
    const stream = lines
      ? `BT /F1 12 Tf 72 720 Td 14 TL ${lines.map((l) => `(${l.replace(/[()\\]/g, '\\$&')}) Tj T*`).join(' ')} ET`
      : '0 0 1 rg 10 10 100 100 re f'
    pageObjs.push([pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`])
    pageObjs.push([contentId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`])
  }
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  for (const [id, body] of pageObjs) objects[id] = body

  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xref = out.length
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out)
}
