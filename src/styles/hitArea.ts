/**
 * A 44 px hit area, centred on a control that is drawn smaller (Paul's look rule: 44 px targets; the comps' `.btn-sm::after`). The
 * control keeps its drawn size; its ::after takes the press. V11 pixel pass, 9 Nov.
 */
export const HIT_44 = "relative after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
