/**
 * Generate Research Report Script
 *
 * Generates a structured research report from analysis results.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface GenerateReportInput {
  topic: string
}

interface Analysis {
  executive_summary?: string
  output?: string
  findings?: string
  recommendations?: string
  sources?: string
}

interface ReportResult {
  title: string
  generated: string
  researcher: string
  executive_summary: string
  findings: string
  recommendations: string
  sources: string
}

export default function generateReport(context: AgentExecutionContext): ReportResult {
  const input = context.input as GenerateReportInput
  const ctx = context as any
  const analysis: Analysis = ctx.deep_analysis || ctx.initial_analysis || {}

  return {
    title: `Research Report: ${input.topic}`,
    generated: new Date().toISOString(),
    researcher: 'AI Research Assistant',
    executive_summary: analysis.executive_summary || analysis.output || 'Analysis pending',
    findings: analysis.findings || 'See full analysis above',
    recommendations: analysis.recommendations || 'Pending deeper analysis',
    sources: analysis.sources || 'Multiple web and code sources consulted',
  }
}
