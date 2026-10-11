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
    const out = await encodeStatic(buf, quality, size)
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

async function gifToSticker(buf) {
  const cap = CONFIG.animatedStickerMaxBytes
  for (let quality = 72; quality >= 25; quality -= 18) {
    const out = await sharp(buf, { animated: true, limitInputPixels: 0 })
      .resize({ width: CONFIG.stickerSize, height: CONFIG.stickerSize, fit: 'inside' })
      .webp({ quality })
      .toBuffer()
    if (out.length <= cap) return out
  }
  return sharp(buf, { animated: true, limitInputPixels: 0 })
    .resize({ width: CONFIG.stickerSize, height: CONFIG.stickerSize, fit: 'inside' })
    .webp({ quality: 25 })
    .toBuffer()
}

async function videoToSticker(buf, ext) {
  const input = await writeTemp(ext)
  const output = await writeTemp('webp')
  const extra = []
  await writeFile(input, buf)
  try {
    await runFfmpeg([
      '-y',
      '-i',
      input,
      '-t',
      String(CONFIG.maxVideoSeconds),
      '-vf',
      `scale=${CONFIG.stickerSize}:${CONFIG.stickerSize}:force_original_aspect_ratio=decrease,fps=${CONFIG.fps},pad=${CONFIG.stickerSize}:${CONFIG.stickerSize}:(ow-iw)/2:(oh-ih)/2:color=#00000000,format=yuva420p`,
      '-loop',
      '0',
      '-an',
      '-c:v',
      'libwebp',
      '-quality',
      '80',
      output,
    ])
    return await readFile(output)
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
    await cleanup(input, output, ...extra)
  }
}

async function handleWebp(buf) {
  const info = await detectWebp(buf)
  if (info?.hasExif) return { buffer: buf, animated: info.animated }
  if (info?.animated) {
    return { buffer: await withPack(await gifToSticker(buf)), animated: true }
  }
  return { buffer: await withPack(await staticToSticker(buf)), animated: false }
}

export async function toSticker(inputBuffer) {
  const ft = await fileTypeFromBuffer(inputBuffer)
  const mime = ft?.mime || ''
  if (mime === 'image/webp') return handleWebp(inputBuffer)
  if (mime === 'image/gif') {
    return { buffer: await withPack(await gifToSticker(inputBuffer)), animated: true }
  }
  if (mime.startsWith('image/')) {
    return { buffer: await withPack(await staticToSticker(inputBuffer)), animated: false }
  }
  if (mime.startsWith('video/')) {
    const ext = ft?.ext || 'mp4'
    return { buffer: await withPack(await videoToSticker(inputBuffer, ext)), animated: true }
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