/**
 * BriefIcon — small FileText icon indicating a user-provided value from the brief.
 * Tooltip: "From your brief".
 */
import { FileText } from 'lucide-react'
import { CANVAS_GLYPH_SIZE_CLASSES } from './canvasGlyphScale'

export function BriefIcon() {
  return (
    <span className="inline-flex" title="From your brief">
      {/* Decorative, so it owes legibility rather than a 24px target — but a
          bare `size={10}` is multiplied by the viewport transform and reached
          the user at 5px on the default whole-model view. The class carries
          `--canvas-label-scale`, so 10px declared is 10px delivered. */}
      <FileText
        size={10}
        className={`text-text-light ${CANVAS_GLYPH_SIZE_CLASSES[10]}`}
        aria-hidden="true"
      />
    </span>
  )
}
