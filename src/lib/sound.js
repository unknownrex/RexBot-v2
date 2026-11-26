import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { generateWAMessageFromContent, prepareWAMessageMedia, proto } from '@whiskeysockets/baileys'
import { parseBuffer } from 'music-metadata'
import { CONFIG } from '../config.js'
import { runFfmpeg } from './ffmpeg.js'

export const SOUND_MIME = 'audio/ogg; codecs=opus'

// ponytail: StickerMessage field 26 (audioMessage) is reverse-engineered. Clients that
// ignore it fall back to a normal sticker, so nothing breaks if Meta changes it, but the
// audio silently disappears. Delete this file to revert to plain stickers.
let patched = false

export function patchSoundSticker() {
  if (patched) return
  patched = true
  const Sticker = proto.Message.StickerMessage
  const Audio = proto.Message.AudioMessage
  if (!Object.hasOwn(Sticker.prototype, 'audioMessage')) Sticker.prototype.audioMessage = null
  const encode = Sticker.encode
  Sticker.encode = function (m, w) {
    w = encode.call(this, m, w)
    if (m?.audioMessage != null) {
      w.uint32(210).fork()
      Audio.encode(m.audioMessage, w)
      w.ldelim()
    }
    return w
  }
}

// Written to a temp file, not a pipe: Ogg needs a seekable output to finalize its
// last page, and a truncated last page cuts the clip short.
export async function toOpus(buf, maxSeconds = CONFIG.soundMaxSeconds) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rexbot-sound-'))
  const input = path.join(dir, 'in')
  const output = path.join(dir, 'out.ogg')
  await writeFile(input, buf)
  try {
    await runFfmpeg([
      '-y',
      '-i',
      input,
      '-vn',
      '-t',
      String(maxSeconds),
      '-ac',
      '1',
      '-ar',
      '48000',
      '-c:a',
      'libopus',
      '-b:a',
      '64k',
      output,
    ])
    const ogg = await readFile(output)
    const { format } = await parseBuffer(ogg, { mimeType: 'audio/ogg' })
    return { buffer: ogg, seconds: Math.max(1, Math.round(format.duration || 1)) }
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

// Video often carries its own audio, so `.ss` on a sound video needs no extra
// attachment. Returns null when the file has no audio track at all.
export async function audioFromVideo(buf, maxSeconds) {
  try {
    return await toOpus(buf, maxSeconds)
  } catch (err) {
    if (/does not contain any stream|Output file is empty/.test(err.message)) return null
    throw err
  }
}

export async function sendSoundSticker(sock, jid, { sticker, audio, seconds, quoted }) {
  patchSoundSticker()
  const opts = { upload: sock.waUploadToServer }
  const [stickerMedia, audioMedia] = await Promise.all([
    prepareWAMessageMedia({ sticker }, opts),
    prepareWAMessageMedia({ audio, mimetype: SOUND_MIME, seconds, ptt: false }, opts),
  ])
  stickerMedia.stickerMessage.audioMessage = audioMedia.audioMessage
  const full = generateWAMessageFromContent(jid, stickerMedia, {
    userJid: sock.user.id,
    timestamp: new Date(),
    quoted,
  })
  await sock.relayMessage(jid, full.message, { messageId: full.key.id })
}
