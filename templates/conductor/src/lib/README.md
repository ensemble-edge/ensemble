# Shared Utilities

This folder contains **your shared utility functions and helpers** that can be used across your agents.

## Why Shared Utilities?

Utilities in `src/lib/` are:
- **Reusable**: Import from any agent or worker code
- **Testable**: Write unit tests for shared logic
- **Maintainable**: Change once, update everywhere
- **Type-safe**: Full TypeScript support

## Adding a Utility

1. Create a TypeScript file:
   ```bash
   touch src/lib/formatting.ts
   ```

2. Write your utility function:
   ```typescript
   export function formatCurrency(amount: number, currency = 'USD'): string {
     return new Intl.NumberFormat('en-US', {
       style: 'currency',
       currency
     }).format(amount);
   }

   export function formatDate(date: Date | string): string {
     const d = typeof date === 'string' ? new Date(date) : date;
     return d.toLocaleDateString('en-US', {
       year: 'numeric',
       month: 'long',
       day: 'numeric'
     });
   }
   ```

3. Import and use in your agents:
   ```typescript
   // agents/my-agent/index.ts
   import { formatCurrency, formatDate } from '../../lib/formatting';

   export default async function(input: any, context: MemberContext) {
     const price = formatCurrency(input.amount);
     const date = formatDate(input.createdAt);

     return { price, date };
   }
   ```

## Common Utility Patterns

### Data Validation
```typescript
// src/lib/validation.ts
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateInput(input: any, schema: any): boolean {
  // Your validation logic
  return true;
}
```

### API Helpers
```typescript
// src/lib/api.ts
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('Max retries exceeded');
}
```

### Data Transformation
```typescript
// src/lib/transform.ts
export function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function extractDomain(url: string): string {
  return new URL(url).hostname;
}
```

### Error Handling
```typescript
// src/lib/errors.ts
export class MemberError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'MemberError';
  }
}

export function handleError(error: unknown): Response {
  if (error instanceof MemberError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  return Response.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

### Database Helpers
```typescript
// src/lib/database.ts
export async function queryWithParams(
  db: D1Database,
  sql: string,
  params: Record<string, any>
) {
  // Replace named parameters
  let query = sql;
  const values: any[] = [];

  for (const [key, value] of Object.entries(params)) {
    query = query.replace(`:${key}`, '?');
    values.push(value);
  }

  return db.prepare(query).bind(...values).all();
}
```

## Organizing Utilities

As your project grows, organize by category:
```
src/lib/
├── README.md
├── validation.ts       # Input validation
├── formatting.ts       # Data formatting
├── api.ts             # API helpers
├── database.ts        # Database utilities
├── errors.ts          # Error handling
├── constants.ts       # Shared constants
└── types.ts           # Shared TypeScript types
```

## TypeScript Types

Define shared types for your project:
```typescript
// src/lib/types.ts
export interface Company {
  id: string;
  name: string;
  industry: string;
  foundedYear: number;
}

export interface MemberInput {
  userId: string;
  timestamp: number;
  data: any;
}

export interface MemberOutput {
  success: boolean;
  result: any;
  metadata?: Record<string, any>;
}
```

## Testing Utilities

Write tests for your shared code:
```typescript
// src/lib/formatting.test.ts
import { formatCurrency, formatDate } from './formatting';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56');
  });
});
```

## Best Practices

1. **Keep utilities pure**: Avoid side effects when possible
2. **Document parameters**: Use JSDoc comments
3. **Handle errors**: Validate inputs and throw meaningful errors
4. **Write tests**: Ensure utilities work correctly
5. **Export explicitly**: Only export what's needed
6. **Use TypeScript**: Take advantage of type safety

## Example: Complete Utility

```typescript
// src/lib/scoring.ts

/**
 * Calculate confidence score based on multiple factors
 * @param factors - Object containing scoring factors
 * @returns Score between 0 and 1
 */
export function calculateConfidence(factors: {
  accuracy: number;
  completeness: number;
  freshness: number;
}): number {
  const weights = {
    accuracy: 0.5,
    completeness: 0.3,
    freshness: 0.2
  };

  return (
    factors.accuracy * weights.accuracy +
    factors.completeness * weights.completeness +
    factors.freshness * weights.freshness
  );
}
```

## Next Steps

1. Create utilities as you find repeated code across agents
2. Extract common logic into this folder
3. Write tests for critical utilities
4. Document complex utilities with examples
