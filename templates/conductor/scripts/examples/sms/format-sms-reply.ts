/**
 * Format SMS Reply Script
 *
 * Formats a response for SMS delivery, ensuring it fits within the 160 character limit.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface FormatSmsReplyInput {
  response?: string
  customerName?: string
}

interface FormatSmsReplyResult {
  reply: string
  timestamp: string
}

export default function formatSmsReply(context: AgentExecutionContext): FormatSmsReplyResult {
  const input = context.input as FormatSmsReplyInput
  const { response } = input

  // Format the reply for SMS (max 160 chars)
  let reply = response || 'Thank you for contacting us!'

  if (reply.length > 160) {
    reply = reply.substring(0, 157) + '...'
  }

  return {
    reply,
    timestamp: new Date().toISOString(),
  }
}
