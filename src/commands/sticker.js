import { CONFIG } from '../config.js'
import logger from '../logger.js'
import { withConversionSlot } from '../lib/limiter.js'
import { downloadMedia, isAudioType, isMediaType } from '../lib/media.js'
import { sendError, sendImage, sendSticker } from '../lib/reply.js'
import { audioFromVideo, sendSoundSticker, toOpus } from '../lib/sound.js'
import { toImage, toSticker, webpDuration } from '../lib/sticker.js'

async function resolveMedia(ctx) {
  if (isMediaType(ctx.type)) return { msg: ctx.msg, type: ctx.type }
  if (ctx.quoted && isMediaType(ctx.quoted.type)) return { msg: ctx.quoted.msg, type: ctx.quoted.type }
  return null
}

// Image comes from the message itself; the audio can come from the reply or, for
// video, from the clip's own track. An explicit reply always wins.
const NO_SOURCE = 'Send or reply to media with `.ss`.'
const NO_AUDIO = 'Please reply to an audio message, or send a video that has sound.'

function resolveSoundSources(ctx) {
  const image = isMediaType(ctx.type) && ctx.type !== 'stickerMessage' ? { msg: ctx.msg, type: ctx.type } : null
  const reply = ctx.quoted && isAudioType(ctx.quoted.type) ? ctx.quoted.msg : null
  return { image, reply }
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
    name: 'ss',
    aliases: ['soundsticker'],
    category: 'sticker',
    icon: '🔊',
    noCooldown: true,
    usage: '.ss',
    description: 'Make a sticker that plays sound: send a video with audio, or send media and reply to an audio message.',
    async exec(ctx) {
      const { image, reply } = resolveSoundSources(ctx)
      if (!image) {
        await sendError(ctx, NO_SOURCE)
        return
      }
      try {
        const media = await downloadMedia(ctx.sock, image.msg, image.type)
        if (!media) throw new Error('media could not be read')
        // The sticker is built first so the audio can be trimmed to whatever
        // the size ladder actually produced; otherwise a 6s animation would
        // carry 10s of sound, or a clipped 3s fallback would not match.
        const sticker = await withConversionSlot(() => toSticker(media.buffer))
        // Round up so the clip is never cut mid-frame; the encoder trims anyway.
        const ms = await webpDuration(sticker.buffer)
        const stickerDuration = Math.max(1, Math.ceil(ms / 1000))
        // A static sticker has no timeline, so it keeps the full clip.
        const maxSeconds = sticker.animated ? Math.min(stickerDuration, CONFIG.soundMaxSeconds) : CONFIG.soundMaxSeconds
        const sound = await withConversionSlot(async () => {
          if (reply) {
            const audio = await downloadMedia(ctx.sock, reply, 'audioMessage')
            return toOpus(audio.buffer, maxSeconds)
          }
          if (image.type === 'videoMessage') return audioFromVideo(media.buffer, maxSeconds)
          return null
        })
        if (!sound) {
          await sendError(ctx, NO_AUDIO)
          return
        }
        await sendSoundSticker(ctx.sock, ctx.jid, {
          sticker: sticker.buffer,
          audio: sound.buffer,
          seconds: sound.seconds,
          quoted: ctx.msg,
        })
      } catch (err) {
        logger.warn({ err: err.message }, 'sound sticker failed')
        await sendError(ctx, err.message.startsWith('media ') ? err.message : 'Could not build that sound sticker.')
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