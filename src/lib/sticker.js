import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import WebP from 'node-webpmux'
import { fileTypeFromBuffer } from 'file-type'
import { CONFIG } from '../config.js'
import logger from '../logger.js'
import { runFfmpeg } from './ffmpeg.js'
import { embedPackMetadata } from './exif.js'

const tempDir = path.resolve(CONFIG.tempDir)

async function ensureTemp() {
  await mkdir(tempDir, { recursive: true })
}

async function writeTemp(ext) {
  await ensureTemp()
  return path.join(tempDir, `media-${randomBytes(6).toString('hex')}.${ext}`)
}

async function cleanup(...files) {
  for (const f of files) {
    if (f) unlink(f).catch(() => {})
  }
}

async function withPack(webpBuffer) {
  try {
    return await embedPackMetadata(webpBuffer)
  } catch (err) {
    logger.warn({ err: err.message }, 'failed to embed pack metadata')
    return webpBuffer
  }
}

async function detectWebp(buf) {
  try {
    const img = new WebP.Image()
    await img.load(buf)
    return { animated: !!img.anim, hasExif: !!img.exif }
  } catch {
    return null
  }
}

function encodeStatic(buf, quality, size) {
  return sharp(buf)
    .resize({
      width: size,
      height: size,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality })
    .toBuffer()
}

async function staticToSticker(buf) {
  let quality = 80
  let size = CONFIG.stickerSize
  const cap = CONFIG.staticStickerMaxBytes
  for (;;) {
    // Checked after packing: the EXIF header adds a few hundred bytes.
    const out = await withPack(await encodeStatic(buf, quality, size))
    if (out.length <= cap) return out
    if (quality > 20) {
      quality -= 15
      continue
    }
    if (size > 200) {
      size -= 100
      quality = 65
      continue
    }
    return out
  }
}

// One encode attempt at a given quality/fps/size. Both animated sources share
// this so the size ladder is written once.
async function encodeAnimated(input, { quality, fps, size, seconds }) {
  const output = await writeTemp('webp')
  try {
    await runFfmpeg([
      '-y',
      '-i',
      input,
      '-t',
      String(seconds),
      '-vf',
      `scale=${size}:${size}:force_original_aspect_ratio=decrease,fps=${fps},pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=#00000000,format=yuva420p`,
      '-loop',
      '0',
      '-an',
      '-c:v',
      'libwebp',
      '-quality',
      String(quality),
      output,
    ])
    return await readFile(output)
  } finally {
    await cleanup(output)
  }
}

// Only compresses when the natural encode overflows the cap: the first attempt
// is the source's own quality at full 11fps, so ordinary clips ship after one
// ffmpeg pass. When it does overflow, pixels are spent before frames - measured
// on a 10s worst-case clip, 192px at 11fps fits in 353 KB while 256px at 8fps
// does not. Frame rate never drops below 10 and length goes last: choppier
// motion reads as worse than a softer clip, and a cut clip loses content.
async function fitAnimated(input, seconds) {
  const requestedSeconds = seconds
  seconds = Math.min(seconds, CONFIG.stickerMaxSeconds)
  const cap = CONFIG.animatedStickerMaxBytes
  const { stickerSize, fps } = CONFIG
  const steps = [
    ...[80, 60, 40, 25].map((quality) => ({ quality, fps, size: stickerSize, seconds })),
    ...[448, 384, 320, 256, 192].map((size) => ({ quality: 60, fps, size, seconds })),
    // Quality slack below 60 at 192px, where a dense clip still had ~100 KB spare.
    ...[40, 30, 25].map((quality) => ({ quality, fps, size: 192, seconds })),
    // Smaller canvas before touching smoothness or length.
    ...[60, 40].map((quality) => ({ quality, fps, size: 160, seconds })),
    // The only fps drop allowed; everything else keeps motion intact.
    { quality: 30, fps: 10, size: 160, seconds },
    // Cut length only when the clip cannot fit anywhere else. Audio is trimmed
    // to the measured result, so sync holds at any cut.
    ...[9, 8, 6, 4, 3, 2, 1].map((s) => ({ quality: 30, fps: 10, size: 160, seconds: Math.min(s, seconds) })),
  ]
  const startedAt = Date.now()
  const kb = (n) => Math.round(n / 1024)
  let out
  for (const [i, step] of steps.entries()) {
    out = await withPack(await encodeAnimated(input, step))
    // Checked after packing: the EXIF header adds a few hundred bytes.
    const fits = out.length <= cap
    logger.debug(
      {
        step: `${i + 1}/${steps.length}`,
        quality: step.quality,
        fps: step.fps,
        size: step.size,
        seconds: step.seconds,
        kb: kb(out.length),
      },
      'sticker attempt',
    )
    if (fits) {
      // Report what was actually encoded, not what was requested: the source may
      // be shorter than the cap, and step.seconds is only the cap.
      const { pages = 1, delay = [] } = await sharp(out, { animated: true }).metadata()
      logger.info(
        {
          quality: step.quality,
          fps: step.fps,
          size: step.size,
          seconds: Number((delay.reduce((a, b) => a + b, 0) / 1000).toFixed(2)),
          frames: pages,
          kb: kb(out.length),
          step: `${i + 1}/${steps.length}`,
          requestedSeconds,
          ms: Date.now() - startedAt,
        },
        'sticker encoded',
      )
      return out
    }
  }
  // Every step overflowed; ship the smallest anyway so the user still gets a sticker.
  logger.warn(
    { kb: kb(out.length), capKb: kb(cap), ms: Date.now() - startedAt },
    'sticker overflowed every step, sending the smallest encode',
  )
  return out
}

// One 10s ceiling for every animated source, matching WhatsApp's limit.
async function gifToSticker(buf) {
  return fitAnimated(buf, CONFIG.maxVideoSeconds)
}

async function videoToSticker(buf, ext, seconds = CONFIG.maxVideoSeconds) {
  const input = await writeTemp(ext)
  const extra = []
  await writeFile(input, buf)
  try {
    return await fitAnimated(input, seconds)
  } catch (err) {
    logger.warn({ err: err.message }, 'video->webp failed, falling back to first frame')
    const frameFile = await writeTemp('png')
    extra.push(frameFile)
    await runFfmpeg([
      '-y',
      '-i',
      input,
      '-frames:v',
      '1',
      '-vf',
      `scale=${CONFIG.stickerSize}:${CONFIG.stickerSize}:force_original_aspect_ratio=decrease,pad=${CONFIG.stickerSize}:${CONFIG.stickerSize}:(ow-iw)/2:(oh-ih)/2:color=black`,
      '-c:v',
      'png',
      frameFile,
    ])
    const frame = await readFile(frameFile)
    return await staticToSticker(frame)
  } finally {
    await cleanup(input, ...extra)
  }
}

async function handleWebp(buf) {
  const info = await detectWebp(buf)
  if (info?.hasExif) return { buffer: buf, animated: info.animated }
  if (info?.animated) {
    return { buffer: await gifToSticker(buf), animated: true }
  }
  return { buffer: await staticToSticker(buf), animated: false }
}

// Summed frame delays, so callers can trim audio to whatever the size ladder
// actually produced instead of a fixed guess.
export async function webpDuration(buffer) {
  const { delay } = await sharp(buffer, { animated: true }).metadata()
  return (delay || []).reduce((sum, ms) => sum + ms, 0)
}

export async function toSticker(inputBuffer, { seconds = CONFIG.maxVideoSeconds } = {}) {
  const ft = await fileTypeFromBuffer(inputBuffer)
  const mime = ft?.mime || ''
  if (mime === 'image/webp') return handleWebp(inputBuffer)
  if (mime === 'image/gif') {
    return { buffer: await gifToSticker(inputBuffer), animated: true }
  }
  if (mime.startsWith('image/')) {
    return { buffer: await staticToSticker(inputBuffer), animated: false }
  }
  if (mime.startsWith('video/')) {
    const ext = ft?.ext || 'mp4'
    return { buffer: await videoToSticker(inputBuffer, ext, seconds), animated: true }
  }
  throw new Error(`unsupported media type: ${mime || 'unknown'}`)
}

export async function toImage(webpBuffer) {
  const metadata = await sharp(webpBuffer, { animated: true }).metadata()
  const animated = (metadata.pages || 1) > 1
  if (animated) {
    const gif = await sharp(webpBuffer, { animated: true, limitInputPixels: 0 })
      .resize({ width: CONFIG.stickerSize, height: CONFIG.stickerSize, fit: 'inside' })
      .gif()
      .toBuffer()
    return { buffer: gif, mime: 'image/gif', animated: true }
  }
  const png = await sharp(webpBuffer)
    .resize({ width: CONFIG.stickerSize, height: CONFIG.stickerSize, fit: 'inside' })
    .png()
    .toBuffer()
  return { buffer: png, mime: 'image/png', animated: false }
}