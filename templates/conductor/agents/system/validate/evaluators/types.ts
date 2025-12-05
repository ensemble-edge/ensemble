/**
 * Validate Agent - Type Definitions
 */

export type EvalType = 'rule' | 'judge' | 'nlp' | 'embedding'

export interface ValidateConfig {
  evalType: EvalType
  threshold: number
  rules?: Rule[]
  criteria?: Criterion[]
  metrics?: string[]
  reference?: string
  model?: string
}

export interface Rule {
  name: string
  check: string // JavaScript expression
  weight: number
  description?: string
}

export interface Criterion {
  name: string
  description?: string
  weight: number
}

export interface EvaluationScore {
  average: number
  breakdown: Record<string, number>
  details?: Record<string, unknown>
}

/**
 * Base Evaluator - Abstract class for all evaluators
 */
export abstract class BaseEvaluator {
  /**
   * Evaluate content and return scores
   */
  abstract evaluate(content: string, config: ValidateConfig): Promise<EvaluationScore>

  /**
   * Normalize score to 0-1 range
   */
  protected normalizeScore(score: number, min: number = 0, max: number = 1): number {
    return Math.max(min, Math.min(max, score))
  }

  /**
   * Calculate weighted average of scores
   */
  protected calculateWeightedAverage(
    scores: Record<string, number>,
    weights: Record<string, number>
  ): number {
    let totalWeight = 0
    let weightedSum = 0

    for (const [key, score] of Object.entries(scores)) {
      const weight = weights[key] || 1
      weightedSum += score * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }
}
