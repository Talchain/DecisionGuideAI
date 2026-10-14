# T1 captured evidence

Source directory: `/Users/paulslee/olumi-work/acceptance-pd/output/acceptance-20261006/t1b-pass/wire/`.
Served capture: CEE `bdf5716`, UI `ed8889ae`.

- `live-recorded.json`: `turn-002-Y1-challenge-1791324423509.json`. All response/state/render fields retained; `_diagnostic_trace`, `_provider_calls` and `_agent.session_id` omitted. The recorded server echo is unchanged.
- `live-request.json`: corresponding `.req.json`, unchanged. Scenario and request provenance only; the hook generates its own outgoing correlation.
- `cold-shape.json`: `X4-coldread.json`, unchanged. Its history entries preserve key names and chip payloads, but omit identity, timestamps and answer words.
- `other-turn.json`: only `_agent.turn_id` and `_agent.durability` projected from `turn-003-run1-1791324104418.json`, with its filename recorded. Used for the foreign-turn negative row.

No exact live/cold turn pair is available: X4 omitted the join-key values, and the earlier `read-draft` capture predates these live answers. The spec explicitly pairs the recorded live reply's shape with X4's cold chip shape. Its cold response envelope uses the live echo, request scenario/message and answer words, plus X4's exact three chips. The timestamp is the live capture's filename time. This is a contract reconstruction for regression coverage, not a captured matching cold response or a served F5 witness. The live challenge offers one talk-through chip; the cold shape offers three next steps. The test requires those fresh cold offers, without saving or reusing the live chip.
