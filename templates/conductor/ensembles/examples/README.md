# Conductor Examples

Advanced examples demonstrating powerful patterns and real-world use cases with Conductor ensembles.

## 📁 Directory Structure

```
examples/
├── http-triggers/       # HTTP API and web application examples
│   ├── basic-greeting.yaml
│   ├── smart-404.yaml
│   ├── smart-500.yaml
│   ├── blog-post.yaml
│   ├── dashboard.yaml
│   ├── login.yaml
│   └── homepage.yaml
└── other-triggers/      # Examples for plugin-provided triggers
    └── twilio-sms-bot.yaml
```

## 🎯 What's Included

### HTTP Triggers (`http-triggers/`)

Production-ready examples for building modern web applications and APIs.

#### **basic-greeting.yaml** - Simple HTTP Endpoint
- ✅ Path parameters (`:name`)
- ✅ JSON responses
- ✅ Public endpoint
- Perfect for learning the basics

#### **smart-404.yaml** - AI-Powered 404 Page
- 🤖 AI-powered page suggestions based on requested URL
- 📊 Analytics tracking of 404s (stored in KV)
- 🎨 Beautiful, responsive design
- Great example of combining AI + storage + UI

#### **smart-500.yaml** - Intelligent Error Handling
- 🚨 Error logging to KV and D1
- 📧 Team notifications via email
- 🤖 AI-powered troubleshooting suggestions
- 🆔 Error ID tracking for support
- 🔧 Dev mode with stack traces

#### **blog-post.yaml** - Dynamic Blog Post
- 🗄️ Database queries (D1)
- 🔗 Path parameters (`:slug`)
- 📝 Related posts
- 🔍 SEO optimization with structured data
- 🔄 Conditional rendering (404 if not found)
- 🎭 HTMX social sharing buttons

#### **dashboard.yaml** - Analytics Dashboard
- 🔐 Authentication required (bearer token)
- 📊 Real-time metrics from database
- 🔄 HTMX-powered dynamic updates
- 📈 Chart loading with HTMX
- ⏰ Auto-refresh every 30s
- 📱 Responsive grid layout

#### **login.yaml** - Login Page with Form Handling
- 📝 GET (display form) and POST (handle submission)
- 🔐 Form submission with validation
- 🗄️ Session management (KV)
- 🔄 HTMX-powered submission
- 🎨 Demo credentials included
- ↩️ Redirects after successful login

#### **homepage.yaml** - Complete Homepage
- 🗄️ Database-driven content (features + blog posts)
- 🎨 Hero section with CTAs
- 📱 Fully responsive design
- 🦶 Complete navigation and footer
- 🏗️ Modern landing page structure

### Other Triggers (`other-triggers/`)

Examples demonstrating custom trigger types from plugins.

#### **twilio-sms-bot.yaml** - AI-Powered SMS Support Bot
- 📱 Custom `twilio-sms` trigger type
- 🤖 AI intent classification
- 💬 Smart response generation
- 📏 SMS length handling (160 chars)
- 🔐 Twilio authentication
- Demonstrates plugin-provided trigger types

## 🚀 Using These Examples

### Option 1: Install with `ensemble conductor init`

When you run `ensemble conductor init`, examples are automatically included unless you use `--no-examples`:

```bash
# With examples (default)
ensemble conductor init my-project

# Without examples
ensemble conductor init my-project --no-examples

# For CI/automated environments
ensemble conductor init my-project --yes
```

### Option 2: Copy Individual Examples

Copy specific examples to your project:

```bash
# Copy smart 404 page
cp catalog/cloud/cloudflare/templates/ensembles/examples/http-triggers/smart-404.yaml \
   ensembles/smart-404.yaml

# Copy blog post example
cp catalog/cloud/cloudflare/templates/ensembles/examples/http-triggers/blog-post.yaml \
   ensembles/blog-post.yaml
```

### Option 3: Copy Entire Category

```bash
# Copy all HTTP trigger examples
cp -r catalog/cloud/cloudflare/templates/ensembles/examples/http-triggers/* \
      ensembles/examples/
```

## ⚙️ Configuration

### Using Smart Error Pages

Add to your [conductor.config.ts](conductor.config.ts):

```typescript
import { defineConfig } from '@ensemble-edge/conductor'

export default defineConfig({
  errorPages: {
    404: 'smart-404',
    500: 'smart-500',
  },
})
```

### Setting Up Routes

Ensembles with HTTP triggers are automatically registered as routes:

```yaml
# ensembles/blog-post.yaml
trigger:
  - type: http
    path: /blog/:slug
```

This ensemble is automatically available at `/blog/:slug` when you run your worker.

### Database Setup

Some examples require database tables. Run these migrations:

```sql
-- Blog posts table
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

-- Analytics metrics table
CREATE TABLE analytics_metrics (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  current_value TEXT NOT NULL,
  change_percent TEXT,
  trend TEXT,
  sort_order INTEGER
);

-- Featured items table
CREATE TABLE featured_items (
  id INTEGER PRIMARY KEY,
  icon TEXT,
  title TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT true,
  sort_order INTEGER
);

-- Error logs table
CREATE TABLE error_logs (
  id INTEGER PRIMARY KEY,
  error_id TEXT UNIQUE NOT NULL,
  message TEXT,
  stack TEXT,
  path TEXT,
  timestamp DATETIME
);
```

## 📚 Common Patterns

### 1. Path Parameters

```yaml
trigger:
  - type: http
    path: /blog/:slug  # :slug becomes available in $input.params.slug
```

### 2. Multiple HTTP Methods

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

### 4. Conditional Agent Execution

```yaml
agents:
  - name: handle-login
    operation: code
    when: $input.method == 'POST'  # Only run on POST requests
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
# In HTML template
<div hx-get="/api/data" hx-trigger="load">
  Loading...
</div>

# In agent config
scripts:
  - src: https://unpkg.com/htmx.org@1.9.10
```

### 7. AI Operations

```yaml
agents:
  - name: greet-user
    operation: think
    config:
      model: "@cf/meta/llama-3.1-8b-instruct"
      systemPrompt: "Generate a friendly greeting for the user."
      temperature: 0.7
    schema:
      input:
        name: string
      output:
        greeting: string   # Define the output field name you want

flow:
  - agent: greet-user
    input:
      name: ${input.userName}

output:
  message: ${greet-user.output.greeting}  # Use the schema-defined field name
```

> **💡 Think Agent Output is Schema-Aware**
>
> When you define an output schema, the AI response maps to your field names:
> ```yaml
> # Your schema
> schema:
>   output:
>     greeting: string
>
> # Your output mapping - uses the schema field name
> output:
>   result: ${agent.output.greeting}  # ✅ Works!
> ```
>
> If the AI returns JSON (e.g., for structured output), all fields are available:
> ```yaml
> output:
>   sentiment: ${analyzer.output.sentiment}
>   confidence: ${analyzer.output.confidence}
> ```
>
> Metadata (model, provider, tokens) is available via `${agent.output._meta}`.

## 🎓 Learning Path

**Beginner**: Start with `basic-greeting.yaml` to understand the fundamentals.

**Intermediate**: Explore `login.yaml` and `blog-post.yaml` to learn:
- Multi-method handling (GET/POST)
- Database integration
- Form processing
- Path parameters

**Advanced**: Study `dashboard.yaml` and `smart-500.yaml` for:
- Authentication
- HTMX dynamic loading
- AI integration
- Error handling
- Real-time updates

## 🏗️ Best Practices

### Security
- ✅ Always use `auth` or `public: true` explicitly
- ✅ Validate and sanitize user input
- ✅ Never expose sensitive data in error messages
- ✅ Use environment variables for secrets

### Performance
- ✅ Use caching where appropriate (KV)
- ✅ Limit database queries (use indexes)
- ✅ Use HTMX for dynamic updates instead of full page reloads
- ✅ Minimize agent chains (run in parallel when possible)

### SEO
- ✅ Set proper meta tags and titles
- ✅ Use structured data (JSON-LD)
- ✅ Return appropriate status codes
- ✅ Use canonical URLs

### User Experience
- ✅ Make pages responsive (mobile-friendly)
- ✅ Provide loading states
- ✅ Give clear feedback on actions
- ✅ Handle errors gracefully

## 📖 Learn More

- **HTTP Trigger Documentation**: https://docs.ensemble.ai/conductor/core-concepts/triggers#http
- **Building with Conductor**: https://docs.ensemble.ai/conductor/building/creating-agents
- **Your First Website Guide**: https://docs.ensemble.ai/conductor/getting-started/your-first-website

## 💡 Need Help?

- **Documentation**: https://docs.ensemble.ai
- **GitHub Issues**: https://github.com/anthropics/conductor/issues
- **Community Discussions**: https://github.com/anthropics/conductor/discussions
