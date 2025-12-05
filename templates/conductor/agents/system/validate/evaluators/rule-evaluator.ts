/**
 * Rule Evaluator
 *
 * Custom rule-based validation using JavaScript expressions.
 */

import { BaseEvaluator, type EvaluationScore, type Rule, type ValidateConfig } from './types.js'

export class RuleEvaluator extends BaseEvaluator {
  async evaluate(content: string, config: ValidateConfig): Promise<EvaluationScore> {
    const rules: Rule[] = config.rules || []

    if (rules.length === 0) {
      throw new Error('Rule evaluator requires at least one rule in config')
    }

    const breakdown: Record<string, number> = {}
    const weights: Record<string, number> = {}
    const details: Record<string, unknown> = {}

    for (const rule of rules) {
      try {
        // Create a safe evaluation context
        const context = {
          content,
          length: content.length,
          wordCount: content.split(/\s+/).length,
          lineCount: content.split('\n').length,
        }

        // Evaluate the rule (safe evaluation)
        const result = this.evaluateRule(rule.check, context)
        const score = result ? 1 : 0

        breakdown[rule.name] = score
        weights[rule.name] = rule.weight
        details[rule.name] = {
          passed: result,
          rule: rule.check,
          description: rule.description,
        }
      } catch (error) {
        breakdown[rule.name] = 0
        weights[rule.name] = rule.weight
        details[rule.name] = {
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }
    }

    const average = this.calculateWeightedAverage(breakdown, weights)

    return {
      average,
      breakdown,
      details,
    }
  }

  /**
   * Safely evaluate a rule expression
   */
  private evaluateRule(
    expression: string,
    context: { content: string; length: number; wordCount: number; lineCount: number }
  ): boolean {
    // Simple expression evaluation
    // Replace content references with actual values
    let evalExpression = expression

    // Replace context variables
    evalExpression = evalExpression.replace(/content\.length/g, String(context.content.length))
    evalExpression = evalExpression.replace(/content\.wordCount/g, String(context.wordCount))
    evalExpression = evalExpression.replace(/content\.lineCount/g, String(context.lineCount))
    evalExpression = evalExpression.replace(
      /content\.includes\(['"]([^'"]+)['"]\)/g,
      (match, keyword) => {
        return String(context.content.toLowerCase().includes(keyword.toLowerCase()))
      }
    )

    // Evaluate the expression using Function constructor (safer than eval)
    try {
      const fn = new Function('return (' + evalExpression + ')')
      return Boolean(fn())
    } catch {
      return false
    }
  }
}
