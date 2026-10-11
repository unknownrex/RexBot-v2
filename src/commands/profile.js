import { displayNameFor, resolvePnJid } from '../lib/jid.js'
import { sendError, sendImage, sendText } from '../lib/reply.js'

export const profileCommands = [
  {
    name: 'avatar',
    aliases: ['pp', 'profilepic'],
    usage: '.avatar @user',
    description: 'Fetch the profile picture of mentioned users (or yours).',
    async exec(ctx) {
      let targets = [...new Set(ctx.mentionedJids || [])]
      if (!targets.length && ctx.quoted?.sender) targets = [ctx.quoted.sender]
      if (!targets.length) targets = [ctx.sender]

      for (const target of targets) {
        try {
          const pnJid = await resolvePnJid(ctx.sock, ctx.jid, target)
          let url = null
          try {
            url = await ctx.sock.profilePictureUrl(pnJid, 'image')
          } catch {
            // fall through to preview
          }
          if (!url) {
            try {
              url = await ctx.sock.profilePictureUrl(pnJid, 'preview')
            } catch {
              // no picture at all
            }
          }
          if (!url) {
            await sendText(ctx.sock, ctx.jid, `No profile picture for ${displayNameFor(ctx.sock, target)}.`, ctx.msg)
            continue
          }
          const res = await fetch(url)
          if (!res.ok) throw new Error(`download failed (${res.status})`)
          const buffer = Buffer.from(await res.arrayBuffer())
          await sendImage(ctx.sock, ctx.jid, buffer, `Profile picture: ${displayNameFor(ctx.sock, target)}`, ctx.msg)
        } catch (err) {
          await sendError(ctx.sock, ctx.jid, `Could not fetch avatar: ${err.message}`, ctx.msg)
        }
      }
    },
  },
]