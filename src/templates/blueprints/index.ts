import type { Blueprint, TemplateMeta } from './types'
import pricingBlueprint from './pricing-v1.json'
import hiringBlueprint from './hiring-v1.json'
import marketingBlueprint from './marketing-v1.json'
import supplyBlueprint from './supply-v1.json'
import featureTradeoffsBlueprint from './feature-tradeoffs-v1.json'
import retentionBlueprint from './retention-v1.json'

const blueprints: Blueprint[] = [
  pricingBlueprint as Blueprint,
  hiringBlueprint as Blueprint,
  marketingBlueprint as Blueprint,
  supplyBlueprint as Blueprint,
  featureTradeoffsBlueprint as Blueprint,
  retentionBlueprint as Blueprint
]

export function getAllBlueprints(): Blueprint[] {
  return blueprints
}

export function getBlueprintById(id: string): Blueprint | undefined {
  return blueprints.find(bp => bp.id === id)
}

export function getTemplateMetas(): TemplateMeta[] {
  return blueprints.map(bp => ({
    id: bp.id,
    name: bp.name,
    description: bp.description
  }))
}
