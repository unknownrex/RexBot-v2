import logger from '../logger.js'
import { withConversionSlot } from '../lib/limiter.js'
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
    category: 'sticker',
    icon: '🎨',
    noCooldown: true,
    usage: '.s',
    description: 'Convert an image, GIF, or video into a sticker (send media with this caption or reply to media).',
    async exec(ctx) {
      const media = await resolveMedia(ctx)
      if (!media) {
        await sendError(ctx, 'Send or reply to an image/GIF/video with `.s` (or `.sticker`).')
        return
      }
      if (media.type === 'stickerMessage') {
        await sendError(ctx, 'That is already a sticker. Use `.toimg` to convert it back to an image.')
        return
      }
      try {
        const { buffer } = await downloadMedia(ctx.sock, media.msg, media.type)
        const sticker = await withConversionSlot(() => toSticker(buffer))
        await sendSticker(ctx, sticker.buffer)
      } catch (err) {
        logger.warn({ err: err.message }, 'sticker conversion failed')
        await sendError(ctx, err.message.startsWith('media ') ? err.message : 'Could not convert that media.')
      }
    },
  },
  {
    name: 'toimg',
    aliases: ['img'],
    category: 'sticker',
    icon: '🖼️',
    noCooldown: true,
    usage: '.toimg',
    description: 'Convert a sticker into an image (reply to a sticker).',
    async exec(ctx) {
      if (!ctx.quoted || ctx.quoted.type !== 'stickerMessage') {
        await sendError(ctx, 'Reply to a sticker with `.toimg` to convert it into an image.')
        return
      }
      try {
        const { buffer } = await downloadMedia(ctx.sock, ctx.quoted.msg, ctx.quoted.type)
        const image = await withConversionSlot(() => toImage(buffer))
        await sendImage(ctx, image.buffer, image.mime === 'image/gif' ? '*Animated sticker*' : '')
      } catch (err) {
        logger.warn({ err: err.message }, 'sticker conversion failed')
        await sendError(ctx, err.message.startsWith('media ') ? err.message : 'Could not convert that sticker.')
      }
    },
  },
]