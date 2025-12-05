/**
 * NLP Evaluator
 *
 * Statistical NLP metrics for text comparison: BLEU, ROUGE, length ratio.
 */

import { BaseEvaluator, type EvaluationScore, type ValidateConfig } from './types.js'

export class NLPEvaluator extends BaseEvaluator {
  async evaluate(content: string, config: ValidateConfig): Promise<EvaluationScore> {
    const reference = config.reference

    if (!reference) {
      throw new Error('NLP evaluator requires "reference" text in config')
    }

    const metrics = config.metrics || ['bleu', 'rouge']
    const breakdown: Record<string, number> = {}

    // Calculate each metric
    for (const metric of metrics) {
      switch (metric.toLowerCase()) {
        case 'bleu':
          breakdown.bleu = this.calculateBLEU(content, reference)
          break
        case 'rouge':
          breakdown.rouge = this.calculateROUGE(content, reference)
          break
        case 'length-ratio':
          breakdown.lengthRatio = this.calculateLengthRatio(content, reference)
          break
        default:
          breakdown[metric] = 0
      }
    }

    // Calculate average (all metrics have equal weight)
    const average =
      Object.values(breakdown).reduce((sum, score) => sum + score, 0) /
      Object.keys(breakdown).length

    return {
      average,
      breakdown,
      details: {
        reference: reference.substring(0, 100) + '...',
        contentLength: content.length,
        referenceLength: reference.length,
      },
    }
  }

  /**
   * Calculate BLEU score (simplified unigram)
   */
  private calculateBLEU(candidate: string, reference: string): number {
    const candidateWords = candidate.toLowerCase().split(/\s+/)
    const referenceWords = reference.toLowerCase().split(/\s+/)

    const referenceSet = new Set(referenceWords)
    let matches = 0

    for (const word of candidateWords) {
      if (referenceSet.has(word)) {
        matches++
      }
    }

    const precision = candidateWords.length > 0 ? matches / candidateWords.length : 0
    return this.normalizeScore(precision)
  }

  /**
   * Calculate ROUGE-L score (longest common subsequence)
   */
  private calculateROUGE(candidate: string, reference: string): number {
    const candidateWords = candidate.toLowerCase().split(/\s+/)
    const referenceWords = reference.toLowerCase().split(/\s+/)

    const lcs = this.longestCommonSubsequence(candidateWords, referenceWords)
    const recall = referenceWords.length > 0 ? lcs / referenceWords.length : 0
    const precision = candidateWords.length > 0 ? lcs / candidateWords.length : 0

    // F1 score
    const f1 = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0
    return this.normalizeScore(f1)
  }

  /**
   * Calculate length ratio (how close the lengths are)
   */
  private calculateLengthRatio(candidate: string, reference: string): number {
    const ratio =
      Math.min(candidate.length, reference.length) / Math.max(candidate.length, reference.length)
    return this.normalizeScore(ratio)
  }

  /**
   * Calculate longest common subsequence length
   */
  private longestCommonSubsequence(arr1: string[], arr2: string[]): number {
    const m = arr1.length
    const n = arr2.length
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0))

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (arr1[i - 1] === arr2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }

    return dp[m][n]
  }
}
