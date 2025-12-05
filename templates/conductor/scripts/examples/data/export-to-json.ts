/**
 * Export to JSON Script
 *
 * Converts data array to JSON string.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface ExportToJsonInput {
  data: unknown[]
  pretty?: boolean
}

interface JsonResult {
  data: string
  count: number
  size: number
}

export default function exportToJson(context: AgentExecutionContext): JsonResult {
  const input = context.input as ExportToJsonInput
  const { data, pretty } = input

  const json = JSON.stringify(data, null, pretty ? 2 : 0)

  return {
    data: json,
    count: Array.isArray(data) ? data.length : 1,
    size: json.length,
  }
}
