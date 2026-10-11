import { sendText } from '../lib/reply.js'

export const miscCommands = [
  {
    name: 'ping',
    usage: '.ping',
    description: 'Check if the bot is online.',
    exec: ({ sock, jid, msg }) => sendText(sock, jid, `pong 🏓 ${new Date().toISOString()}`, msg),
  },
]