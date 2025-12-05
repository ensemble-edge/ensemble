/**
 * Validate Agent
 *
 * Validation and evaluation framework with pluggable evaluators.
 *
 * Evaluator types:
 * - rule: Custom rule-based validation
 * - judge: LLM-based quality assessment
 * - nlp: Statistical NLP metrics (BLEU, ROUGE)
 * - embedding: Semantic similarity via embeddings
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'
import { RuleEvaluator } from './evaluators/rule-evaluator.js'
import { JudgeEvaluator } from './evaluators/judge-evaluator.js'
import { NLPEvaluator } from './evaluators/nlp-evaluator.js'
import { EmbeddingEvaluator } from './evaluators/embedding-evaluator.js'
import type { BaseEvaluator, EvaluationScore, ValidateConfig, EvalType } from './evaluators/types.js'

// ============================================================================
// Types
// ============================================================================

interface ValidateInput {
  content: string
  reference?: string
  expected?: unknown
}

interface ValidateOutput {
  passed: boolean
  score: number
  scores: Record<string, number>
  details: Record<string, unknown>
  evalType: EvalType
}

// ============================================================================
// Agent Implementation
// ============================================================================

export default async function validate(
  input: ValidateInput,
  ctx: AgentExecutionContext
): Promise<ValidateOutput> {
  const config: ValidateConfig = {
    evalType: 'rule',
    threshold: 0.7,
    ...(ctx.config as Partial<ValidateConfig>),
  }

  if (!input.content) {
    throw new Error('Validate agent requires "content" in input')
  }

  const evalType = config.evalType
  const evaluator = getEvaluator(evalType)

  // Merge config with input reference if provided
  const evalConfig = {
    ...config,
    reference: input.reference || config.reference,
  }

  // Evaluate
  const scores = await evaluator.evaluate(input.content, evalConfig)

  // Check if passed threshold
  const threshold = config.threshold
  const passed = scores.average >= threshold

  return {
    passed,
    score: scores.average,
    scores: scores.breakdown,
    details: scores.details || {},
    evalType,
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the appropriate evaluator based on type
 */
function getEvaluator(type: EvalType): BaseEvaluator {
  switch (type) {
    case 'rule':
      return new RuleEvaluator()
    case 'judge':
      return new JudgeEvaluator()
    case 'nlp':
      return new NLPEvaluator()
    case 'embedding':
      return new EmbeddingEvaluator()
    default:
      throw new Error(`Unknown evaluator type: ${type}`)
  }
}
