/**
 * Export to Excel Script
 *
 * Prepares data for Excel export format.
 * In production, would use a library like xlsx to generate .xlsx file.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface ExportToExcelInput {
  data: unknown[]
}

interface ExcelResult {
  data: unknown[]
  count: number
  format: 'xlsx'
}

export default function exportToExcel(context: AgentExecutionContext): ExcelResult {
  const input = context.input as ExportToExcelInput
  const { data } = input

  // In real app, would use a library like xlsx to generate .xlsx file
  return {
    data,
    count: Array.isArray(data) ? data.length : 0,
    format: 'xlsx',
  }
}
