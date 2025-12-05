/**
 * Redirect Agent
 *
 * URL redirect operations with support for permanent, expiring,
 * and single-use (magic) links. Stores data in Cloudflare KV.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

// ============================================================================
// Types
// ============================================================================

interface RedirectEntry {
  slug: string
  targetUrl: string
  type: 'permanent' | 'expiring' | 'single-use'
  statusCode: 301 | 302 | 307 | 308
  expiresAt: string | null
  used: boolean
  usedAt: string | null
  createdAt: string
  metadata?: {
    createdBy?: string
    campaign?: string
    tags?: string[]
    notes?: string
  }
}

interface RedirectInput {
  action: 'resolve' | 'create' | 'get' | 'update' | 'delete' | 'list'
  slug?: string
  targetUrl?: string
  type?: 'permanent' | 'expiring' | 'single-use'
  statusCode?: 301 | 302 | 307 | 308
  expiresAt?: string
  expiresIn?: number
  customSlug?: string
  metadata?: RedirectEntry['metadata']
  filter?: {
    type?: string
    used?: boolean
    campaign?: string
  }
  limit?: number
  cursor?: string
  markAsUsed?: boolean
}

interface RedirectConfig {
  kvBinding: string
  basePath: string
  defaultStatusCode: 301 | 302 | 307 | 308
  defaultType: 'permanent' | 'expiring' | 'single-use'
  slugLength: number
  slugAlphabet: string
}

interface RedirectOutput {
  success: boolean
  found?: boolean
  targetUrl?: string
  statusCode?: number
  error?: string
  errorMessage?: string
  redirect?: RedirectEntry & { shortUrl: string }
  redirects?: Array<RedirectEntry & { shortUrl: string }>
  cursor?: string
  total?: number
  deleted?: boolean
}

// ============================================================================
// Helpers
// ============================================================================

const DEFAULT_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

function customAlphabet(alphabet: string, size: number): string {
  const array = new Uint8Array(size)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < size; i++) {
    result += alphabet[array[i] % alphabet.length]
  }
  return result
}

function computeShortUrl(ctx: AgentExecutionContext, config: RedirectConfig, slug: string): string {
  // Try to get base URL from request context
  const input = ctx.input as { url?: string }
  if (input?.url) {
    try {
      const url = new URL(input.url)
      return `${url.protocol}//${url.host}${config.basePath}/${slug}`
    } catch {
      // Fallback
    }
  }
  return `${config.basePath}/${slug}`
}

// ============================================================================
// Agent Implementation
// ============================================================================

export default async function redirect(
  input: RedirectInput,
  ctx: AgentExecutionContext
): Promise<RedirectOutput> {
  const config: RedirectConfig = {
    kvBinding: 'REDIRECTS_KV',
    basePath: '/go',
    defaultStatusCode: 302,
    defaultType: 'permanent',
    slugLength: 7,
    slugAlphabet: DEFAULT_ALPHABET,
    ...(ctx.config as Partial<RedirectConfig>),
  }

  const kv = ctx.env?.[config.kvBinding] as KVNamespace | undefined

  if (!kv) {
    return {
      success: false,
      error: 'binding_not_found',
      errorMessage: `KV binding "${config.kvBinding}" not found in environment`,
    }
  }

  switch (input.action) {
    case 'resolve':
      return resolve(kv, input, ctx, config)
    case 'create':
      return create(kv, input, ctx, config)
    case 'get':
      return get(kv, input, ctx, config)
    case 'update':
      return update(kv, input, ctx, config)
    case 'delete':
      return del(kv, input)
    case 'list':
      return list(kv, input, ctx, config)
    default:
      return { success: false, error: 'invalid_action' }
  }
}

// --------------------------------------------------------------------------
// Resolve: Look up slug and return redirect info
// --------------------------------------------------------------------------

async function resolve(
  kv: KVNamespace,
  input: RedirectInput,
  ctx: AgentExecutionContext,
  config: RedirectConfig
): Promise<RedirectOutput> {
  if (!input.slug) {
    return { success: false, found: false, error: 'not_found' }
  }

  const entry = await kv.get<RedirectEntry>(`redirect:${input.slug}`, 'json')

  if (!entry) {
    return { success: true, found: false, error: 'not_found' }
  }

  // Check expiration
  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
    return { success: true, found: false, error: 'expired' }
  }

  // Check single-use
  if (entry.type === 'single-use' && entry.used) {
    return { success: true, found: false, error: 'already_used' }
  }

  // Mark as used (for single-use links)
  if (entry.type === 'single-use' && input.markAsUsed !== false) {
    const updated: RedirectEntry = {
      ...entry,
      used: true,
      usedAt: new Date().toISOString(),
    }
    await kv.put(`redirect:${input.slug}`, JSON.stringify(updated), {
      metadata: { type: entry.type, expiresAt: entry.expiresAt, used: true },
    })
  }

  return {
    success: true,
    found: true,
    targetUrl: entry.targetUrl,
    statusCode: entry.statusCode,
  }
}

// --------------------------------------------------------------------------
// Create: Generate slug and store redirect
// --------------------------------------------------------------------------

async function create(
  kv: KVNamespace,
  input: RedirectInput,
  ctx: AgentExecutionContext,
  config: RedirectConfig
): Promise<RedirectOutput> {
  if (!input.targetUrl) {
    return { success: false, error: 'invalid_url', errorMessage: 'targetUrl is required' }
  }

  // Validate URL
  try {
    new URL(input.targetUrl)
  } catch {
    return { success: false, error: 'invalid_url', errorMessage: 'Invalid targetUrl format' }
  }

  // Generate or use custom slug
  let slug: string
  if (input.customSlug) {
    const existing = await kv.get(`redirect:${input.customSlug}`)
    if (existing) {
      return {
        success: false,
        error: 'slug_taken',
        errorMessage: `Slug "${input.customSlug}" already exists`,
      }
    }
    slug = input.customSlug
  } else {
    slug = await generateUniqueSlug(kv, config)
  }

  // Calculate expiration
  let expiresAt: string | null = null
  if (input.expiresAt) {
    expiresAt = input.expiresAt
  } else if (input.expiresIn) {
    expiresAt = new Date(Date.now() + input.expiresIn * 1000).toISOString()
  }

  // Create entry
  const entry: RedirectEntry = {
    slug,
    targetUrl: input.targetUrl,
    type: input.type || config.defaultType,
    statusCode: input.statusCode || config.defaultStatusCode,
    expiresAt,
    used: false,
    usedAt: null,
    createdAt: new Date().toISOString(),
    metadata: input.metadata,
  }

  // Calculate TTL for KV (auto-cleanup expired entries)
  const options: KVNamespacePutOptions = {
    metadata: {
      type: entry.type,
      expiresAt: entry.expiresAt,
      used: entry.used,
    },
  }
  if (expiresAt) {
    const ttl = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    if (ttl > 0) {
      options.expirationTtl = ttl + 86400 // Add 1 day buffer
    }
  }

  await kv.put(`redirect:${slug}`, JSON.stringify(entry), options)

  return {
    success: true,
    redirect: {
      ...entry,
      shortUrl: computeShortUrl(ctx, config, slug),
    },
  }
}

// --------------------------------------------------------------------------
// Get: Retrieve redirect by slug
// --------------------------------------------------------------------------

async function get(
  kv: KVNamespace,
  input: RedirectInput,
  ctx: AgentExecutionContext,
  config: RedirectConfig
): Promise<RedirectOutput> {
  if (!input.slug) {
    return { success: false, error: 'not_found' }
  }

  const entry = await kv.get<RedirectEntry>(`redirect:${input.slug}`, 'json')

  if (!entry) {
    return { success: false, error: 'not_found' }
  }

  return {
    success: true,
    redirect: {
      ...entry,
      shortUrl: computeShortUrl(ctx, config, entry.slug),
    },
  }
}

// --------------------------------------------------------------------------
// Update: Modify existing redirect
// --------------------------------------------------------------------------

async function update(
  kv: KVNamespace,
  input: RedirectInput,
  ctx: AgentExecutionContext,
  config: RedirectConfig
): Promise<RedirectOutput> {
  if (!input.slug) {
    return { success: false, error: 'not_found' }
  }

  const existing = await kv.get<RedirectEntry>(`redirect:${input.slug}`, 'json')

  if (!existing) {
    return { success: false, error: 'not_found' }
  }

  // Validate URL if provided
  if (input.targetUrl) {
    try {
      new URL(input.targetUrl)
    } catch {
      return { success: false, error: 'invalid_url' }
    }
  }

  // Calculate expiration
  let expiresAt = existing.expiresAt
  if (input.expiresAt !== undefined) {
    expiresAt = input.expiresAt
  } else if (input.expiresIn !== undefined) {
    expiresAt = new Date(Date.now() + input.expiresIn * 1000).toISOString()
  }

  // Update entry
  const updated: RedirectEntry = {
    ...existing,
    targetUrl: input.targetUrl ?? existing.targetUrl,
    type: input.type ?? existing.type,
    statusCode: input.statusCode ?? existing.statusCode,
    expiresAt,
    metadata: input.metadata ?? existing.metadata,
  }

  await kv.put(`redirect:${input.slug}`, JSON.stringify(updated), {
    metadata: { type: updated.type, expiresAt: updated.expiresAt, used: updated.used },
  })

  return {
    success: true,
    redirect: {
      ...updated,
      shortUrl: computeShortUrl(ctx, config, updated.slug),
    },
  }
}

// --------------------------------------------------------------------------
// Delete: Remove redirect
// --------------------------------------------------------------------------

async function del(kv: KVNamespace, input: RedirectInput): Promise<RedirectOutput> {
  if (!input.slug) {
    return { success: false, error: 'not_found' }
  }

  await kv.delete(`redirect:${input.slug}`)

  return { success: true, deleted: true }
}

// --------------------------------------------------------------------------
// List: Paginated listing with filters
// --------------------------------------------------------------------------

async function list(
  kv: KVNamespace,
  input: RedirectInput,
  ctx: AgentExecutionContext,
  config: RedirectConfig
): Promise<RedirectOutput> {
  const limit = input.limit || 50

  const listResult = await kv.list<{ type: string; expiresAt: string; used: boolean }>({
    prefix: 'redirect:',
    limit,
    cursor: input.cursor,
  })

  const redirects: Array<RedirectEntry & { shortUrl: string }> = []

  for (const key of listResult.keys) {
    // Apply filters using metadata
    if (input.filter) {
      if (input.filter.type && key.metadata?.type !== input.filter.type) continue
      if (input.filter.used !== undefined && key.metadata?.used !== input.filter.used) continue
    }

    const entry = await kv.get<RedirectEntry>(key.name, 'json')
    if (entry) {
      // Filter by campaign (requires full entry)
      if (input.filter?.campaign && entry.metadata?.campaign !== input.filter.campaign) continue

      redirects.push({
        ...entry,
        shortUrl: computeShortUrl(ctx, config, entry.slug),
      })
    }
  }

  return {
    success: true,
    redirects,
    cursor: listResult.list_complete ? undefined : listResult.cursor,
    total: redirects.length,
  }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

async function generateUniqueSlug(
  kv: KVNamespace,
  config: RedirectConfig,
  maxRetries = 3
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const slug = customAlphabet(config.slugAlphabet, config.slugLength)
    const existing = await kv.get(`redirect:${slug}`)
    if (!existing) {
      return slug
    }
  }

  // Fallback: use longer slug
  return customAlphabet(config.slugAlphabet, config.slugLength + 3)
}
