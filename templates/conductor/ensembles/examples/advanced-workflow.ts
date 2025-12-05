/**
 * Advanced Workflow - TypeScript Ensemble
 *
 * Showcases ALL advanced workflow features using TypeScript primitives:
 * - Retry with exponential backoff
 * - Timeout with fallback
 * - Conditional execution (when)
 * - Try/Catch error handling
 * - Switch/Case branching
 * - While loops
 * - ForEach with early exit
 * - Map/Reduce pattern
 * - Nested flow control
 * - Lifecycle hooks (onError)
 *
 * This demonstrates the power of TypeScript authoring - same functionality
 * as YAML but with type safety, IDE support, and lifecycle hooks.
 */

import {
  createEnsemble,
  step,
  parallel,
  tryStep,
  switchStep,
  whileStep,
  foreach,
  mapReduce,
  type FlowStepType,
  type Context,
} from '@ensemble-edge/conductor'

export default createEnsemble({
  name: 'advanced-workflow',
  description: `Showcase of all advanced workflow features:
- Retry with backoff
- Timeout with fallback
- Conditional execution (when)
- Try/Catch error handling
- Switch/Case branching
- While loops
- Map/Reduce
- Early exit from loops`,

  steps: [
    // =========================================================================
    // Feature 1: Retry with Exponential Backoff
    // =========================================================================
    step('call-external-api', {
      operation: 'http',
      input: {
        url: '${input.apiUrl}',
      },
      retry: {
        attempts: 3,
        backoff: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000,
        retryOn: ['NETWORK_ERROR', 'TIMEOUT'],
      },
    }),

    // =========================================================================
    // Feature 2: Timeout with Fallback
    // =========================================================================
    step('slow-operation', {
      input: {
        data: '${input.data}',
      },
      timeout: 5000, // 5 seconds
      onTimeout: {
        fallback: { result: 'default', cached: true },
        error: false,
      },
    }),

    // =========================================================================
    // Feature 3: Conditional Execution (when)
    // =========================================================================
    step('optional-analytics', {
      input: {
        event: '${input.event}',
      },
      when: '${input.enableAnalytics === true}',
    }),

    // =========================================================================
    // Feature 4: Try/Catch Error Handling
    // =========================================================================
    tryStep(
      [
        step('risky-operation', {
          input: { data: '${input.data}' },
        }),
        step('validate-result', {
          input: { result: '${risky-operation.output}' },
        }),
      ],
      {
        catch: [
          step('handle-error', {
            input: { error: '${error}', fallback: true },
          }),
          step('log-error', {
            input: { error: '${error}', timestamp: '${Date.now()}' },
          }),
        ],
        finally: [
          step('cleanup-resources', {
            input: { sessionId: '${input.sessionId}' },
          }),
        ],
      }
    ),

    // =========================================================================
    // Feature 5: Switch/Case Branching
    // =========================================================================
    switchStep(
      '${input.requestType}',
      {
        urgent: [
          step('handle-urgent', {
            input: { priority: 'high', data: '${input.data}' },
          }),
        ],
        normal: [
          step('handle-normal', {
            input: { priority: 'medium', data: '${input.data}' },
          }),
        ],
        'low-priority': [
          step('queue-for-later', {
            input: { data: '${input.data}' },
          }),
        ],
      },
      // Default case
      [
        step('handle-unknown', {
          input: { operation: '${input.requestType}', data: '${input.data}' },
        }),
      ]
    ),

    // =========================================================================
    // Feature 6: While Loop with Safety Limit
    // =========================================================================
    whileStep(
      '${batch.output.hasMore === true}',
      [
        step('fetch-batch', {
          input: { cursor: '${batch.output.nextCursor || null}' },
        }),
        step('process-batch', {
          input: { items: '${fetch-batch.output.items}' },
        }),
      ],
      { maxIterations: 100 }
    ),

    // =========================================================================
    // Feature 7: ForEach with Early Exit
    // =========================================================================
    foreach(
      '${input.searchTargets}',
      step('check-target', {
        input: {
          target: '${item}',
          query: '${input.searchQuery}',
        },
      }),
      {
        maxConcurrency: 5,
        breakWhen: '${check-target.output.found === true}',
      }
    ),

    // =========================================================================
    // Feature 8: Map/Reduce Pattern
    // =========================================================================
    mapReduce(
      '${input.documents}',
      step('analyze-document', {
        input: { document: '${item}' },
      }),
      step('aggregate-analysis', {
        input: { results: '${results}' },
      }),
      { maxConcurrency: 10 }
    ),

    // =========================================================================
    // Feature 9: Combined - Parallel with Retry and Timeout
    // =========================================================================
    parallel([
      step('fetch-user-data', {
        input: { userId: '${input.userId}' },
        retry: { attempts: 2, backoff: 'linear' },
        timeout: 3000,
      }),
      step('fetch-preferences', {
        input: { userId: '${input.userId}' },
        timeout: 2000,
        onTimeout: {
          fallback: { theme: 'default', language: 'en' },
          error: false,
        },
      }),
    ]),

    // =========================================================================
    // Feature 10: Nested Try/Catch with Switch
    // =========================================================================
    tryStep(
      [
        switchStep(
          '${fetch-user-data.output.accountType}',
          {
            premium: [
              step('premium-features', {
                input: { userId: '${input.userId}' },
              }),
            ],
            basic: [
              step('basic-features', {
                input: { userId: '${input.userId}' },
              }),
            ],
          }
        ),
      ],
      {
        catch: [
          step('fallback-features', {
            input: { error: '${error}' },
          }),
        ],
      }
    ),
  ],

  // ===========================================================================
  // TypeScript-only Feature: Lifecycle Hooks
  // ===========================================================================
  onError: (error: Error, failedStep: FlowStepType, context: Context) => {
    // Centralized error handling - this is only possible in TypeScript!
    console.error(`[advanced-workflow] Error in step:`, error.message)

    // Smart retry logic based on error type
    if ('code' in error && (error as any).code === 'NETWORK_ERROR') {
      return 'retry'
    }

    // Skip non-critical steps
    if ('agent' in failedStep) {
      const agentName = (failedStep as any).agent
      if (agentName.startsWith('optional-') || agentName.startsWith('log-')) {
        return 'skip'
      }
    }

    return 'fail'
  },

  output: {
    success: true,
    apiResult: '${call-external-api.output}',
    operationResult: '${slow-operation.output}',
    analytics: '${optional-analytics.output}',
    errorHandled: '${handle-error.output || null}',
    requestHandled:
      '${handle-urgent.output || handle-normal.output || queue-for-later.output}',
    batchProcessed: '${process-batch.output}',
    searchResult: '${check-target.output}',
    documentAnalysis: '${aggregate-analysis.output}',
    userData: '${fetch-user-data.output}',
    preferences: '${fetch-preferences.output}',
  },
})
