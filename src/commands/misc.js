import { sendText } from '../lib/reply.js'

export const miscCommands = [
  {
    name: 'ping',
    category: 'misc',
    icon: '🏓',
    usage: '.ping',
    description: 'Check if the bot is online.',
    async exec(ctx) {
      const started = Date.now()
      const key = await sendText(ctx, 'Pinging…')
      // Local dispatch latency, not network round-trip time to WhatsApp.
      await sendText(ctx, `*Latency*: ${Date.now() - started}ms`, key)
    },
  },
]