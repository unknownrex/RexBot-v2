import { sendText } from '../lib/reply.js'

export const groupCommands = [
  {
    name: 'ginfo',
    groupOnly: true,
    category: 'group',
    icon: '🛡️',
    usage: '.ginfo',
    description: 'Show group information.',
    async exec(ctx) {
      const metadata = await ctx.sock.groupMetadata(ctx.jid)
      const participants = metadata.participants || []
      const admins = participants.filter((p) => p.admin)
      const me = participants.find(
        (p) =>
          p.id === ctx.sender ||
          p.pn === ctx.sender ||
          p.lid === ctx.sender ||
          `${p.phoneNumber}@s.whatsapp.net` === ctx.sender,
      )
      const role = me?.admin ? '👑 Admin' : '👤 Member'
      const lines = [
        `📛 *Name*: ${metadata.subject}`,
        `🆔 *ID*: ${ctx.jid.split('@')[0]}`,
        `👥 *Members*: ${participants.length}`,
        `🛡️ *Admins*: ${admins.length}`,
        `🔑 *Your role*: ${role}`,
        metadata.desc ? `📝 *Description*: ${metadata.desc}` : null,
      ].filter(Boolean)
      await sendText(ctx, lines.join('\n'))
    },
  },
]