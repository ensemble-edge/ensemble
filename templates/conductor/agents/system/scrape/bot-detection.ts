/**
 * Bot Protection Detection
 *
 * Detects common bot protection mechanisms like Cloudflare, Captcha, etc.
 */

interface BotProtectionResult {
  detected: boolean
  reasons: string[]
}

const BOT_PROTECTION_KEYWORDS = [
  'cloudflare',
  'just a moment',
  'checking your browser',
  'please wait',
  'access denied',
  'captcha',
  'recaptcha',
  'challenge',
  'verify you are human',
  'attention required',
  'enable javascript',
  'blocked',
]

const MIN_CONTENT_LENGTH = 800

/**
 * Detect if content contains bot protection
 */
export function detectBotProtection(content: string): BotProtectionResult {
  const reasons: string[] = []
  const lowercaseContent = content.toLowerCase()

  // Check length
  if (content.length < MIN_CONTENT_LENGTH) {
    reasons.push(`Content too short (${content.length} < ${MIN_CONTENT_LENGTH})`)
  }

  // Check for bot protection keywords
  for (const keyword of BOT_PROTECTION_KEYWORDS) {
    if (lowercaseContent.includes(keyword)) {
      reasons.push(`Contains bot protection keyword: "${keyword}"`)
    }
  }

  return {
    detected: reasons.length > 0,
    reasons,
  }
}

/**
 * Check if content is successful (no bot protection, sufficient length)
 */
export function isContentSuccessful(content: string): boolean {
  const result = detectBotProtection(content)
  return !result.detected
}
