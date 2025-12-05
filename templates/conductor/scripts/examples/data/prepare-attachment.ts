/**
 * Prepare Attachment Script
 *
 * Prepares data for email attachment by converting to base64.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface PrepareAttachmentInput {
  exportResult: {
    data: any
    extension: string
    contentType: string
  }
  format: string
  filename?: string
}

interface AttachmentResult {
  filename: string
  content: string
  contentType: string
  encoding: 'base64'
}

export default function prepareAttachment(context: AgentExecutionContext): AttachmentResult {
  const input = context.input as PrepareAttachmentInput
  const { exportResult, format, filename } = input

  // Get file extension
  const ext = exportResult.extension || format
  const finalFilename = filename || `export-${Date.now()}.${ext}`

  // Convert data to base64 if needed
  let content = exportResult.data
  if (typeof content === 'string') {
    content = btoa(content) // Convert to base64
  } else if (typeof content === 'object') {
    content = btoa(JSON.stringify(content))
  }

  return {
    filename: finalFilename,
    content: content,
    contentType: exportResult.contentType,
    encoding: 'base64',
  }
}
