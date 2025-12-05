# Cloudflare Templates - Ensembles

Pre-built ensemble templates for common web application patterns using HTTP triggers.

## Structure

```
ensembles/
├── errors/        # Default error page ensembles
├── static/        # Static utility ensembles (robots.txt, sitemap, health check)
└── README.md      # This file
```

## Error Pages (`errors/`)

Production-ready error page ensembles that can be used as-is or customized for your brand.

### Available Error Pages

- **404.yaml** - Page Not Found
- **401.yaml** - Authentication Required
- **403.yaml** - Access Forbidden
- **500.yaml** - Internal Server Error

### Features

- Beautiful, modern design with gradient backgrounds
- Fully responsive (mobile-friendly)
- Configurable messages and branding
- SEO-optimized (noindex, nofollow for error pages)
- Optional helpful links and search functionality

### Usage

Configure error pages in your `conductor.config.ts`:

```typescript
import { defineConfig } from '@ensemble-edge/conductor'

export default defineConfig({
  errorPages: {
    404: 'error-404',
    401: 'error-401',
    403: 'error-403',
    500: 'error-500',
  },
})
```

### Customization

Copy any error page template to your project's `ensembles/` directory and customize:

```bash
cp catalog/cloud/cloudflare/templates/ensembles/errors/404.yaml \
   ensembles/my-custom-404.yaml
```

Then update your config:

```typescript
errorPages: {
  404: 'my-custom-404',
}
```

You can customize:
- Colors and styling
- Logo and branding
- Error messages
- Helpful links
- Search functionality
- Analytics tracking

## Static Utilities (`static/`)

Essential static files for web applications.

### robots.yaml

SEO robots.txt file for search engine crawlers.

**Features:**
- Configurable allow/disallow rules
- Sitemap reference
- Crawl delay settings
- Environment-based configuration (dev vs prod)

**Usage:**

```yaml
# In your ensemble or config
input:
  disallowAll: false  # true for staging/dev
  disallowPaths:
    - /api/*
    - /admin/*
    - /_*
  sitemap: https://example.com/sitemap.xml
```

### sitemap.yaml

Dynamic XML sitemap generation for SEO.

**Features:**
- Configurable URLs with metadata
- Database-driven dynamic sitemaps
- Proper XML formatting
- Priority and changefreq support

**Basic Usage:**

```yaml
# Static sitemap
input:
  urls:
    - loc: https://example.com/
      lastmod: "2024-01-01"
      changefreq: daily
      priority: 1.0
```

**Dynamic Usage:**

Fetch pages from database and generate sitemap (see comments in sitemap.yaml for full example).

### health.yaml

Health check endpoint for monitoring and load balancers.

**Features:**
- Basic health status
- Database connectivity checks
- KV store checks
- Version information
- Uptime tracking

**Usage:**

The health check runs at `/health` and returns JSON:

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime": 12345678,
  "version": "1.0.0",
  "database": "connected",
  "kv": "connected"
}
```

## Installation

These templates are included in the Conductor package. To use them:

1. **Configure in conductor.config.ts:**

```typescript
import { defineConfig } from '@ensemble-edge/conductor'

export default defineConfig({
  errorPages: {
    404: 'error-404',
    500: 'error-500',
  },
})
```

2. **Copy templates to your project** (optional - for customization):

```bash
# Copy all error pages
cp -r catalog/cloud/cloudflare/templates/ensembles/errors/ \
      ensembles/errors/

# Copy static utilities
cp -r catalog/cloud/cloudflare/templates/ensembles/static/ \
      ensembles/static/
```

3. **Customize as needed** - Edit the YAML files to match your branding

## Examples

See the [examples/](examples/) directory for advanced examples including:

- **[http-triggers/](examples/http-triggers/)** - HTTP API and web application examples
  - **smart-404.yaml** - AI-powered 404 with suggested pages
  - **smart-500.yaml** - AI-powered 500 with troubleshooting
  - **blog-post.yaml** - Dynamic blog post with database
  - **dashboard.yaml** - Analytics dashboard with HTMX
  - **login.yaml** - Login page with form handling
  - **homepage.yaml** - Full homepage with features section
- **[other-triggers/](examples/other-triggers/)** - Plugin-provided trigger examples
  - **twilio-sms-bot.yaml** - AI-powered SMS support bot

## Support

For questions or issues:
- Documentation: https://docs.ensemble.ai
- GitHub Issues: https://github.com/anthropics/conductor/issues
- Community: https://github.com/anthropics/conductor/discussions
