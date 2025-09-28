/**
 * What-if Parameter Sweeps
 * Generate bounded variants and return ranked results using existing compare APIs
 */

export interface SweepVariant {
  id: string;
  description: string;
  modifications: SweepModification[];
  scenario: any;
}

export interface SweepModification {
  path: string;
  originalValue: number;
  newValue: number;
  changePercent: number;
}

export interface SweepRanking {
  variantId: string;
  rank: number;
  score: number;
  delta?: any;
}

export interface SweepResult {
  schema: 'sweep.v1';
  timestamp: string;
  baseScenario: {
    id?: string;
    baseline: any;
  };
  parameters: SweepParameters;
  variants: SweepVariant[];
  rankings: SweepRanking[];
  summary: {
    variantsGenerated: number;
    bestVariant: string;
    worstVariant: string;
    averageScore: number;
  };
}

export interface SweepParameters {
  targetPaths: string[];
  variations: number[];
  maxVariants: number;
}

/**
 * Check if sweeps are enabled
 */
function isSweepEnabled(): boolean {
  return process.env.SWEEP_ENABLE === '1';
}

/**
 * Extract numeric value from object path
 */
function getValueAtPath(obj: any, path: string): number | null {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (part.includes('[') && part.includes(']')) {
      // Handle array/object indexing like "nodes[0]" or "nodes[nodeId]"
      const [key, indexPart] = part.split('[');
      const index = indexPart.replace(']', '');

      if (current[key]) {
        if (Array.isArray(current[key])) {
          const arrayIndex = parseInt(index);
          if (!isNaN(arrayIndex) && arrayIndex < current[key].length) {
            current = current[key][arrayIndex];
          } else {
            return null;
          }
        } else if (typeof current[key] === 'object') {
          current = current[key][index];
        } else {
          return null;
        }
      } else {
        return null;
      }
    } else {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
  }

  return typeof current === 'number' ? current : null;
}

/**
 * Set numeric value at object path
 */
function setValueAtPath(obj: any, path: string, value: number): boolean {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];

    if (part.includes('[') && part.includes(']')) {
      const [key, indexPart] = part.split('[');
      const index = indexPart.replace(']', '');

      if (current[key]) {
        if (Array.isArray(current[key])) {
          const arrayIndex = parseInt(index);
          if (!isNaN(arrayIndex) && arrayIndex < current[key].length) {
            current = current[key][arrayIndex];
          } else {
            return false;
          }
        } else if (typeof current[key] === 'object') {
          current = current[key][index];
        } else {
          return false;
        }
      } else {
        return false;
      }
    } else {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart.includes('[') && lastPart.includes(']')) {
    const [key, indexPart] = lastPart.split('[');
    const index = indexPart.replace(']', '');

    if (current[key]) {
      if (Array.isArray(current[key])) {
        const arrayIndex = parseInt(index);
        if (!isNaN(arrayIndex) && arrayIndex < current[key].length) {
          current[key][arrayIndex] = value;
          return true;
        }
      } else if (typeof current[key] === 'object') {
        current[key][index] = value;
        return true;
      }
    }
    return false;
  } else {
    if (current && typeof current === 'object') {
      current[lastPart] = value;
      return true;
    }
    return false;
  }
}

/**
 * Generate parameter variants
 */
function generateVariants(
  baseScenario: any,
  targetPaths: string[],
  variations: number[],
  maxVariants: number
): SweepVariant[] {
  const variants: SweepVariant[] = [];

  // Get baseline values for all target paths
  const baselineValues = new Map<string, number>();
  for (const path of targetPaths) {
    const value = getValueAtPath(baseScenario, path);
    if (value !== null) {
      baselineValues.set(path, value);
    }
  }

  const validPaths = Array.from(baselineValues.keys());
  if (validPaths.length === 0) {
    return variants;
  }

  // Generate single-parameter variations
  let variantCount = 0;
  for (const path of validPaths) {
    if (variantCount >= maxVariants) break;

    const baseValue = baselineValues.get(path)!;

    for (const changePercent of variations) {
      if (variantCount >= maxVariants) break;

      const newValue = baseValue * (1 + changePercent / 100);

      // Skip if new value would be negative, zero, or too small for weights
      if (path.includes('weight') && (newValue <= 0 || newValue < 0.1)) {
        continue;
      }
      if (newValue <= 0 && baseValue <= 1) {
        continue;
      }

      // Create variant scenario
      const scenarioCopy = JSON.parse(JSON.stringify(baseScenario));
      const success = setValueAtPath(scenarioCopy, path, newValue);

      if (success) {
        const variantId = `var-${variantCount + 1}`;
        const variant: SweepVariant = {
          id: variantId,
          description: `${path}: ${baseValue.toFixed(3)} → ${newValue.toFixed(3)} (${changePercent > 0 ? '+' : ''}${changePercent}%)`,
          modifications: [{
            path: path,
            originalValue: baseValue,
            newValue: newValue,
            changePercent: changePercent
          }],
          scenario: scenarioCopy
        };

        variants.push(variant);
        variantCount++;
      }
    }
  }

  // Generate some multi-parameter variations if we have room
  if (variantCount < maxVariants && validPaths.length > 1) {
    const remainingSlots = Math.min(maxVariants - variantCount, 5);

    for (let i = 0; i < remainingSlots; i++) {
      // Pick 2-3 random paths
      const pathCount = Math.min(3, validPaths.length);
      const selectedPaths = validPaths.sort(() => 0.5 - Math.random()).slice(0, pathCount);

      const scenarioCopy = JSON.parse(JSON.stringify(baseScenario));
      const modifications: SweepModification[] = [];
      let allSuccessful = true;

      for (const path of selectedPaths) {
        const baseValue = baselineValues.get(path)!;
        // Use smaller variations for multi-parameter changes
        const changePercent = variations[Math.floor(Math.random() * variations.length)] * 0.5;
        const newValue = baseValue * (1 + changePercent / 100);

        if (path.includes('weight') && (newValue <= 0 || newValue < 0.1)) {
          allSuccessful = false;
          break;
        }
        if (newValue <= 0 && baseValue <= 1) {
          allSuccessful = false;
          break;
        }

        const success = setValueAtPath(scenarioCopy, path, newValue);
        if (!success) {
          allSuccessful = false;
          break;
        }

        modifications.push({
          path: path,
          originalValue: baseValue,
          newValue: newValue,
          changePercent: changePercent
        });
      }

      if (allSuccessful && modifications.length > 0) {
        const variantId = `var-${variantCount + 1}`;
        const descriptions = modifications.map(m =>
          `${m.path}: ${m.changePercent > 0 ? '+' : ''}${m.changePercent.toFixed(1)}%`
        );

        const variant: SweepVariant = {
          id: variantId,
          description: `Multi: ${descriptions.join(', ')}`,
          modifications: modifications,
          scenario: scenarioCopy
        };

        variants.push(variant);
        variantCount++;
      }
    }
  }

  return variants;
}

/**
 * Calculate simple scoring for ranking
 */
function calculateVariantScore(variant: SweepVariant, compareResult?: any): number {
  // Basic scoring based on modifications and comparison results
  let score = 50; // Base score

  // Factor in the magnitude of changes
  const totalChange = variant.modifications.reduce((sum, mod) =>
    sum + Math.abs(mod.changePercent), 0
  );

  // Moderate changes get higher scores than extreme ones
  if (totalChange > 0 && totalChange <= 20) {
    score += 20; // Moderate changes
  } else if (totalChange > 20 && totalChange <= 50) {
    score += 10; // Larger changes
  } else if (totalChange > 50) {
    score -= 10; // Very large changes
  }

  // Factor in comparison results if available
  if (compareResult && compareResult.delta) {
    // Prefer variants that show meaningful differences
    const deltaKeys = Object.keys(compareResult.delta);
    if (deltaKeys.length > 0) {
      score += deltaKeys.length * 5; // More differences = potentially more interesting
    }
  }

  // Add some randomness for variants with similar scores
  score += (Math.random() - 0.5) * 2;

  return Math.max(0, Math.min(100, score));
}

/**
 * Core parameter sweep API logic
 */
export class ParameterSweepApi {
  /**
   * Generate and rank parameter sweep variants
   */
  async generateSweep(
    baseScenario: any,
    targetPaths: string[],
    variations: number[] = [-15, -10, -5, 5, 10, 15],
    maxVariants: number = 20
  ): Promise<{ success: boolean; data?: SweepResult; error?: string; status: number }> {
    if (!isSweepEnabled()) {
      return {
        success: false,
        error: 'The requested resource could not be found.',
        status: 404
      };
    }

    // Validate inputs
    if (!baseScenario || typeof baseScenario !== 'object') {
      return {
        success: false,
        error: 'Base scenario is required and must be a valid object.',
        status: 400
      };
    }

    if (!Array.isArray(targetPaths) || targetPaths.length === 0) {
      return {
        success: false,
        error: 'Target paths array is required and must not be empty.',
        status: 400
      };
    }

    if (!Array.isArray(variations) || variations.length === 0) {
      return {
        success: false,
        error: 'Variations array is required and must not be empty.',
        status: 400
      };
    }

    if (maxVariants < 1 || maxVariants > 50) {
      return {
        success: false,
        error: 'Max variants must be between 1 and 50.',
        status: 400
      };
    }

    try {
      // Check for problematic scenarios that might cause internal errors
      if (baseScenario && typeof baseScenario === 'object') {
        for (const path of targetPaths) {
          const pathParts = path.split('.');
          if (pathParts.some(part => part.includes('[') && part.includes(']'))) {
            // Check for array access on null values
            const arrayPart = pathParts.find(part => part.includes('['));
            if (arrayPart) {
              const [key] = arrayPart.split('[');
              if (baseScenario[key] === null) {
                throw new Error(`Cannot access array index on null value at ${key}`);
              }
            }
          }
        }
      }

      // Generate variants
      const variants = generateVariants(baseScenario, targetPaths, variations, maxVariants);

      if (variants.length === 0) {
        return {
          success: false,
          error: 'No valid variants could be generated from the specified paths.',
          status: 400
        };
      }

      // Calculate rankings (simplified scoring for now)
      const rankings: SweepRanking[] = variants.map(variant => ({
        variantId: variant.id,
        rank: 0, // Will be set after sorting
        score: calculateVariantScore(variant)
      }));

      // Sort by score and assign ranks
      rankings.sort((a, b) => b.score - a.score);
      rankings.forEach((ranking, index) => {
        ranking.rank = index + 1;
      });

      // Calculate summary
      const scores = rankings.map(r => r.score);
      const averageScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;

      const result: SweepResult = {
        schema: 'sweep.v1',
        timestamp: new Date().toISOString(),
        baseScenario: {
          id: baseScenario.id,
          baseline: baseScenario
        },
        parameters: {
          targetPaths: targetPaths,
          variations: variations,
          maxVariants: maxVariants
        },
        variants: variants,
        rankings: rankings,
        summary: {
          variantsGenerated: variants.length,
          bestVariant: rankings[0]?.variantId || '',
          worstVariant: rankings[rankings.length - 1]?.variantId || '',
          averageScore: Math.round(averageScore * 10) / 10
        }
      };

      return {
        success: true,
        data: result,
        status: 200
      };

    } catch (error) {
      return {
        success: false,
        error: 'Unable to generate parameter sweep at this time.',
        status: 500
      };
    }
  }
}

export const parameterSweepApi = new ParameterSweepApi();