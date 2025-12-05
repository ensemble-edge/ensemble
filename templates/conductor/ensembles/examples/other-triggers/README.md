# Other Trigger Examples

Examples demonstrating custom trigger types provided by Conductor plugins.

## What Are Custom Triggers?

Conductor's plugin system allows third-party packages to register custom trigger types. This enables ensembles to respond to events beyond HTTP requests, such as:

- 📱 SMS messages (Twilio)
- 📧 Emails (SendGrid, Mailgun)
- 📅 Scheduled events (Cron)
- 🔔 Webhooks (GitHub, Stripe, etc.)
- 📨 Message queues (RabbitMQ, Kafka)
- 🎮 Discord commands
- 💬 Slack events

## Available Examples

### twilio-sms-bot.yaml - AI-Powered SMS Support Bot

An intelligent SMS bot that demonstrates how plugins can extend Conductor with custom trigger types.

**Features:**
- 📱 Custom `twilio-sms` trigger type (provided by `@conductor/twilio` plugin)
- 🤖 AI-powered intent classification
- 💬 Smart response generation
- 📏 SMS length handling (160 character limit)
- 🔐 Twilio authentication (AccountSID + AuthToken)
- 📞 Phone number filtering

**What it demonstrates:**
- Using plugin-provided trigger types
- Multi-agent AI workflows (classify → handle → format)
- Conditional agent execution based on intent
- External service integration (Twilio)

**How it works:**

1. **Trigger Registration**: The `@conductor/twilio` plugin registers the `twilio-sms` trigger type
2. **Incoming SMS**: When an SMS is received at your Twilio webhook, it triggers this ensemble
3. **Intent Classification**: AI classifies the intent (support, billing, general, feedback)
4. **Smart Handling**: Routes to appropriate handler based on intent
5. **Reply Formatting**: Formats response for SMS (max 160 chars)
6. **Auto-Reply**: Twilio plugin sends the reply back to the user

**Setup:**

1. Install the Twilio plugin:
```bash
npm install @conductor/twilio
```

2. Configure Twilio credentials in `.env`:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

3. Copy the example to your project:
```bash
cp catalog/cloud/cloudflare/templates/ensembles/examples/other-triggers/twilio-sms-bot.yaml \
   ensembles/sms-support.yaml
```

4. Deploy and configure Twilio webhook:
```bash
npm run deploy
```

Then set your Twilio webhook URL to: `https://your-worker.workers.dev/twilio/sms/support`

**Customization:**

```yaml
# Change the phone number filter
filter:
  to: ["+1234567890", "+0987654321"]

# Modify AI behavior
agents:
  - name: classify-intent
    config:
      systemPrompt: |
        Custom classification logic...

# Add more handlers
agents:
  - name: handle-billing
    when: $classify-intent.intent == 'billing'
```

## Creating Your Own Trigger Plugin

Want to create a trigger for your favorite service? Here's the structure:

```typescript
// Example: Discord bot trigger
import { PluginRegistry } from '@ensemble-edge/conductor'

export function registerDiscordTrigger() {
  const registry = PluginRegistry.getInstance()

  registry.register('discord:command', {
    async execute(operation, context) {
      // Your trigger logic
      // Listen for Discord commands
      // Execute ensemble when command is received
    }
  }, {
    name: 'discord:command',
    description: 'Respond to Discord slash commands',
    author: '@your-org/conductor-discord',
    contexts: ['all'],
    tags: ['discord', 'bot', 'messaging']
  })
}
```

Then use it in ensembles:

```yaml
name: discord-help-bot
trigger:
  - type: discord:command
    command: /help
    guildId: "your-guild-id"

agents:
  - name: generate-help
    operation: think
    # ... agent config
```

## Available Plugin Triggers

Here are some trigger plugins available in the Conductor ecosystem:

### Official Plugins

- **@conductor/twilio** - SMS and voice triggers
- **@conductor/sendgrid** - Email triggers
- **@conductor/stripe** - Webhook triggers for Stripe events
- **@conductor/github** - GitHub webhook triggers

### Community Plugins

- **@conductor/discord** - Discord bot commands and events
- **@conductor/slack** - Slack events and commands
- **@conductor/telegram** - Telegram bot messages

*(Note: Check npm for the latest available plugins)*

## Pattern: Multi-Trigger Ensembles

You can combine multiple trigger types in one ensemble:

```yaml
name: multi-channel-support
description: Handle support requests from multiple channels

trigger:
  # HTTP webhook
  - type: http
    path: /support/webhook
    methods: [POST]

  # SMS messages
  - type: twilio-sms
    path: /support/sms
    filter:
      to: ["+1234567890"]

  # Email
  - type: sendgrid:inbound
    path: /support/email
    from: support@example.com

agents:
  # Universal handler for all channels
  - name: classify-and-respond
    operation: think
    # ... shared logic
```

## Best Practices

1. **Authentication**: Always authenticate external triggers
   ```yaml
   auth:
     accountSid: $env.TWILIO_ACCOUNT_SID
     authToken: $env.TWILIO_AUTH_TOKEN
   ```

2. **Filtering**: Use filters to only process relevant events
   ```yaml
   filter:
     to: ["+1234567890"]  # Only your support number
   ```

3. **Error Handling**: Always handle failures gracefully
   ```yaml
   agents:
     - name: send-error-notification
       when: $previous-agent.success == false
   ```

4. **Rate Limiting**: Implement rate limiting for public triggers
   ```yaml
   agents:
     - name: check-rate-limit
       operation: code
       config:
         script: scripts/utils/check-rate-limit
   ```

   ```typescript
   // scripts/utils/check-rate-limit.ts
   import type { AgentExecutionContext } from '@ensemble-edge/conductor'

   export default async function checkRateLimit(context: AgentExecutionContext) {
     const { env, input } = context
     const key = `rate:${input.clientId}`
     const count = parseInt(await env.KV?.get(key) || '0')

     if (count > 100) {
       return { allowed: false, reason: 'Rate limit exceeded' }
     }

     await env.KV?.put(key, String(count + 1), { expirationTtl: 3600 })
     return { allowed: true, remaining: 100 - count }
   }
   ```

5. **Logging**: Log all trigger activations for debugging
   ```yaml
   agents:
     - name: log-trigger
       operation: code
       config:
         script: scripts/utils/log-trigger
   ```

   ```typescript
   // scripts/utils/log-trigger.ts
   import type { AgentExecutionContext } from '@ensemble-edge/conductor'

   export default async function logTrigger(context: AgentExecutionContext) {
     const { env, input, logger } = context

     const logEntry = {
       timestamp: new Date().toISOString(),
       trigger: input.triggerType,
       path: input.path,
       method: input.method,
     }

     logger?.info('[Trigger]', logEntry)

     // Store in KV for analytics
     if (env.KV) {
       const key = `trigger:${Date.now()}`
       await env.KV.put(key, JSON.stringify(logEntry), { expirationTtl: 86400 })
     }

     return { logged: true }
   }
   ```

## Learn More

- **Plugin Development Guide**: https://docs.ensemble.ai/conductor/plugins/creating-plugins
- **Trigger System**: https://docs.ensemble.ai/conductor/core-concepts/triggers
- **Available Plugins**: https://docs.ensemble.ai/conductor/plugins/catalog

## Support

- **Documentation**: https://docs.ensemble.ai
- **GitHub Issues**: https://github.com/anthropics/conductor/issues
- **Plugin Marketplace**: https://docs.ensemble.ai/conductor/plugins
