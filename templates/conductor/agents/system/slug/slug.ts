/**
 * Slug Agent
 *
 * Generate unique URL-safe slugs using various strategies.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

interface SlugInput {
  strategy?: 'nanoid' | 'uuid' | 'base62' | 'timestamp'
  length?: number
  alphabet?: string
  prefix?: string
}

interface SlugOutput {
  success: boolean
  slug: string
  strategy: string
}

interface SlugConfig {
  defaultLength: number
  defaultAlphabet: string
}

const DEFAULT_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Custom alphabet random string generator (nanoid-style)
 */
function customAlphabet(alphabet: string, size: number): string {
  const array = new Uint8Array(size)
  crypto.getRandomValues(array)

  let result = ''
  for (let i = 0; i < size; i++) {
    result += alphabet[array[i] % alphabet.length]
  }
  return result
}

export default async function slug(
  input: SlugInput,
  ctx: AgentExecutionContext
): Promise<SlugOutput> {
  const config = (ctx.config as SlugConfig) || {}
  const strategy = input.strategy || 'nanoid'
  const length = input.length || config.defaultLength || 7
  const alphabet = input.alphabet || config.defaultAlphabet || DEFAULT_ALPHABET
  const prefix = input.prefix || ''

  let generatedSlug: string

  switch (strategy) {
    case 'nanoid':
      generatedSlug = customAlphabet(alphabet, length)
      break

    case 'uuid':
      generatedSlug = crypto.randomUUID()
      break

    case 'base62':
      const base62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
      generatedSlug = customAlphabet(base62, length)
      break

    case 'timestamp':
      // Base36 encoded timestamp + random suffix
      const ts = Date.now().toString(36)
      const suffixLength = Math.max(1, length - ts.length)
      const suffix = customAlphabet(alphabet, suffixLength)
      generatedSlug = ts + suffix
      break

    default:
      generatedSlug = customAlphabet(alphabet, length)
  }

  return {
    success: true,
    slug: prefix + generatedSlug,
    strategy,
  }
}
