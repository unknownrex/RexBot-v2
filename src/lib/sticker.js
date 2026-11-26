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

// Spends quality first, then frame rate, then resolution, and only shortens the
// clip as a last resort. Duration last is deliberate: length is what the user
// asked for, and every other lever keeps the clip intact. The cap is WhatsApp's
// 500 KB animated limit, so anything over it arrives undownloadable.
async function fitAnimated(input, seconds) {
  const cap = CONFIG.animatedStickerMaxBytes
  const { stickerSize, fps } = CONFIG
  const steps = [
    ...[80, 60, 40, 25].map((quality) => ({ quality, fps, size: stickerSize, seconds })),
    ...[8, 6].map((f) => ({ quality: 60, fps: f, size: stickerSize, seconds })),
    ...[448, 384, 320, 256].map((size) => ({ quality: 60, fps: 6, size, seconds })),
    ...[50, 40].map((quality) => ({ quality, fps: 6, size: 256, seconds })),
    // Cut length only when 10s cannot fit at the smallest usable framing. Audio
    // is trimmed to the measured result, so sync holds at any cut.
    ...[8, 6, 4, 3, 2, 1].map((s) => ({ quality: 40, fps: 6, size: 256, seconds: Math.min(s, seconds) })),
  ]
  let out
  for (const step of steps) {
    out = await withPack(await encodeAnimated(input, step))
    // Checked after packing: the EXIF header adds a few hundred bytes.
    if (out.length <= cap) return out
  }
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