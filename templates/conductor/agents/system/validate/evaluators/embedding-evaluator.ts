/**
 * Embedding Evaluator
 *
 * Semantic similarity using embeddings (requires Cloudflare AI binding).
 */

import { BaseEvaluator, type EvaluationScore, type ValidateConfig } from './types.js'

export class EmbeddingEvaluator extends BaseEvaluator {
  async evaluate(content: string, config: ValidateConfig): Promise<EvaluationScore> {
    const reference = config.reference

    if (!reference) {
      throw new Error('Embedding evaluator requires "reference" text in config')
    }

    const model = config.model || '@cf/baai/bge-base-en-v1.5'

    // TODO: Integrate with Cloudflare AI embeddings
    // For now, return placeholder score based on simple text similarity
    const similarity = this.calculateSimpleTextSimilarity(content, reference)

    return {
      average: similarity,
      breakdown: {
        semanticSimilarity: similarity,
      },
      details: {
        model,
        note: 'Using simple text similarity as placeholder for embedding-based similarity',
      },
    }
  }

  /**
   * Calculate simple text similarity (placeholder for actual embeddings)
   */
  private calculateSimpleTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])

    // Jaccard similarity
    return union.size > 0 ? intersection.size / union.size : 0
  }

  /**
   * Calculate cosine similarity between two vectors
   * (ready for when we integrate actual embeddings)
   */
  protected cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length')
    }

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i]
      norm1 += vec1[i] * vec1[i]
      norm2 += vec2[i] * vec2[i]
    }

    norm1 = Math.sqrt(norm1)
    norm2 = Math.sqrt(norm2)

    if (norm1 === 0 || norm2 === 0) {
      return 0
    }

    return dotProduct / (norm1 * norm2)
  }
}
