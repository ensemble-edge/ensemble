/**
 * Echo Agent
 *
 * Returns input unchanged - useful for debugging flows and inspecting
 * what data reaches an agent after transformations.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface EchoInput {
  data?: unknown
}

interface EchoOutput {
  echo: unknown
  receivedAt: string
  inputType: string
}

export default async function echo(
  input: EchoInput,
  ctx: AgentExecutionContext
): Promise<EchoOutput> {
  return {
    echo: input.data,
    receivedAt: new Date().toISOString(),
    inputType: typeof input.data,
  }
}
