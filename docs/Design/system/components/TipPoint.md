# TipPoint

For “what would change the choice”, TipPoint shows where the line is and
which side of it your figure sits. Core’s sentence comes first, verbatim.

Each `run.tipping` row supplies `line`, `hover`, `figure { id, label, whose }`,
`side`, `at`, `low` and `high`. The figure card’s `figureRange` supplies
its low, high, optional likely value and unit.

One linear axis, zoomed to the values with a margin and labelled ends
(`spanAxisOf`; never below 0 for non-negative figures), covers Core’s tested span and threshold plus the figure’s
range when supplied. A solid 2px `text-header` marker extends just above the
track, with the formatted value and unit below. A transparent region with
a solid 1px `option` border runs from the marker to the end in Core’s tipping
direction. The figure range uses the shared band and likely dot. The band
is dotted when the card author or Core’s figure attribution is Olumi, and
solid for a person. The axis ends use formatted values, 12px meta text
and `text-light`. Omit units when absent.

The picture is aria-hidden. Core’s line carries the meaning. Omit the
picture when a threshold or tested bound is non-finite, the tested low is
not below its high, or no honest axis exists (`spanAxisOf` null). The
outline covers only the span Core tested; the tip value prints one digit
finer than the ends.

Glance tier is Core’s line and the picture. Expert tier is Core’s hover
and the try-a-figure editor.
