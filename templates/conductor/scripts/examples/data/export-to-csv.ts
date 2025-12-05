/**
 * Export to CSV Script
 *
 * Converts data array to CSV format.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface ExportToCsvInput {
  data: Record<string, unknown>[]
}

interface CsvResult {
  csv: string
  count: number
  size: number
}

export default function exportToCsv(context: AgentExecutionContext): CsvResult {
  const input = context.input as ExportToCsvInput
  const { data } = input

  if (!data || data.length === 0) {
    return { csv: '', count: 0, size: 0 }
  }

  // Convert data to CSV format
  const headers = Object.keys(data[0]).join(',')
  const rows = data.map((row) => Object.values(row).join(',')).join('\n')
  const csv = `${headers}\n${rows}`

  return {
    csv,
    count: data.length,
    size: csv.length,
  }
}
