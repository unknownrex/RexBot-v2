import { sendText } from '../lib/reply.js'

export const groupCommands = [
  {
    name: 'ginfo',
    groupOnly: true,
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
        '*Group info*',
        `📛 Name: ${metadata.subject}`,
        `🆔 ID: ${ctx.jid.split('@')[0]}`,
        `👥 Members: ${participants.length}`,
        `🛡 Admins: ${admins.length}`,
        `🔑 Your role: ${role}`,
        metadata.desc ? `📝 Description: ${metadata.desc}` : null,
      ].filter(Boolean)
      await sendText(ctx.sock, ctx.jid, lines.join('\n'), ctx.msg)
    },
  },
]