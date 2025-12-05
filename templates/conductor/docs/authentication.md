---
title: Authentication
description: Learn how to authenticate your API requests
order: 2
icon: 🔐
---

# Authentication

All API requests must be authenticated using an API key.

## API Keys

Generate an API key from your dashboard. Keep it secure - treat it like a password!

### Using API Keys

Include your API key in the `Authorization` header:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.example.com/execute/your-ensemble
```

### Security Best Practices

1. **Never expose API keys** in client-side code or public repositories
2. **Rotate keys regularly** - Generate new keys periodically
3. **Use environment variables** - Store keys in env vars, not code
4. **Revoke compromised keys** immediately from the dashboard
5. **Use separate keys** for development, staging, and production

## Request Headers

Required headers for all requests:

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

Optional headers:

```http
X-Request-ID: unique-request-id  # For tracking and debugging
X-Idempotency-Key: unique-key    # For idempotent requests
```

## Error Responses

### 401 Unauthorized

Missing or invalid API key:

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API key"
  }
}
```

### 403 Forbidden

Valid key but insufficient permissions:

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions for this resource"
  }
}
```

## Testing Authentication

Test your API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.example.com/health
```

You should receive:

```json
{
  "status": "healthy",
  "authenticated": true,
  "user": {
    "id": "user_123",
    "plan": "pro"
  }
}
```

## SDK Support

Our SDKs handle authentication automatically:

```typescript
// TypeScript/JavaScript
import { ConductorClient } from '@your-org/conductor-sdk';

const client = new ConductorClient({
  apiKey: process.env.API_KEY
});

// Python
from conductor_sdk import ConductorClient

client = ConductorClient(api_key=os.environ['API_KEY'])
```

## Next Steps

- [Rate Limits →](./rate-limits.md)
- [Error Handling →](./errors.md)
- [Webhooks →](./webhooks.md)
