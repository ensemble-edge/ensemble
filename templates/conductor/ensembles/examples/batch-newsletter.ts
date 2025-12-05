/**
 * Batch Newsletter - TypeScript Ensemble
 *
 * Send batch newsletters with personalized content for each recipient.
 *
 * Key TypeScript advantages demonstrated:
 * - beforeExecute hook for validation and recipient fetching
 * - Dynamic recipient list from database
 * - foreach primitive for batch processing
 * - Type-safe email configuration
 *
 * The TypeScript version can dynamically fetch recipients from D1/KV
 * instead of hardcoding them in the workflow!
 */

import {
  createEnsemble,
  step,
  foreach,
  type Context,
  type FlowStepType,
} from '@ensemble-edge/conductor'

/**
 * Input schema for newsletter
 */
interface NewsletterInput {
  subject?: string
  currentMonth?: string
  template?: string
  fetch_recipients_from_db?: boolean
  recipients?: Array<{
    email: string
    data: {
      name: string
      lastArticle?: string
      [key: string]: unknown
    }
  }>
}

/**
 * Common data shared across all recipients
 */
interface CommonData {
  companyName: string
  unsubscribeUrl: string
  currentMonth: string
  [key: string]: unknown
}

export default createEnsemble({
  name: 'batch-newsletter',
  description: `Send batch newsletters with personalized content for each recipient.
Demonstrates:
- Batch email sending with rate limiting
- Personalized data per recipient
- Template rendering with common and per-recipient data
- Error handling for failed sends
- Dynamic recipient fetching from database (TypeScript feature)`,

  // ===========================================================================
  // Steps - Can use foreach for more control, or single batch email step
  // ===========================================================================
  steps: (context: Context): FlowStepType[] => {
    const input = context.input as NewsletterInput

    // Option 1: Fetch recipients from database first
    if (input.fetch_recipients_from_db) {
      return [
        // Fetch active subscribers from D1
        step('fetch-subscribers', {
          operation: 'data',
          config: {
            binding: 'DB',
            type: 'd1',
            query: `
              SELECT email, name, preferences, last_article_read
              FROM subscribers
              WHERE subscribed = 1 AND email_verified = 1
              ORDER BY created_at DESC
              LIMIT 1000
            `,
          },
        }),

        // Transform DB results to recipient format
        step('prepare-recipients', {
          operation: 'code',
          config: {
            handler: (ctx: any) => {
              const subscribers = ctx.input.subscribers || []
              return {
                recipients: subscribers.map((sub: any) => ({
                  email: sub.email,
                  data: {
                    name: sub.name,
                    lastArticle: sub.last_article_read || 'Getting Started',
                    preferences: sub.preferences,
                  },
                })),
              }
            },
          },
          input: {
            subscribers: '${fetch-subscribers.output.results}',
          },
        }),

        // Send batch emails with prepared recipients
        step('send-newsletter', {
          operation: 'email',
          config: {
            provider: {
              provider: 'resend',
              resend: {
                apiKey: '${env.RESEND_API_KEY}',
              },
              from: 'newsletter@example.com',
              fromName: 'Your Newsletter',
            },
            rateLimit: 5, // 5 emails per second
            tracking: true,
          },
          input: {
            recipients: '${prepare-recipients.output.recipients}',
            template: '${input.template || "templates/email/newsletter@v1.0.0"}',
            subject: '${input.subject || "Your Weekly Newsletter"}',
            commonData: {
              companyName: 'Your Company',
              unsubscribeUrl: 'https://example.com/unsubscribe',
              currentMonth: '${input.currentMonth}',
            },
          },
        }),
      ]
    }

    // Option 2: Use recipients from input directly (simpler flow)
    return [
      step('send-newsletter', {
        operation: 'email',
        config: {
          provider: {
            provider: 'resend',
            resend: {
              apiKey: '${env.RESEND_API_KEY}',
            },
            from: 'newsletter@example.com',
            fromName: 'Your Newsletter',
          },
          rateLimit: 5, // 5 emails per second
          tracking: true,
        },
        input: {
          recipients: '${input.recipients}',
          template: '${input.template || "templates/email/newsletter@v1.0.0"}',
          subject: '${input.subject || "Your Weekly Newsletter"}',
          commonData: {
            companyName: 'Your Company',
            unsubscribeUrl: 'https://example.com/unsubscribe',
            currentMonth: '${input.currentMonth}',
          },
        },
      }),
    ]
  },

  // ===========================================================================
  // TypeScript-only: beforeExecute hook for validation
  // ===========================================================================
  beforeExecute: async (context: Context) => {
    const input = context.input as NewsletterInput
    const env = context.env as Record<string, string>

    // Validate email provider is configured
    if (!env.RESEND_API_KEY) {
      throw new Error(
        'RESEND_API_KEY is required. Set it in your environment variables.'
      )
    }

    // Validate we have recipients (unless fetching from DB)
    if (!input.fetch_recipients_from_db) {
      if (!input.recipients || input.recipients.length === 0) {
        throw new Error(
          'Recipients list is required when not fetching from database'
        )
      }

      // Validate recipient email formats
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      const invalidEmails = input.recipients.filter(
        (r) => !emailRegex.test(r.email)
      )
      if (invalidEmails.length > 0) {
        throw new Error(
          `Invalid email addresses: ${invalidEmails.map((r) => r.email).join(', ')}`
        )
      }
    }

    console.log('[batch-newsletter] Starting newsletter send')
    console.log('[batch-newsletter] Subject:', input.subject || 'Your Weekly Newsletter')
    console.log(
      '[batch-newsletter] Recipients:',
      input.fetch_recipients_from_db
        ? 'Fetching from database'
        : `${input.recipients?.length || 0} provided`
    )
  },

  inputs: {
    subject: 'Your Weekly Newsletter',
    currentMonth: '',
    template: 'templates/email/newsletter@v1.0.0',
    fetch_recipients_from_db: false,
    recipients: [
      {
        email: 'user1@example.com',
        data: {
          name: 'Alice',
          lastArticle: '10 Tips for Productivity',
        },
      },
      {
        email: 'user2@example.com',
        data: {
          name: 'Bob',
          lastArticle: 'Getting Started with AI',
        },
      },
      {
        email: 'user3@example.com',
        data: {
          name: 'Charlie',
          lastArticle: 'Modern Web Development',
        },
      },
    ],
  },

  output: {
    sent: '${send-newsletter.output.sent}',
    failed: '${send-newsletter.output.failed}',
    messageIds: '${send-newsletter.output.messageIds}',
    errors: '${send-newsletter.output.errors}',
  },
})
