import { displayNameFor, resolvePnJid } from '../lib/jid.js'
import { sendError, sendImage, sendWarn } from '../lib/reply.js'

const ME = 'me'

// Resolve who the command is about. Mentions win, then an explicit `me`,
// then the replied user.
// Returns:
//   { targets }  - a list of jids to fetch
//   { silent:true } - nothing was given; stay quiet rather than guess
//   { unknown:true } - an argument we do not recognise; point at usage
function resolveTargets(ctx) {
  const mentions = [...new Set(ctx.mentionedJids || [])]
  if (mentions.length) return { targets: mentions }
  if (ctx.args.some((a) => a.toLowerCase() === ME)) return { targets: [ctx.sender] }
  if (ctx.quoted?.sender) return { targets: [ctx.quoted.sender] }
  if (!ctx.args.length && !ctx.text.trim()) return { silent: true }
  return { unknown: true }
}

async function fetchAvatar(ctx, target, metadata) {
  const pnJid = await resolvePnJid(ctx.sock, ctx.jid, target, metadata)

  // The contact store may already hold the picture URL; if so we skip the
  // network round trip for it entirely.
  const cached = ctx.sock?.store?.contacts?.get?.(target)?.imgUrl
  if (cached && cached !== 'changed') return cached

  const url = await ctx.sock.profilePictureUrl(pnJid, 'image')
  if (url) return url
  return (await ctx.sock.profilePictureUrl(pnJid, 'preview')) || null
}

export const profileCommands = [
  {
    name: 'avatar',
    aliases: ['pp', 'profilepic'],
    category: 'profile',
    icon: '🖼️',
    usage: '.avatar [@user | me]',
    description: "Fetch a user's profile picture (mention someone, or use `me` for your own).",
    async exec(ctx) {
      const resolved = resolveTargets(ctx)
      // Bare `.avatar` with no target: stay silent rather than guess.
      if (resolved.silent) return null
      if (resolved.unknown) {
        await sendError(ctx, 'Mention someone, reply to them, or use `.avatar me` for your own.')
        return null
      }
      const targets = resolved.targets

      // One metadata fetch shared by every target, and only when we need it.
      let metadata = null
      try {
        metadata = await ctx.sock.groupMetadata(ctx.jid)
      } catch {
        // DM or lookup failed; name resolution falls back to the store
      }

      await Promise.all(
        targets.map(async (target) => {
          const name = displayNameFor(ctx.sock, target, null, metadata)
          try {
            const url = await fetchAvatar(ctx, target, metadata)
            if (!url) {
              // Baileys returns undefined for a private picture and for an
              // unset one identically, so we cannot tell them apart.
              await sendWarn(ctx, `Couldn't retrieve a picture for ${name} — it may be private or unset.`)
              return
            }
            const res = await fetch(url)
            if (!res.ok) throw new Error(`download failed (${res.status})`)
            const buffer = Buffer.from(await res.arrayBuffer())
            await sendImage(ctx, buffer, name)
          } catch (err) {
            await sendError(ctx, `Could not fetch avatar for ${name}: ${err.message}`)
          }
        }),
      )
      return null
    },
  },
]