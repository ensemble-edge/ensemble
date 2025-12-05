/**
 * Scrape Agent
 *
 * 3-tier web scraping with bot protection detection and fallback strategies.
 *
 * Tier 1: Fast browser rendering (domcontentloaded) - ~350ms
 * Tier 2: Slow browser rendering (networkidle2) - ~2s
 * Tier 3: HTML parsing fallback - ~1.5s
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'
import { detectBotProtection, isContentSuccessful } from './bot-detection.js'
import { extractTextFromHTML, extractTitleFromHTML, convertHTMLToMarkdown } from './html-parser.js'

// ============================================================================
// Types
// ============================================================================

type ScrapeStrategy = 'fast' | 'balanced' | 'aggressive'
type ReturnFormat = 'markdown' | 'html' | 'text'

interface ScrapeInput {
  url: string
}

interface ScrapeConfig {
  strategy: ScrapeStrategy
  returnFormat: ReturnFormat
  blockResources: boolean
  userAgent?: string
  timeout: number
}

interface ScrapeOutput {
  success: boolean
  url: string
  markdown?: string
  html?: string
  text?: string
  title?: string
  tier: 1 | 2 | 3
  duration: number
  botProtectionDetected: boolean
  contentLength: number
}

// ============================================================================
// Agent Implementation
// ============================================================================

export default async function scrape(
  input: ScrapeInput,
  ctx: AgentExecutionContext
): Promise<ScrapeOutput> {
  const config: ScrapeConfig = {
    strategy: 'balanced',
    returnFormat: 'markdown',
    blockResources: true,
    timeout: 30000,
    ...(ctx.config as Partial<ScrapeConfig>),
  }

  if (!input.url) {
    throw new Error('Scrape agent requires "url" in input')
  }

  const startTime = Date.now()
  const strategy = config.strategy

  // Tier 1: Fast browser rendering (domcontentloaded)
  try {
    const result = await tier1Fast(input.url, config)
    if (isContentSuccessful(result.html)) {
      return formatResult(input.url, result, 1, Date.now() - startTime, config)
    }
  } catch {
    // Tier 1 failed, try next tier
  }

  // If strategy is 'fast', return fallback
  if (strategy === 'fast') {
    return fallbackResult(input.url, Date.now() - startTime)
  }

  // Tier 2: Slow browser rendering (networkidle2)
  try {
    const result = await tier2Slow(input.url, config)
    if (isContentSuccessful(result.html)) {
      return formatResult(input.url, result, 2, Date.now() - startTime, config)
    }
  } catch {
    // Tier 2 failed, try next tier
  }

  // If strategy is 'balanced', return fallback
  if (strategy === 'balanced') {
    return fallbackResult(input.url, Date.now() - startTime)
  }

  // Tier 3: HTML parsing fallback
  const result = await tier3HTMLParsing(input.url, config)
  return formatResult(input.url, result, 3, Date.now() - startTime, config)
}

// ============================================================================
// Tier Functions
// ============================================================================

/**
 * Tier 1: Fast browser rendering with domcontentloaded
 */
async function tier1Fast(
  url: string,
  config: ScrapeConfig
): Promise<{ html: string; title: string }> {
  // TODO: Integrate with Cloudflare Browser Rendering API
  // For now, use standard fetch as placeholder
  const response = await fetch(url, {
    headers: {
      'User-Agent': config.userAgent || 'Mozilla/5.0 (compatible; Conductor/1.0)',
    },
    signal: AbortSignal.timeout(config.timeout),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const html = await response.text()
  const title = extractTitleFromHTML(html)

  return { html, title }
}

/**
 * Tier 2: Slow browser rendering with networkidle2
 */
async function tier2Slow(
  url: string,
  config: ScrapeConfig
): Promise<{ html: string; title: string }> {
  // TODO: Integrate with Cloudflare Browser Rendering API with networkidle2
  // For now, fallback to tier1
  return await tier1Fast(url, config)
}

/**
 * Tier 3: HTML parsing fallback
 */
async function tier3HTMLParsing(
  url: string,
  config: ScrapeConfig
): Promise<{ html: string; title: string }> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': config.userAgent || 'Mozilla/5.0 (compatible; Conductor/1.0)',
    },
    signal: AbortSignal.timeout(config.timeout),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const html = await response.text()
  const title = extractTitleFromHTML(html)

  return { html, title }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Format the result based on configured return format
 */
function formatResult(
  url: string,
  data: { html: string; title: string },
  tier: 1 | 2 | 3,
  duration: number,
  config: ScrapeConfig
): ScrapeOutput {
  const botProtection = detectBotProtection(data.html)
  const format = config.returnFormat

  const result: ScrapeOutput = {
    success: true,
    url,
    tier,
    duration,
    botProtectionDetected: botProtection.detected,
    contentLength: data.html.length,
    title: data.title,
  }

  // Add requested format
  if (format === 'html' || format === 'markdown') {
    result.html = data.html
  }

  if (format === 'markdown') {
    result.markdown = convertHTMLToMarkdown(data.html)
  }

  if (format === 'text') {
    result.text = extractTextFromHTML(data.html)
  }

  return result
}

/**
 * Return a fallback result when all tiers fail
 */
function fallbackResult(url: string, duration: number): ScrapeOutput {
  return {
    success: false,
    url,
    tier: 3,
    duration,
    botProtectionDetected: true,
    contentLength: 0,
    markdown: '',
    html: '',
    text: '',
  }
}
