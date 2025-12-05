# Static Assets (R2-Only)

This directory contains **static assets** deployed to R2 for CDN delivery.

## ⚠️ Important Design Decision

**Assets are NOT Edgit-versioned**. This is intentional.

### The Rule

- **Static assets** (images, fonts, global CSS) → `/assets/` directory → R2 storage
- **Versioned content** (template-specific CSS/JS) → **Inline in templates** → Edgit-versioned

### Why This Design?

1. **Simplicity**: One clear rule - if it's shared, it goes in `/assets/`
2. **Performance**: R2-backed assets are CDN-cached globally
3. **Version Control**: Templates with inline styles/scripts are atomically versioned
4. **No Complexity**: No need to coordinate asset versions with template versions

## What Goes in `/assets/`

### ✅ Static Assets (R2-Deployed)

- **Images**: Logos, icons, photos, banners
- **Fonts**: Web fonts (WOFF2, WOFF, TTF)
- **Global CSS**: Resets, utilities, shared styles
- **Static JavaScript**: Third-party libraries (if not from CDN)

### ❌ NOT for `/assets/`

- **Template-specific CSS** → Inline in template `<style>` tags
- **Template-specific JavaScript** → Inline in template `<script>` tags
- **Dynamic content** → Use Function agents or API calls

## Directory Structure

```
assets/
├── images/       # Logos, icons, photos
│   ├── logo.svg
│   ├── favicon.ico
│   └── hero-banner.jpg
├── fonts/        # Web fonts
│   ├── inter-regular.woff2
│   └── space-grotesk-bold.woff2
└── styles/       # Global CSS only
    ├── reset.css      # CSS reset
    └── utilities.css  # Utility classes
```

## Deployment to R2

Assets will be deployed to R2 during Conductor deployment (implementation pending).

**Future deployment workflow:**
```bash
# Deploy will handle assets automatically
pnpm run deploy
# Assets synced to R2 bucket: ASSETS
```

## Usage in Templates

Reference assets using absolute paths from R2:

```html
<!-- Email Template -->
<!DOCTYPE html>
<html>
<head>
  <!-- Global CSS from R2 -->
  <link href="/assets/styles/reset.css" rel="stylesheet">

  <!-- Template-specific CSS INLINE (Edgit-versioned with template) -->
  <style>
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    .email-header {
      background-color: #2D1B69;
      padding: 20px;
    }
  </style>
</head>
<body>
  <!-- Static logo from R2 -->
  <img src="/assets/images/logo.svg" alt="Logo">

  <div class="email-container">
    <div class="email-header">
      <h1>Welcome {{name}}!</h1>
    </div>
  </div>
</body>
</html>
```

```html
<!-- HTML Dashboard Template -->
<!DOCTYPE html>
<html>
<head>
  <!-- Global utilities from R2 -->
  <link href="/assets/styles/reset.css" rel="stylesheet">
  <link href="/assets/styles/utilities.css" rel="stylesheet">

  <!-- Static font from R2 -->
  <link rel="preload" href="/assets/fonts/inter-regular.woff2" as="font" crossorigin>

  <!-- Dashboard-specific CSS INLINE (versioned with template) -->
  <style>
    @font-face {
      font-family: 'Inter';
      src: url('/assets/fonts/inter-regular.woff2') format('woff2');
    }

    .dashboard {
      display: grid;
      grid-template-columns: 250px 1fr;
      min-height: 100vh;
      font-family: 'Inter', sans-serif;
    }

    .sidebar {
      background: #2D1B69;
      color: white;
      padding: 2rem;
    }

    .metric-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div class="dashboard">
    <aside class="sidebar">
      <!-- Static logo -->
      <img src="/assets/images/logo.svg" alt="Logo" width="150">
      <nav>Navigation</nav>
    </aside>
    <main>
      <div class="metric-card">
        <span class="label">Active Users</span>
        <span class="value">{{activeUsers}}</span>
      </div>
    </main>
  </div>

  <!-- Dashboard JavaScript INLINE (versioned with template) -->
  <script>
    // Fetch metrics
    async function loadMetrics() {
      const response = await fetch('/api/metrics');
      const data = await response.json();
      document.querySelector('.value').textContent = data.activeUsers;
    }

    // Auto-refresh every 30s
    setInterval(loadMetrics, 30000);
    loadMetrics();
  </script>
</body>
</html>
```

## URL Structure

Assets are served at:
```
https://your-worker.dev/assets/images/logo.svg
https://your-worker.dev/assets/fonts/inter-regular.woff2
https://your-worker.dev/assets/styles/reset.css
```

## When to Use Static Assets vs Inline

| Type | Location | Versioning | Example |
|------|----------|------------|---------|
| **Shared images** | `/assets/images/` | R2-only | Company logo used across all templates |
| **Web fonts** | `/assets/fonts/` | R2-only | Inter, Space Grotesk |
| **Global CSS** | `/assets/styles/` | R2-only | reset.css, utilities.css |
| **Template CSS** | Inline `<style>` | Edgit-versioned | Dashboard-specific styles |
| **Template JS** | Inline `<script>` | Edgit-versioned | Dashboard metrics widget |
| **Third-party libs** | CDN or `/assets/` | R2-only | Chart.js, Alpine.js |

## Design Principles

### 1. One Source of Truth

- **Assets** = R2 (static, rarely changes)
- **Templates** = Edgit/KV (versioned, frequently changes)

### 2. Atomic Versioning

Templates with inline styles/scripts are **atomically versioned**:

```yaml
# templates/html/dashboard.html@v2.0.0
# Everything needed for v2.0.0 is in the template:
# - HTML structure
# - Inline CSS for dashboard v2.0.0 design
# - Inline JavaScript for dashboard v2.0.0 behavior

# References static assets:
# - /assets/images/logo.svg (never changes)
# - /assets/styles/reset.css (rarely changes)
```

### 3. Clear Separation

```
Static (R2)                    Versioned (Edgit/KV)
    ↓                                  ↓
/assets/images/logo.svg        templates/html/dashboard.html@v2.0.0
/assets/fonts/inter.woff2            ├── <style> dashboard CSS </style>
/assets/styles/reset.css             └── <script> dashboard JS </script>
```

## Best Practices

### For Assets (R2)

1. **Optimize before adding**: Compress images, minify CSS
2. **Use web formats**: WebP, AVIF, WOFF2
3. **Keep files small**: Aim for < 100KB per asset
4. **Organize by type**: images/, fonts/, styles/
5. **Lowercase filenames**: Use hyphens: `company-logo.svg`

### For Template Content (Inline)

1. **Inline template-specific CSS/JS**: Keep styles with templates
2. **Use Edgit versioning**: Tag template versions
3. **Minify inline code**: Keep templates lean
4. **Reference static assets**: Use `/assets/` for shared resources
5. **Test atomically**: Each template version is self-contained

## Examples

### ✅ CORRECT: Dashboard Template with Inline Styles

```html
<!-- templates/html/dashboard.html@v1.0.0 -->
<!DOCTYPE html>
<html>
<head>
  <!-- Global reset from R2 (rarely changes) -->
  <link href="/assets/styles/reset.css" rel="stylesheet">

  <!-- Dashboard styles INLINE (versioned with template) -->
  <style>
    /* v1.0.0 dashboard design */
    .dashboard { display: grid; grid-template-columns: 250px 1fr; }
    .sidebar { background: #2D1B69; }
    .metric-card { background: white; border-radius: 8px; }
  </style>
</head>
<body>
  <!-- Static logo from R2 -->
  <img src="/assets/images/logo.svg" alt="Logo">

  <div class="dashboard">...</div>

  <!-- Dashboard behavior INLINE (versioned with template) -->
  <script>
    // v1.0.0 dashboard behavior
    async function loadMetrics() { ... }
    setInterval(loadMetrics, 30000);
  </script>
</body>
</html>
```

### ❌ INCORRECT: Template-specific CSS in /assets/

```
# DON'T DO THIS
/assets/styles/dashboard-v1.css    ❌ Template-specific CSS
/assets/styles/dashboard-v2.css    ❌ Versioning in assets/
/assets/scripts/dashboard-v1.js    ❌ Template-specific JS

# Instead, inline in template
templates/html/dashboard.html@v1.0.0   ✅ All CSS/JS inline
templates/html/dashboard.html@v2.0.0   ✅ All CSS/JS inline
```

## FAQ

### Q: Why not version assets with Edgit?

**A**: Simplicity. Two systems (R2 for static, Edgit for templates) is clearer than three systems (R2, Edgit for templates, Edgit for assets). Plus, inline styles/scripts give you atomic template versioning.

### Q: What if my inline CSS/JS is too large?

**A**:
1. First, minify it
2. If still too large (>50KB), consider:
   - Splitting into multiple templates
   - Using a CDN for third-party libraries
   - Moving truly shared code to `/assets/` (if it's used by ALL templates)

### Q: Can I use a CSS framework like Tailwind?

**A**: Yes! Put the Tailwind CDN or minified build in `/assets/styles/tailwind.css`, then use utility classes in your templates.

### Q: How do I update a template's styles?

**A**:
1. Edit the template file (update inline `<style>` block)
2. Tag new version: `edgit tag create dashboard v1.1.0`
3. Deploy: `edgit deploy set dashboard v1.1.0 --to production`
4. Template and styles update atomically!

## Next Steps

1. Add your static assets to `/assets/`
2. Create templates with inline styles/scripts
3. Version templates with Edgit
4. Deploy (assets to R2, templates to KV)
5. Access assets at `https://your-worker.dev/assets/*`

---

**Remember**: If it's shared and static → `/assets/`. If it's template-specific → inline in template.
