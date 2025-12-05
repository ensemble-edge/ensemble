/**
 * GitHub PR Analyzer - TypeScript Ensemble
 *
 * Analyzes GitHub pull requests using MCP tools with DYNAMIC file fetching.
 *
 * Key TypeScript advantages demonstrated:
 * - Dynamic step generation (fetch N files based on input.maxFiles)
 * - afterExecute hook for Slack/Discord notifications
 * - Type-safe PR analysis configuration
 *
 * The YAML version had hardcoded get-file-1/2/3 steps.
 * The TypeScript version dynamically generates steps for any number of files!
 */

import {
  createEnsemble,
  step,
  type Context,
  type FlowStepType,
} from '@ensemble-edge/conductor'

/**
 * Input schema for PR analysis
 */
interface PRAnalyzerInput {
  owner: string
  repo: string
  pull_number: number
  auto_comment?: boolean
  max_files?: number
  notify_slack?: boolean
}

/**
 * Analysis result structure
 */
interface AnalysisResult {
  summary: string
  quality_score: number
  issues: string[]
  security_concerns: string[]
  performance_notes: string[]
  suggestions: string[]
  recommendation: 'Approve' | 'Request Changes' | 'Comment'
  review_comment: string
}

export default createEnsemble({
  name: 'github-pr-analyzer',
  description: 'Analyze GitHub pull requests using MCP tools',

  // ===========================================================================
  // Trigger - Expose as MCP tool
  // ===========================================================================
  trigger: [
    {
      type: 'mcp',
      public: false,
      auth: {
        type: 'bearer',
        secret: '${env.MCP_CLIENT_TOKEN}',
      },
    },
  ],

  // ===========================================================================
  // Dynamic Steps - Generate file fetch steps based on input
  // ===========================================================================
  steps: (context: Context): FlowStepType[] => {
    const input = context.input as PRAnalyzerInput
    const maxFiles = input.max_files || 5

    // Step 1: Fetch PR metadata
    const prSteps: FlowStepType[] = [
      step('get-pr', {
        operation: 'tools',
        config: {
          mcp: 'github',
          tool: 'get_pull_request',
          timeout: 10000,
        },
        input: {
          owner: '${input.owner}',
          repo: '${input.repo}',
          pull_number: '${input.pull_number}',
        },
      }),

      // Step 2: Get list of changed files
      step('list-files', {
        operation: 'tools',
        config: {
          mcp: 'github',
          tool: 'list_pull_request_files',
          timeout: 10000,
        },
        input: {
          owner: '${input.owner}',
          repo: '${input.repo}',
          pull_number: '${input.pull_number}',
        },
      }),
    ]

    // Step 3: Dynamically generate file content fetch steps
    // This is the KEY advantage - no hardcoded get-file-1/2/3!
    const fileSteps: FlowStepType[] = []
    for (let i = 0; i < maxFiles; i++) {
      fileSteps.push(
        step(`get-file-${i + 1}`, {
          operation: 'tools',
          config: {
            mcp: 'github',
            tool: 'get_file_contents',
            timeout: 10000,
          },
          input: {
            owner: '${input.owner}',
            repo: '${input.repo}',
            path: `\${list-files.output[${i}].filename}`,
            ref: '${get-pr.output.head.sha}',
          },
          // Only fetch if we have this many files
          when: `\${list-files.output.length > ${i}}`,
        })
      )
    }

    // Step 4: Analyze PR with AI
    const analysisSteps: FlowStepType[] = [
      step('analyze', {
        operation: 'think',
        config: {
          provider: 'anthropic',
          model: 'claude-sonnet-4',
          prompt: buildAnalysisPrompt(maxFiles),
        },
      }),
    ]

    // Step 5: Post comment (conditional)
    const commentSteps: FlowStepType[] = [
      step('post-comment', {
        operation: 'tools',
        config: {
          mcp: 'github',
          tool: 'create_issue_comment',
          timeout: 10000,
        },
        input: {
          owner: '${input.owner}',
          repo: '${input.repo}',
          issue_number: '${input.pull_number}',
          body: '${analyze.output.review_comment}',
        },
        when: '${input.auto_comment === true}',
      }),
    ]

    return [...prSteps, ...fileSteps, ...analysisSteps, ...commentSteps]
  },

  // ===========================================================================
  // TypeScript-only: afterExecute hook for notifications
  // ===========================================================================
  afterExecute: async (result: unknown, context: Context) => {
    const input = context.input as PRAnalyzerInput
    const env = context.env as Record<string, string>

    // Send Slack notification if configured
    if (input.notify_slack && env.SLACK_WEBHOOK_URL) {
      try {
        const analysis = (result as any)?.analysis as AnalysisResult | undefined

        const slackPayload = {
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `PR Analysis: ${input.owner}/${input.repo}#${input.pull_number}`,
              },
            },
            {
              type: 'section',
              fields: [
                {
                  type: 'mrkdwn',
                  text: `*Quality Score:* ${analysis?.quality_score || 'N/A'}/100`,
                },
                {
                  type: 'mrkdwn',
                  text: `*Recommendation:* ${analysis?.recommendation || 'N/A'}`,
                },
              ],
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Summary:* ${analysis?.summary || 'Analysis completed'}`,
              },
            },
          ],
        }

        await fetch(env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload),
        })

        console.log('[github-pr-analyzer] Slack notification sent')
      } catch (error) {
        console.error('[github-pr-analyzer] Failed to send Slack notification:', error)
        // Don't fail the workflow for notification errors
      }
    }
  },

  inputs: {
    owner: '',
    repo: '',
    pull_number: 0,
    auto_comment: false,
    max_files: 5,
    notify_slack: false,
  },

  output: {
    pr_url: '${get-pr.output.html_url}',
    pr_title: '${get-pr.output.title}',
    pr_author: '${get-pr.output.user.login}',
    files_changed: '${list-files.output.length}',
    analysis: '${analyze.output}',
    review_posted: '${post-comment.executed}',
  },
})

// ===========================================================================
// Helper function to build analysis prompt
// ===========================================================================

function buildAnalysisPrompt(maxFiles: number): string {
  const fileContentSections = Array.from(
    { length: maxFiles },
    (_, i) => `File ${i + 1}: \${get-file-${i + 1}.output}`
  ).join('\n')

  return `# Pull Request Analysis

## PR Details
Title: \${get-pr.output.title}
Author: \${get-pr.output.user.login}
State: \${get-pr.output.state}
Description: \${get-pr.output.body}

## Changed Files (\${list-files.output.length} files)
\${list-files.output}

## File Contents
${fileContentSections}

Please provide a comprehensive code review including:
1. Summary of changes
2. Code quality assessment
3. Potential issues or bugs
4. Security concerns
5. Performance considerations
6. Suggestions for improvement
7. Overall recommendation (Approve, Request Changes, Comment)

Format your response as JSON with these fields:
{
  "summary": "Brief summary",
  "quality_score": 0-100,
  "issues": ["issue1", "issue2"],
  "security_concerns": ["concern1"],
  "performance_notes": ["note1"],
  "suggestions": ["suggestion1"],
  "recommendation": "Approve|Request Changes|Comment",
  "review_comment": "Detailed review comment"
}`
}
