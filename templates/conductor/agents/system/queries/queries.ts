/**
 * Queries Agent
 *
 * Execute SQL queries across Hyperdrive-connected databases.
 * Queries can be loaded from catalog (like prompts) or executed inline.
 */

import type { AgentExecutionContext } from '@ensemble-edge/conductor'

// ============================================================================
// Types
// ============================================================================

interface QueriesInput {
  /** Query name from catalog (mutually exclusive with sql) */
  queryName?: string
  /** Inline SQL query (mutually exclusive with queryName) */
  sql?: string
  /** Query parameters (named or positional) */
  input?: Record<string, unknown> | unknown[]
  /** Database alias (overrides default) */
  database?: string
}

interface QueriesConfig {
  defaultDatabase?: string
  cacheTTL?: number
  maxRows?: number
  timeout?: number
  readOnly: boolean
  transform: 'none' | 'camelCase' | 'snakeCase'
  includeMetadata: boolean
}

interface QueriesOutput {
  rows: unknown[]
  count: number
  metadata: {
    columns: string[]
    executionTime: number
    cached: boolean
    database: string
    query?: string
  }
}

interface CatalogQuery {
  name: string
  sql: string
  description?: string
  database?: string
  params?: Record<string, unknown>
}

// ============================================================================
// Agent Implementation
// ============================================================================

export default async function queries(
  input: QueriesInput,
  ctx: AgentExecutionContext
): Promise<QueriesOutput> {
  const config: QueriesConfig = {
    readOnly: false,
    transform: 'none',
    includeMetadata: true,
    ...(ctx.config as Partial<QueriesConfig>),
  }

  // 1. Validate input
  if (!input.queryName && !input.sql) {
    throw new Error('Either queryName or sql must be provided')
  }

  if (input.queryName && input.sql) {
    throw new Error('Cannot specify both queryName and sql')
  }

  // 2. Resolve query (from catalog or inline)
  const query = input.queryName
    ? await loadQueryFromCatalog(input.queryName)
    : { sql: input.sql!, params: {}, database: input.database }

  // 3. Determine database
  const database = input.database || query.database || config.defaultDatabase
  if (!database) {
    throw new Error('No database specified and no default database configured')
  }

  // 4. Get D1/Hyperdrive binding
  const db = ctx.env?.[database] as D1Database | undefined
  if (!db) {
    throw new Error(`Database binding not found: ${database}`)
  }

  // 5. Validate read-only mode
  if (config.readOnly && isWriteQuery(query.sql)) {
    throw new Error('Write operations not allowed in read-only mode')
  }

  // 6. Prepare parameters
  const { sql, params } = prepareQuery(query.sql, input.input || query.params || {})

  // 7. Execute query
  const startTime = Date.now()
  const result = await executeQuery(db, sql, params, config.timeout)
  const executionTime = Date.now() - startTime

  // 8. Transform results
  let rows = result.rows
  if (config.transform === 'camelCase') {
    rows = toCamelCase(rows)
  } else if (config.transform === 'snakeCase') {
    rows = toSnakeCase(rows)
  }

  // 9. Apply row limit
  if (config.maxRows && rows.length > config.maxRows) {
    rows = rows.slice(0, config.maxRows)
  }

  // 10. Return result
  const output: QueriesOutput = {
    rows,
    count: rows.length,
    metadata: {
      columns: result.columns || [],
      executionTime,
      cached: false, // TODO: Implement caching
      database,
      ...(config.includeMetadata && { query: sql }),
    },
  }

  return output
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Load query from catalog
 */
async function loadQueryFromCatalog(queryName: string): Promise<CatalogQuery> {
  // TODO: Implement catalog integration
  throw new Error(
    `Query catalog not yet implemented. Use inline SQL with 'sql' parameter instead of 'queryName'.`
  )
}

/**
 * Prepare query with parameters
 */
function prepareQuery(
  sql: string,
  input: Record<string, unknown> | unknown[]
): { sql: string; params: unknown[] } {
  // If input is an array, assume positional parameters
  if (Array.isArray(input)) {
    return { sql, params: input }
  }

  // Convert named parameters to positional
  const params: unknown[] = []
  let paramIndex = 1

  const convertedSql = sql.replace(/:(\w+)/g, (match, paramName) => {
    if (!(paramName in input)) {
      throw new Error(`Missing parameter: ${paramName}`)
    }

    params.push(input[paramName])
    return `$${paramIndex++}`
  })

  return { sql: convertedSql, params }
}

/**
 * Execute query via D1
 */
async function executeQuery(
  db: D1Database,
  sql: string,
  params: unknown[],
  timeout?: number
): Promise<{ rows: unknown[]; columns?: string[] }> {
  // Prepare statement
  let stmt = db.prepare(sql)
  if (params.length > 0) {
    stmt = stmt.bind(...params)
  }

  // Execute with timeout if configured
  const executePromise = stmt.all()
  const result = timeout
    ? await Promise.race([
        executePromise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout')), timeout)
        ),
      ])
    : await executePromise

  // Extract columns from result
  const columns =
    result.results.length > 0
      ? Object.keys(result.results[0])
      : result.meta?.columns
        ? (result.meta.columns as Array<{ name: string }>).map((c) => c.name)
        : []

  return {
    rows: result.results,
    columns,
  }
}

/**
 * Check if query is a write operation
 */
function isWriteQuery(sql: string): boolean {
  const upperSQL = sql.trim().toUpperCase()
  return /^(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|REPLACE)/i.test(upperSQL)
}

/**
 * Transform object keys to camelCase
 */
function toCamelCase(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    const transformed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      transformed[camelKey] = value
    }
    return transformed
  })
}

/**
 * Transform object keys to snake_case
 */
function toSnakeCase(rows: unknown[]): unknown[] {
  return rows.map((row) => {
    const transformed: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
      transformed[snakeKey] = value
    }
    return transformed
  })
}
