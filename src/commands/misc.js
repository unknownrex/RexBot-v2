import { sendText } from '../lib/reply.js'

export const miscCommands = [
  {
    name: 'ping',
    category: 'misc',
    icon: '🏓',
    usage: '.ping',
    description: 'Check if the bot is online.',
    exec: (ctx) => sendText(ctx, `pong · ${new Date().toISOString()}`),
  },
]