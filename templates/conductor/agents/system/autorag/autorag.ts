/**
 * AutoRAG Agent - Cloudflare's Fully Managed RAG Service
 *
 * Uses Cloudflare's AutoRAG service which provides completely automatic
 * RAG with R2 storage integration. Zero manual work required.
 *
 * Cloudflare AutoRAG Features:
 * - Automatic document ingestion from R2 buckets
 * - Automatic chunking with configurable size/overlap
 * - Automatic embedding generation via Workers AI
 * - Automatic indexing in Vectorize
 * - Continuous monitoring and updates
 * - Supports PDFs, images, text, HTML, CSV, and more
 *
 * This is the easiest way to do RAG on Cloudflare - just point to an R2 bucket!
 */

import type { AgentExecutionContext } from '@anthropic-ai/conductor'

export interface AutoRAGConfig {
  /** AutoRAG instance name (configured in wrangler.toml) */
  instance: string

  /** Return format: 'answer' (AI-generated) or 'results' (raw search results) */
  mode?: 'answer' | 'results'

  /** Number of results to retrieve */
  topK?: number

  /** Optional query rewriting for better retrieval */
  rewriteQuery?: boolean
}

export interface AutoRAGInput {
  /** Query text */
  query: string

  /** Override topK for this query */
  topK?: number
}

export interface AutoRAGAnswerResult {
  /** AI-generated answer grounded in retrieved documents */
  answer: string

  /** Sources used to generate the answer */
  sources: Array<{
    /** Document content excerpt */
    content: string

    /** Similarity score (0-1) */
    score: number

    /** Document metadata */
    metadata: Record<string, unknown>

    /** Document ID */
    id: string
  }>

  /** Original query */
  query: string
}

export interface AutoRAGSearchResult {
  /** Retrieved search results without generation */
  results: Array<{
    /** Document content */
    content: string

    /** Similarity score (0-1) */
    score: number

    /** Document metadata */
    metadata: Record<string, unknown>

    /** Document ID */
    id: string
  }>

  /** Combined context for LLM */
  context: string

  /** Number of results */
  count: number

  /** Original query */
  query: string
}

/**
 * Cloudflare AI interface
 */
interface CloudflareAI {
  autorag(instance: string): AutoRAGInstance
}

interface AutoRAGInstance {
  aiSearch(options: { query: string; topK?: number }): Promise<{
    answer: string
    sources?: Array<{
      content: string
      score: number
      metadata?: Record<string, unknown>
      id: string
    }>
  }>

  search(options: { query: string; topK?: number }): Promise<{
    results: Array<{
      content: string
      score: number
      metadata?: Record<string, unknown>
      id: string
    }>
  }>
}

/**
 * AutoRAG Agent Handler
 */
export default async function autorag(
  context: AgentExecutionContext
): Promise<AutoRAGAnswerResult | AutoRAGSearchResult> {
  const input = context.input as AutoRAGInput
  const config = context.config as unknown as AutoRAGConfig

  // Get AI binding
  const ai = (context.env as unknown as Record<string, unknown>).AI as CloudflareAI | undefined

  if (!ai) {
    throw new Error(
      'AI binding not found in environment. Make sure you have Workers AI configured in wrangler.toml.'
    )
  }

  // Get AutoRAG instance
  const autorag = ai.autorag(config.instance)

  if (!autorag) {
    throw new Error(
      `AutoRAG instance '${config.instance}' not found. Check your wrangler.toml configuration.`
    )
  }

  const mode = config.mode || 'answer'
  const topK = input.topK || config.topK

  if (mode === 'answer') {
    // Use aiSearch for AI-generated answers
    const result = await autorag.aiSearch({
      query: input.query,
      topK,
    })

    // Transform to our result format
    return {
      answer: result.answer,
      sources:
        result.sources?.map((source) => ({
          content: source.content,
          score: source.score,
          metadata: source.metadata || {},
          id: source.id,
        })) || [],
      query: input.query,
    }
  } else {
    // Use search for raw results without generation
    const result = await autorag.search({
      query: input.query,
      topK,
    })

    // Transform results
    const searchResults = result.results.map((match) => ({
      content: match.content,
      score: match.score,
      metadata: match.metadata || {},
      id: match.id,
    }))

    // Combine into context string for LLM
    const contextString = searchResults
      .map((result, index) => {
        const source = result.metadata.source || result.id
        return `[${index + 1}] Source: ${source}\n${result.content}`
      })
      .join('\n\n---\n\n')

    return {
      results: searchResults,
      context: contextString,
      count: searchResults.length,
      query: input.query,
    }
  }
}
