---
title: Getting Started
description: Quick start guide to make your first API call
order: 1
icon: 🚀
---

# Getting Started

Welcome to the {{projectName}} API! This guide will help you make your first API call.

## Base URL

```
Production: https://api.example.com
Development: http://localhost:8787
```

## Quick Start

### 1. Get Your API Key

Sign up for an account and generate your API key from the dashboard:

```bash
export API_KEY="your_api_key_here"
```

### 2. Make Your First Request

```bash
curl -X POST https://api.example.com/execute/hello-world \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "World"}'
```

### 3. Handle the Response

Successful responses return JSON:

```json
{
  "success": true,
  "data": {
    "greeting": "Hello, World!"
  },
  "metadata": {
    "executionTime": 234,
    "timestamp": "2025-11-03T18:00:00Z"
  }
}
```

## Response Format

All API endpoints return a consistent response structure:

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the request succeeded |
| `data` | object | Response data (when successful) |
| `error` | object | Error details (when failed) |
| `metadata` | object | Execution metadata |

## Error Handling

When an error occurs, you'll receive:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Missing required field: name",
    "details": {
      "field": "name",
      "received": null
    }
  }
}
```

Common error codes:

- `INVALID_INPUT` - Request validation failed
- `UNAUTHORIZED` - Invalid or missing API key
- `NOT_FOUND` - Ensemble not found
- `RATE_LIMIT` - Too many requests
- `INTERNAL_ERROR` - Server error

## Next Steps

- [Authentication →](./authentication) - Learn about API keys and security
- [Rate Limits →](./rate-limits) - Understand usage limits
- [API Reference →](./api) - Full endpoint documentation
