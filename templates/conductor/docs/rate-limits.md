---
title: Rate Limits
description: Understand API rate limits and best practices
order: 3
icon: ⏱️
---

# Rate Limits

Rate limits protect API availability and ensure fair usage.

## Current Limits

| Plan | Requests/Minute | Requests/Hour | Requests/Day |
|------|----------------|---------------|--------------|
| **Free** | 60 | 1,000 | 10,000 |
| **Pro** | 600 | 10,000 | 100,000 |
| **Enterprise** | Custom | Custom | Custom |

## Rate Limit Headers

Every API response includes rate limit information:

```http
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 599
X-RateLimit-Reset: 1699027200
```

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in current window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |

## 429 Too Many Requests

When you exceed the rate limit:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Retry after 60 seconds.",
    "retryAfter": 60
  }
}
```

Response headers will include:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
X-RateLimit-Limit: 600
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1699027200
```

## Best Practices

### 1. Check Rate Limit Headers

Monitor headers and slow down before hitting limits:

```typescript
const response = await fetch(url, options);

const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
const reset = parseInt(response.headers.get('X-RateLimit-Reset'));

if (remaining < 10) {
  console.warn(`Only ${remaining} requests remaining`);
  // Implement backoff strategy
}
```

### 2. Implement Exponential Backoff

When you receive a 429, wait before retrying:

```typescript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After')) || 60;
      await sleep(retryAfter * 1000 * Math.pow(2, i)); // Exponential backoff
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

### 3. Batch Requests

Instead of making many small requests, batch when possible:

```bash
# Bad: Multiple requests
curl -X POST /execute/process -d '{"id": 1}'
curl -X POST /execute/process -d '{"id": 2}'
curl -X POST /execute/process -d '{"id": 3}'

# Good: Single batched request
curl -X POST /execute/process-batch -d '{
  "items": [{"id": 1}, {"id": 2}, {"id": 3}]
}'
```

### 4. Cache Responses

Cache responses that don't change frequently:

```typescript
const cache = new Map();

async function getCachedData(key) {
  if (cache.has(key)) {
    const { data, timestamp } = cache.get(key);
    if (Date.now() - timestamp < 60000) { // 1 minute cache
      return data;
    }
  }

  const data = await fetchFromAPI(key);
  cache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

## Increasing Limits

Need higher limits? [Upgrade your plan](https://example.com/pricing) or [contact us](mailto:support@example.com) for enterprise pricing.

## Monitoring Usage

Track your usage in the dashboard:

- Real-time request count
- Historical usage graphs
- Alerts when approaching limits
- Detailed request logs

## Next Steps

- [Error Handling →](./errors.md)
- [Performance Tips →](./performance.md)
- [Webhooks →](./webhooks.md)
