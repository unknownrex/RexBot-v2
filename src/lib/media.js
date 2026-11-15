import { getContentType, downloadMediaMessage } from '@whiskeysockets/baileys'
import { fileTypeFromBuffer } from 'file-type'
import logger from '../logger.js'
import { CONFIG } from '../config.js'

export const MEDIA_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'stickerMessage',
  'documentMessage',
])

export function isMediaType(type) {
  return MEDIA_TYPES.has(type)
}

export function getMessageType(msg) {
  if (!msg?.message) return null
  return getContentType(msg.message)
}

export function extractText(msg) {
  const content = msg?.message
  if (!content) return ''
  const type = getContentType(content)
  if (!type) return ''
  const m = content[type]
  switch (type) {
    case 'conversation':
      return m || ''
    case 'extendedTextMessage':
      return m?.text || ''
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
      return m?.caption || ''
    default:
      return ''
  }
}

export function getContextInfo(msg) {
  const type = getMessageType(msg)
  if (!type) return {}
  return msg.message[type]?.contextInfo || {}
}

export const wrapQuoted = (key, message) => ({ key, message })

// The media URL comes from the message proto, which the sender controls, so
// without this check a crafted message makes the VPS fetch any host it can
// reach (localhost, cloud metadata, internal services).
const MEDIA_HOST = /(^|\.)whatsapp\.net$/

function assertMediaHost(msg, type) {
  const content = msg?.message?.[type]
  const url = content?.url
  if (!url) return
  let host
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('media has an invalid URL')
  }
  if (!MEDIA_HOST.test(host)) throw new Error('media host is not allowed')
}

// Streamed rather than buffered so an oversized file is rejected while it is
// still arriving instead of after the whole thing sits in memory.
export async function downloadMedia(sock, msg, type = getMessageType(msg)) {
  if (!type || !isMediaType(type)) return null
  assertMediaHost(msg, type)

  const stream = await downloadMediaMessage(msg, 'stream', {}, { logger })
  const chunks = []
  let total = 0
  try {
    for await (const chunk of stream) {
      total += chunk.length
      if (total > CONFIG.maxMediaBytes) {
        throw new Error(`media file is too large (max ${CONFIG.maxMediaBytes / 1024 / 1024} MB)`)
      }
      chunks.push(chunk)
    }
  } finally {
    stream.destroy?.()
  }

  const buffer = Buffer.concat(chunks)
  const ft = await fileTypeFromBuffer(buffer)
  return { buffer, mime: ft?.mime, ext: ft?.ext }
}