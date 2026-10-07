import { describe, it } from 'vitest'
import assert from 'node:assert/strict'
import { readPremortemWorksheet } from '../readPremortemWorksheet'
import { worksheetFixture } from './premortemFixture'

// Served T1b carrier, turn-004-PM-1791354985240 (7 October 2026).
const servedWorksheetFixture = () => ({
  "kind": "premortem",
  "version": 1,
  "scenario_id": "2e7cd627-09f8-4e1d-b81f-b4c79685efbc",
  "turn_id": "353e2d80-c190-4eb9-bcb6-2ebbf14957f1",
  "run": {
    "graph_hash_at_run": "1559ce31d1cf123d",
    "computed_at": "2026-10-07T06:34:37.724Z"
  },
  "binding": {
    "scenario_id": "2e7cd627-09f8-4e1d-b81f-b4c79685efbc",
    "graph_revision": "1559ce31d1cf123d",
    "dependencies": [
      {
        "kind": "map_structure",
        "id": "whole_graph",
        "fingerprint": "5b7ddbf19c122000279adbb8c29bcbbe8b3c1ee9e0a4af6864400eccd04135f8"
      },
      {
        "kind": "analysis",
        "id": "run",
        "fingerprint": "532f2b66c70f441a36ca3629469da08c6240808197d1d5afe28316eb2cbc7e2c"
      }
    ]
  },
  "rows": [
    {
      "row_id": "pm_74deec60536c245718c5a1dd",
      "option_id": "launch_starter_tier",
      "option_label": "Launch starter tier",
      "failure_way": "It is a year later and this decision went badly because ‘Launch starter tier’ attracted too few ‘Starter subscribers’ before the deadline. Subscriber growth arrived too slowly to support the revenue goal.",
      "early_warning": "Starter sign-ups falling behind the planned acquisition pace.",
      "mitigation": "Test paid demand before committing to a full launch.",
      "grounding": {
        "kind": "factor",
        "ids": [
          "starter_subscribers"
        ],
        "labels": [
          "Starter subscribers"
        ]
      },
      "provenance": "olumi_hypothesis",
      "risk_request": {
        "chip_id": "agent-next-suggest-risks",
        "message": "Prepare one risk called \"Subscriber growth arrived too slowly\": It is a year later and this decision went badly because ‘Launch starter tier’ attracted too few ‘Starter subscribers’ before the deadline. Subscriber growth arrived too slowly to support the revenue goal. It would lower \"monthly recurring revenue\". Early warning: Starter sign-ups falling behind the planned acquisition pace. Olumi hypothesis — for you to challenge. Show the proposed change for approval.",
        "affected_node_id": "monthly_recurring_revenue",
        "direction": "negative",
        "grounding_ids": [
          "starter_subscribers"
        ]
      }
    }
  ],
  "coverage": [
    {
      "option_id": "raise_prices_10",
      "option_label": "Raise prices 10%",
      "status": "not_stress_tested"
    },
    {
      "option_id": "launch_starter_tier",
      "option_label": "Launch starter tier",
      "status": "stress_tested"
    },
    {
      "option_id": "keep_pricing_as_is",
      "option_label": "Keep pricing as is",
      "status": "not_stress_tested"
    }
  ],
  "blindspot_question": "Could existing customers downgrade to the starter tier, reducing revenue from customers you already have?"
})

const priceRiseWorksheetFixture = () => {
  const raw = servedWorksheetFixture()
  // Second row uses assistant_text story 1 from the same served turn.
  raw.rows.push({
    "row_id": "pm_raise_prices_10_story_1",
    "option_id": "raise_prices_10",
    "option_label": "Raise prices 10%",
    "failure_way": "It is a year later and this decision went badly because ‘Raise prices 10%’ increased ‘Price rise’, but customer losses erased the added revenue. ‘Customers lost to price-rise churn’ had outweighed the gain.",
    "early_warning": "Renewal cancellations citing price.",
    "mitigation": "Test the increase with a small renewal cohort before extending it.",
    "grounding": {
      "kind": "link",
      "ids": [
        "price_rise",
        "customers_lost_to_price_rise_churn"
      ],
      "labels": [
        "Price rise",
        "Customers lost to price-rise churn"
      ]
    },
    "provenance": "olumi_hypothesis",
    "risk_request": {
      "chip_id": "agent-next-suggest-risks",
      "message": "Prepare one risk called \"Customer losses erased the added revenue\": It is a year later and this decision went badly because ‘Raise prices 10%’ increased ‘Price rise’, but customer losses erased the added revenue. ‘Customers lost to price-rise churn’ had outweighed the gain. It would lower \"monthly recurring revenue\". Early warning: Renewal cancellations citing price. Olumi hypothesis — for you to challenge. Show the proposed change for approval.",
      "affected_node_id": "monthly_recurring_revenue",
      "direction": "negative",
      "grounding_ids": [
        "price_rise",
        "customers_lost_to_price_rise_churn"
      ]
    }
  })
  raw.coverage[0].status = 'stress_tested'
  return raw
}

describe('pre-mortem v1 reader', () => {
  it('reads the validated carrier verbatim', () => {
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: worksheetFixture() }), { status: 'available', worksheet: worksheetFixture() })
  })
  for (const name of ['version', 'stamp', 'malformed', 'binding', 'copy']) it(`refuses ${name} without throwing`, () => {
    const raw = worksheetFixture()
    if (name === 'version') raw.version = 2
    if (name === 'stamp') Reflect.deleteProperty(raw.run, 'computed_at')
    if (name === 'malformed') Reflect.deleteProperty(raw.rows[0], 'early_warning')
    if (name === 'binding') raw.binding.graph_revision = 'fedcba9876543210'
    if (name === 'copy') raw.rows[0].failure_way = 'This is the most likely failure.'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'unavailable' })
  })
  it('reads the served carrier verbatim', () => {
    const raw = servedWorksheetFixture()
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'available', worksheet: raw })
  })
  it('accepts Raise prices 10% in the second row story and risk request', () => {
    const raw = priceRiseWorksheetFixture()
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'available', worksheet: raw })
  })
  it('masks a label supplied only by coverage', () => {
    const raw = servedWorksheetFixture()
    raw.rows[0].failure_way += ' Compare with ‘Raise prices 10%’.'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'available', worksheet: raw })
  })
  it('masks labels case-insensitively in all authored fields', () => {
    const raw = priceRiseWorksheetFixture()
    const label = '‘RAISE PRICES 10%’'
    raw.rows[1].failure_way = `${label} lost customers.`
    raw.rows[1].early_warning = `Customers leaving ${label}.`
    raw.rows[1].mitigation = `Test ${label} with a small cohort.`
    raw.rows[1].risk_request.message = `Prepare one risk for ${label}.`
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'available', worksheet: raw })
  })
  it('masks literal grounding labels longest first', () => {
    const raw = servedWorksheetFixture()
    raw.rows[0].grounding.labels = ['Demand', 'Demand (best + 10%)']
    raw.rows[0].failure_way = '‘DEMAND (BEST + 10%)’ fell.'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'available', worksheet: raw })
  })
  for (const name of ['probability', 'best', 'leads', 'one-word label', 'standalone percent', 'risk message']) it(`still refuses authored ${name}`, () => {
    const raw = priceRiseWorksheetFixture()
    if (name === 'probability') raw.rows[1].failure_way += ' This is about 40% likely.'
    if (name === 'best') raw.rows[1].mitigation = 'Choose the best option.'
    if (name === 'leads') {
      raw.coverage.push({ option_id: 'lead_with_price', option_label: 'Lead with price', status: 'not_stress_tested' })
      raw.rows[1].early_warning = 'With ‘Lead with price’, it leads.'
    }
    // DL r3: masking is whole-label only, so a one-word label 'Lead' cannot mask Olumi's own "leads".
    if (name === 'one-word label') {
      raw.coverage.push({ option_id: 'lead', option_label: 'Lead', status: 'not_stress_tested' })
      raw.rows[1].early_warning = 'With ‘Lead’, it leads.'
    }
    if (name === 'standalone percent') raw.rows[1].failure_way = '‘Raise prices 10%’ loses another 10%.'
    if (name === 'risk message') raw.rows[1].risk_request.message += ' This is about 40% likely.'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'unavailable' })
  })
  // DL r5 review: the blindspot question is user-visible, so Olumi's own probability words there are refused too.
  it('refuses an authored probability in the blindspot question', () => {
    const raw = priceRiseWorksheetFixture()
    raw.blindspot_question = 'Which option is most likely to fail (60%)?'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'unavailable' })
  })
  it('keeps a user label in the blindspot question', () => {
    const raw = priceRiseWorksheetFixture()
    raw.blindspot_question = 'Could existing customers downgrade from ‘Raise prices 10%’ to the starter tier?'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'available', worksheet: raw })
  })
  // DL r4: a story grounded on a risk node (the served T1b story 1 rests on 'Customers lost to price-rise churn').
  it('reads a row grounded on a risk node', () => {
    const raw = priceRiseWorksheetFixture()
    raw.rows[1].grounding = { kind: 'risk', ids: ['customers_lost_to_price_rise_churn'], labels: ['Customers lost to price-rise churn'] }
    raw.rows[1].risk_request.grounding_ids = ['customers_lost_to_price_rise_churn']
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'available', worksheet: raw })
  })
  it('refuses a risk grounding with no labels', () => {
    const raw = priceRiseWorksheetFixture()
    raw.rows[1].grounding = { kind: 'risk', ids: ['customers_lost_to_price_rise_churn'], labels: [] }
    raw.rows[1].risk_request.grounding_ids = ['customers_lost_to_price_rise_churn']
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'unavailable' })
  })
  it('still refuses tampered coverage', () => {
    const raw = servedWorksheetFixture()
    raw.coverage[0].status = 'stress_tested'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'unavailable' })
  })
  it('still refuses coverage with a mismatched row label', () => {
    const raw = priceRiseWorksheetFixture()
    raw.coverage[0].option_label = 'Different price option'
    assert.deepEqual(readPremortemWorksheet({ _premortem_worksheet: raw }), { status: 'unavailable' })
  })
  it('missing carrier is unavailable', () => assert.deepEqual(readPremortemWorksheet({}), { status: 'unavailable' }))
})
