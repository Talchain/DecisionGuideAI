# ChanceDots

A row of ten dots shows the chance of meeting an aim at a glance. Core’s
served words lead and sit beside the dots. Those words carry the meaning for
screen readers, so the row is aria-hidden.

Fill round(chance × 10) dots from Core’s served numeric chance. Draw no dots
when the number is missing, the chance is withheld, or the result is “never
met in this model”. Keep Core’s words verbatim.

Each circle is 12px with a 4px gap. Filled circles use solid `var(--option)`.
Empty circles have a 1px `var(--option)` outline and a transparent interior.

The glance tier on option cards and in Analysis uses dots. ChanceDots
replaces the face chance bar. In Analysis the bar and whisker sit below the
dots in the expert tier.
