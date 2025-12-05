/**
 * Prepare PDF Attachment Script
 *
 * Converts PDF ArrayBuffer to base64 for email attachment.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface PreparePdfInput {
  pdfResult: {
    pdf: ArrayBuffer | number[]
    filename?: string
    size?: number
  }
  filename?: string
}

interface PdfAttachmentResult {
  filename: string
  content: string
  contentType: 'application/pdf'
  encoding: 'base64'
}

export default function preparePdfAttachment(context: AgentExecutionContext): PdfAttachmentResult {
  const input = context.input as PreparePdfInput
  const { pdfResult, filename } = input

  // Convert ArrayBuffer to base64
  const uint8Array = new Uint8Array(
    pdfResult.pdf instanceof ArrayBuffer ? pdfResult.pdf : pdfResult.pdf
  )
  const binaryString = Array.from(uint8Array)
    .map((byte) => String.fromCharCode(byte))
    .join('')
  const base64 = btoa(binaryString)

  return {
    filename: pdfResult.filename || filename || 'document.pdf',
    content: base64,
    contentType: 'application/pdf',
    encoding: 'base64',
  }
}
