/**
 * Research Assistant - TypeScript Ensemble
 *
 * AI-powered research assistant using MCP tools with DYNAMIC step generation.
 *
 * This demonstrates the key advantage of TypeScript ensembles:
 * - Dynamic steps based on input (generate N scrape steps based on max_sources)
 * - beforeExecute hook for input validation
 * - Type-safe configuration
 *
 * The YAML version had hardcoded scrape-result-1/2/3 steps.
 * The TypeScript version dynamically generates the right number of steps!
 */

import {
  createEnsemble,
  step,
  type Context,
  type FlowStepType,
} from '@ensemble-edge/conductor'

/**
 * Input schema for the research assistant
 */
interface ResearchInput {
  topic: string
  include_code?: boolean
  deep_analysis?: boolean
  max_sources?: number
}

export default createEnsemble({
  name: 'research-assistant',
  description: 'AI-powered research assistant using MCP tools',

  // ===========================================================================
  // Triggers - Webhook and MCP
  // ===========================================================================
  trigger: [
    {
      type: 'webhook',
      path: '/research',
      methods: ['POST'],
      public: false,
      auth: {
        type: 'bearer',
        secret: '${env.API_TOKEN}',
      },
    },
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
  // Notifications
  // ===========================================================================
  notifications: [
    {
      type: 'email',
      to: ['${env.RESEARCHER_EMAIL}'],
      events: ['execution.completed'],
      subject: 'Research Complete: ${input.topic}',
      from: 'research@conductor.dev',
    },
  ],

  // ===========================================================================
  // Dynamic Steps - Generated at runtime based on input!
  // ===========================================================================
  steps: (context: Context): FlowStepType[] => {
    const input = context.input as ResearchInput
    const maxSources = input.max_sources || 10

    // Phase 1: Discovery - Search multiple sources
    const searchSteps: FlowStepType[] = [
      step('search-brave', {
        operation: 'tools',
        config: {
          mcp: 'brave',
          tool: 'web_search',
          timeout: 15000,
          cacheDiscovery: true,
          cacheTTL: 3600,
        },
        input: {
          query: '${input.topic}',
          max_results: '${input.max_sources}',
        },
      }),
    ]

    // Conditionally add GitHub search
    if (input.include_code) {
      searchSteps.push(
        step('search-github', {
          operation: 'tools',
          config: {
            mcp: 'github',
            tool: 'search_code',
            timeout: 15000,
            cacheDiscovery: true,
          },
          input: {
            query: '${input.topic}',
          },
        })
      )
    }

    // Phase 2: Deep Dive - Dynamically generate scrape steps!
    // This is the KEY advantage over YAML - no hardcoded scrape-result-1/2/3
    const scrapeSteps: FlowStepType[] = []
    const scrapeCount = Math.min(maxSources, 10) // Cap at 10 for performance

    for (let i = 0; i < scrapeCount; i++) {
      scrapeSteps.push(
        step(`scrape-result-${i + 1}`, {
          operation: 'tools',
          config: {
            mcp: 'custom',
            tool: 'web_scrape',
            timeout: 30000,
          },
          input: {
            url: `\${search-brave.output.results[${i}].url}`,
          },
          // Only execute if we have enough results
          when: `\${search-brave.output.results.length > ${i}}`,
        })
      )
    }

    // Phase 3: Analysis - Initial analysis
    const analysisSteps: FlowStepType[] = [
      step('initial-analysis', {
        operation: 'think',
        config: {
          provider: 'anthropic',
          model: 'claude-sonnet-4',
          prompt: buildInitialAnalysisPrompt(scrapeCount),
        },
      }),
    ]

    // Phase 4: Deep Analysis (conditional)
    if (input.deep_analysis) {
      analysisSteps.push(
        step('deep-analysis', {
          operation: 'think',
          config: {
            provider: 'anthropic',
            model: 'claude-opus-4',
            prompt: buildDeepAnalysisPrompt(scrapeCount),
          },
        })
      )
    }

    // Phase 5: Generate Report
    const reportSteps: FlowStepType[] = [
      step('generate-report', {
        operation: 'code',
        config: {
          script: 'scripts/examples/research/generate-report',
        },
      }),
    ]

    return [...searchSteps, ...scrapeSteps, ...analysisSteps, ...reportSteps]
  },

  // ===========================================================================
  // TypeScript-only: beforeExecute hook for validation
  // ===========================================================================
  beforeExecute: async (context: Context) => {
    const input = context.input as ResearchInput

    if (!input.topic || input.topic.trim() === '') {
      throw new Error('Research topic is required')
    }

    if (input.max_sources && (input.max_sources < 1 || input.max_sources > 20)) {
      throw new Error('max_sources must be between 1 and 20')
    }

    console.log(`[research-assistant] Starting research on: "${input.topic}"`)
    console.log(`[research-assistant] Options:`, {
      include_code: input.include_code || false,
      deep_analysis: input.deep_analysis || false,
      max_sources: input.max_sources || 10,
    })
  },

  inputs: {
    topic: '',
    include_code: false,
    deep_analysis: false,
    max_sources: 10,
  },

  output: {
    summary: '${initial-analysis.output}',
    detailed_analysis: '${deep-analysis.output}',
    report: '${generate-report.output}',
    sources_count: '${search-brave.output.results.length}',
  },
})

// ===========================================================================
// Helper functions for building prompts
// ===========================================================================

function buildInitialAnalysisPrompt(scrapeCount: number): string {
  const scrapedContentSections = Array.from(
    { length: scrapeCount },
    (_, i) => `Scraped Content ${i + 1}:\n\${scrape-result-${i + 1}.output}`
  ).join('\n\n')

  return `Research Topic: \${input.topic}

Web Search Results:
\${search-brave.output}

Code Search Results:
\${search-github.output}

${scrapedContentSections}

Provide a preliminary analysis with:
1. Key findings
2. Patterns and trends
3. Areas requiring deeper investigation
4. Initial recommendations`
}

function buildDeepAnalysisPrompt(scrapeCount: number): string {
  const scrapedContentList = Array.from(
    { length: scrapeCount },
    (_, i) => `\${scrape-result-${i + 1}.output}`
  ).join(', ')

  return `Topic: \${input.topic}

Initial Analysis:
\${initial-analysis.output}

All Research Data:
Web: \${search-brave.output}
Code: \${search-github.output}
Content: ${scrapedContentList}

Provide comprehensive research report:
1. Executive Summary
2. Detailed Findings
3. Data Analysis
4. Trends and Insights
5. Recommendations
6. Next Steps
7. References

Format as structured markdown.`
}
