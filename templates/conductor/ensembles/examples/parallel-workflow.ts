/**
 * Parallel Workflow - TypeScript Ensemble
 *
 * Example of advanced graph-based workflow with parallel execution,
 * branching, and complex dependencies.
 *
 * This is a clean showcase of TypeScript primitives:
 * - parallel() for concurrent execution
 * - branch() for conditional paths
 * - foreach() for iteration
 * - Type-safe step configuration
 *
 * Demonstrates Conductor's sophisticated workflow capabilities
 * with full IDE support and type checking.
 */

import {
  createEnsemble,
  step,
  parallel,
  branch,
  foreach,
  type FlowStepType,
} from '@ensemble-edge/conductor'

export default createEnsemble({
  name: 'parallel-workflow',
  description: `Example of advanced graph-based workflow with parallel execution,
branching, and complex dependencies.

Demonstrates Conductor's sophisticated workflow capabilities.`,

  steps: [
    // =========================================================================
    // Step 1: Analyze input
    // =========================================================================
    step('analyze', {
      input: {
        data: '${input.data}',
      },
    }),

    // =========================================================================
    // Step 2: Parallel execution - process multiple tasks simultaneously
    // =========================================================================
    parallel([
      step('validate', {
        input: {
          data: '${analyze.output.cleaned}',
        },
      }),
      step('enrich', {
        input: {
          data: '${analyze.output.cleaned}',
        },
      }),
      step('categorize', {
        input: {
          data: '${analyze.output.cleaned}',
        },
      }),
    ]),

    // =========================================================================
    // Step 3: Conditional branch based on validation result
    // =========================================================================
    branch('${validate.output.isValid === true}', {
      // Valid path: Continue processing
      then: [
        step('process', {
          input: {
            data: '${enrich.output.enriched}',
            category: '${categorize.output.category}',
          },
          depends_on: ['validate', 'enrich', 'categorize'],
        }),

        // Parallel notifications after processing
        parallel([
          step('notify-success', {
            input: {
              result: '${process.output}',
            },
          }),
          step('log-success', {
            input: {
              result: '${process.output}',
            },
          }),
        ]),
      ],

      // Invalid path: Handle error
      else: [
        step('notify-error', {
          input: {
            errors: '${validate.output.errors}',
          },
        }),
        step('log-error', {
          input: {
            errors: '${validate.output.errors}',
          },
        }),
      ],
    }),

    // =========================================================================
    // Step 4: Loop over results (if processing succeeded)
    // =========================================================================
    foreach(
      '${process.output.items}',
      step('post-process', {
        input: {
          item: '${item}',
        },
      }),
      { maxConcurrency: 3 }
    ),
  ],

  output: {
    success: '${process.output.success}',
    results: '${post-process.output}',
    metadata: {
      analyzed: '${analyze.output.metadata}',
      validated: '${validate.output.isValid}',
      category: '${categorize.output.category}',
    },
  },
})
