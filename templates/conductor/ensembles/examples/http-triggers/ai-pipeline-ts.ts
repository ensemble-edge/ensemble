/**
 * AI Pipeline - TypeScript Ensemble
 *
 * Multi-agent AI workflow using Workers AI.
 * Demonstrates a 3-agent pipeline:
 * 1. Brainstormer - generates creative ideas
 * 2. Critic - evaluates and refines the ideas
 * 3. Summarizer - creates a polished final response
 *
 * This tests multi-step AI orchestration with schema output mapping.
 * TypeScript version showcases type-safe ensemble authoring.
 */

import { createEnsemble, step } from '@ensemble-edge/conductor';

export default createEnsemble({
  name: 'ai-pipeline-ts',
  description: `Multi-agent AI workflow using Workers AI (TypeScript version).
Demonstrates a 3-agent pipeline:
1. Brainstormer - generates creative ideas
2. Critic - evaluates and refines the ideas
3. Summarizer - creates a polished final response`,

  trigger: [
    {
      type: 'http',
      path: '/ai/think-ts',
      methods: ['GET', 'POST'],
      public: true,
    },
  ],

  // Define inline agents
  agents: [
    {
      name: 'brainstorm',
      operation: 'think',
      config: {
        provider: 'workers-ai',
        model: '@cf/meta/llama-3.1-8b-instruct',
        temperature: 0.8,
        maxTokens: 400,
      },
      schema: {
        output: {
          ideas: 'string',
        },
      },
      prompt: `You are a creative brainstormer. Generate 3 interesting ideas or perspectives about the following topic.

Topic: \${input.topic || "the future of edge computing"}

Be creative and think outside the box. Format as a numbered list.`,
    },
    {
      name: 'critique',
      operation: 'think',
      config: {
        provider: 'workers-ai',
        model: '@cf/meta/llama-3.1-8b-instruct',
        temperature: 0.5,
        maxTokens: 400,
      },
      schema: {
        output: {
          analysis: 'string',
        },
      },
      prompt: `You are a thoughtful critic. Review these ideas and identify the most promising one:

\${brainstorm.output.ideas}

Explain why you chose it and how it could be improved. Be constructive.`,
    },
    {
      name: 'summarize',
      operation: 'think',
      config: {
        provider: 'workers-ai',
        model: '@cf/meta/llama-3.1-8b-instruct',
        temperature: 0.6,
        maxTokens: 300,
      },
      schema: {
        output: {
          insight: 'string',
        },
      },
      prompt: `Create a concise, polished summary combining the best idea with the critique's improvements.

Original brainstorm: \${brainstorm.output.ideas}

Critique and refinement: \${critique.output.analysis}

Write a final, actionable insight in 2-3 sentences.`,
    },
  ],

  // Flow: sequential execution of the 3 agents
  steps: [step('brainstorm'), step('critique'), step('summarize')],

  // Output mapping
  output: {
    final_insight: '${summarize.output.insight}',
    brainstorm_ideas: '${brainstorm.output.ideas}',
    critique: '${critique.output.analysis}',
    source: 'typescript',
  },
});
