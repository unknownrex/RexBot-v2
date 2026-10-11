import { downloadMedia, isMediaType } from '../lib/media.js'
import { sendError, sendImage, sendSticker } from '../lib/reply.js'
import { toImage, toSticker } from '../lib/sticker.js'

async function resolveMedia(ctx) {
  if (isMediaType(ctx.type)) return { msg: ctx.msg, type: ctx.type }
  if (ctx.quoted && isMediaType(ctx.quoted.type)) return { msg: ctx.quoted.msg, type: ctx.quoted.type }
  return null
}

export const stickerCommands = [
  {
    name: 's',
    aliases: ['sticker'],
    usage: '.s',
    description: 'Convert an image, GIF, or video into a sticker (send media with this caption or reply to media).',
    async exec(ctx) {
      const media = await resolveMedia(ctx)
      if (!media) {
        await sendError(ctx.sock, ctx.jid, 'Send or reply to an image/GIF/video with `.s` (or `.sticker`).', ctx.msg)
        return
      }
      if (media.type === 'stickerMessage') {
        await sendError(ctx.sock, ctx.jid, 'That is already a sticker. Use `.toimg` to convert it back to an image.', ctx.msg)
        return
      }
      try {
        const { buffer } = await downloadMedia(ctx.sock, media.msg, media.type)
        const sticker = await toSticker(buffer)
        await sendSticker(ctx.sock, ctx.jid, sticker.buffer, ctx.msg)
      } catch (err) {
        await sendError(ctx.sock, ctx.jid, err.message, ctx.msg)
      }
    },
  },
  {
    name: 'toimg',
    aliases: ['img'],
    usage: '.toimg',
    description: 'Convert a sticker into an image (reply to a sticker).',
    async exec(ctx) {
      if (!ctx.quoted || ctx.quoted.type !== 'stickerMessage') {
        await sendError(ctx.sock, ctx.jid, 'Reply to a sticker with `.toimg` to convert it into an image.', ctx.msg)
        return
      }
      try {
        const { buffer } = await downloadMedia(ctx.sock, ctx.quoted.msg, ctx.quoted.type)
        const image = await toImage(buffer)
        await sendImage(ctx.sock, ctx.jid, image.buffer, image.mime === 'image/gif' ? 'Animated sticker' : '', ctx.msg)
      } catch (err) {
        await sendError(ctx.sock, ctx.jid, err.message, ctx.msg)
      }
    },
  },
]