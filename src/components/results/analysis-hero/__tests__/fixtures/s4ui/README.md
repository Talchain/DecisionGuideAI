# S4-UI served fixtures and frozen controls

The turn captures are copied byte-for-byte from Science Wave B. No keys or producer records were edited.

| Fixture | Original served capture | SHA-256 |
| --- | --- | --- |
| `unseen-1.turn.json` | `unseen-1/wire/turn-003-A-run1-1791341854647.json` | `db1c85e6ccd761fcb6453ed6135750e1ff5424f59d90ed8408c81dbaae4a38f6` |
| `unseen-2.turn.json` | `unseen-2/wire/turn-003-A-run1-1791342212248.json` | `fb8bc7f69f5a15da115910a8eb7a4cf46895187ee84a69cf53e43d9b96605619` |

Original paths are relative to the sibling `s4ui-evidence` directory. The two `unseen-*.hero.json` files are byte-identical copies of each capture's `A-run1.hero.json`; their `dom.range_lines` pin the served option IDs and exact text.

`no-figures.base.html`, `points.base.html`, and `unresolved.base.html` freeze the original S4-UI DOM replay's control markup, witnessed byte-identical against base `e3f2fc82a65ccf06292be2103ae360ba14cae50a`. They are comparison artefacts, not served turn captures. The Vitest spec stabilises only React's opaque accessibility IDs to that replay's fresh-root sequence, retaining all ID cross-references and comparing the complete markup byte-for-byte. Do not regenerate them from changed source to make a failure pass.

The point control uses the existing neighbouring `served-t1b-f440be4a-goal-chance-records.json` fixture. Tests load only repository fixtures and do not require the sibling evidence directory.
