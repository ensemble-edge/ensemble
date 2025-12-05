# Shared Queries

This folder contains **shared, versioned SQL queries** that can be used across multiple agents and ensembles.

## 🚧 Status: Coming Soon

**File-based component loading is not yet implemented.** This folder structure demonstrates the intended architecture.

For now, define queries inline in your agent.yaml or use the Data agent type.

Once Edgit integration is complete, you'll be able to reference queries like:
```yaml
query:
  component: queries/company-lookup.sql@v1.0.0
```

## Why Shared Queries?

Queries are Edgit components, which means:
- **Reusable**: Multiple agents can reference the same query
- **Versioned**: Each query has independent version history
- **Optimizable**: Use different query versions across agents
- **Database-agnostic**: Works with D1, Hyperdrive (Postgres, MySQL, MariaDB)

## Adding a Query

1. Create a SQL file in this folder:
   ```bash
   touch queries/company-lookup.sql
   ```

2. Write your SQL query:
   ```sql
   SELECT
     id,
     name,
     industry,
     founded_year,
     revenue
   FROM companies
   WHERE name LIKE :companyName
     AND industry = :industry
   ORDER BY revenue DESC
   LIMIT :limit;
   ```

3. Reference it in a agent's `agent.yaml`:
   ```yaml
   type: query
   name: company-finder
   query:
     component: queries/company-lookup.sql
     binding: DB  # D1 database
   params:
     companyName: "{{input.name}}"
     industry: "{{input.industry}}"
     limit: 10
   ```

4. Version it with Edgit:
   ```bash
   edgit commit -m "Add company lookup query"
   edgit tag queries/company-lookup.sql v1.0.0
   ```

## Database Bindings

Configure bindings in `wrangler.toml`:

### D1 (Cloudflare SQL)
```toml
[[d1_databases]]
binding = "DB"
database_name = "conductor-db"
database_id = "your-d1-database-id"
```

### Hyperdrive (External Databases)
```toml
[[hyperdrive]]
binding = "PRODUCTION_DB"
id = "your-hyperdrive-id"
```

Then use in agent:
```yaml
query:
  component: queries/my-query.sql
  binding: PRODUCTION_DB  # or DB
```

## Using Different Versions

```yaml
# Ensemble with multiple query versions
flow:
  - component: queries/company-lookup.sql@v2.0.0  # Latest optimized query
  - component: queries/competitor-search.sql@v1.0.0  # Stable version
```

## Co-located Alternative

For rapid development, you can put queries directly in agent folders:
```
agents/
  my-query-agent/
    agent.yaml
    query.sql        # Co-located query
```

**When to use shared vs co-located:**
- **Co-located**: Early development, agent-specific queries
- **Shared**: Production use, queries used by multiple agents, version control needed

## Query Parameters

Use named parameters with `:paramName` syntax:
```sql
SELECT * FROM users
WHERE created_at > :startDate
  AND status = :status
  AND country IN (:countries);
```

Map parameters in agent.yaml:
```yaml
params:
  startDate: "{{input.startDate}}"
  status: "active"
  countries: ["US", "CA", "UK"]
```

## Examples

Common query patterns:
- **Lookup**: Find records by ID or name
- **Search**: Full-text search across tables
- **Analytics**: Aggregations and reporting
- **Joins**: Complex multi-table queries
