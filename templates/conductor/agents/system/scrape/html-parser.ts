/**
 * HTML Parser
 *
 * Simple HTML parsing and text extraction for Tier 3 fallback.
 */

/**
 * Extract text content from HTML
 */
export function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ')

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ')
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ')
  text = text.trim()

  return text
}

/**
 * Extract title from HTML
 */
export function extractTitleFromHTML(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].trim()
  }
  return ''
}

/**
 * Convert HTML to simple markdown
 */
export function convertHTMLToMarkdown(html: string): string {
  let markdown = html

  // Extract title
  const title = extractTitleFromHTML(html)

  // Remove script and style tags
  markdown = markdown.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  markdown = markdown.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Convert headings
  markdown = markdown.replace(/<h1[^>]*>([^<]+)<\/h1>/gi, '\n# $1\n')
  markdown = markdown.replace(/<h2[^>]*>([^<]+)<\/h2>/gi, '\n## $1\n')
  markdown = markdown.replace(/<h3[^>]*>([^<]+)<\/h3>/gi, '\n### $1\n')
  markdown = markdown.replace(/<h4[^>]*>([^<]+)<\/h4>/gi, '\n#### $1\n')
  markdown = markdown.replace(/<h5[^>]*>([^<]+)<\/h5>/gi, '\n##### $1\n')
  markdown = markdown.replace(/<h6[^>]*>([^<]+)<\/h6>/gi, '\n###### $1\n')

  // Convert links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/gi, '[$2]($1)')

  // Convert bold/strong
  markdown = markdown.replace(/<(strong|b)[^>]*>([^<]+)<\/(strong|b)>/gi, '**$2**')

  // Convert italic/em
  markdown = markdown.replace(/<(em|i)[^>]*>([^<]+)<\/(em|i)>/gi, '*$2*')

  // Convert lists
  markdown = markdown.replace(/<li[^>]*>([^<]+)<\/li>/gi, '- $1\n')

  // Convert paragraphs
  markdown = markdown.replace(/<p[^>]*>([^<]+)<\/p>/gi, '\n$1\n')

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  markdown = markdown.replace(/&nbsp;/g, ' ')
  markdown = markdown.replace(/&amp;/g, '&')
  markdown = markdown.replace(/&lt;/g, '<')
  markdown = markdown.replace(/&gt;/g, '>')
  markdown = markdown.replace(/&quot;/g, '"')
  markdown = markdown.replace(/&#39;/g, "'")

  // Clean up whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n')
  markdown = markdown.replace(/[ \t]+/g, ' ')
  markdown = markdown.trim()

  // Prepend title if found
  if (title) {
    markdown = `# ${title}\n\n${markdown}`
  }

  return markdown
}
