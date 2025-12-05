# HTTP Trigger Examples

Advanced examples demonstrating powerful patterns with HTTP triggers and Conductor ensembles.

## Examples Overview

### Smart Error Pages

AI-powered error pages that go beyond static HTML.

#### smart-404.yaml - Intelligent 404 Page

**Features:**
- AI-powered page suggestions based on requested URL
- Analytics tracking of 404s
- Helpful links and search
- Beautiful, responsive design

**What it does:**
1. Tracks the missing URL in KV for analytics
2. Uses AI (GPT-4 Mini) to suggest similar pages
3. Renders smart suggestions to help users find what they need

**Usage:**

```typescript
// conductor.config.ts
errorPages: {
  404: 'smart-404',
}
```

**Configuration:**

```yaml
input:
  path: /the-missing-page
  headers:
    user-agent: "..."
    referer: "..."
```

#### smart-500.yaml - Intelligent Error Handling

**Features:**
- Error logging to KV and D1
- Team notifications via email
- AI-powered troubleshooting suggestions
- Error ID tracking for support
- Dev mode with stack traces

**What it does:**
1. Generates unique error ID
2. Logs error details to KV/D1
3. Sends email notification to team (optional)
4. Uses AI to suggest troubleshooting steps
5. Displays helpful error page to user

**Usage:**

```typescript
// conductor.config.ts
errorPages: {
  500: 'smart-500',
}
```

**Configuration:**

```yaml
input:
  error: "Error message"
  stack: "Stack trace"
  config:
    notifyOnError: true
    aiSuggestions: true
    alertEmail: alerts@example.com
    dashboardUrl: https://dashboard.example.com
```

### Web Application Examples

Full-featured examples for building modern web applications.

#### blog-post.yaml - Dynamic Blog Post

**Features:**
- Dynamic routing with path parameters (`:slug`)
- Database queries (D1)
- Related posts
- SEO optimization
- Social sharing buttons (HTMX)
- Responsive design

**What it demonstrates:**
- Path parameter handling
- Multi-agent workflows (fetch post + fetch related)
- Conditional rendering
- HTMX integration
- Structured data (JSON-LD)

**Usage:**

Route: `/blog/:slug`

```yaml
# Fetches blog post from D1 database
# Displays with related posts
# Returns 404 if post not found
```

#### dashboard.yaml - Analytics Dashboard

**Features:**
- Authentication required (bearer token)
- Real-time metrics from database
- HTMX-powered dynamic updates
- Chart loading with HTMX
- Auto-refresh every 30s
- Responsive grid layout

**What it demonstrates:**
- Protected routes with authentication
- Multiple database queries
- HTMX polling and dynamic loading
- Modern dashboard UI

**Usage:**

Route: `/dashboard`
Auth: Bearer token required

```typescript
trigger: {
  type: 'http',
  path: '/dashboard',
  auth: {
    type: 'bearer',
    secret: process.env.AUTH_TOKEN
  }
}
```

#### login.yaml - Login Page with Form Handling

**Features:**
- GET and POST handling
- Form submission
- Session management (KV)
- HTMX-powered submission
- Demo credentials
- Error handling

**What it demonstrates:**
- Multi-method routes (GET + POST)
- Conditional agent execution (`when:`)
- Form processing
- Session token generation
- Redirects after login

**Usage:**

Route: `/login`
Methods: GET (display form), POST (handle submission)

Demo credentials:
- Email: demo@example.com
- Password: demo123

#### homepage.yaml - Complete Homepage

**Features:**
- Database-driven content
- Features section
- Latest blog posts
- Call-to-action sections
- Full navigation and footer
- Responsive design

**What it demonstrates:**
- Multiple database queries in parallel
- Conditional rendering (blog section)
- Modern landing page structure
- Reusable components pattern

**Usage:**

Route: `/`

```yaml
# Fetches featured items and blog posts
# Renders full homepage with sections
```

#### basic-greeting.yaml - Simple HTTP Endpoint

**Features:**
- Path parameter handling
- JSON responses
- Basic code operation
- Public endpoint

**What it demonstrates:**
- Basic HTTP trigger setup
- Path parameter usage
- Simple code operations
- JSON output

**Usage:**

Route: `/hello/:name`

```yaml
# Returns JSON greeting with timestamp
# Example: /hello/World -> {"greeting": "Hello, World!", ...}
```

## Common Patterns

### 1. Path Parameters

```yaml
trigger:
  - type: http
    path: /blog/:slug  # :slug becomes available in $input.params.slug
```

### 2. Multiple Methods

```yaml
trigger:
  - type: http
    path: /login
    methods: [GET, POST]  # Handle both display and submission
```

### 3. Authentication

```yaml
trigger:
  - type: http
    path: /dashboard
    auth:
      type: bearer
      secret: $env.AUTH_TOKEN
```

### 4. Conditional Agents

```yaml
agents:
  - name: handle-login
    operation: code
    when: $input.method == 'POST'  # Only run on POST
```

### 5. Database Queries

```yaml
agents:
  - name: fetch-data
    operation: data
    config:
      database: d1
      query: SELECT * FROM table WHERE id = ?
      params:
        - $input.params.id
```

### 6. HTMX Integration

```yaml
# In template
<div hx-get="/api/data" hx-trigger="load">
  Loading...
</div>

# In HTML agent
scripts:
  - src: https://unpkg.com/htmx.org@1.9.10
```

### 7. Multiple Responses

```yaml
trigger:
  - type: http
    responses:
      html:
        enabled: true   # Return HTML for browsers
      json:
        enabled: true   # Return JSON for API clients
```

## Using These Examples

### 1. Copy to Your Project

```bash
cp catalog/cloud/cloudflare/templates/ensembles/examples/http-triggers/smart-404.yaml \
   ensembles/smart-404.yaml
```

### 2. Customize

Edit the YAML file to match your needs:
- Update styling and branding
- Modify AI prompts
- Add/remove features
- Configure database queries

### 3. Configure

Add to your `conductor.config.ts`:

```typescript
import { defineConfig } from '@ensemble-edge/conductor'

export default defineConfig({
  errorPages: {
    404: 'smart-404',
    500: 'smart-500',
  },
})
```

### 4. Deploy

```bash
npm run deploy
```

## Database Setup

Some examples require database tables:

```sql
-- Blog posts
CREATE TABLE blog_posts (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  author TEXT,
  cover_image TEXT,
  published BOOLEAN DEFAULT false,
  published_at DATETIME,
  reading_time INTEGER,
  tags TEXT  -- JSON array
);

-- Analytics metrics
CREATE TABLE analytics_metrics (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  current_value TEXT NOT NULL,
  change_percent TEXT,
  trend TEXT,
  sort_order INTEGER
);

-- Featured items
CREATE TABLE featured_items (
  id INTEGER PRIMARY KEY,
  icon TEXT,
  title TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER
);

-- Error logs
CREATE TABLE error_logs (
  id INTEGER PRIMARY KEY,
  error_id TEXT UNIQUE NOT NULL,
  message TEXT,
  stack TEXT,
  path TEXT,
  timestamp DATETIME
);
```

## Best Practices

1. **Security:**
   - Always use `auth` or `public: true` explicitly
   - Never expose sensitive data in error messages
   - Validate and sanitize user input

2. **Performance:**
   - Use caching where appropriate
   - Limit database queries
   - Use HTMX for dynamic updates instead of full page reloads

3. **SEO:**
   - Set proper meta tags
   - Use structured data (JSON-LD)
   - Return appropriate status codes

4. **Error Handling:**
   - Always handle error cases
   - Provide helpful error messages
   - Log errors for debugging

5. **User Experience:**
   - Make pages responsive
   - Provide loading states
   - Give clear feedback on actions

## Learn More

- [HTTP Trigger Documentation](https://docs.ensemble.ai/conductor/core-concepts/triggers#http)
- [Your First Website Guide](https://docs.ensemble.ai/conductor/getting-started/your-first-website)
- [Building with Conductor](https://docs.ensemble.ai/conductor/building/creating-agents)

## Support

- Documentation: https://docs.ensemble.ai
- GitHub: https://github.com/anthropics/conductor
- Community: https://github.com/anthropics/conductor/discussions
