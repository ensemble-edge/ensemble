# Templates

This directory contains HTML, email, and PDF templates used by your Conductor workflows. Templates are treated as **Edgit components** and can be versioned, deployed, and managed just like prompts.

## Directory Structure

```
templates/
├── email/          # Email templates (HTML, MJML)
├── html/           # HTML templates for dashboards, reports
└── pdf/            # PDF templates (HTML with print styles)
```

## Template Types

### Email Templates (`email/`)

Email templates support multiple formats:
- **HTML** - Simple HTML emails with inline styles
- **MJML** - Responsive email markup (compiles to HTML)
- **Handlebars** - Dynamic templating with variables

**Example:**
```html
<!-- email/welcome.html -->
<html>
  <body style="font-family: Arial, sans-serif;">
    <h1>Welcome, {{name}}!</h1>
    <p>Thanks for signing up for {{appName}}.</p>
    <a href="{{activationUrl}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
      Activate Your Account
    </a>
  </body>
</html>
```

### HTML Templates (`html/`)

HTML templates for dashboards, reports, and dynamic UIs.

**Example:**
```html
<!-- html/dashboard.html -->
<html>
  <head>
    <title>{{title}}</title>
    <style>
      .metric { padding: 20px; background: #f5f5f5; margin: 10px; border-radius: 8px; }
      .value { font-size: 32px; font-weight: bold; color: #007bff; }
    </style>
  </head>
  <body>
    <h1>{{title}}</h1>
    <div class="metrics">
      {{#each metrics}}
        <div class="metric">
          <div class="label">{{name}}</div>
          <div class="value">{{value}}</div>
        </div>
      {{/each}}
    </div>
  </body>
</html>
```

### PDF Templates (`pdf/`)

HTML templates designed for PDF generation with print styles.

**Example:**
```html
<!-- pdf/invoice.html -->
<html>
  <head>
    <style>
      @page {
        margin: 2cm;
        @top-right { content: "Invoice #{{invoiceNumber}}"; }
        @bottom-center { content: "Page " counter(page) " of " counter(pages); }
      }
      body { font-family: Arial, sans-serif; }
      .header { text-align: center; margin-bottom: 30px; }
      .line-items { width: 100%; border-collapse: collapse; }
      .line-items th, .line-items td { border: 1px solid #ddd; padding: 8px; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Invoice</h1>
      <p>Invoice #{{invoiceNumber}} | Date: {{date}}</p>
    </div>

    <table class="line-items">
      <thead>
        <tr>
          <th>Item</th>
          <th>Quantity</th>
          <th>Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
          <tr>
            <td>{{name}}</td>
            <td>{{quantity}}</td>
            <td>${{price}}</td>
            <td>${{total}}</td>
          </tr>
        {{/each}}
      </tbody>
    </table>

    <div style="text-align: right; margin-top: 20px;">
      <strong>Total: ${{total}}</strong>
    </div>
  </body>
</html>
```

## Using Templates in Ensembles

### Reference by Path

```yaml
# ensembles/welcome-email.yaml
flow:
  - agent: send-welcome
    type: Email
    config:
      template: email/welcome  # Loads from templates/email/welcome.html
    input:
      to: ${input.email}
      data:
        name: ${input.name}
        appName: ${env.APP_NAME}
        activationUrl: ${generateActivationUrl()}
```

### Inline Templates

```yaml
# For quick prototyping
- agent: send-notification
  type: Email
  input:
    to: admin@example.com
    html: |
      <h1>Alert</h1>
      <p>Something happened: ${event.message}</p>
```

### Load from KV (Edgit Versioned)

```yaml
# After deployment, templates are versioned in KV
- agent: send-email
  type: Email
  config:
    template: kv://templates/email/welcome@v1.2.0
    # Or use 'latest' for current version
    template: kv://templates/email/welcome@latest
```

## Template Variables

Templates use Liquid syntax for variables (edge-compatible):

- `{{variable}}` - Simple variable
- `{% for item in items %}...{% endfor %}` - Loop over array
- `{% if condition %}...{% endif %}` - Conditional rendering
- `{{variable | upcase}}` - Filters for transformations

## Edgit Integration

Templates are **Edgit components** and support versioning:

### 1. Local Development
Edit templates in `templates/` directory during development.

### 2. Version Control
Commit templates to Git like any other code:
```bash
git add templates/email/welcome.html
git commit -m "feat: update welcome email template"
```

### 3. Automatic Deployment
When you push to GitHub:
- GitHub Action detects template changes
- Templates are pushed to KV with version tags
- Workers instantly access new templates (no rebuild)

### 4. Version Tags
Reference specific versions in production:
```yaml
config:
  template: kv://templates/email/welcome@v1.0.0  # Specific version
  template: kv://templates/email/welcome@latest  # Current version
  template: kv://templates/email/welcome@main    # Main branch version
```

### 5. A/B Testing
Use different template versions for testing:
```yaml
- agent: conditional
  if: ${input.experimentGroup === 'A'}
  then:
    - agent: send-email
      config:
        template: kv://templates/email/welcome@v1.0.0
  else:
    - agent: send-email
      config:
        template: kv://templates/email/welcome@v2.0.0
```

### 6. Rollback
Instantly rollback to previous template version:
```yaml
config:
  template: kv://templates/email/welcome@v1.5.0  # Roll back from v1.6.0
```

## Template Best Practices

### 1. Email Templates
- Use inline CSS (no external stylesheets)
- Keep width under 600px for mobile
- Test in multiple email clients
- Use MJML for responsive layouts
- Include plain text fallback

### 2. HTML Templates
- Keep JavaScript minimal (Workers context)
- Use relative paths for assets
- Consider dark mode with CSS variables
- Make responsive with media queries

### 3. PDF Templates
- Use `@page` rules for headers/footers
- Test page breaks with `page-break-before/after`
- Avoid complex CSS (PDF renderers are limited)
- Use web fonts carefully (may not render)
- Include page numbers with `counter(page)`

### 4. General
- Use clear, semantic HTML
- Comment complex logic
- Keep templates under 100KB
- Version breaking changes
- Document required variables

## Template Engines

Conductor supports multiple template engines optimized for edge runtime:

- **Liquid** (default) - Edge-compatible, real-time rendering, powerful filters. Industry standard from Shopify/Jekyll.
- **Simple** - Ultra-lightweight, zero dependencies, perfect for basic templating
- **MJML** - Email-specific, responsive layouts

**Why Liquid?** Unlike Handlebars which uses `new Function()` (blocked by Cloudflare Workers CSP), Liquid compiles to AST and runs safely at the edge. Perfect for real-time, edge-first applications.

Configure in agent YAML:
```yaml
config:
  template: email/welcome
  engine: liquid  # or simple, mjml
```

## Development Workflow

### 1. Create Template
```bash
# Create new email template
touch templates/email/onboarding-day-1.html
```

### 2. Edit Template
Use your favorite editor. Variables use Liquid syntax.

### 3. Test Locally
```bash
# Run local dev server
pnpm run dev

# Test your ensemble that uses the template
curl -X POST http://localhost:8787/ensemble/send-onboarding \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "name": "Test User"}'
```

### 4. Commit & Deploy
```bash
git add templates/email/onboarding-day-1.html
git commit -m "feat: add day 1 onboarding email"
git push

# GitHub Action automatically:
# 1. Detects template change
# 2. Pushes to KV with version tag
# 3. Makes available to Workers instantly
```

### 5. Verify Deployment
Templates are instantly available - no Worker rebuild needed!

## KV Storage Structure

Templates are stored in KV with this structure:
```
templates/email/welcome@v1.0.0 -> <template content>
templates/email/welcome@latest -> <template content>
templates/email/welcome@main   -> <template content>
```

## Migration from Other Systems

### From Inline HTML
```yaml
# Before
input:
  html: "<h1>Welcome {{name}}</h1>"

# After
config:
  template: email/welcome
```

### From External Services (SendGrid, Mailchimp)
Export your templates as HTML and place in `templates/email/`.
Update variables to Liquid syntax.

## Troubleshooting

### Template Not Found
- Verify file exists in `templates/` directory
- Check path is correct (no leading slash)
- Ensure file extension matches (.html, .mjml, etc.)

### Variables Not Rendering
- Check Liquid syntax: `{{variable}}` not `${variable}`
- Ensure data is passed in `input.data`
- Loop syntax: `{% for item in items %}`...`{% endfor %}`

### Template Not Updating
- If using KV version, push new version to KV
- Check version tag in config
- Clear KV cache if needed

## Examples

See the included example templates:
- [`email/welcome.html`](email/welcome.html) - Simple welcome email
- [`html/dashboard.html`](html/dashboard.html) - Metrics dashboard
- [`pdf/invoice.html`](pdf/invoice.html) - Professional invoice

## Learn More

- [Conductor Documentation](https://docs.ensemble-edge.com/conductor)
- [Edgit Versioning](https://docs.ensemble-edge.com/edgit)
- [Liquid Template Syntax](https://liquidjs.com/)
- [MJML Email Framework](https://mjml.io/)
